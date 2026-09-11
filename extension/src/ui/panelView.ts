/**
 * What the side panel should show, decided away from the markup.
 *
 * The panel follows the focused tab. On the board it shows whichever card the
 * reader clicked; on an article it shows that article's card, or an offer to
 * add it; on anything else it says so. Every one of those choices is made
 * here, so `ReadingPanel` is left rendering a switch and nothing else.
 *
 * A plain function over plain data on purpose: `vitest` runs in the node
 * environment and collects only `src/**\/*.test.ts`, so nothing that renders
 * React can be tested at all. This can.
 */
import type { Card } from '../domain/types';
import type { FocusedTab } from './focusedTab';
import type { CapturePermission } from './useCapturePermission';

/**
 * What the Capture button can do right now.
 *
 * Capture reads a text selection out of a live page, so it needs a tab AND the
 * right to inject into it. Three answers, because the middle one is actionable:
 * the reader can grant this publication from the panel and carry on.
 */
export type CaptureTarget =
  /** Read the selection out of this tab. */
  | { kind: 'ready'; tabId: number }
  /** The article may well be open, but this extension may not look. */
  | { kind: 'ask'; pattern: string; host: string }
  /** No tab to read from. */
  | { kind: 'absent' };

/**
 * @param activeTabGrantId the id under ACTIVE_TAB_GRANT_KEY, or null. The
 *   floor under `permission`: the toolbar's activeTab grant reaches this one
 *   tab with no host permission at all, but only while it is still focused.
 */
export function captureTarget(
  tab: FocusedTab,
  permission: CapturePermission,
  activeTabGrantId: number | null,
): CaptureTarget {
  if (tab.kind !== 'article') return { kind: 'absent' };
  if (permission.kind === 'granted') return { kind: 'ready', tabId: tab.tabId };
  // Checked above the 'ask' branch: asking for a publication is pointless
  // while a grant that already reaches this very tab is in hand.
  if (activeTabGrantId != null && activeTabGrantId === tab.tabId) {
    return { kind: 'ready', tabId: tab.tabId };
  }
  if (permission.kind === 'ask') return { kind: 'ask', pattern: permission.pattern, host: permission.host };
  // 'checking' and 'unavailable' both read as absent: a control that arrives
  // off and turns on misleads less than one that flickers from on to off.
  return { kind: 'absent' };
}

export type PanelView =
  /** No answer yet, or the card behind the focused tab has not arrived. */
  | { kind: 'loading' }
  /** Focused on neither the board nor an article. Say how to open one. */
  | { kind: 'prompt' }
  /** On the board, with no card clicked yet. */
  | { kind: 'board-idle' }
  /** A board card that is no longer on the board, usually just deleted. */
  | { kind: 'gone' }
  /** An article that is not on the board yet, offered rather than added. */
  | { kind: 'draft'; url: string; title: string; capture: CaptureTarget }
  | { kind: 'card'; card: Card; capture: CaptureTarget };

/**
 * @param tab what is focused right now.
 * @param pickedCardId the board's pick: undefined while session storage is
 *   still being read, null once read and empty, the id once the reader has
 *   clicked a card. Irrelevant except while `tab.kind === 'board'`.
 * @param card the live query result keyed to whichever of the two above
 *   applies: undefined while it is running, null once it has run and found
 *   nothing.
 */
export function panelView(
  tab: FocusedTab,
  pickedCardId: string | null | undefined,
  card: Card | null | undefined,
  permission: CapturePermission,
  activeTabGrantId: number | null,
): PanelView {
  if (tab.kind === 'checking') return { kind: 'loading' };
  if (tab.kind === 'other') return { kind: 'prompt' };

  if (tab.kind === 'board') {
    if (pickedCardId === undefined) return { kind: 'loading' };
    if (pickedCardId === null) return { kind: 'board-idle' };
    if (card === undefined) return { kind: 'loading' };
    if (card === null) return { kind: 'gone' };
    // The reader clicked a second card; the live query has not caught up.
    if (card.id !== pickedCardId) return { kind: 'loading' };
    return { kind: 'card', card, capture: captureTarget(tab, permission, activeTabGrantId) };
  }

  // tab.kind === 'article'
  if (card === undefined) return { kind: 'loading' };
  if (card === null) {
    return {
      kind: 'draft',
      url: tab.url,
      title: tab.title,
      capture: captureTarget(tab, permission, activeTabGrantId),
    };
  }
  // Switched to a different article; the live query has not caught up.
  if (card.articleKey !== tab.articleKey) return { kind: 'loading' };
  return { kind: 'card', card, capture: captureTarget(tab, permission, activeTabGrantId) };
}
