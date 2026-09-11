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
 * One writer now: the board, when the reader clicks a card. The background
 * used to write it on a toolbar capture, but the toolbar no longer captures
 * anything and the panel reads the article straight off the focused tab.
 */
export const PANEL_STATE_KEY = 'panel';

/**
 * The session-storage key holding the id of the board's tab, or nothing when
 * no board tab is open.
 *
 * The background writes it so a second toolbar click, and the panel's "Open
 * the board", focus the board rather than open another copy. The background
 * decides between focusing and creating; `classifyTab` also reads it to tell
 * the board apart from any other tab, because `tabs.query` reports a tab id
 * even where it withholds the url.
 */
export const BOARD_TAB_KEY = 'boardTabId';

/**
 * The id of the tab the toolbar's `activeTab` grant last covered, or nothing.
 *
 * Chrome grants `activeTab` on the tab a toolbar click fires from, reaching
 * scripting.executeScript on that tab with no permission prompt, until it
 * navigates or closes. The click no longer captures anything, so this key is
 * the only remaining record of which tab that grant covers — Capture can
 * still work on it immediately, before the reader grants a host permission.
 */
export const ACTIVE_TAB_GRANT_KEY = 'activeTabGrant';

/**
 * The session-storage key holding what the background has resolved about
 * Substack's reader-shell routes.
 *
 * `/inbox/post/<id>` and its siblings name the app, not the article, so the
 * panel cannot derive an article key from the address bar there. The
 * background can: it injects a DOM read when it ingests. This is where it
 * leaves the answer, so the panel stops having to hold it in component state
 * that a tab switch wipes.
 *
 * Session-scoped on purpose. The mapping is a cache of something re-derivable,
 * and a reader-shell id that changes meaning between browser sessions costs
 * nothing more than one extra DOM read.
 */
export const READER_KEYS_KEY = 'readerKeys';

/**
 * Provisional article keys mapped to the real ones.
 *
 * The key is what `articleKey()` makes of the tab's own URL — on a reader
 * route that is just the canonical URL, because no pattern matches. The value
 * is the key the board actually stores the card under.
 */
export type ReaderKeys = Record<string, string>;

/** What `ingestCard()` did. Named so the panel can key a banner on it. */
export type CaptureOutcome = IngestOutcome['kind'];

/**
 * The board's pick, or nothing. An article opening is not remembered here at
 * all: the panel reads it straight off the focused tab every time, via
 * useFocusedTab. This is the one case a plain tab-focus read cannot answer —
 * which of possibly several cards on the board the reader clicked.
 */
export type PanelState = { cardId: string };

export type AddArticleReply =
  | { ok: true; outcome: 'added' | 'updated'; articleKey: string; notices: string[] }
  | { ok: false; reason: string };

export type PanelMessage =
  /*
   * `tabId` names the tab to read the selection out of, and is required: the
   * panel classifies the focused tab itself, so it always knows one and the
   * background has no remembered tab left to fall back to.
   */
  | { type: 'capture-selection'; tabId: number }
  | { type: 'sync-saved' }
  | { type: 'open-board' }
  | { type: 'add-article'; tabId: number; url: string };

export type CaptureSelectionReply =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export type SyncSavedReply = { ok: true; report: SyncReport } | { ok: false; reason: string };

// Re-exported so `src/ui/` reads one file for the whole message contract
// rather than reaching into `src/db/` for half of it.
export type { SyncReport };
