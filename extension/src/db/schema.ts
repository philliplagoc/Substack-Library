import Dexie, { type EntityTable } from 'dexie';
import { articleKey } from '../domain/url';
import type { Card } from '../domain/types';

export class SubstackLibraryDb extends Dexie {
    cards!: EntityTable<Card, 'id'>;

    constructor(name = 'substack-library') {
        super(name);
        // The string lists INDEXES, not columns. Every other Card field
        // is still stored and read back; it just cannot be queried efficiently.
        //  id                         primary key
        //  &url                       unique. A duplicate insert throws.
        // [status+sortOrder]          compound. A column reads already ordered
        this.version(1).stores({
            cards: 'id, &url, status, savedAt, [status+sortOrder]',
        });

        // articleKey is indexed but NOT unique. A board written before this
        // version can already hold two cards for one article, and a unique
        // index would make this upgrade throw and the board fail to open.
        // &url still blocks the exact duplicate; ingestCard blocks the rest.
        this.version(2)
            .stores({
                cards: 'id, &url, articleKey, status, savedAt, [status+sortOrder]',
            })
            .upgrade((tx) =>
                tx.table('cards').toCollection().modify((card: Card) => {
                    card.articleKey = articleKey(card.url) ?? card.url;
                }),
            );
    }
}

export const db = new SubstackLibraryDb();