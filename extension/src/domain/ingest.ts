import type { Card, CardInput } from './types';

/**
 * Fold fresh metadata into a card the board already holds.
 * Refresh what the publisher owns. Never touch what the reader wrote.
 */
export function mergeCard(existing: Card, incoming: CardInput & { url: string }): Card {
    return {
        ...existing,
        // The url is not refreshed. The board already links somewhere that
        // works, and the incoming url is only another route to the same
        // article. Identity lives in articleKey, which does not change.
        title: incoming.title?.trim() || existing.title,
        author: incoming.author?.trim() || existing.author,
        publication: incoming.publication?.trim() || existing.publication,
        estimatedReadingMinutes: incoming.estimatedReadingMinutes ?? existing.estimatedReadingMinutes,
    };
}