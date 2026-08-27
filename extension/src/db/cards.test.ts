import { describe, test, expect, beforeEach } from 'vitest';
import { db } from './schema';
import { allCards, getCard, updateCard, deleteCard, nextSortOrder } from './cards';
import { makeCard } from '../test-support/factory';

beforeEach(async () => {
  await db.cards.clear();
});

describe('the cards table', () => {
  test('rejects a second card with the same url', async () => {
    await db.cards.add(makeCard({ id: 'a', url: 'https://alpha.substack.com/p/one' }));
    await expect(
      db.cards.add(makeCard({ id: 'b', url: 'https://alpha.substack.com/p/one' })),
    ).rejects.toThrow();
  });

  test('stores fields that are not indexed', async () => {
    await db.cards.add(makeCard({ id: 'a', notes: 'kept', tags: ['x'] }));
    const found = await getCard('a');
    expect(found?.notes).toBe('kept');
    expect(found?.tags).toEqual(['x']);
  });
});

describe('allCards', () => {
  test('returns cards ordered within a status by sortOrder', async () => {
    await db.cards.bulkAdd([
      makeCard({ id: 'a', status: 'to_read', sortOrder: 2 }),
      makeCard({ id: 'b', status: 'to_read', sortOrder: 0 }),
      makeCard({ id: 'c', status: 'to_read', sortOrder: 1 }),
    ]);
    const ids = (await allCards()).map((c) => c.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  test('returns an empty array when the table is empty', async () => {
    expect(await allCards()).toEqual([]);
  });
});

describe('updateCard', () => {
  test('changes only the named fields', async () => {
    await db.cards.add(makeCard({ id: 'a', notes: '', title: 'Original' }));
    await updateCard('a', { notes: 'written' });
    const found = await getCard('a');
    expect(found?.notes).toBe('written');
    expect(found?.title).toBe('Original');
  });
});

describe('deleteCard', () => {
  test('removes the card', async () => {
    await db.cards.add(makeCard({ id: 'a' }));
    await deleteCard('a');
    expect(await getCard('a')).toBeUndefined();
  });
});

describe('nextSortOrder', () => {
  test('returns 0 for an empty column', async () => {
    expect(await nextSortOrder('reading')).toBe(0);
  });

  test('returns one past the highest sortOrder in that column', async () => {
    await db.cards.bulkAdd([
      makeCard({ id: 'a', status: 'to_read', sortOrder: 0 }),
      makeCard({ id: 'b', status: 'to_read', sortOrder: 4 }),
      makeCard({ id: 'c', status: 'reading', sortOrder: 9 }),
    ]);
    expect(await nextSortOrder('to_read')).toBe(5);
  });
});