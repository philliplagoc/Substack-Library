import Dexie, { type EntityTable } from 'dexie';
import { nanoid } from 'nanoid';
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

        // The three Substack flags leave Card in Milestone 4. Nothing outside
        // three checkboxes in the board's card panel ever read them (a panel
        // since deleted), and those checkboxes
        // asked the reader to keep a copy of state Substack already holds.
        //
        // The store string is identical to version 2. No index changes; only
        // the rows do.
        this.version(3)
            .stores({
                cards: 'id, &url, articleKey, status, savedAt, [status+sortOrder]',
            })
            .upgrade((tx) =>
                tx.table('cards').toCollection().modify((card: Record<string, unknown>) => {
                    delete card.liked;
                    delete card.commented;
                    delete card.unsavedFromSubstack;
                }),
            );

        // Quotes get an id. Until now `db/cards.ts` addressed a quote by its
        // index into card.quotes, which was sound only while quotes were
        // append-only. Removal ends that: take one out and every index below
        // it shifts, so a comment being typed into quote 2 lands on quote 1.
        //
        // The two locator fields go in the same pass. The staleness check they
        // fed never worked outside an open article tab, and it is deleted.
        //
        // The store string is identical to version 3. No index changes; only
        // the rows do.
        this.version(4)
            .stores({
                cards: 'id, &url, articleKey, status, savedAt, [status+sortOrder]',
            })
            .upgrade((tx) =>
                tx.table('cards').toCollection().modify((card: Record<string, unknown>) => {
                    const quotes = card.quotes;
                    if (!Array.isArray(quotes)) return;
                    for (const quote of quotes as Record<string, unknown>[]) {
                        // A card written by an aborted upgrade may already have
                        // one. Never reissue an id something else may reference.
                        if (typeof quote.id !== 'string') quote.id = nanoid();
                        delete quote.locator;
                        delete quote.locatorLost;
                    }
                }),
            );
    }
}

export const db = new SubstackLibraryDb();