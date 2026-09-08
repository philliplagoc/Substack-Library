import { describe, test, expect, beforeEach } from 'vitest';
import { db } from './schema';
import type { Card, Quote } from '../domain/types';
import {
  allCards,
  getCard,
  updateCard,
  deleteCard,
  nextSortOrder,
  ingestCard,
  updateQuote,
  addQuote,
  cardByArticleKey,
  recordExport,
  moveCardTo,
} from './cards';
import { makeCard } from '../test-support/factory';
import { applyOrder } from './cards';
import { restoreCards } from './cards';

/**
 * The one card the board holds, for tests that have just written exactly one.
 * `allCards()` returns `Card[]`, and `noUncheckedIndexedAccess` makes every
 * index read `Card | undefined`, so the tests below need this narrowed once
 * rather than at each `expect`.
 */
async function onlyCard(): Promise<Card> {
  const cards = await allCards();
  expect(cards).toHaveLength(1);
  return cards[0]!;
}

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


describe('ingestCard', () => {
  test('adds a card the board does not have', async () => {
    const result = await ingestCard({
      url: 'https://alpha.substack.com/p/questions',
      title: 'Questions',
    });
    expect(result.kind).toBe('added');
    expect(await db.cards.count()).toBe(1);
  });

  test('canonicalizes the url before it stores it', async () => {
    await ingestCard({ url: 'https://Alpha.substack.com/p/questions?utm_source=post' });
    const card = await onlyCard();
    expect(card.url).toBe('https://alpha.substack.com/p/questions');
  });

  test('treats two routes to one article as one card', async () => {
    await ingestCard({ url: 'https://alpha.substack.com/p/questions', title: 'First' });
    const second = await ingestCard({
      url: 'https://alpha.substack.com/p/questions?utm_source=share#top',
      title: 'Second',
    });
    expect(second.kind).toBe('updated');
    expect(await db.cards.count()).toBe(1);
  });

  test('keeps notes when it refreshes a known card', async () => {
    await ingestCard({ url: 'https://alpha.substack.com/p/questions', title: 'First' });
    const before = await onlyCard();
    await updateCard(before.id, { notes: 'my notes', status: 'reading' });

    await ingestCard({ url: 'https://alpha.substack.com/p/questions', title: 'Refreshed' });

    const after = await onlyCard();
    expect(after.title).toBe('Refreshed');
    expect(after.notes).toBe('my notes');
    expect(after.status).toBe('reading');
    expect(after.id).toBe(before.id);
  });

  test('rejects text that is not a url and stores nothing', async () => {
    const result = await ingestCard({ url: 'not a url' });
    expect(result.kind).toBe('rejected');
    expect(await db.cards.count()).toBe(0);
  });

  test('puts a new card at the end of To Read', async () => {
    await db.cards.add(makeCard({ id: 'existing', status: 'to_read', sortOrder: 0 }));
    const result = await ingestCard({ url: 'https://alpha.substack.com/p/new' });
    expect(result.kind).toBe('added');
    if (result.kind === 'added') expect(result.card.sortOrder).toBe(1);
  });
});

describe('applyOrder', () => {
  test('writes every change', async () => {
    await db.cards.bulkAdd([
      makeCard({ id: 'a', status: 'to_read', sortOrder: 0 }),
      makeCard({ id: 'b', status: 'to_read', sortOrder: 1 }),
    ]);

    await applyOrder([
      { id: 'b', status: 'reading', sortOrder: 0, readAt: '2026-08-26T12:00:00.000Z' },
      { id: 'a', status: 'to_read', sortOrder: 0 },
    ]);

    expect((await getCard('b'))?.status).toBe('reading');
    expect((await getCard('b'))?.readAt).toBe('2026-08-26T12:00:00.000Z');
    expect((await getCard('a'))?.sortOrder).toBe(0);
  });

  test('does nothing on an empty list', async () => {
    await db.cards.add(makeCard({ id: 'a', sortOrder: 5 }));
    await applyOrder([]);
    expect((await getCard('a'))?.sortOrder).toBe(5);
  });

  test('skips a change for a card that is gone', async () => {
    await applyOrder([{ id: 'missing', status: 'reading', sortOrder: 0 }]);
    expect(await db.cards.count()).toBe(0);
  });
});

