import Dexie from 'dexie';
import { describe, test, expect } from 'vitest';
import { SubstackLibraryDb } from './schema';
import { makeCard } from '../test-support/factory';

/** The version 1 store definition, frozen. History does not change. */
const V1_STORES = { cards: 'id, &url, status, savedAt, [status+sortOrder]' };

/** The version 2 store definition, frozen. History does not change. */
const V2_STORES = { cards: 'id, &url, articleKey, status, savedAt, [status+sortOrder]' };

describe('the version 2 upgrade', () => {
  test('backfills articleKey onto cards written by version 1', async () => {
    const name = `migration-${Math.random().toString(36).slice(2)}`;

    const v1 = new Dexie(name);
    v1.version(1).stores(V1_STORES);
    await v1.open();
    const { articleKey: _dropped, ...older } = makeCard({
      id: 'a',
      url: 'https://open.substack.com/pub/pokgaigamer/p/steamanimegames',
    });
    await v1.table('cards').add(older);
    v1.close();

    const v2 = new SubstackLibraryDb(name);
    await v2.open();
    const row = await v2.cards.get('a');
    v2.close();

    expect(row?.articleKey).toBe('pokgaigamer/p/steamanimegames');
  });

  test('leaves a card whose url cannot be canonicalized findable', async () => {
    const name = `migration-${Math.random().toString(36).slice(2)}`;

    const v1 = new Dexie(name);
    v1.version(1).stores(V1_STORES);
    await v1.open();
    const { articleKey: _dropped, ...older } = makeCard({ id: 'bad', url: 'not a url' });
    await v1.table('cards').add(older);
    v1.close();

    const v2 = new SubstackLibraryDb(name);
    await v2.open();
    const row = await v2.cards.get('bad');
    v2.close();

    expect(row).toBeDefined();
    expect(row?.articleKey).toBe('not a url');
  });
});

describe('the version 3 upgrade', () => {
  test('deletes the three Substack flags and keeps every other field', async () => {
    const name = `migration-${Math.random().toString(36).slice(2)}`;

    const v2 = new Dexie(name);
    v2.version(1).stores(V1_STORES);
    v2.version(2).stores(V2_STORES);
    await v2.open();
    // makeCard no longer produces these three, so the row states them itself.
    await v2.table('cards').add({
      ...makeCard({ id: 'flags', title: 'Kept', notes: 'also kept', tags: ['ai'] }),
      liked: true,
      commented: true,
      unsavedFromSubstack: true,
    });
    v2.close();

    const v3 = new SubstackLibraryDb(name);
    await v3.open();
    const row = (await v3.cards.get('flags')) as Record<string, unknown> | undefined;
    v3.close();

    expect(row).toBeDefined();
    expect(row && 'liked' in row).toBe(false);
    expect(row && 'commented' in row).toBe(false);
    expect(row && 'unsavedFromSubstack' in row).toBe(false);
    expect(row?.title).toBe('Kept');
    expect(row?.notes).toBe('also kept');
    expect(row?.tags).toEqual(['ai']);
  });
});

/** The version 3 store definition, frozen. History does not change. */
const V3_STORES = { cards: 'id, &url, articleKey, status, savedAt, [status+sortOrder]' };

describe('the version 4 upgrade', () => {
  test('gives every stored quote an id and strips the dead locator fields', async () => {
    const name = `migration-${Math.random().toString(36).slice(2)}`;

    const v3 = new Dexie(name);
    v3.version(1).stores(V1_STORES);
    v3.version(2).stores(V2_STORES);
    v3.version(3).stores(V3_STORES);
    await v3.open();
    await v3.table('cards').add({
      ...makeCard({ id: 'quoted' }),
      quotes: [
        {
          text: 'first passage',
          comment: 'my reaction',
          locator: 'words before ',
          locatorLost: true,
          capturedAt: '2026-08-29T00:00:00.000Z',
        },
        {
          text: 'second passage',
          locator: '',
          locatorLost: false,
          capturedAt: '2026-08-29T00:00:00.000Z',
        },
      ],
    });
    v3.close();

    const v4 = new SubstackLibraryDb(name);
    await v4.open();
    const row = await v4.cards.get('quoted');
    v4.close();

    const quotes = (row?.quotes ?? []) as unknown as Record<string, unknown>[];
    expect(quotes).toHaveLength(2);
    // Ids exist and are distinct. Their values are nanoid's business.
    expect(typeof quotes[0]?.id).toBe('string');
    expect(quotes[0]?.id).not.toBe(quotes[1]?.id);
    for (const quote of quotes) {
      expect('locator' in quote).toBe(false);
      expect('locatorLost' in quote).toBe(false);
    }
    // Everything the reader wrote survives.
    expect(quotes[0]?.text).toBe('first passage');
    expect(quotes[0]?.comment).toBe('my reaction');
    expect(quotes[1]?.text).toBe('second passage');
  });

  test('leaves a card with no quotes alone', async () => {
    const name = `migration-${Math.random().toString(36).slice(2)}`;

    const v3 = new Dexie(name);
    v3.version(1).stores(V1_STORES);
    v3.version(2).stores(V2_STORES);
    v3.version(3).stores(V3_STORES);
    await v3.open();
    await v3.table('cards').add(makeCard({ id: 'bare', quotes: [] }));
    v3.close();

    const v4 = new SubstackLibraryDb(name);
    await v4.open();
    const row = await v4.cards.get('bare');
    v4.close();

    expect(row?.quotes).toEqual([]);
  });
});
