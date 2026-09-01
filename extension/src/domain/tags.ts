import type { Card } from './types';

/**
 * The characters that would break `tags: [a, b]` in a note's frontmatter.
 *
 * A comma splits one tag into two entries. A bracket closes the sequence early.
 * Obsidian's response to broken frontmatter is to fail the whole block, so a
 * comma in a tag costs the note its title, its author, and its URL.
 *
 * They are stripped on entry rather than quoted on export, because a tag is a
 * short label somebody typed and there is no meaning in a comma inside one.
 * Quoting would keep the character and push the problem into the filter row,
 * the datalist, and every future reader of a tag.
 */
const UNSAFE = /[,[\]"]/g;

/**
 * One tag, in the one spelling the whole application uses, or `null` when there
 * is no tag left after normalizing.
 *
 * Lowercasing is what makes the suggestion list worth having. Without it `AI`
 * and `ai` are two tags, the filter row offers both, and neither one finds
 * every card. The cost is that a tag cannot be capitalized, which for a
 * personal reading library is not a loss worth code.
 */
export function normalizeTag(raw: string): string | null {
  // Strip before trim: "[ ai ]" clears its brackets to " ai ", and only then
  // does trimming the ends leave "ai". Trim first and the brackets guard a
  // space that survives to the result.
  const tag = raw
    .replace(UNSAFE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // Last, so "[,]" and a run of spaces both land here rather than as "".
  return tag === '' ? null : tag;
}

/** The list with `raw` added, or unchanged if it is empty or already there. */
export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (tag === null || tags.includes(tag)) return tags;
  return [...tags, tag];
}

/** The list without `tag`. Every other tag keeps its position. */
export function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((t) => t !== tag);
}

/**
 * Every distinct tag in use, sorted. Feeds the datalist and the filter row.
 *
 * `card.tags ?? []` rather than `card.tags`: a card restored from a
 * hand-edited backup can be missing the field, and building a vocabulary is not
 * the place to find that out.
 */
export function allTags(cards: Card[]): string[] {
  const seen = new Set<string>();
  for (const card of cards) {
    for (const tag of card.tags ?? []) seen.add(tag);
  }
  return [...seen].sort();
}
