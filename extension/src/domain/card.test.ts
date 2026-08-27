import { describe, test, expect } from 'vitest';
import { createCard } from './card';

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