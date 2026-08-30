import type { Card, Quote } from './types';

/**
 * A YAML double-quoted scalar.
 *
 * Titles are quoted because Substack titles carry colons, and an unquoted YAML
 * scalar containing ": " is a parse error rather than a string. Inside double
 * quotes YAML reads backslash escapes, so a literal backslash has to be doubled
 * BEFORE the quotes are escaped, or the escaping of a quote would itself be
 * escaped away.
 */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
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

const LOST_MARKER = '*— location no longer resolves in the source article*';

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
  if (quote.locatorLost) blocks.push(LOST_MARKER);

  return blocks.join('\n\n');
}

export function toMarkdown(card: Card): string {
  const blocks: string[] = [frontmatter(card)];

  for (const quote of card.quotes) blocks.push(quoteBlock(quote));

  // The heading and the body are omitted together. There is no empty heading.
  if (card.notes.trim()) blocks.push('## Notes', card.notes.trim());

  return blocks.join('\n\n') + '\n';
}
