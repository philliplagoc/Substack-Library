import { describe, test, expect } from 'vitest';
import { mergeCard } from './ingest';
import { makeCard } from '../test-support/factory';

const URL_A = 'https://alpha.substack.com/p/questions';

describe('mergeCard', () => {
  test('refreshes the metadata fields', () => {
    const existing = makeCard({
      url: URL_A,
      title: 'Old Title',
      author: 'Old Author',
      publication: 'Old Pub',
      estimatedReadingMinutes: 4,
    });

    const merged = mergeCard(existing, {
      url: URL_A,
      title: 'New Title',
      author: 'New Author',
      publication: 'New Pub',
      estimatedReadingMinutes: 12,
    });

    expect(merged.title).toBe('New Title');
    expect(merged.author).toBe('New Author');
    expect(merged.publication).toBe('New Pub');
    expect(merged.estimatedReadingMinutes).toBe(12);
  });

  test('never touches what the reader wrote', () => {
    const existing = makeCard({
      url: URL_A,
      notes: 'my notes',
      tags: ['keep'],
      quotes: [{ id: 'q', text: 'q', capturedAt: '2026-08-01' }],
      status: 'processed',
      sortOrder: 7,
      readAt: '2026-08-02T00:00:00.000Z',
      exportVersion: 2,
      lastExportedAt: '2026-08-03T00:00:00.000Z',
    });

    const merged = mergeCard(existing, { url: URL_A, title: 'New Title' });

    expect(merged.notes).toBe('my notes');
    expect(merged.tags).toEqual(['keep']);
    expect(merged.quotes).toHaveLength(1);
    expect(merged.status).toBe('processed');
    expect(merged.sortOrder).toBe(7);
    expect(merged.readAt).toBe('2026-08-02T00:00:00.000Z');
    expect(merged.exportVersion).toBe(2);
    expect(merged.lastExportedAt).toBe('2026-08-03T00:00:00.000Z');
  });

  test('keeps the id and the saved date', () => {
    const existing = makeCard({ id: 'keep-me', url: URL_A, savedAt: '2026-01-01T00:00:00.000Z' });
    const merged = mergeCard(existing, { url: URL_A, title: 'New Title' });
    expect(merged.id).toBe('keep-me');
    expect(merged.savedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  test('keeps the old value when a field is missing from the incoming metadata', () => {
    const existing = makeCard({ url: URL_A, title: 'Good Title', author: 'Good Author' });
    const merged = mergeCard(existing, { url: URL_A });
    expect(merged.title).toBe('Good Title');
    expect(merged.author).toBe('Good Author');
  });

  test('keeps the old value when a field arrives blank', () => {
    const existing = makeCard({ url: URL_A, title: 'Good Title' });
    const merged = mergeCard(existing, { url: URL_A, title: '   ' });
    expect(merged.title).toBe('Good Title');
  });

  test('keeps the old estimate when none arrives', () => {
    const existing = makeCard({ url: URL_A, estimatedReadingMinutes: 9 });
    const merged = mergeCard(existing, { url: URL_A });
    expect(merged.estimatedReadingMinutes).toBe(9);
  });

  test('does not change the card it was given', () => {
    const existing = makeCard({ url: URL_A, title: 'Old Title' });
    mergeCard(existing, { url: URL_A, title: 'New Title' });
    expect(existing.title).toBe('Old Title');
  });
});
describe('mergeCard and the url', () => {
  test('keeps the url the board already holds', () => {
    const existing = makeCard({ url: 'https://www.pokgaigamer.com/p/steamanimegames' });
    const merged = mergeCard(existing, {
      url: 'https://open.substack.com/pub/pokgaigamer/p/steamanimegames',
      title: 'Anime Into Games',
    });
    expect(merged.url).toBe('https://www.pokgaigamer.com/p/steamanimegames');
    expect(merged.title).toBe('Anime Into Games');
  });
});