describe('restoreCards', () => {
  test('adds cards the board does not have', async () => {
    const result = await restoreCards([
      makeCard({ id: 'a', url: 'https://alpha.substack.com/p/one' }),
      makeCard({ id: 'b', url: 'https://alpha.substack.com/p/two' }),
    ]);
    expect(result).toEqual({ added: 2, replaced: 0 });
    expect(await db.cards.count()).toBe(2);
  });

  test('restores the notes and quotes a backup holds', async () => {
    await restoreCards([
      makeCard({
        id: 'a',
        url: 'https://alpha.substack.com/p/one',
        notes: 'notes from the backup',
        quotes: [{ id: 'q', text: 'q', locatorLost: false, capturedAt: '2026-08-01' }],
      }),
    ]);
    const card = await onlyCard();
    expect(card.notes).toBe('notes from the backup');
    expect(card.quotes).toHaveLength(1);
  });

  test('replaces a card with the same url and keeps the local id', async () => {
    await db.cards.add(
      makeCard({ id: 'local', url: 'https://alpha.substack.com/p/one', notes: 'local notes' }),
    );

    const result = await restoreCards([
      makeCard({ id: 'from-file', url: 'https://alpha.substack.com/p/one', notes: 'file notes' }),
    ]);

    expect(result).toEqual({ added: 0, replaced: 1 });
    expect(await db.cards.count()).toBe(1);
    const card = await onlyCard();
    expect(card.id).toBe('local');
    expect(card.notes).toBe('file notes');
  });

  test('leaves a local card the file does not mention', async () => {
    await db.cards.add(makeCard({ id: 'keep', url: 'https://alpha.substack.com/p/keep' }));
    await restoreCards([makeCard({ id: 'new', url: 'https://alpha.substack.com/p/new' })]);
    expect(await getCard('keep')).toBeDefined();
  });

  test('skips a record whose url cannot be canonicalized', async () => {
    const result = await restoreCards([makeCard({ id: 'a', url: 'not a url' })]);
    expect(result).toEqual({ added: 0, replaced: 0 });
    expect(await db.cards.count()).toBe(0);
  });

  test('gives an id to a quote from a file written before quotes had one', async () => {
    const older = makeCard({ id: 'a' });
    // The shape a pre-version-4 backup holds: no id, and the two dead fields.
    const legacy = {
      ...older,
      quotes: [
        {
          text: 'a passage',
          comment: 'kept',
          locator: 'before it ',
          locatorLost: true,
          capturedAt: '2026-08-29T00:00:00.000Z',
        },
      ],
    } as unknown as Card;

    await restoreCards([legacy]);

    const quote = (await onlyCard()).quotes[0] as Record<string, unknown> | undefined;
    expect(typeof quote?.id).toBe('string');
    expect(quote?.text).toBe('a passage');
    expect(quote?.comment).toBe('kept');
    expect('locator' in (quote ?? {})).toBe(false);
    expect('locatorLost' in (quote ?? {})).toBe(false);
  });
});
describe('ingestCard and the routes to one article', () => {
  const CUSTOM = 'https://www.pokgaigamer.com/p/steamanimegames';
  const SHARE = 'https://open.substack.com/pub/pokgaigamer/p/steamanimegames';
  const SUBDOMAIN = 'https://pokgaigamer.substack.com/p/steamanimegames';

  test('treats the share route as the card already on the board', async () => {
    await ingestCard({ url: CUSTOM });
    const second = await ingestCard({ url: SHARE, title: 'Anime Into Games' });

    expect(second.kind).toBe('updated');
    expect(await db.cards.count()).toBe(1);
  });

  test('treats the substack subdomain as the card already on the board', async () => {
    await ingestCard({ url: CUSTOM });
    const second = await ingestCard({ url: SUBDOMAIN });

    expect(second.kind).toBe('updated');
    expect(await db.cards.count()).toBe(1);
  });

  test('keeps the url the card was added with', async () => {
    await ingestCard({ url: CUSTOM });
    await ingestCard({ url: SHARE, title: 'Anime Into Games' });

    const card = await onlyCard();
    expect(card.url).toBe(CUSTOM);
    expect(card.title).toBe('Anime Into Games');
  });

  test('stores the article key on a new card', async () => {
    await ingestCard({ url: SHARE });
    expect((await onlyCard()).articleKey).toBe('pokgaigamer/p/steamanimegames');
  });

  test('still separates the same slug in two publications', async () => {
    await ingestCard({ url: 'https://alpha.substack.com/p/welcome' });
    const second = await ingestCard({ url: 'https://beta.substack.com/p/welcome' });

    expect(second.kind).toBe('added');
    expect(await db.cards.count()).toBe(2);
  });
});

