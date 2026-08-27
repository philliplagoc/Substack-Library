import Dexie, { type EntityTable } from 'dexie';
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
    }
}

export const db = new SubstackLibraryDb();