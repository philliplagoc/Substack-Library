import type { Card } from '../domain/types';

let counter = 0;

/** Build a whole Card for a test. Override any field through `overrides`. */
export function makeCard(overrides: Partial<Card> = {}): Card {
  counter += 1;
  return {
    id: `card-${counter}`,
    url: `https://alpha.substack.com/p/post-${counter}`,
    title: `Post ${counter}`,
    author: 'A. Writer',
    publication: 'Alpha Notes',
    estimatedReadingMinutes: 10,
    status: 'to_read',
    savedAt: '2026-08-10T00:00:00.000Z',
    exportVersion: 0,
    tags: [],
    notes: '',
    quotes: [],
    liked: false,
    commented: false,
    unsavedFromSubstack: false,
    sortOrder: 0,
    ...overrides,
  };
}