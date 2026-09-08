import { describe, test, expect } from 'vitest';
import { createQuote, resolveQuote } from './quote';
import type { Quote } from './types';

describe('createQuote', () => {
  test('is deterministic given an injected id and timestamp', () => {
    expect(
      createQuote(
        { text: 'the quoted sentence', prefix: 'words before it. ' },
        { id: 'q1', capturedAt: '2026-08-29T10:00:00.000Z' },
      ),
    ).toEqual({
      id: 'q1',
      text: 'the quoted sentence',
      locator: 'words before it. ',
      locatorLost: false,
      capturedAt: '2026-08-29T10:00:00.000Z',
    });
  });

  test('starts life resolved, because it was just seen in the article', () => {
    const q = createQuote(
      { text: 'x', prefix: '' },
      { id: 'q2', capturedAt: '2026-08-29T10:00:00.000Z' },
    );
    expect(q.locatorLost).toBe(false);
  });
});

function q(text: string, locator = ''): Quote {
  return { id: `q-${text}`, text, locator, locatorLost: false, capturedAt: '2026-08-29T10:00:00.000Z' };
}

describe('resolveQuote', () => {
  const ARTICLE = 'Alpha beta gamma. The quoted sentence lands here. Delta epsilon.';

  test('finds a quote that appears once', () => {
    expect(resolveQuote(ARTICLE, q('The quoted sentence'))).toBe(18);
  });

  test('returns null when the author edited the sentence away', () => {
    expect(resolveQuote(ARTICLE, q('a sentence that is gone'))).toBe(null);
  });

  test('returns null for an empty quote rather than matching at zero', () => {
    expect(resolveQuote(ARTICLE, q(''))).toBe(null);
  });

  test('matches across a whitespace difference', () => {
    // The selection carried a newline where the DOM text renders a space.
    expect(resolveQuote('one two three', q('one\ntwo'))).toBe(0);
  });

  test('uses the prefix to pick between two identical passages', () => {
    const doubled = 'First run: repeated text. Second run: repeated text.';
    expect(resolveQuote(doubled, q('repeated text', 'Second run: '))).toBe(38);
  });

  test('finds the only occurrence even when the prefix has moved', () => {
    expect(resolveQuote(ARTICLE, q('The quoted sentence', 'a prefix that is gone'))).toBe(18);
  });

  // Decided here, in place of the plan's first test.todo: two matches and a
  // prefix that identifies neither. Null, not the first match. "It is in two
  // places" is not an answer to "where is it", and the caller turns null into a
  // visible label rather than a silent wrong offset.
  test('returns null when the quote appears twice and the prefix identifies neither', () => {
    const doubled = 'First run: repeated text. Second run: repeated text.';
    expect(resolveQuote(doubled, q('repeated text', 'a prefix that is gone'))).toBe(null);
  });

  // Decided here, in place of the plan's second test.todo: whitespace runs
  // collapse and nothing else does.
  test('collapses runs of whitespace and normalizes nothing else', () => {
    expect(resolveQuote('one   \n\t two three', q('one two'))).toBe(0);
    // Case and punctuation survive. An author who changed either made an edit,
    // and an edit is what locatorLost exists to report.
    expect(resolveQuote('One two three', q('one two'))).toBe(null);
    expect(resolveQuote('one, two three', q('one two'))).toBe(null);
  });

  test('returns an offset into the article as it was given, not a normalized copy', () => {
    // The offset addresses `articleText` itself, so a caller can slice with it.
    const spaced = 'Alpha  beta.  The quoted sentence.';
    const at = resolveQuote(spaced, q('The quoted sentence'));
    expect(at).toBe(14);
    expect(spaced.slice(at!, at! + 19)).toBe('The quoted sentence');
  });
});
