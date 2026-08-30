// The toolbar action. On an article it captures, ingests, and opens the reading
// panel. On anything else it opens the board, or focuses the board tab it
// already opened.
import {
  canonicalizeUrl,
  isReaderRoute,
  publicationFromHost,
  resolveArticleUrl,
  shouldCaptureFrom,
} from '../domain/url';
import { readingMinutes } from '../domain/article';
import { ingestCard } from '../db/cards';
import { detectSignedOut, extractArticleMeta, readReaderArticle } from '../substack/extract';
import { PANEL_STATE_KEY, type PanelState } from '../messages';

export default defineBackground({
  main() {
    const BOARD_PATH = '/board.html';

    async function openBoard() {
      const { boardTabId } = await browser.storage.session.get('boardTabId');

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
        await browser.storage.session.set({ boardTabId: tab.id });
      }
    }

    async function reject(tabId: number, notice: string) {
      await browser.storage.session.set({
        [PANEL_STATE_KEY]: {
          articleKey: '',
          tabId,
          outcome: 'rejected',
          notices: [notice],
          bodyText: '',
        } satisfies PanelState,
      });
    }

    async function capture(tabId: number, tabUrl: string) {
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
        await reject(tabId, "Can't read this page.");
        return;
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
          await reject(
            tabId,
            "Couldn't tell which article this is. Open it on the publication's own page and click again.",
          );
          return;
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

      await browser.storage.session.set({
        [PANEL_STATE_KEY]: {
          articleKey: outcome.kind === 'rejected' ? '' : outcome.card.articleKey,
          tabId,
          outcome: outcome.kind,
          notices: outcome.kind === 'rejected' ? [outcome.reason] : notices,
          bodyText: meta.bodyText,
        } satisfies PanelState,
      });
    }

    browser.action.onClicked.addListener(async (tab) => {
      if (!shouldCaptureFrom(tab.url) || tab.id == null || !tab.url) {
        await openBoard();
        return;
      }

      // Open the panel FIRST. sidePanel.open() needs the user gesture, and the
      // gesture expires while the awaits below run.
      await browser.sidePanel.open({ tabId: tab.id });
      await capture(tab.id, tab.url);
    });
  },
});
