import { describe, test, expect } from 'vitest';
import { createCard } from './card';
import { visibleCards } from './card';
import { makeCard } from '../test-support/factory';
import { reorderCards } from './card';

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
      articleKey: 'alpha/p/questions',
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
  const noFilter = { query: '', maxMinutes: null, tags: [] };

  test('returns every card when nothing is filtered', () => {
    const cards = [makeCard(), makeCard()];
    expect(visibleCards(cards, noFilter)).toHaveLength(2);
  });

  test('matches the title, case-insensitively', () => {
    const cards = [
      makeCard({ id: 'a', title: 'Great Questions' }),
      makeCard({ id: 'b', title: 'Slow Reading' }),
    ];
    expect(visibleCards(cards, { query: 'question', maxMinutes: null, tags: [] }).map((c) => c.id)).toEqual(['a']);
  });

  test('matches the author', () => {
    const cards = [
      makeCard({ id: 'a', author: 'A. Writer' }),
      makeCard({ id: 'b', author: 'B. Essayist' }),
    ];
    expect(visibleCards(cards, { query: 'essayist', maxMinutes: null, tags: [] }).map((c) => c.id)).toEqual(['b']);
  });

  test('matches the publication', () => {
    const cards = [
      makeCard({ id: 'a', publication: 'Alpha Notes' }),
      makeCard({ id: 'b', publication: 'Beta Letters' }),
    ];
    expect(visibleCards(cards, { query: 'beta', maxMinutes: null, tags: [] }).map((c) => c.id)).toEqual(['b']);
  });

  test('ignores surrounding whitespace in the query', () => {
    const cards = [makeCard({ id: 'a', title: 'Great Questions' })];
    expect(visibleCards(cards, { query: '  questions  ', maxMinutes: null, tags: [] })).toHaveLength(1);
  });

  test('keeps cards at or under the maximum', () => {
    const cards = [
      makeCard({ id: 'a', estimatedReadingMinutes: 5 }),
      makeCard({ id: 'b', estimatedReadingMinutes: 10 }),
      makeCard({ id: 'c', estimatedReadingMinutes: 11 }),
    ];
    expect(visibleCards(cards, { query: '', maxMinutes: 10, tags: [] }).map((c) => c.id)).toEqual(['a', 'b']);
  });

  test('HIDES a card with no estimate when a maximum is set', () => {
    const cards = [
      makeCard({ id: 'a', estimatedReadingMinutes: 5 }),
      makeCard({ id: 'b', estimatedReadingMinutes: undefined }),
    ];
    expect(visibleCards(cards, { query: '', maxMinutes: 10, tags: [] }).map((c) => c.id)).toEqual(['a']);
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
    expect(visibleCards(cards, { query: 'questions', maxMinutes: 10, tags: [] }).map((c) => c.id)).toEqual(['a']);
  });

  test('keeps the order it was given', () => {
    const cards = [
      makeCard({ id: 'a', sortOrder: 0 }),
      makeCard({ id: 'b', sortOrder: 1 }),
      makeCard({ id: 'c', sortOrder: 2 }),
    ];
    expect(visibleCards(cards, noFilter).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  test('narrows to the cards carrying one selected tag', () => {
    const cards = [
      makeCard({ id: 'a', tags: ['ai'] }),
      makeCard({ id: 'b', tags: ['economics'] }),
    ];
    expect(
      visibleCards(cards, { query: '', maxMinutes: null, tags: ['ai'] }).map((c) => c.id),
    ).toEqual(['a']);
  });

  test('requires ALL selected tags, not any of them', () => {
    const cards = [
      makeCard({ id: 'both', tags: ['ai', 'economics'] }),
      makeCard({ id: 'one', tags: ['ai'] }),
      makeCard({ id: 'other', tags: ['economics'] }),
    ];
    expect(
      visibleCards(cards, { query: '', maxMinutes: null, tags: ['ai', 'economics'] }).map(
        (c) => c.id,
      ),
    ).toEqual(['both']);
  });

  test('an empty tag list filters nothing', () => {
    const cards = [makeCard({ tags: [] }), makeCard({ tags: ['ai'] })];
    expect(visibleCards(cards, { query: '', maxMinutes: null, tags: [] })).toHaveLength(2);
  });

  test('combines with the query and the maximum', () => {
    const cards = [
      makeCard({ id: 'a', title: 'Great Questions', tags: ['ai'], estimatedReadingMinutes: 5 }),
      makeCard({ id: 'b', title: 'Great Questions', tags: ['ai'], estimatedReadingMinutes: 30 }),
      makeCard({ id: 'c', title: 'Slow Reading', tags: ['ai'], estimatedReadingMinutes: 5 }),
    ];
    expect(
      visibleCards(cards, { query: 'questions', maxMinutes: 10, tags: ['ai'] }).map((c) => c.id),
    ).toEqual(['a']);
  });

  test('excludes a card whose tags field is missing rather than throwing', () => {
    const card = makeCard({ id: 'a' });
    delete (card as { tags?: string[] }).tags;
    expect(visibleCards([card], { query: '', maxMinutes: null, tags: ['ai'] })).toEqual([]);
  });
});

const NOW = '2026-08-26T12:00:00.000Z';

function column(status: 'to_read' | 'reading' | 'processed', ids: string[]) {
  return ids.map((id, i) => makeCard({ id, status, sortOrder: i }));
}

describe('reorderCards', () => {
  test('moves a card down inside its own column', () => {
    const cards = column('to_read', ['a', 'b', 'c']);
    const changes = reorderCards(cards, { cardId: 'a', toStatus: 'to_read', toIndex: 2 }, NOW);
    expect(changes).toEqual([
      { id: 'b', status: 'to_read', sortOrder: 0 },
      { id: 'c', status: 'to_read', sortOrder: 1 },
      { id: 'a', status: 'to_read', sortOrder: 2 },
    ]);
  });

  test('moves a card up inside its own column', () => {
    const cards = column('to_read', ['a', 'b', 'c']);
    const changes = reorderCards(cards, { cardId: 'c', toStatus: 'to_read', toIndex: 0 }, NOW);
    expect(changes.map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(changes.map((c) => c.sortOrder)).toEqual([0, 1, 2]);
  });

  test('moves a card between columns and renumbers both', () => {
    const cards = [...column('to_read', ['a', 'b']), ...column('reading', ['x', 'y'])];
    const changes = reorderCards(cards, { cardId: 'a', toStatus: 'reading', toIndex: 1 }, NOW);

    const reading = changes.filter((c) => c.status === 'reading');
    const toRead = changes.filter((c) => c.status === 'to_read');

    expect(reading.map((c) => c.id)).toEqual(['x', 'a', 'y']);
    expect(reading.map((c) => c.sortOrder)).toEqual([0, 1, 2]);
    expect(toRead).toEqual([{ id: 'b', status: 'to_read', sortOrder: 0 }]);
  });

  test('drops at the end when the index is past the end', () => {
    const cards = column('to_read', ['a', 'b']);
    const changes = reorderCards(cards, { cardId: 'a', toStatus: 'to_read', toIndex: 99 }, NOW);
    expect(changes.map((c) => c.id)).toEqual(['b', 'a']);
  });

  test('produces a dense sequence with no gaps', () => {
    const cards = column('to_read', ['a', 'b', 'c', 'd']);
    const changes = reorderCards(cards, { cardId: 'd', toStatus: 'to_read', toIndex: 1 }, NOW);
    expect(changes.map((c) => c.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  test('stamps readAt when a card first enters Reading', () => {
    const cards = column('to_read', ['a']);
    const changes = reorderCards(cards, { cardId: 'a', toStatus: 'reading', toIndex: 0 }, NOW);
    expect(changes.find((c) => c.id === 'a')?.readAt).toBe(NOW);
  });

  test('never rewrites a readAt the card already has', () => {
    const cards = [makeCard({ id: 'a', status: 'processed', sortOrder: 0, readAt: '2026-01-01T00:00:00.000Z' })];
    const changes = reorderCards(cards, { cardId: 'a', toStatus: 'reading', toIndex: 0 }, NOW);
    expect(changes.find((c) => c.id === 'a')?.readAt).toBeUndefined();
  });

  test('leaves readAt alone on a move that is not into Reading', () => {
    const cards = column('to_read', ['a']);
    const changes = reorderCards(cards, { cardId: 'a', toStatus: 'processed', toIndex: 0 }, NOW);
    expect(changes.find((c) => c.id === 'a')?.readAt).toBeUndefined();
  });

  test('returns an empty array when the card is unknown', () => {
    expect(reorderCards(column('to_read', ['a']), { cardId: 'zz', toStatus: 'reading', toIndex: 0 }, NOW)).toEqual([]);
  });
});