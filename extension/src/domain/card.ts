import type { Card, CardInput } from './types';

export interface CardSeed {
  id: string;
  savedAt: string;
  sortOrder: number;
}

export interface CardFilter {
  query: string;
  /** null means no maximum. */
  maxMinutes: number | null;
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
    liked: false,
    commented: false,
    unsavedFromSubstack: false,
    sortOrder: seed.sortOrder,
  };
}