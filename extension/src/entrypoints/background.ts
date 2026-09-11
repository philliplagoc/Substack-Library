// The toolbar action. On an article it opens the reading panel and records the
// activeTab grant the click just handed over; adding the article is the
// reader's own call, made from the panel. On anything else it opens the board,
// or focuses the board tab it already opened.
import {
  articleKey as provisionalKey,
  canonicalizeUrl,
  isReaderRoute,
  publicationFromHost,
  resolveArticleUrl,
  shouldCaptureFrom,
} from '../domain/url';
import { readingMinutes } from '../domain/article';
import { ingestCard } from '../db/cards';
import {
  detectSignedOut,
  extractArticleMeta,
  readReaderArticle,
  readSelection,
} from '../substack/extract';
import { extractSavedEntries, scrollToEnd } from '../substack/saved';
import { applySync } from '../db/sync';
import {
  ACTIVE_TAB_GRANT_KEY,
  BOARD_TAB_KEY,
  READER_KEYS_KEY,
  type AddArticleReply,
  type ReaderKeys,
  type CaptureSelectionReply,
  type PanelMessage,
  type SyncSavedReply,
} from '../messages';

export default defineBackground({
  main() {
    const BOARD_PATH = '/board.html';

    async function openBoard() {
      const { [BOARD_TAB_KEY]: boardTabId } = await browser.storage.session.get(BOARD_TAB_KEY);

      if (typeof boardTabId === 'number') {
        try {
          const tab = await browser.tabs.update(boardTabId, { active: true });
          if (tab?.windowId != null) {
            await browser.windows.update(tab.windowId, { focused: true });
          }
          return;
        } catch {
          // The remembered tab is gone. Fall through and open a new one.
        }
      }

      const tab = await browser.tabs.create({ url: browser.runtime.getURL(BOARD_PATH) });
      if (tab.id != null) {
        await browser.storage.session.set({ [BOARD_TAB_KEY]: tab.id });
      }
    }

    // Not `/inbox/saved`. That is the older reader view and it holds a subset:
    // 20 entries against 47 on this route on 2026-08-31, on the same account
    // and the same day, and it held 60 when the fixture was captured on
    // 2026-08-25. The two routes do not redirect to each other and share no
    // DOM.
    const SAVED_URL = 'https://substack.com/saved';

    /** Resolve once the tab has finished loading, or reject rather than hang. */
    async function waitForComplete(tabId: number): Promise<void> {
      const tab = await browser.tabs.get(tabId);
      if (tab.status === 'complete') return;

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          browser.tabs.onUpdated.removeListener(listener);
          reject(new Error('The Saved list did not finish loading.'));
        }, 30_000);

        function listener(id: number, info: { status?: string }) {
          if (id !== tabId || info.status !== 'complete') return;
          clearTimeout(timer);
          browser.tabs.onUpdated.removeListener(listener);
          resolve();
        }

        browser.tabs.onUpdated.addListener(listener);
      });
    }

    /** The Saved tab, opened or reused and loaded. Visible on purpose. */
    async function openSavedTab(): Promise<number> {
      const { savedTabId } = await browser.storage.session.get('savedTabId');

      if (typeof savedTabId === 'number') {
        try {
          const tab = await browser.tabs.update(savedTabId, { active: true, url: SAVED_URL });
          if (tab?.id != null) {
            await waitForComplete(tab.id);
            return tab.id;
          }
        } catch {
          // The remembered tab is gone. Fall through and open a new one.
        }
      }

      const tab = await browser.tabs.create({ url: SAVED_URL, active: true });
      if (tab.id == null) throw new Error('Could not open the Saved list.');
      await browser.storage.session.set({ savedTabId: tab.id });
      await waitForComplete(tab.id);
      return tab.id;
    }

    /**
     * Read one tab and put the article on the board.
     *
     * Called from the panel now, not from the toolbar click, so it answers the
     * caller rather than writing what it did into session storage.
     */
    async function addArticle(tabId: number, tabUrl: string): Promise<AddArticleReply> {
      let meta: Awaited<ReturnType<typeof extractArticleMeta>> | undefined;
      let signedOut = false;

      try {
        const [metaResult, signedOutResult] = await Promise.all([
          browser.scripting.executeScript({ target: { tabId }, func: extractArticleMeta }),
          browser.scripting.executeScript({ target: { tabId }, func: detectSignedOut }),
        ]);
        meta = metaResult[0]?.result;
        signedOut = signedOutResult[0]?.result === true;
      } catch {
        // A chrome:// page, the PDF viewer, or the Web Store. Injection is
        // refused there and no amount of retrying changes it.
      }

      const notices: string[] = [];

      if (!meta) {
        return { ok: false, reason: "Can't read this page." };
      }

      // On the inbox reader route the head belongs to the app shell, so
      // meta.canonicalUrl is `https://substack.com/inbox` and meta.title is the
      // shell's. Read this article's own url and title out of the body instead.
      let reader: { url: string; title: string } | null = null;

      if (isReaderRoute(tabUrl)) {
        try {
          const [result] = await browser.scripting.executeScript({
            target: { tabId },
            func: readReaderArticle,
          });
          reader = result?.result ?? null;
        } catch {
          // Same refusal as above, and no more retryable.
        }

        // Without the article's own url there is no honest key for this card.
        // Keying on the inbox url would make a second card for an article the
        // board may already hold, so refuse and say why.
        if (!reader) {
          return {
            ok: false,
            reason:
              "Couldn't tell which article this is. Open it on the publication's own page and click again.",
          };
        }
      }

      // The reader result outranks everything: on that route it is the only
      // source describing this article. Off it, `resolveArticleUrl` weighs the
      // page's canonical link against the address bar, because a client-side
      // navigation can leave the previous page's canonical in the head.
      const url = reader?.url ?? resolveArticleUrl(tabUrl, meta.canonicalUrl);
      const title = reader?.title ?? meta.title;

      if (!title) {
        notices.push(
          "Couldn't read this page's details. Card created from the URL — edit the title below.",
        );
      }
      if (signedOut) {
        notices.push(
          "You're signed out of Substack. Notes and capture work; likes and saves won't.",
        );
      }
      if (!meta.readable) {
        notices.push('Preview only — reading time unavailable.');
      }

      // The host fallback lives here rather than in the extractor, because
      // `publicationFromHost` is domain/ code and substack/ imports nothing.
      const canonical = canonicalizeUrl(url);
      const publication =
        meta.publication ?? (canonical ? publicationFromHost(new URL(canonical).hostname) : '');

      const outcome = await ingestCard({
        url,
        title: title ?? undefined,
        author: meta.author ?? undefined,
        publication: publication || undefined,
        estimatedReadingMinutes: readingMinutes(meta.wordCount, meta.readable),
      });

      if (outcome.kind === 'rejected') return { ok: false, reason: outcome.reason };

      /*
       * Leave the answer where the panel can find it again.
       *
       * Only a reader-shell tab needs this. Anywhere else the address bar
       * names the article and `articleKey()` agrees with the stored card
       * already, so there is nothing to remember. Written before the reply so
       * a panel that re-reads on the resulting `storage.onChanged` cannot
       * beat the record it is reacting to.
       */
      if (reader) {
        const provisional = provisionalKey(tabUrl);
        if (provisional != null && provisional !== outcome.card.articleKey) {
          const stored = await browser.storage.session.get(READER_KEYS_KEY);
          const keys = (stored[READER_KEYS_KEY] as ReaderKeys | undefined) ?? {};
          await browser.storage.session.set({
            [READER_KEYS_KEY]: { ...keys, [provisional]: outcome.card.articleKey },
          });
        }
      }

      return {
        ok: true,
        outcome: outcome.kind,
        articleKey: outcome.card.articleKey,
        notices,
      };
    }

    async function syncSaved(): Promise<SyncSavedReply> {
      function why(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
      }

      let tabId: number;
      try {
        tabId = await openSavedTab();
      } catch (error) {
        return { ok: false, reason: why(error) };
      }

      try {
        // Checked BEFORE the entry count. A sign-in wall and a layout change
        // both parse to zero entries, and only the order tells them apart.
        const [signedOut] = await browser.scripting.executeScript({
          target: { tabId },
          func: detectSignedOut,
        });
        if (signedOut?.result === true) {
          return { ok: false, reason: 'Sign in to Substack, then sync again.' };
        }

        // Two injections, not one. The scroll is slow and retryable; the
        // extract is instant and pure. Fusing them would mean re-scrolling a
        // loaded list to retry a parse.
        const [scrolled] = await browser.scripting.executeScript({
          target: { tabId },
          func: scrollToEnd,
        });
        const complete = scrolled?.result?.complete === true;

        const [parsed] = await browser.scripting.executeScript({
          target: { tabId },
          func: extractSavedEntries,
        });
        const entries = parsed?.result ?? [];

        const report = await applySync(entries, new Date().toISOString(), complete);
        return { ok: true, report };
      } catch (error) {
        return { ok: false, reason: why(error) };
      }
    }

    /*
     * Forget the board tab the moment it closes.
     *
     * `openBoard` is tolerant of a stale id: it tries to focus the tab and
     * opens a new one when that throws. Removing the id keeps the common case
     * off that path, so opening the board after closing it costs one
     * `tabs.create` rather than a failed `tabs.update` first.
     */
    browser.tabs.onRemoved.addListener((tabId) => {
      void browser.storage.session.get(BOARD_TAB_KEY).then((stored) => {
        if (stored[BOARD_TAB_KEY] !== tabId) return;
        return browser.storage.session.remove(BOARD_TAB_KEY);
      });
    });

    browser.action.onClicked.addListener(async (tab) => {
      if (!shouldCaptureFrom(tab.url) || tab.id == null || !tab.url) {
        await openBoard();
        return;
      }

      // Open the panel FIRST. sidePanel.open() needs the user gesture, and the
      // gesture expires while the awaits below run.
      await browser.sidePanel.open({ tabId: tab.id });

      /*
       * Nothing is ingested here. The click opens the panel and records the
       * grant it just handed over; the reader decides whether this article
       * belongs on their board.
       *
       * Never cleared, on purpose, and the same risk `panel.tabId` already
       * carried: a stale id can leave Capture looking armed after the grant is
       * actually gone, and the try/catch around the selection read already
       * turns that into "Lost access to the article."
       */
      await browser.storage.session.set({ [ACTIVE_TAB_GRANT_KEY]: tab.id });
    });

    browser.runtime.onMessage.addListener((message: PanelMessage, _sender, sendResponse) => {
      // Returns false, not true: there is no reply to wait for, so the message
      // channel closes at once.
      if (message?.type === 'open-board') {
        void openBoard();
        return false;
      }

      if (message?.type === 'sync-saved') {
        void (async () => sendResponse(await syncSaved()))();
        return true;
      }

      if (message?.type === 'add-article') {
        void (async () => sendResponse(await addArticle(message.tabId, message.url)))();
        return true;
      }

      if (message?.type !== 'capture-selection') return false;

      void (async () => {
        // The panel classifies the focused tab itself, so it always names the
        // tab to read from and there is nothing to fall back to.
        const { tabId } = message;

        try {
          const results = await browser.scripting.executeScript({
            target: { tabId },
            func: readSelection,
          });
          const found = results[0]?.result;

          sendResponse(
            (found
              ? { ok: true, text: found }
              : {
                  ok: false,
                  reason: 'Select some text in the article first.',
                }) satisfies CaptureSelectionReply,
          );
        } catch {
          // The tab navigated away or was closed, and an `activeTab` grant
          // goes with it. Either way the article has to be opened again.
          sendResponse({
            ok: false,
            reason: 'Lost access to the article. Open it again, then capture.',
          });
        }
      })();

      // Keep the message channel open for the async sendResponse above.
      return true;
    });
  },
});
