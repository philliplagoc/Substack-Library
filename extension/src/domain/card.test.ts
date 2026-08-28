import { describe, test, expect } from 'vitest';
import { createCard } from './card';
import { visibleCards } from './card';
import { makeCard } from '../test-support/factory';

const SEED = { id: 'fixed-id', savedAt: '2026-08-26T12:00:00.000Z', sortOrder: 3 };

describe('createCard', () => {
  test('builds a whole card from the seed and the input', () => {
    const card = createCard(
      {
        url: 'https://alpha.substack.com/p/questions',
        title: 'How Great Questions Change a Company',
        author: 'A. Writer',
        publication: 'Alpha Notes',
        estimatedReadingMinutes: 12,
      },
      SEED,
    );

    expect(card).toEqual({
      id: 'fixed-id',
      url: 'https://alpha.substack.com/p/questions',
      title: 'How Great Questions Change a Company',
      author: 'A. Writer',
      publication: 'Alpha Notes',
      estimatedReadingMinutes: 12,
      status: 'to_read',
      savedAt: '2026-08-26T12:00:00.000Z',
      exportVersion: 0,
      tags: [],
      notes: '',
      quotes: [],
      liked: false,
      commented: false,
      unsavedFromSubstack: false,
      sortOrder: 3,
    });
  });

  test('falls back to the url when no title is supplied', () => {
    const card = createCard({ url: 'https://alpha.substack.com/p/questions' }, SEED);
    expect(card.title).toBe('https://alpha.substack.com/p/questions');
  });

  test('leaves author and publication empty when not supplied', () => {
    const card = createCard({ url: 'https://alpha.substack.com/p/questions' }, SEED);
    expect(card.author).toBe('');
    expect(card.publication).toBe('');
  });

  test('leaves the reading estimate undefined when not supplied', () => {
    const card = createCard({ url: 'https://alpha.substack.com/p/questions' }, SEED);
    expect(card.estimatedReadingMinutes).toBeUndefined();
  });

  test('is deterministic: the same input and seed give the same card', () => {
    const input = { url: 'https://alpha.substack.com/p/questions', title: 'T' };
    expect(createCard(input, SEED)).toEqual(createCard(input, SEED));
  });
});

describe('visibleCards', () => {
  const noFilter = { query: '', maxMinutes: null };

  test('returns every card when nothing is filtered', () => {
    const cards = [makeCard(), makeCard()];
    expect(visibleCards(cards, noFilter)).toHaveLength(2);
  });

  test('matches the title, case-insensitively', () => {
    const cards = [
      makeCard({ id: 'a', title: 'Great Questions' }),
      makeCard({ id: 'b', title: 'Slow Reading' }),
    ];
    expect(visibleCards(cards, { query: 'question', maxMinutes: null }).map((c) => c.id)).toEqual(['a']);
  });

  test('matches the author', () => {
    const cards = [
      makeCard({ id: 'a', author: 'A. Writer' }),
      makeCard({ id: 'b', author: 'B. Essayist' }),
    ];
    expect(visibleCards(cards, { query: 'essayist', maxMinutes: null }).map((c) => c.id)).toEqual(['b']);
  });

  test('matches the publication', () => {
    const cards = [
      makeCard({ id: 'a', publication: 'Alpha Notes' }),
      makeCard({ id: 'b', publication: 'Beta Letters' }),
    ];
    expect(visibleCards(cards, { query: 'beta', maxMinutes: null }).map((c) => c.id)).toEqual(['b']);
  });

  test('ignores surrounding whitespace in the query', () => {
    const cards = [makeCard({ id: 'a', title: 'Great Questions' })];
    expect(visibleCards(cards, { query: '  questions  ', maxMinutes: null })).toHaveLength(1);
  });

  test('keeps cards at or under the maximum', () => {
    const cards = [
      makeCard({ id: 'a', estimatedReadingMinutes: 5 }),
      makeCard({ id: 'b', estimatedReadingMinutes: 10 }),
      makeCard({ id: 'c', estimatedReadingMinutes: 11 }),
    ];
    expect(visibleCards(cards, { query: '', maxMinutes: 10 }).map((c) => c.id)).toEqual(['a', 'b']);
  });

  test('HIDES a card with no estimate when a maximum is set', () => {
    const cards = [
      makeCard({ id: 'a', estimatedReadingMinutes: 5 }),
      makeCard({ id: 'b', estimatedReadingMinutes: undefined }),
    ];
    expect(visibleCards(cards, { query: '', maxMinutes: 10 }).map((c) => c.id)).toEqual(['a']);
  });

  test('shows a card with no estimate when no maximum is set', () => {
    const cards = [makeCard({ id: 'b', estimatedReadingMinutes: undefined })];
    expect(visibleCards(cards, noFilter)).toHaveLength(1);
  });

  test('applies the search and the maximum together', () => {
    const cards = [
      makeCard({ id: 'a', title: 'Great Questions', estimatedReadingMinutes: 5 }),
      makeCard({ id: 'b', title: 'Great Questions', estimatedReadingMinutes: 40 }),
      makeCard({ id: 'c', title: 'Slow Reading', estimatedReadingMinutes: 5 }),
    ];
    expect(visibleCards(cards, { query: 'questions', maxMinutes: 10 }).map((c) => c.id)).toEqual(['a']);
  });

  test('keeps the order it was given', () => {
    const cards = [
      makeCard({ id: 'a', sortOrder: 0 }),
      makeCard({ id: 'b', sortOrder: 1 }),
      makeCard({ id: 'c', sortOrder: 2 }),
    ];
    expect(visibleCards(cards, noFilter).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});