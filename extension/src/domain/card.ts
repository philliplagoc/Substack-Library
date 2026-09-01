import { articleKey } from './url';
import type { Card, CardInput, Status } from './types';

/**
 * The label each column carries.
 *
 * It lives here rather than in `ui/` because `domain/markdown.ts` needs it for
 * the library file's headings and `domain/` cannot import from `ui/`. Three
 * other copies exist in `ui/Board.tsx`, `ui/ReadingPanel.tsx`, and
 * `ui/CardTile.tsx`; consolidating them is out of scope for this milestone.
 */
export const STATUS_LABELS: Record<Status, string> = {
  to_read: 'To Read',
  reading: 'Reading',
  processed: 'Processed',
};

export interface CardSeed {
  id: string;
  savedAt: string;
  sortOrder: number;
}

export interface CardFilter {
  query: string;
  /** null means no maximum. */
  maxMinutes: number | null;
  /**
   * Empty means no tag filter. A card must carry EVERY tag listed, not any of
   * them: each click on the filter row narrows, the way the query and the
   * maximum do. A row where one control widens while its neighbours narrow is a
   * row that has to be explained.
   */
  tags: string[];
}

/**
 * Narrow the board to what the reader asked for. Keeps the input order
 */
export function visibleCards(cards: Card[], filter: CardFilter): Card[] {
 const query = filter.query.trim().toLowerCase();
 const max = filter.maxMinutes;

 return cards.filter((card) => {
  if (query) {
    const haystack = `${card.title} ${card.author} ${card.publication}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (max != null) {
    if (card.estimatedReadingMinutes == null) return false;
    if (card.estimatedReadingMinutes > max) return false;
  }
  if (filter.tags.length > 0) {
    // `?? []` because a card restored from a hand-edited backup can be missing
    // the field, and a filter is not the place to throw.
    const own = card.tags ?? [];
    if (!filter.tags.every((tag) => own.includes(tag))) return false;
  }
  return true;
 });
}

/**
 * Build a new card. Pure: the id, the timestamp, and the position come in
 * through `seed`, so the same arguments always give the same card.
 */
export function createCard(input: CardInput & { url: string }, seed: CardSeed): Card {
  return {
    id: seed.id,
    url: input.url,
    // input.url is already canonical here, so this cannot fail. Fall back to
    // the url anyway: a card without a key could never be found again.
    articleKey: articleKey(input.url) ?? input.url,
    // A bare URL still has to show something readable on a card face.
    title: input.title?.trim() || input.url,
    author: input.author?.trim() ?? '',
    publication: input.publication?.trim() ?? '',
    estimatedReadingMinutes: input.estimatedReadingMinutes,
    status: 'to_read',
    savedAt: seed.savedAt,
    exportVersion: 0,
    tags: [],
    notes: '',
    quotes: [],
    sortOrder: seed.sortOrder,
  };
}

export interface CardMove {
  cardId: string;
  toStatus: Status;
  /** Position inside target column, counting the moved card itself */
  toIndex: number;
}

export interface OrderChange {
  id: string;
  status: Status;
  sortOrder: number;
  /** Set only when this move is the card's first entry into Reading. */
  readAt?: string;
}

/** Work out the whole new ordering after one drop. */
export function reorderCards(cards: Card[], move: CardMove, now: string): OrderChange[] {
  const moved = cards.find((c) => c.id === move.cardId);
  if (!moved) return [];

  const fromStatus = moved.status;
  const byOrder = (a: Card, b: Card) => a.sortOrder - b.sortOrder;

  const target = cards
    .filter((c) => c.status === move.toStatus && c.id !== moved.id)
    .sort(byOrder);
  const index = Math.max(0, Math.min(move.toIndex, target.length));
  target.splice(index, 0, moved);

  const changes: OrderChange[] = target.map((card, i) => ({
    id: card.id,
    status: move.toStatus,
    sortOrder: i,
  }));

  if (fromStatus !== move.toStatus) {
    cards
      .filter((c) => c.status === fromStatus && c.id !== moved.id)
      .sort(byOrder)
      .forEach((card, i) => {
        changes.push({ id: card.id, status: fromStatus, sortOrder: i });
      });
  }

  if (move.toStatus === 'reading' && !moved.readAt) {
    const entry = changes.find((c) => c.id === moved.id);
    if (entry) entry.readAt = now;
  }

  return changes;
}