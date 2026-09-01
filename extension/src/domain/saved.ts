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
  /** ".reader2-item-meta", e.g. "Hussain Ibarra∙14 min read". */
  itemMeta: string | null;
}

export interface ItemMeta {
  author: string | null;
  minutes: number | null;
  medium: Medium | null;
}

export interface SavedImport {
  input: CardInput;
  medium: Medium | null;
}

export function savedEntryToInput(entry: SavedEntry): SavedImport {
  const meta = parseItemMeta(entry.itemMeta);

  return {
    input: {
      url: entry.url,
      // undefined rather than null or '': mergeCard keeps the existing value
      // when the incoming one is falsy, and a missing field must not blank a
      // good one on a card the board already holds.
      title: entry.title?.trim() || undefined,
      author: meta.author ?? undefined,
      publication: entry.publication?.trim() || undefined,
      estimatedReadingMinutes: meta.minutes ?? undefined,
    },
    medium: meta.medium,
  };
}

/**
 * "Hussain Ibarra∙14 min read" into an author, a minute count, and a medium.
 *
 * TODO(human)
 */
export function parseItemMeta(raw: string | null): ItemMeta {
  const empty: ItemMeta = { author: null, minutes: null, medium: null };
  if (!raw) return empty;

  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return empty;

  // Anchored at the end. Both counts are optional so "∙read" still names a
  // medium, and the medium word is required so "14 min" alone is not a
  // reading estimate.
  const match = /(?:(\d+)\s*hr)?\s*(?:(\d+)\s*min)?\s*(read|watch|listen)$/i.exec(text);

  if (!match) return { ...empty, author: text };

  const hours = Number(match[1] ?? 0);
  const mins = Number(match[2] ?? 0);
  const minutes = hours * 60 + mins;

  // Whatever precedes the duration is the author, once the separator that
  // joined them is dropped.
  const author = text.slice(0, match.index).replace(/[∙·•\-\s]+$/, '').trim();

  return {
    author: author || null,
    minutes: minutes > 0 ? minutes : null,
    medium: match[3]!.toLowerCase() as Medium,
  };
}
