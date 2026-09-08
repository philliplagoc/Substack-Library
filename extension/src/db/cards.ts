import { nanoid } from 'nanoid';
import { articleKey, canonicalizeUrl } from '../domain/url';
import { createCard, reorderCards } from '../domain/card';
import { mergeCard } from '../domain/ingest';
import { db } from './schema';
import Dexie from 'dexie';
import type { Card, CardInput, Quote, Status } from '../domain/types';
import type { OrderChange } from '../domain/card';


/** Every card, ordered by status then sortOrder */
export async function allCards(): Promise<Card[]> {
    return db.cards.orderBy('[status+sortOrder]').toArray();
}

export async function getCard(id: string): Promise<Card | undefined> {
    return db.cards.get(id);
}

export async function updateCard(id: string, changes: Partial<Card>): Promise<void> {
  await db.cards.update(id, changes);
}

export async function deleteCard(id: string): Promise<void> {
  await db.cards.delete(id);
}

/** The sortOrder a new card takes at the end of a column. */
export async function nextSortOrder(status: Status): Promise<number> {
  const last = await db.cards
    .where('[status+sortOrder]')
    .between([status, Dexie.minKey], [status, Dexie.maxKey])
    .last();
  return last ? last.sortOrder + 1 : 0;
}

export type IngestOutcome =
  | { kind: 'added'; card: Card }
  | { kind: 'updated'; card: Card }
  | { kind: 'rejected'; reason: string };

/**
 * The single capture path. The add-by-URL form calls it now. Milestone 2's
 * content script and Milestone 3's sync call it later. Merge rules live in
 * domain/ingest.ts so every caller gets the same behaviour.
 */
export async function ingestCard(input: CardInput): Promise<IngestOutcome> {
  const url = canonicalizeUrl(input.url);
  if (url === null) {
    return { kind: 'rejected', reason: `Not an http or https URL: ${input.url}` };
  }

  const key = articleKey(url) ?? url;

  return db.transaction('rw', db.cards, async (): Promise<IngestOutcome> => {
    const existing = await db.cards.where('articleKey').equals(key).first();

    if (existing) {
      const merged = mergeCard(existing, { ...input, url });
      await db.cards.put(merged);
      return { kind: 'updated', card: merged };
    }

    const card = createCard(
      { ...input, url },
      {
        id: nanoid(),
        savedAt: new Date().toISOString(),
        sortOrder: await nextSortOrder('to_read'),
      },
    );
    await db.cards.add(card);
    return { kind: 'added', card };
  });
}

/** Write a whole reordering in one transaction. */
export async function applyOrder(changes: OrderChange[]): Promise<void> {
  if (changes.length === 0) return;

  await db.transaction('rw', db.cards, async() => {
    for (const change of changes) {
      const patch: Partial<Card> = { status: change.status, sortOrder: change.sortOrder };
      if (change.readAt) patch.readAt = change.readAt;
      await db.cards.update(change.id, patch);
    }
  })
}

/**
 * One quote from a backup file, brought up to the current shape.
 *
 * restoreCards writes whole cards and runs no migration, so a file written
 * before schema version 4 arrives with idless quotes carrying the two dead
 * locator fields. This is the same reason articleKey is recomputed below
 * rather than trusted: a file is a record of the past, not of the schema.
 */
function normalizeQuote(quote: Quote): Quote {
  const { locator: _locator, locatorLost: _locatorLost, ...rest } = quote as Quote & {
    locator?: string;
    locatorLost?: boolean;
  };
  // `locatorLost` is still required on Quote until task 3 drops it, but a
  // normalized quote no longer carries it. The cast bridges that gap.
  return { ...rest, id: rest.id ?? nanoid() } as unknown as Quote;
}

/**
 * Write whole cards from a backup file.
 *
 * A card with the same canonical URL is replaced, keeping the id already on
 * the board so the unique url index stays satisfied. A card the board does not
 * have is added. A local card the file does not mention is left alone: restore
 * never deletes.
 *
 * This does not go through ingestCard(). ingestCard carries metadata only, and
 * routing a backup through it would drop every note and quote in the file.
 */
