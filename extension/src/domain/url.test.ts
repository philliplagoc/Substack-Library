import { describe, test, expect } from 'vitest';
import { canonicalizeUrl } from './url';

describe('canonicalizeUrl', () => {
  test('strips the query string', () => {
    expect(canonicalizeUrl('https://alpha.substack.com/p/questions?utm_source=post')).toBe(
      'https://alpha.substack.com/p/questions',
    );
  });

  test('strips the hash', () => {
    expect(canonicalizeUrl('https://alpha.substack.com/p/questions#comments')).toBe(
      'https://alpha.substack.com/p/questions',
    );
  });

  test('strips a trailing slash from a path', () => {
    expect(canonicalizeUrl('https://alpha.substack.com/p/questions/')).toBe(
      'https://alpha.substack.com/p/questions',
    );
  });

  test('keeps the trailing slash on a bare host', () => {
    expect(canonicalizeUrl('https://alpha.substack.com')).toBe('https://alpha.substack.com/');
  });

  test('lowercases the host and leaves the path alone', () => {
    expect(canonicalizeUrl('https://Alpha.SubStack.COM/p/Great-Questions')).toBe(
      'https://alpha.substack.com/p/Great-Questions',
    );
  });

  test('leaves a url that needs no change', () => {
    expect(canonicalizeUrl('https://alpha.substack.com/p/questions')).toBe(
      'https://alpha.substack.com/p/questions',
    );
  });

  test('trims surrounding whitespace', () => {
    expect(canonicalizeUrl('  https://alpha.substack.com/p/questions  ')).toBe(
      'https://alpha.substack.com/p/questions',
    );
  });

  test('returns null for text that is not a url', () => {
    expect(canonicalizeUrl('not a url')).toBeNull();
  });

  test('returns null for an empty string', () => {
    expect(canonicalizeUrl('')).toBeNull();
  });

  test('returns null for a non-http scheme', () => {
    expect(canonicalizeUrl('javascript:alert(1)')).toBeNull();
  });

  test('does not throw on undefined', () => {
    expect(canonicalizeUrl(undefined as unknown as string)).toBeNull();
  });
});