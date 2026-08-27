import Dexie from 'dexie';
import { db } from './schema';
import type { Card, Status } from '../domain/types';

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