import { describe, expect, test } from 'vitest';
import { makeCard } from '../test-support/factory';
import { toMarkdown, exportFilename } from './markdown';
import type { Card, Quote } from './types';

/** The frontmatter block, without its --- fences. */
function frontmatterOf(markdown: string): string[] {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`No frontmatter in:\n${markdown}`);
  return match[1]!.split('\n');
}

describe('toMarkdown frontmatter', () => {
  test('carries the five always-present keys', () => {
    const card = makeCard({
      title: 'How Great Questions Change a Company',
      author: 'Jane Doe',
      publication: 'The Work That Holds',
      url: 'https://www.theworkthatholds.com/p/great-questions',
      savedAt: '2026-08-16T09:31:00.000Z',
      estimatedReadingMinutes: undefined,
      readAt: undefined,
    });

    expect(frontmatterOf(toMarkdown(card))).toEqual([
      'title: "How Great Questions Change a Company"',
      'author: "Jane Doe"',
      'publication: "The Work That Holds"',
      'url: https://www.theworkthatholds.com/p/great-questions',
      'saved: 2026-08-16',
      'tags: []',
    ]);
  });

  test('quotes a title holding a colon, so the YAML still parses', () => {
    const card = makeCard({ title: 'On Writing: a short case' });
    expect(toMarkdown(card)).toContain('title: "On Writing: a short case"');
  });

  test('escapes a double quote inside a title', () => {
    const card = makeCard({ title: 'The "Deep Work" Problem' });
    expect(toMarkdown(card)).toContain('title: "The \\"Deep Work\\" Problem"');
  });

  test('escapes a backslash inside a title', () => {
    const card = makeCard({ title: 'Either\\Or' });
    expect(toMarkdown(card)).toContain('title: "Either\\\\Or"');
  });

  test('flattens a newline in a title to a single space so the YAML still parses', () => {
    const normal = frontmatterOf(toMarkdown(makeCard({ title: 'How Great Questions' })));
    const wrapped = frontmatterOf(toMarkdown(makeCard({ title: 'How Great\nQuestions' })));

    expect(wrapped).toHaveLength(normal.length);
    expect(wrapped).toContain('title: "How Great Questions"');
    for (const line of wrapped) {
      expect(line === '---' || line.includes(': ')).toBe(true);
    }
  });

  test('emits read only when the card has been read', () => {
    const unread = makeCard({ readAt: undefined });
    expect(toMarkdown(unread)).not.toContain('read:');

    const read = makeCard({ readAt: '2026-08-18T22:04:00.000Z' });
    expect(toMarkdown(read)).toContain('read: 2026-08-18');
  });

  test('emits reading_minutes only when there is an estimate', () => {
    const paywalled = makeCard({ estimatedReadingMinutes: undefined });
    expect(toMarkdown(paywalled)).not.toContain('reading_minutes:');

    const readable = makeCard({ estimatedReadingMinutes: 12 });
    expect(toMarkdown(readable)).toContain('reading_minutes: 12');
  });

  test('emits an empty tags list rather than dropping the key', () => {
    expect(toMarkdown(makeCard({ tags: [] }))).toContain('tags: []');
  });

  test('renders tags as a flow sequence', () => {
    const card = makeCard({ tags: ['substack', 'reading'] });
    expect(toMarkdown(card)).toContain('tags: [substack, reading]');
  });
});

describe('toMarkdown body', () => {
  const quote = (text: string, extra: Partial<Quote> = {}): Quote => ({
    text,
    locatorLost: false,
    capturedAt: '2026-08-17T00:00:00.000Z',
    ...extra,
  });

  test('renders a quote with no comment as a bare blockquote', () => {
    const card = makeCard({ notes: '', quotes: [quote('First captured quote text.')] });
    expect(toMarkdown(card)).toContain('\n> First captured quote text.\n');
  });

  test('puts a comment in its own paragraph under the quote', () => {
    const card = makeCard({
      notes: '',
      quotes: [quote('First captured quote text.', { comment: 'My reaction to that quote.' })],
    });
    expect(toMarkdown(card)).toContain(
      '> First captured quote text.\n\nMy reaction to that quote.\n',
    );
  });

  test('keeps a quote spanning a paragraph break as one blockquote', () => {
    const card = makeCard({ notes: '', quotes: [quote('First line.\n\nSecond line.')] });
    expect(toMarkdown(card)).toContain('> First line.\n>\n> Second line.');
  });

  test('marks a quote whose location no longer resolves', () => {
    const card = makeCard({
      notes: '',
      quotes: [quote('Second captured quote.', { locatorLost: true })],
    });
    expect(toMarkdown(card)).toContain(
      '> Second captured quote.\n\n*— location no longer resolves in the source article*',
    );
  });

  test('puts the lost marker after the comment when a quote has both', () => {
    const card = makeCard({
      notes: '',
      quotes: [quote('Second captured quote.', { comment: 'Still true.', locatorLost: true })],
    });
    expect(toMarkdown(card)).toContain(
      '> Second captured quote.\n\nStill true.\n\n*— location no longer resolves in the source article*',
    );
  });

  test('renders the notes under a Notes heading', () => {
    const card = makeCard({ notes: 'Freeform notes body from the card.', quotes: [] });
    expect(toMarkdown(card)).toContain('## Notes\n\nFreeform notes body from the card.\n');
  });

  test('drops the Notes heading when there are no notes', () => {
    expect(toMarkdown(makeCard({ notes: '', quotes: [] }))).not.toContain('## Notes');
  });

  test('drops the Notes heading when the notes are only whitespace', () => {
    expect(toMarkdown(makeCard({ notes: '   \n\n  ', quotes: [] }))).not.toContain('## Notes');
  });

  test('exports frontmatter alone for a card with neither notes nor quotes', () => {
    const markdown = toMarkdown(makeCard({ notes: '', quotes: [] }));
    expect(markdown).not.toContain('## Notes');
    expect(markdown).not.toContain('>');
    expect(markdown.trimEnd().endsWith('---')).toBe(true);
  });

  test('ends with exactly one newline', () => {
    const card = makeCard({ notes: 'Body.', quotes: [quote('Quoted.')] });
    const markdown = toMarkdown(card);
    expect(markdown.endsWith('\n')).toBe(true);
    expect(markdown.endsWith('\n\n')).toBe(false);
  });

  test('renders two quotes and notes in order', () => {
    const card = makeCard({
      notes: 'Freeform notes body from the card.',
      quotes: [
        quote('First captured quote text.', { comment: 'My reaction to that quote.' }),
        quote('Second captured quote.'),
      ],
    });
    const markdown = toMarkdown(card);

    const first = markdown.indexOf('> First captured quote text.');
    const reaction = markdown.indexOf('My reaction to that quote.');
    const second = markdown.indexOf('> Second captured quote.');
    const notes = markdown.indexOf('## Notes');

    expect(first).toBeGreaterThan(0);
    expect(reaction).toBeGreaterThan(first);
    expect(second).toBeGreaterThan(reaction);
    expect(notes).toBeGreaterThan(second);
  });
});

