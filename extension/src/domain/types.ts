export type Status = 'to_read' | 'reading' | 'processed';

export interface Quote {
  text: string;
  comment?: string;
  locator?: string;
  locatorLost: boolean;
  capturedAt: string;
}

export interface Card {
  id: string;
  url: string;
  title: string;
  author: string;
  publication: string;
  estimatedReadingMinutes?: number;
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
  liked: boolean;
  commented: boolean;
  unsavedFromSubstack: boolean;
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