import { nanoid } from 'nanoid';
import { articleKey, canonicalizeUrl } from '../domain/url';
import { createCard } from '../domain/card';
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

      const existing = await db.cards.where('articleKey').equals(key).first();
      if (existing) {
        await db.cards.put({ ...card, id: existing.id, url, articleKey: key });
        replaced += 1;
      } else {
        await db.cards.put({ ...card, url, articleKey: key });
        added += 1;
      }
    }
  });

  return { added, replaced };
}

/**
 * Change one quote on one card.
 *
 * Quotes have no id, so the index is the address. It is stable because quotes
 * are only ever appended, never inserted or reordered. Read, patch, write, in
 * one transaction, because two panels can hold the same card open at once.
 */
export async function updateQuote(
  cardId: string,
  index: number,
  changes: Partial<Quote>,
): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;
    const quote = card.quotes[index];
    if (!quote) return;

    const quotes = card.quotes.slice();
    quotes[index] = { ...quote, ...changes };
    await db.cards.update(cardId, { quotes });
  });
}
