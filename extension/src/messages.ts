/**
 * The shapes the background and the side panel agree on.
 *
 * Types only. No runtime code lives here, so this file belongs to no layer of
 * the dependency rule and either side may import it.
 */
import type { IngestOutcome } from './db/cards';
import type { SyncReport } from './db/sync';

/**
 * The session-storage key naming the card the side panel shows.
 *
 * Two writers now. The background writes it on a toolbar capture; the board
 * writes it when the reader clicks a card. It used to be the background's
 * alone, and the board carried its own panel instead.
 */
export const PANEL_STATE_KEY = 'panel';

/**
 * The session-storage key holding the id of the board's tab, or nothing when
 * no board tab is open.
 *
 * The background writes it so a second toolbar click, and the panel's "Open
 * the board", focus the board rather than open another copy. The background is
 * the only reader: the panel asks for the board and lets the background decide
 * between focusing and creating.
 */
export const BOARD_TAB_KEY = 'boardTabId';

/** What `ingestCard()` did. Named so the panel can key a banner on it. */
export type CaptureOutcome = IngestOutcome['kind'];

/**
 * Where the panel was opened from.
 *
 * A union rather than one shape with optional fields, because the two openings
 * carry different evidence. A toolbar capture knows the tab it read and what
 * ingest did with the result. A board click knows only which card was clicked:
 * there is no live article behind it, so no tab, no outcome, and nothing to
 * announce.
 */
export type PanelState =
  | {
      source: 'capture';
      articleKey: string;
      /** The tab the activeTab grant covers, for later selection reads. */
      tabId: number;
      outcome: CaptureOutcome;
      /** Everything the reader needs told: signed out, paywalled, no title. */
      notices: string[];
    }
  | {
      source: 'board';
      /*
       * The card's own id, not its articleKey. `articleKey` is indexed but
       * deliberately not unique: a board written before schema version 2 can
       * hold two cards sharing one key, and `cardByArticleKey` returns the
       * first. The board knows exactly which card was clicked and says so.
       */
      cardId: string;
    };

export type PanelMessage =
  /*
   * `tabId` names the tab to read the selection out of, when the panel knows
   * one. The panel knows one whenever it has found the article open in a tab
   * it holds a host permission for. Absent, the background falls back to the
   * tab the toolbar click covered, which is the only tab `activeTab` reaches.
   */
  | { type: 'capture-selection'; tabId?: number }
  | { type: 'sync-saved' }
  | { type: 'open-board' };

export type CaptureSelectionReply =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export type SyncSavedReply = { ok: true; report: SyncReport } | { ok: false; reason: string };

// Re-exported so `src/ui/` reads one file for the whole message contract
// rather than reaching into `src/db/` for half of it.
export type { SyncReport };