export async function restoreCards(cards: Card[]): Promise<{ added: number; replaced: number }> {
  let added = 0;
  let replaced = 0;

  await db.transaction('rw', db.cards, async () => {
    for (const card of cards) {
      const url = canonicalizeUrl(card.url);
      if (url === null) continue;

      // A file written before articleKey existed carries no key. Compute it
      // rather than trust the file, so an old backup restores correctly.
      const key = articleKey(url) ?? url;
      const quotes = (card.quotes ?? []).map(normalizeQuote);

      const existing = await db.cards.where('articleKey').equals(key).first();
      if (existing) {
        await db.cards.put({ ...card, id: existing.id, url, articleKey: key, quotes });
        replaced += 1;
      } else {
        await db.cards.put({ ...card, url, articleKey: key, quotes });
        added += 1;
      }
    }
  });

  return { added, replaced };
}

/**
 * Change one quote on one card.
 *
 * Addressed by `quote.id`, not by position. Removal means a quote's index is
 * no longer stable, and an index that shifts under a mounted textarea writes
 * the reader's reaction onto the wrong passage.
 *
 * Read, patch, write, in one transaction, because two panels can hold the same
 * card open at once.
 */
export async function updateQuote(
  cardId: string,
  quoteId: string,
  changes: Partial<Quote>,
): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;

    const index = card.quotes.findIndex((quote) => quote.id === quoteId);
    if (index === -1) return;

    const quotes = card.quotes.slice();
    quotes[index] = { ...quotes[index]!, ...changes };
    await db.cards.update(cardId, { quotes });
  });
}

/**
 * The card for one article, whichever of Substack's routes it was added by.
 *
 * `articleKey` is indexed but not unique, because a board written before
 * schema version 2 can already hold a duplicate pair. `.first()` is therefore
 * the honest read: it returns one card, and a board that holds two for one
 * article shows the older of them until the reader deletes one by hand.
 */
export async function cardByArticleKey(key: string): Promise<Card | undefined> {
  return db.cards.where('articleKey').equals(key).first();
}

/**
 * Append a quote to a card.
 *
 * Read, append, write, in one transaction. Position no longer addresses
 * anything, so appending is simply where a new quote reads best: last captured,
 * last shown.
 */
export async function addQuote(cardId: string, quote: Quote): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;
    await db.cards.update(cardId, { quotes: [...card.quotes, quote] });
  });
}

/**
 * Record that a card was exported.
 *
 * Read, increment, write, in one transaction, because the board's detail panel
 * and the reading panel can hold the same card open at once and two clicks
 * racing through get-then-update would both read the same version.
 *
 * A card that is gone is not an error. The reader deleted it between the click
 * and this write, and there is nothing left to record against.
 */
export async function recordExport(cardId: string, at: string): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;
    await db.cards.update(cardId, {
      exportVersion: card.exportVersion + 1,
      lastExportedAt: at,
    });
  });
}

/**
 * Move one card to the top of another column.
 *
 * This was `ReadingPanel`'s private `moveTo`. It moved down here because the
 * Processed offer needs the same move from a second component, and because
 * src/ui/ has no automated tests: a behaviour living in a component is a
 * behaviour only a manual check can verify.
 *
 * reorderCards renumbers whole columns, so it needs every card. Reading them
 * inside the transaction is what makes the renumber safe against a concurrent
 * drag on the board. applyOrder called in here joins this transaction rather
 * than opening its own; Dexie reuses an active transaction of a compatible
 * scope.
 */
export async function moveCardTo(
  cardId: string,
  toStatus: Status,
  now: string,
): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const cards = await db.cards.orderBy('[status+sortOrder]').toArray();
    // reorderCards returns [] for a card it cannot find, and applyOrder returns
    // early on an empty list, so a deleted card falls through both.
    await applyOrder(reorderCards(cards, { cardId, toStatus, toIndex: 0 }, now));
  });
}
