import { STATUS_LABELS } from './card';
import type { Card, Quote, Status } from './types';

/**
 * A YAML double-quoted scalar.
 *
 * Titles are quoted because Substack titles carry colons, and an unquoted YAML
 * scalar containing ": " is a parse error rather than a string. Inside double
 * quotes YAML reads backslash escapes, so a literal backslash has to be doubled
 * BEFORE the quotes are escaped, or the escaping of a quote would itself be
 * escaped away.
 *
 * All whitespace runs are flattened to a single space first. A home-feed title
 * comes from trimmed anchor text and JSON-LD headline can carry a literal
 * newline; a newline inside the quotes would emit a second physical line in the
 * `---` fence that is not a `key: value` pair, and Obsidian then fails to parse
 * the whole frontmatter block. Flattening also neutralizes tabs.
 */
function yamlString(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return `"${flat.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function frontmatter(card: Card): string {
  const lines = [
    `title: ${yamlString(card.title)}`,
    `author: ${yamlString(card.author)}`,
    `publication: ${yamlString(card.publication)}`,
    // A URL holds no YAML metacharacter that needs quoting.
    `url: ${card.url}`,
    `saved: ${card.savedAt.slice(0, 10)}`,
  ];

  // A key with no value is omitted, never emitted empty: `read:` with nothing
  // after it reads as null in Obsidian's Properties view and looks like a bug.
  if (card.readAt) lines.push(`read: ${card.readAt.slice(0, 10)}`);
  if (typeof card.estimatedReadingMinutes === 'number') {
    lines.push(`reading_minutes: ${card.estimatedReadingMinutes}`);
  }

  // The one deliberate exception: an empty list still emits its key, so the
  // field shows up in Obsidian and can be filled there.
  lines.push(`tags: [${card.tags.join(', ')}]`);

  return ['---', ...lines, '---'].join('\n');
}

/**
 * One quote as a Markdown block.
 *
 * Every line of the text is prefixed, so a quote spanning a paragraph break
 * stays ONE blockquote instead of two. A blank line inside the quote becomes a
 * bare ">", which is what holds the block together.
 */
function quoteBlock(quote: Quote): string {
  const blocks = [
    quote.text
      .split('\n')
      .map((line) => `> ${line}`.trimEnd())
      .join('\n'),
  ];

  if (quote.comment?.trim()) blocks.push(quote.comment.trim());

  return blocks.join('\n\n');
}

/**
 * The quotes and the notes of one card.
 *
 * `level` is the heading level the notes heading takes. A single note nests it
 * under nothing and passes 2. The library nests it under a `###` card heading
 * and passes 4. One builder rather than two copies: the next change to how a
 * quote or its comment is rendered has to hold in both files, and the day it is
 * made once is the day the two disagree.
 */
function cardBody(card: Card, level: number): string[] {
  const blocks: string[] = [];

  for (const quote of card.quotes) blocks.push(quoteBlock(quote));

  // The heading and the body are omitted together. There is no empty heading.
  if (card.notes.trim()) blocks.push(`${'#'.repeat(level)} Notes`, card.notes.trim());

  return blocks;
}

export function toMarkdown(card: Card): string {
  return [frontmatter(card), ...cardBody(card, 2)].join('\n\n') + '\n';
}

/** Every character Windows forbids in a filename. */
const FORBIDDEN = /[\\/:*?"<>|]/g;

const MAX_TITLE = 120;

/**
 * A title made safe to be a filename.
 *
 * Order matters: replace, collapse, trim, truncate. Replacing after trimming
 * would reintroduce a leading "-" from a title starting with "/".
 */
function sanitizeTitle(raw: string): string {
  const replaced = raw.replace(FORBIDDEN, '-').replace(/\s+/g, ' ');
  const trimmed = replaced.replace(/^[.\s-]+/, '').replace(/[.\s-]+$/, '');

  if (trimmed.length <= MAX_TITLE) return trimmed;

  const cut = trimmed.slice(0, MAX_TITLE);
  const lastSpace = cut.lastIndexOf(' ');
  // A single 120-character word has no boundary to cut on. Cut it anyway; a
  // truncated word beats a filename the filesystem refuses.
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.\s-]+$/, '');
}

/** The last path segment of a URL, sanitized. Empty when there is none. */
function slugFromUrl(raw: string): string {
  try {
    const segments = new URL(raw).pathname.split('/').filter(Boolean);
    return sanitizeTitle(segments[segments.length - 1] ?? '');
  } catch {
    // A card can hold a URL this cannot parse. A filename is not the place to
    // find that out, so fall through to `untitled`.
    return '';
  }
}

/**
 * `YYYY-MM-DD - Title.md`, with ` (vN)` before the extension when N > 1.
 *
 * The date is savedAt, not the export date, so two exports of one card sort
 * next to each other in a Downloads folder.
 */
export function exportFilename(card: Card, version: number): string {
  const date = card.savedAt.slice(0, 10);
  const stem = sanitizeTitle(card.title) || slugFromUrl(card.url) || 'untitled';
  const suffix = version > 1 ? ` (v${version})` : '';
  return `${date} - ${stem}${suffix}.md`;
}

/** Board order. Every column is emitted, in this order, empty or not. */
const STATUS_ORDER: Status[] = ['to_read', 'reading', 'processed'];

/** Author, publication, and reading time, dropping whatever is missing. */
function metaLine(card: Card): string {
  const parts = [card.author, card.publication].filter(Boolean);
  if (typeof card.estimatedReadingMinutes === 'number') {
    parts.push(`${card.estimatedReadingMinutes} min`);
  }
  return parts.join(' · ');
}

/** One card as it appears inside the library file. */
function libraryCard(card: Card): string[] {
  const blocks: string[] = [`### ${card.title}`];

  // Pushed even when empty: a card with no author, publication, or estimate
  // still gets the blank paragraph, so every card block has the same shape.
  blocks.push(metaLine(card));

  blocks.push(`[${card.title}](${card.url})`);

  if (card.tags.length > 0) blocks.push(`Tags: ${card.tags.join(', ')}`);

  // Spread, not pushed: cardBody returns the quote blocks and the `#### Notes`
  // heading as separate paragraphs, already at level four.
  blocks.push(...cardBody(card, 4));

  return blocks;
}

/**
 * Every card the board is showing, as one Markdown file.
 *
 * This is a snapshot, not a note for an article, which is why nothing here
 * touches `exportVersion`. `now` is passed in because `domain/` reads no clock
 * of its own.
 */
export function toLibraryMarkdown(cards: Card[], now: string): string {
  const blocks: string[] = [
    ['---', `exported: ${now.slice(0, 10)}`, `count: ${cards.length}`, '---'].join('\n'),
    '# Substack Library',
  ];

  for (const status of STATUS_ORDER) {
    blocks.push(`## ${STATUS_LABELS[status]}`);

    const inColumn = cards.filter((card) => card.status === status);

    // A missing heading reads as a bug. An empty one reads as an empty column.
    if (inColumn.length === 0) {
      blocks.push('*No cards.*');
      continue;
    }

    for (const card of inColumn) blocks.push(...libraryCard(card));
  }

  return blocks.join('\n\n') + '\n';
}

/**
 * `YYYY-MM-DD - Substack Library.md`, from the export date.
 *
 * Not versioned. Two exports on one day produce one name and Chrome appends its
 * own ` (1)`, which is the right answer for a snapshot: the copies are dated,
 * and which one is newer is a question the filesystem already answers.
 */
export function libraryFilename(now: string): string {
  return `${now.slice(0, 10)} - Substack Library.md`;
}