describe('restoreCards and the routes to one article', () => {
  test('replaces a card the file reached by another route', async () => {
    await db.cards.add(
      makeCard({
        id: 'local',
        url: 'https://www.pokgaigamer.com/p/steamanimegames',
        articleKey: 'pokgaigamer/p/steamanimegames',
        notes: 'local notes',
      }),
    );

    const result = await restoreCards([
      makeCard({
        id: 'from-file',
        url: 'https://open.substack.com/pub/pokgaigamer/p/steamanimegames',
        articleKey: 'pokgaigamer/p/steamanimegames',
        notes: 'file notes',
      }),
    ]);

    expect(result).toEqual({ added: 0, replaced: 1 });
    expect(await db.cards.count()).toBe(1);
    const card = await onlyCard();
    expect(card.id).toBe('local');
    expect(card.notes).toBe('file notes');
  });

  test('computes the article key for a card from an older backup', async () => {
    const { articleKey: _dropped, ...older } = makeCard({
      id: 'a',
      url: 'https://open.substack.com/pub/pokgaigamer/p/steamanimegames',
    });

    await restoreCards([older as Card]);
    expect((await onlyCard()).articleKey).toBe('pokgaigamer/p/steamanimegames');
  });
});

describe('updateQuote', () => {
  const q = (id: string, text: string): Quote => ({
    id,
    text,
    locatorLost: false,
    capturedAt: '2026-08-29T00:00:00.000Z',
  });

  test('writes a comment onto one quote and leaves its neighbours alone', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'first'), q('q2', 'second')] }));

    await updateQuote('a', 'q2', { comment: 'my reaction' });

    const card = await getCard('a');
    expect(card?.quotes[0]?.comment).toBeUndefined();
    expect(card?.quotes[1]?.comment).toBe('my reaction');
    expect(card?.quotes[1]?.text).toBe('second');
  });

  test('finds a quote by id, not by position', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'first'), q('q2', 'second')] }));

    await updateQuote('a', 'q1', { comment: 'on the first' });

    const card = await getCard('a');
    expect(card?.quotes[0]?.comment).toBe('on the first');
    expect(card?.quotes[1]?.comment).toBeUndefined();
  });

  test('leaves the verbatim text alone', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'the exact words')] }));

    await updateQuote('a', 'q1', { comment: 'hm' });

    expect((await getCard('a'))?.quotes[0]?.text).toBe('the exact words');
  });

  test('does nothing when no quote carries that id', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'only')] }));

    await updateQuote('a', 'gone', { comment: 'nowhere' });

    const card = await getCard('a');
    expect(card?.quotes).toHaveLength(1);
    expect(card?.quotes[0]?.comment).toBeUndefined();
  });

  test('does nothing when the card is gone', async () => {
    await expect(updateQuote('missing', 'q1', { comment: 'x' })).resolves.toBeUndefined();
  });
});

describe('cardByArticleKey', () => {
  test('finds the card for an article key', async () => {
    await db.cards.add(makeCard({ id: 'a', url: 'https://alpha.substack.com/p/one' }));
    const found = await cardByArticleKey('alpha/p/one');
    expect(found?.id).toBe('a');
  });

  test('finds one card whichever route the reader arrived by', async () => {
    // The same article, added from the share route, keys the same way.
    await db.cards.add(
      makeCard({ id: 'a', url: 'https://open.substack.com/pub/alpha/p/one' }),
    );
    expect((await cardByArticleKey('alpha/p/one'))?.id).toBe('a');
  });

  test('returns undefined for a key no card holds', async () => {
    expect(await cardByArticleKey('alpha/p/nothing')).toBeUndefined();
  });
});

