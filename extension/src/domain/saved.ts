/**
 * The Saved list, turned from strings into values.
 *
 * The parse is split in two. `substack/saved.ts` runs inside Substack's page
 * and may import nothing, so it returns raw strings. The edge cases live here,
 * where Vitest can reach them.
 *
 * Types only, like every other file in this directory.
 */
import type { CardInput, Medium } from './types';

/**
 * One row of the Saved list, exactly as the page gives it up.
 *
 * `substack/saved.ts` declares an identical private interface, because it may
 * not import this one. The two meet in `background.ts`, where a mismatch is a
 * compile error.
 */
export interface SavedEntry {
  url: string;
  title: string | null;
  publication: string | null;
  /** The profile behind the avatar, e.g. "Daniel Parris". Not the publication. */
  author: string | null;
}

export interface SavedImport {
  input: CardInput;
  medium: Medium | null;
}

export function savedEntryToInput(entry: SavedEntry): SavedImport {
  return {
    input: {
      url: entry.url,
      // undefined rather than null or '': mergeCard keeps the existing value
      // when the incoming one is falsy, and a missing field must not blank a
      // good one on a card the board already holds.
      title: entry.title?.trim() || undefined,
      author: entry.author?.trim() || undefined,
      publication: entry.publication?.trim() || undefined,
      // Absent from substack.com/saved. `spike/README.md`, "Saved page read
      // paths": the page carries no reading estimate and no read/watch/listen
      // word, so neither can be read here. `background.ts` fills
      // `estimatedReadingMinutes` from the real body word count on capture,
      // which is a better number than Substack's estimate anyway. A card
      // synced and never opened shows "— min" until it is.
      estimatedReadingMinutes: undefined,
    },
    // Same reason. Null leaves whatever the card already carries in place.
    medium: null,
  };
}
