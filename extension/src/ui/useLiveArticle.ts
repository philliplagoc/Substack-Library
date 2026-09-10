import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { articleKey, originPattern } from '../domain/url';

/**
 * Whether the article behind the shown card is open in a tab this extension is
 * allowed to read.
 *
 * Both halves of that sentence need the same permission. Without a host
 * permission matching the tab, `tabs.query` hands back a tab with no `url` at
 * all, so the extension cannot even tell that the article is open, let alone
 * read a selection out of it. `activeTab` does not help here: Chrome grants it
 * on a toolbar click, a context-menu item, or a keyboard command, and a click
 * inside the side panel is none of the three.
 *
 * So the answer is three-valued, not two. "Ask" is a state the reader can act
 * on, and it is the state a reader who followed a link to the article lands in.
 *
 * "Open" means the FOCUSED tab is showing the article, not merely that some tab
 * somewhere is. A quote is read out of the page the reader is looking at, so a
 * forgotten article tab in the background is not a capture target; offering one
 * would pull text out of a page the reader cannot see.
 */
export type LiveArticle =
  /** Still reading the permission or the tab list. */
  | { kind: 'checking' }
  /**
   * No permission for this publication yet. `pattern` is what to request.
   * @param activeTabId the focused tab, which is knowable without any host
   *   permission: `tabs.query` withholds `url` and `title` from an unpermitted
   *   tab but never its `id`.
   */
  | { kind: 'ask'; pattern: string; host: string; activeTabId: number | null }
  /** Permission held, and the focused tab in this window shows the article. */
  | { kind: 'open'; tabId: number }
  /** Nothing to capture from: the focused tab is not this article. */
  | { kind: 'closed'; activeTabId: number | null };

/**
 * @param url the shown card's URL, or null while there is no card.
 * @param key the shown card's `articleKey`. A tab counts as this article when
 *   its URL keys the same, so the publication's custom domain, its
 *   `*.substack.com` address, and the share route all match one card.
 */
export function useLiveArticle(url: string | null, key: string | null): LiveArticle {
  const [live, setLive] = useState<LiveArticle>({ kind: 'checking' });

  useEffect(() => {
    if (!url || !key) {
      setLive({ kind: 'checking' });
      return;
    }

    let alive = true;
    const origin = originPattern(url);

    async function look(): Promise<LiveArticle> {
      // The focused tab of this window. Asked for first and separately, because
      // it is the one fact that survives having no permission: an unpermitted
      // tab still reports its `id`, only its `url` is withheld. The capture
      // fallback for a toolbar click needs that id even in the 'ask' state.
      const [focused] = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTabId = focused?.id ?? null;

      // A card whose URL will not parse can never be matched against a tab and
      // has no origin to ask for. Nothing to capture from, and nothing to ask.
      if (!origin) return { kind: 'closed', activeTabId };

      if (!(await browser.permissions.contains({ origins: [origin.pattern] }))) {
        return { kind: 'ask', pattern: origin.pattern, host: origin.host, activeTabId };
      }

      // Only the focused tab is a candidate. A background tab showing the same
      // article is deliberately not a match: see the type's note above.
      const showing = focused?.url != null && articleKey(focused.url) === key;
      return showing && activeTabId != null
        ? { kind: 'open', tabId: activeTabId }
        : { kind: 'closed', activeTabId };
    }

    function refresh() {
      void look().then((next) => {
        if (alive) setLive(next);
      });
    }

    refresh();

    // A navigation reports as a `url` change once the address bar moves and
    // again as `status: 'complete'`. Either is worth a re-look, and re-looking
    // twice costs one `tabs.query`.
    const onUpdated = (_id: number, info: { url?: string; status?: string }) => {
      if (info.url != null || info.status === 'complete') refresh();
    };

    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(refresh);
    browser.tabs.onCreated.addListener(refresh);
    // Switching tabs changes the answer now that only the focused tab counts.
    // Without this the button would keep the previous tab's verdict.
    browser.tabs.onActivated.addListener(refresh);
    // The grant arrives from Chrome's own dialog, which this panel does not
    // control and cannot await past. Listening is how the button un-greys the
    // moment the reader says yes.
    browser.permissions.onAdded.addListener(refresh);
    browser.permissions.onRemoved.addListener(refresh);

    return () => {
      alive = false;
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(refresh);
      browser.tabs.onCreated.removeListener(refresh);
      browser.tabs.onActivated.removeListener(refresh);
      browser.permissions.onAdded.removeListener(refresh);
      browser.permissions.onRemoved.removeListener(refresh);
    };
  }, [url, key]);

  return live;
}
