import { describe, expect, test } from 'vitest';
import { makeCard } from '../test-support/factory';
import { toMarkdown } from './markdown';
import type { Quote } from './types';

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
