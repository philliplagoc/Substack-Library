export type Status = 'to_read' | 'reading' | 'processed';

export interface Quote {
  /**
   * Stable across a removal. Quotes used to be addressed by their index into
   * `card.quotes`, which was sound only while quotes were append-only.
   */
  id: string;
  text: string;
  comment?: string;
  capturedAt: string;
}

/** What a saved item is. Substack's list says "14 min read" or "1 hr 6 min watch". */
export type Medium = 'read' | 'watch' | 'listen';

export interface Card {
  id: string;
  /** The URL this card was added with. What the card links to. */
  url: string;
  /**
   * What makes this article this article, whichever of Substack's several
   * routes you arrived by. Cards dedup on this, not on `url`.
   */
  articleKey: string;
  title: string;
  author: string;
  publication: string;
  estimatedReadingMinutes?: number;
  /**
   * Read, watch, or listen. Absent on every card written before Milestone 3
   * and on every card captured by the toolbar button, which reads an article
   * page and so is always a read.
   */
  medium?: Medium;
  status: Status;
  savedAt: string;
  readAt?: string;
  lastExportedAt?: string;
  exportVersion: number;
  lastSeenInSaved?: string;
  syncWarning?: string;
  tags: string[];
  notes: string;
  quotes: Quote[];
  sortOrder: number;
}

/**
 * The metadata a capture source supplies.
 * Everything else on a Card is state the extension owns.
 * Milestone 2's content script and Milestone 3's sync both produce this shape.
 */
export interface CardInput {
  url: string;
  title?: string;
  author?: string;
  publication?: string;
  estimatedReadingMinutes?: number;
}