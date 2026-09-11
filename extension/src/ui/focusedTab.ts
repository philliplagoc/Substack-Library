/**
 * What the focused tab of this window is: the board, a capturable article, or
 * neither.
 *
 * A plain function over plain data, in the same spirit as `panelView.ts`:
 * `vitest` runs in the node environment and collects only `src/**\/*.test.ts`,
 * so nothing that renders React can be tested at all. This can.
 */
import { articleKey, shouldCaptureFrom } from '../domain/url';

export type FocusedTab =
  /** The hook's own initial state before the first `tabs.query` resolves. */
  | { kind: 'checking' }
  | { kind: 'board'; tabId: number }
  | { kind: 'article'; tabId: number; url: string; articleKey: string; title: string }
  | { kind: 'other'; tabId: number | null };

/**
 * Whether a tab's address names the board page, tolerating a trailing
 * `?query` or `#hash`. Lifted from `useBoardFocused.ts` verbatim: Chrome
 * withholds `url` from `tabs.query` without the `"tabs"` permission, so this
 * is a bonus check on top of the id match, not the primary one.
 */
function isBoardUrl(tabUrl: string | undefined, boardUrl: string): boolean {
  if (tabUrl == null) return false;
  const page = tabUrl.split(/[?#]/, 1)[0];
  return page === boardUrl;
}

/**
 * @param boardTabId the id the background keeps for the board tab in session
 *   storage, needed because an unpermitted tab still reports its `id` even
 *   when its `url` is withheld.
 * @param boardUrl `browser.runtime.getURL('/board.html')`, computed once by
 *   the caller.
 */
export function classifyTab(
  tab: { id?: number; url?: string; title?: string } | null | undefined,
  boardTabId: number | undefined,
  boardUrl: string,
): FocusedTab {
  if (tab == null) return { kind: 'other', tabId: null };

  // A board URL match with no id to act on is not distinguishable from
  // 'other' anyway, so an id-less tab skips straight to the last case.
  if (tab.id != null && (isBoardUrl(tab.url, boardUrl) || tab.id === boardTabId)) {
    return { kind: 'board', tabId: tab.id };
  }

  if (tab.url != null && tab.id != null && shouldCaptureFrom(tab.url)) {
    const key = articleKey(tab.url);
    if (key != null) {
      return { kind: 'article', tabId: tab.id, url: tab.url, articleKey: key, title: tab.title ?? '' };
    }
  }

  return { kind: 'other', tabId: tab.id ?? null };
}