describe('exportFilename', () => {
  // Every case in this block wants the same savedAt, because the date prefix
  // comes from it and is not what any of them is testing.
  const card = (overrides: Partial<Card> = {}) =>
    makeCard({ savedAt: '2026-08-16T09:31:00.000Z', ...overrides });

  test('is date first, then the title', () => {
    const subject = card({ title: 'How Great Questions Change a Company' });
    expect(exportFilename(subject, 1)).toBe(
      '2026-08-16 - How Great Questions Change a Company.md',
    );
  });

  test('adds no suffix for the first export', () => {
    expect(exportFilename(card({ title: 'Once' }), 1)).toBe('2026-08-16 - Once.md');
  });

  test('puts the version before the extension on a re-export', () => {
    expect(exportFilename(card({ title: 'Once' }), 2)).toBe('2026-08-16 - Once (v2).md');
    expect(exportFilename(card({ title: 'Once' }), 11)).toBe('2026-08-16 - Once (v11).md');
  });

  test('replaces every character Windows forbids in a filename', () => {
    const subject = card({ title: 'a\\b/c:d*e?f"g<h>i|j' });
    expect(exportFilename(subject, 1)).toBe('2026-08-16 - a-b-c-d-e-f-g-h-i-j.md');
  });

  test('collapses runs of whitespace to one space', () => {
    expect(exportFilename(card({ title: 'Too    many\n\nspaces' }), 1)).toBe(
      '2026-08-16 - Too many spaces.md',
    );
  });

  test('strips the trailing dots a title ending in an ellipsis leaves behind', () => {
    // Windows forbids a trailing dot as well as the nine forbidden characters.
    expect(exportFilename(card({ title: 'And then...' }), 1)).toBe(
      '2026-08-16 - And then.md',
    );
  });

  test('strips leading dots and spaces', () => {
    expect(exportFilename(card({ title: '  .hidden' }), 1)).toBe('2026-08-16 - hidden.md');
  });

  test('truncates a long title on a word boundary', () => {
    const title = 'word '.repeat(40).trim(); // 199 characters
    const name = exportFilename(card({ title }), 1);
    const stem = name.slice('2026-08-16 - '.length, -'.md'.length);

    expect(stem.length).toBeLessThanOrEqual(120);
    expect(stem.endsWith('word')).toBe(true);
    expect(stem).not.toContain('  ');
  });

  test('truncates a single word longer than the limit with no boundary to cut on', () => {
    const name = exportFilename(card({ title: 'x'.repeat(200) }), 1);
    const stem = name.slice('2026-08-16 - '.length, -'.md'.length);

    expect(stem.length).toBe(120);
    expect(stem).toBe('x'.repeat(120));
    expect(stem).not.toContain(' ');
  });

  test('falls back to the article slug when the title sanitizes to nothing', () => {
    const subject = card({
      title: '///',
      url: 'https://alpha.substack.com/p/great-questions',
    });
    expect(exportFilename(subject, 1)).toBe('2026-08-16 - great-questions.md');
  });

  test('falls back to untitled when the URL has no slug either', () => {
    const subject = card({ title: '///', url: 'https://alpha.substack.com/' });
    expect(exportFilename(subject, 1)).toBe('2026-08-16 - untitled.md');
  });

  test('falls back to untitled when the URL is unparseable', () => {
    const subject = card({ title: '   ', url: 'not-a-url' });
    expect(exportFilename(subject, 1)).toBe('2026-08-16 - untitled.md');
  });
});
