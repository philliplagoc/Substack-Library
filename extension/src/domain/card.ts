import type { Card, CardInput } from './types';

export interface CardSeed {
  id: string;
  savedAt: string;
  sortOrder: number;
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