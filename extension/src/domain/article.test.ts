import { describe, test, expect } from 'vitest';
import { readingMinutes } from './article';

describe('readingMinutes', () => {
  test('divides the word count by 250', () => {
    expect(readingMinutes(1500, true)).toBe(6);
  });

  test('rounds a partial minute up, so an estimate is never optimistic', () => {
    expect(readingMinutes(1599, true)).toBe(7);
  });

  test('gives a very short article one minute rather than zero', () => {
    expect(readingMinutes(12, true)).toBe(1);
  });

  test('returns undefined when only a preview is readable', () => {
    // The paywalled fixture is 684 words of preview. Reporting 3 minutes for
    // an article the reader cannot finish is worse than reporting nothing.
    expect(readingMinutes(684, false)).toBeUndefined();
  });

  test('returns undefined when there was no body to count', () => {
    expect(readingMinutes(null, true)).toBeUndefined();
  });

  test('returns undefined for a zero word count', () => {
    expect(readingMinutes(0, true)).toBeUndefined();
  });
});
