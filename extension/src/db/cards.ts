import { nanoid } from 'nanoid';
import { canonicalizeUrl } from '../domain/url';
import { createCard } from '../domain/card';
import { mergeCard } from '../domain/ingest';
import { db } from './schema';
import Dexie from 'dexie';
import type { Card, CardInput, Status } from '../domain/types';


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

  return db.transaction('rw', db.cards, async (): Promise<IngestOutcome> => {
    const existing = await db.cards.where('url').equals(url).first();

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