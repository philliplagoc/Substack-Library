/**
 * The shapes the background and the side panel agree on.
 *
 * Types only. No runtime code lives here, so this file belongs to no layer of
 * the dependency rule and either side may import it.
 */
import type { IngestOutcome } from './db/cards';

/** The session-storage key the background writes and the panel reads. */
export const PANEL_STATE_KEY = 'panel';

export interface PanelState {
  /** Which article the panel is showing. */
  articleKey: string;
  /** The tab the activeTab grant covers, for later selection reads. */
  tabId: number;
  /** What ingestCard() did, so the panel can say so. */
  outcome: IngestOutcome['kind'];
  /** Everything the reader needs told: signed out, paywalled, no title. */
  notices: string[];
  /** The article body as plain text, for locating quotes. */
  bodyText: string;
}

export type PanelMessage = { type: 'capture-selection' };

export type CaptureSelectionReply =
  | { ok: true; text: string; prefix: string }
  | { ok: false; reason: string };
