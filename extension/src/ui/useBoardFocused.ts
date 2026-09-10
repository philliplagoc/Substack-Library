import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { BOARD_TAB_KEY } from '../messages';

/**
 * Whether a focused tab's address names the board page.
 *
 * `tabUrl` is a full tab address (`chrome-extension://<id>/board.html`), which
 * may carry a `#hash` or a `?query`, or `undefined`. Chrome withholds `url`
 * from `tabs.query` without the `"tabs"` permission, which this extension does
 * not hold, so `undefined` is the common case and the id check below is what
 * actually carries the answer; a URL match is a bonus when Chrome does hand one
 * over (a board tab restored on startup, never tracked by the background).
 */
function isBoardUrl(tabUrl: string | undefined, boardUrl: string): boolean {
  if (tabUrl == null) return false;
  // Drop a trailing `?query` or `#hash` so the board still counts when Chrome
  // reports its URL with one appended.
  const page = tabUrl.split(/[?#]/, 1)[0];
  return page === boardUrl;
}

/**
 * Whether the board is the focused tab of this window.
 *
 * The side panel's "Open the board" button opens or focuses the board tab. When
 * the board is already the tab in front of the reader, that button has nowhere
 * to go, so it should look spent rather than clickable — the same rule the
 * Capture button follows when there is no article to read a selection from.
 *
 * The board tab is identified by the id the background keeps in
 * `BOARD_TAB_KEY`, because `tabs.query` returns a tab's `id` even with no
 * permission but withholds its `url`. Scoped to match `useLiveArticle`: only
 * the focused tab of the current window counts, kept fresh by the same `tabs.*`
 * events, plus the storage key so opening or closing the board updates the
 * button with the panel already open. A switch to another window is
 * deliberately not listened for, so this button behaves exactly like Capture.
 */
export function useBoardFocused(): boolean {
  const [onBoard, setOnBoard] = useState(false);

  useEffect(() => {
    let alive = true;
    const boardUrl = browser.runtime.getURL('/board.html');

    async function look(): Promise<boolean> {
      const [focused] = await browser.tabs.query({ active: true, currentWindow: true });
      if (focused == null) return false;
      if (isBoardUrl(focused.url, boardUrl)) return true;

      const { [BOARD_TAB_KEY]: boardTabId } = await browser.storage.session.get(BOARD_TAB_KEY);
      return focused.id != null && focused.id === boardTabId;
    }

    function refresh() {
      void look().then((next) => {
        if (alive) setOnBoard(next);
      });
    }

    refresh();

    // A navigation into or out of the board in the same tab reports as a `url`
    // change and again as `status: 'complete'`; either is worth a re-look.
    const onUpdated = (_id: number, info: { url?: string; status?: string }) => {
      if (info.url != null || info.status === 'complete') refresh();
    };

    // The board opening or closing changes BOARD_TAB_KEY while this panel is
    // already up. `usePanelState` filters the generic listener the same way.
    const onStored = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area === 'session' && BOARD_TAB_KEY in changes) refresh();
    };

    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(refresh);
    browser.tabs.onCreated.addListener(refresh);
    // Switching tabs is the common case: it changes the answer with no reload.
    browser.tabs.onActivated.addListener(refresh);
    browser.storage.onChanged.addListener(onStored);

    return () => {
      alive = false;
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(refresh);
      browser.tabs.onCreated.removeListener(refresh);
      browser.tabs.onActivated.removeListener(refresh);
      browser.storage.onChanged.removeListener(onStored);
    };
  }, []);

  return onBoard;
}
