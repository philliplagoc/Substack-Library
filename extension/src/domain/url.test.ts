import { describe, test, expect } from 'vitest';
import { articleKey, canonicalizeUrl, shouldCaptureFrom } from './url';

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
describe('articleKey', () => {
  test('reads the publication from the open.substack.com share route', () => {
    expect(articleKey('https://open.substack.com/pub/pokgaigamer/p/steamanimegames')).toBe(
      'pokgaigamer/p/steamanimegames',
    );
  });

  test('reads the publication from a custom domain', () => {
    expect(articleKey('https://www.pokgaigamer.com/p/steamanimegames')).toBe(
      'pokgaigamer/p/steamanimegames',
    );
  });

  test('reads the publication from a substack subdomain', () => {
    expect(articleKey('https://pokgaigamer.substack.com/p/steamanimegames')).toBe(
      'pokgaigamer/p/steamanimegames',
    );
  });

  test('strips a generic subdomain from a custom domain', () => {
    expect(articleKey('https://newsletter.pragmaticengineer.com/p/the-scoop')).toBe(
      'pragmaticengineer/p/the-scoop',
    );
  });

  test('keeps a generic word as the publication on a substack.com host', () => {
    expect(articleKey('https://news.substack.com/p/weekly')).toBe('news/p/weekly');
  });

  test('separates the same slug in two publications', () => {
    expect(articleKey('https://alpha.substack.com/p/welcome')).not.toBe(
      articleKey('https://beta.substack.com/p/welcome'),
    );
  });

  test('lowercases the slug', () => {
    expect(articleKey('https://alpha.substack.com/p/Great-Questions')).toBe(
      'alpha/p/great-questions',
    );
  });

  test('falls back to the canonical url when the path is not an article', () => {
    expect(articleKey('https://example.com/blog/2026/thing')).toBe(
      'https://example.com/blog/2026/thing',
    );
  });

  test('returns null when the url cannot be canonicalized', () => {
    expect(articleKey('not a url')).toBeNull();
  });
});

describe('shouldCaptureFrom', () => {
  test('captures an article on a substack.com subdomain', () => {
    expect(shouldCaptureFrom('https://alpha.substack.com/p/questions')).toBe(true);
  });

  test('captures an article on a custom domain', () => {
    expect(shouldCaptureFrom('https://www.theworkthatholds.com/p/on-attention')).toBe(true);
  });

  test('captures an article on the open.substack.com share route', () => {
    expect(shouldCaptureFrom('https://open.substack.com/pub/alpha/p/questions')).toBe(true);
  });

  test('ignores a publication home page', () => {
    expect(shouldCaptureFrom('https://alpha.substack.com')).toBe(false);
  });

  test('ignores the Saved list', () => {
    expect(shouldCaptureFrom('https://substack.com/inbox/saved')).toBe(false);
  });

  test('ignores the board itself', () => {
    expect(shouldCaptureFrom('chrome-extension://abcdefg/board.html')).toBe(false);
  });

  test('ignores a browser page', () => {
    expect(shouldCaptureFrom('chrome://extensions')).toBe(false);
  });

  test('ignores an undefined url without throwing', () => {
    expect(shouldCaptureFrom(undefined)).toBe(false);
    expect(shouldCaptureFrom(null)).toBe(false);
    expect(shouldCaptureFrom('')).toBe(false);
  });
});
