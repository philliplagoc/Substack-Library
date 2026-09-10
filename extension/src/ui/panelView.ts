/**
 * What the side panel should show, decided away from the markup.
 *
 * The panel has one job and two ways in. The toolbar button opens it on a live
 * article and has an ingest outcome to announce. The board opens it on a card
 * the reader picked, where there is no article behind it and nothing happened
 * worth announcing. Every difference between those two openings is decided
 * here, so `ReadingPanel` is left rendering a switch and nothing else.
 *
 * A plain function over plain data on purpose: `vitest` runs in the node
 * environment and collects only `src/**\/*.test.ts`, so nothing that renders
 * React can be tested at all. This can.
 */
import type { CaptureOutcome, PanelState } from '../messages';
import type { Card } from '../domain/types';
import type { LiveArticle } from './useLiveArticle';

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
 * Where Capture should read from, given how the panel was opened and what is
 * open in this window.
 *
 * Two sources disagree by design. `panel` records how the panel was opened and
 * never changes after. `live` is asked afresh every time a tab moves. The
 * fresher answer wins wherever there is one, and the older one is the floor
 * under it rather than a case beside it.
 */
export function captureTarget(panel: PanelState, live: LiveArticle): CaptureTarget {
  // A verified tab outranks a remembered one, whichever way the panel opened.
  // `live.tabId` is the focused tab, matched against a tab list read under a
  // real host permission, so it is true now. `panel.tabId` was true once.
  if (live.kind === 'open') return { kind: 'ready', tabId: live.tabId };

  // The toolbar click's `activeTab` grant covers its own tab and needs no host
  // permission, so it is the only thing that works before the reader has
  // granted anything. But it is a grant over ONE tab, and the reader may have
  // walked away from it since, so it counts only while that tab is still the
  // focused one. Placed above the 'ask' branch on purpose: asking for a
  // publication is pointless while a grant that already reaches the focused
  // tab is in hand. `checking` carries no `activeTabId`, and an unknown tab
  // is not a match.
  const focused = live.kind === 'checking' ? null : live.activeTabId;
  if (panel.source === 'capture' && panel.tabId === focused) {
    return { kind: 'ready', tabId: panel.tabId };
  }

  if (live.kind === 'ask') return { kind: 'ask', pattern: live.pattern, host: live.host };

  // 'closed' has no tab and 'checking' has no answer yet. Both read as absent,
  // because the button re-renders the instant a real answer lands, and a
  // control that arrives off and turns on misleads less than one that flickers
  // from on to off.
  return { kind: 'absent' };
}

export type PanelView =
  /** No answer yet, or the card behind the state has not arrived. */
  | { kind: 'loading' }
  /** Nothing has ever been opened. Tell the reader how to open something. */
  | { kind: 'prompt' }
  /** A capture that produced no card. The outcome and notices say why. */
  | { kind: 'rejected'; outcome: CaptureOutcome; notices: string[] }
  /** A board card that is no longer on the board, usually just deleted. */
  | { kind: 'gone' }
  | {
      kind: 'card';
      card: Card;
      /** The outcome banner, or null when there is nothing to announce. */
      banner: CaptureOutcome | null;
      notices: string[];
      /** Where Capture reads from, or what stands between it and a page. */
      capture: CaptureTarget;
    };

/**
 * @param panel `undefined` while session storage is still being read, `null`
 *   when it holds nothing.
 * @param card `undefined` while the live query is still running, `null` when
 *   the query finished and found nothing.
 * @param live what is open in this window and what this extension may read.
 */
export function panelView(
  panel: PanelState | null | undefined,
  card: Card | null | undefined,
  live: LiveArticle,
): PanelView {
  // Nothing has been read yet. Neither of the two states below is knowable,
  // so say nothing rather than guess at one.
  if (panel === undefined) return { kind: 'loading' };

  // Read, and empty. Nothing has ever opened this panel.
  if (panel === null) return { kind: 'prompt' };

  // The state names a card; the query for it has not answered.
  if (card === undefined) return { kind: 'loading' };

  if (card === null) {
    // A capture with no card behind it failed at ingest, and the outcome and
    // notices are the explanation. A board card with no card behind it was on
    // the board a moment ago, so the reader needs telling, not diagnosing.
    return panel.source === 'capture'
      ? { kind: 'rejected', outcome: panel.outcome, notices: panel.notices }
      : { kind: 'gone' };
  }

  // The card arrived, but the live query may still be holding the previous
  // one: the panel state flips the instant the reader clicks a second card,
  // and the re-query lands a tick later. A moment of "Loading…" is cheaper
  // than one card's banner painted over another card's notes.
  //
  // A capture knows only an articleKey. A board click knows the card's own id,
  // and must use it, because articleKey is indexed but not unique.
  const matches =
    panel.source === 'board' ? card.id === panel.cardId : card.articleKey === panel.articleKey;

  if (!matches) return { kind: 'loading' };

  // A board opening captured nothing and so has nothing to announce.
  return panel.source === 'capture'
    ? {
        kind: 'card',
        card,
        banner: panel.outcome,
        notices: panel.notices,
        capture: captureTarget(panel, live),
      }
    : { kind: 'card', card, banner: null, notices: [], capture: captureTarget(panel, live) };
}