describe('addQuote', () => {
  const q = (text: string): Quote => ({
    id: `id-${text}`,
    text,
    locatorLost: false,
    capturedAt: '2026-08-29T00:00:00.000Z',
  });

  test('appends to the end, so indexes stay stable', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('first')] }));

    await addQuote('a', q('second'));

    const card = await getCard('a');
    expect(card?.quotes.map((x) => x.text)).toEqual(['first', 'second']);
  });

  test('adds the first quote to a card that has none', async () => {
    await db.cards.add(makeCard({ id: 'a' }));
    await addQuote('a', q('only'));
    expect((await getCard('a'))?.quotes).toHaveLength(1);
  });

  test('leaves the notes and the status alone', async () => {
    await db.cards.add(makeCard({ id: 'a', notes: 'kept', status: 'reading' }));
    await addQuote('a', q('x'));
    const card = await getCard('a');
    expect(card?.notes).toBe('kept');
    expect(card?.status).toBe('reading');
  });

  test('does nothing when the card is gone', async () => {
    await expect(addQuote('missing', q('x'))).resolves.toBeUndefined();
  });
});

describe('recordExport', () => {
  test('takes a never-exported card to version 1', async () => {
    await db.cards.add(makeCard({ id: 'c1', exportVersion: 0 }));

    await recordExport('c1', '2026-08-30T10:00:00.000Z');

    const card = await db.cards.get('c1');
    expect(card?.exportVersion).toBe(1);
    expect(card?.lastExportedAt).toBe('2026-08-30T10:00:00.000Z');
  });

  test('increments an already-exported card', async () => {
    await db.cards.add(
      makeCard({ id: 'c1', exportVersion: 1, lastExportedAt: '2026-08-29T10:00:00.000Z' }),
    );

    await recordExport('c1', '2026-08-30T10:00:00.000Z');

    const card = await db.cards.get('c1');
    expect(card?.exportVersion).toBe(2);
    expect(card?.lastExportedAt).toBe('2026-08-30T10:00:00.000Z');
  });

  test('changes nothing else on the card', async () => {
    await db.cards.add(makeCard({ id: 'c1', notes: 'kept', status: 'reading' }));

    await recordExport('c1', '2026-08-30T10:00:00.000Z');

    const card = await db.cards.get('c1');
    expect(card?.notes).toBe('kept');
    expect(card?.status).toBe('reading');
  });

  test('does nothing for a card that is not there', async () => {
    await expect(recordExport('missing', '2026-08-30T10:00:00.000Z')).resolves.toBeUndefined();
    expect(await db.cards.count()).toBe(0);
  });
});

describe('moveCardTo', () => {
  test('puts the card at the top of the target column', async () => {
    await db.cards.bulkAdd([
      makeCard({ id: 'a', status: 'processed', sortOrder: 0 }),
      makeCard({ id: 'b', status: 'processed', sortOrder: 1 }),
      makeCard({ id: 'c', status: 'reading', sortOrder: 0 }),
    ]);

    await moveCardTo('c', 'processed', '2026-08-30T10:00:00.000Z');

    const processed = await db.cards
      .where('status')
      .equals('processed')
      .sortBy('sortOrder');
    expect(processed.map((card) => card.id)).toEqual(['c', 'a', 'b']);
  });

  test('leaves the cards it did not move in their order', async () => {
    await db.cards.bulkAdd([
      makeCard({ id: 'a', status: 'to_read', sortOrder: 0 }),
      makeCard({ id: 'b', status: 'to_read', sortOrder: 1 }),
      makeCard({ id: 'c', status: 'to_read', sortOrder: 2 }),
    ]);

    await moveCardTo('b', 'processed', '2026-08-30T10:00:00.000Z');

    const toRead = await db.cards.where('status').equals('to_read').sortBy('sortOrder');
    expect(toRead.map((card) => card.id)).toEqual(['a', 'c']);
  });

  test('stamps readAt on a first move into Reading', async () => {
    await db.cards.add(makeCard({ id: 'a', status: 'to_read', readAt: undefined }));

    await moveCardTo('a', 'reading', '2026-08-30T10:00:00.000Z');

    expect((await db.cards.get('a'))?.readAt).toBe('2026-08-30T10:00:00.000Z');
  });

  test('does nothing for a card that is not there', async () => {
    await db.cards.add(makeCard({ id: 'a', status: 'to_read', sortOrder: 0 }));

    await moveCardTo('missing', 'processed', '2026-08-30T10:00:00.000Z');

    expect((await db.cards.get('a'))?.status).toBe('to_read');
  });
});
