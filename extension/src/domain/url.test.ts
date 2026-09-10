import { describe, test, expect } from 'vitest';
import {
  articleKey,
  originPattern,
  canonicalizeUrl,
  isReaderRoute,
  resolveArticleUrl,
  shouldCaptureFrom,
} from './url';

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

  // The page sync opens. The toolbar button must show the board there rather
  // than try to capture the list as though it were an article.
  test('ignores the Saved page', () => {
    expect(shouldCaptureFrom('https://substack.com/saved')).toBe(false);
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

describe('resolveArticleUrl', () => {
  /**
   * Measured on a live page, 2026-08-30. Substack is a React SPA and
   * `<link rel="canonical">` is server-rendered rather than helmet-managed, so
   * a client-side navigation into an article leaves the PREVIOUS page's
   * canonical sitting in the head. The address bar had the article; the
   * canonical and og:url both still read the publication's home page.
   */
  test('ignores a canonical left behind by a client-side navigation', () => {
    expect(
      resolveArticleUrl(
        'https://www.theworkthatholds.com/p/stop-posting-random-thoughts',
        'https://www.theworkthatholds.com/',
      ),
    ).toBe('https://www.theworkthatholds.com/p/stop-posting-random-thoughts');
  });

  test('ignores a canonical naming a different article', () => {
    expect(
      resolveArticleUrl(
        'https://alpha.substack.com/p/questions',
        'https://alpha.substack.com/p/some-other-post',
      ),
    ).toBe('https://alpha.substack.com/p/questions');
  });

  test('keeps a fresh canonical', () => {
    expect(
      resolveArticleUrl(
        'https://alpha.substack.com/p/questions?utm_source=post',
        'https://alpha.substack.com/p/questions',
      ),
    ).toBe('https://alpha.substack.com/p/questions');
  });

  test('lets a fresh canonical replace the share route with the publication', () => {
    expect(
      resolveArticleUrl(
        'https://open.substack.com/pub/alpha/p/questions',
        'https://alpha.substack.com/p/questions',
      ),
    ).toBe('https://alpha.substack.com/p/questions');
  });

  test('falls back to the tab url when the page offers no canonical', () => {
    expect(resolveArticleUrl('https://alpha.substack.com/p/questions', null)).toBe(
      'https://alpha.substack.com/p/questions',
    );
    expect(resolveArticleUrl('https://alpha.substack.com/p/questions', undefined)).toBe(
      'https://alpha.substack.com/p/questions',
    );
  });

  test('falls back to the tab url when the canonical is not a url', () => {
    expect(resolveArticleUrl('https://alpha.substack.com/p/questions', '/p/questions')).toBe(
      'https://alpha.substack.com/p/questions',
    );
  });
});

describe('the reader routes', () => {
  const READER = 'https://substack.com/inbox/post/213391431';
  // The home feed serves the same shell under a different path, and stamps its
  // id with a `p-` prefix the inbox does not. Found by hand on 2026-08-30, when
  // the toolbar button opened the board on it.
  const HOME_READER = 'https://substack.com/home/post/p-175437103';

  // Substack also serves the app-shell post view from a profile-scoped path,
  // `substack.com/@<handle>/p-<id>`. Found by hand on 2026-08-30, when the
  // toolbar button opened the board instead of the panel on it.
  const PROFILE_READER = 'https://substack.com/@kevinszabo14/p-210325254';

  test('captures a post opened from a profile-scoped url', () => {
    expect(shouldCaptureFrom(PROFILE_READER)).toBe(true);
    expect(isReaderRoute(PROFILE_READER)).toBe(true);
  });

  test('ignores a bare profile page', () => {
    expect(shouldCaptureFrom('https://substack.com/@kevinszabo14')).toBe(false);
    expect(isReaderRoute('https://substack.com/@kevinszabo14')).toBe(false);
  });

  test('ignores a profile post segment that is not an id', () => {
    expect(isReaderRoute('https://substack.com/@kevinszabo14/about')).toBe(false);
    expect(isReaderRoute('https://substack.com/@kevinszabo14/p-settings')).toBe(false);
  });

  test('captures a post opened from the home feed', () => {
    expect(shouldCaptureFrom(HOME_READER)).toBe(true);
    expect(isReaderRoute(HOME_READER)).toBe(true);
  });

  test('ignores the home feed itself', () => {
    expect(shouldCaptureFrom('https://substack.com/home')).toBe(false);
    expect(isReaderRoute('https://substack.com/home')).toBe(false);
  });

  test('ignores a home post segment that is not an id', () => {
    expect(shouldCaptureFrom('https://substack.com/home/post/settings')).toBe(false);
  });

  test('takes the p- prefix only in front of digits', () => {
    // `p-` is a prefix on an id, not a licence for any word after it.
    expect(isReaderRoute('https://substack.com/home/post/p-settings')).toBe(false);
  });

  test('captures a post opened from the inbox', () => {
    expect(shouldCaptureFrom(READER)).toBe(true);
  });

  test('survives the query string the inbox appends', () => {
    // canonicalizeUrl strips `search`, so utm_medium=reader2 changes nothing.
    expect(shouldCaptureFrom(`${READER}?utm_medium=reader2`)).toBe(true);
  });

  test('still ignores the Saved list beside it', () => {
    expect(shouldCaptureFrom('https://substack.com/inbox/saved')).toBe(false);
  });

  test('ignores the inbox itself', () => {
    expect(shouldCaptureFrom('https://substack.com/inbox')).toBe(false);
  });

  test('ignores a post segment that is not an id', () => {
    expect(shouldCaptureFrom('https://substack.com/inbox/post/settings')).toBe(false);
  });

  test('names the route, so the caller knows the head is untrustworthy', () => {
    expect(isReaderRoute(READER)).toBe(true);
  });

  test('does not call an ordinary article a reader route', () => {
    expect(isReaderRoute('https://alpha.substack.com/p/questions')).toBe(false);
    expect(isReaderRoute('https://substack.com/inbox/saved')).toBe(false);
    expect(isReaderRoute(undefined)).toBe(false);
  });
});

describe('originPattern', () => {
  test('covers the whole publication, not the one article', () => {
    expect(originPattern('https://alpha.substack.com/p/one?utm=x')).toEqual({
      pattern: 'https://alpha.substack.com/*',
      host: 'alpha.substack.com',
    });
  });

  test('names the custom domain a publication actually serves from', () => {
    expect(originPattern('https://www.theworkthatholds.com/p/two')).toEqual({
      pattern: 'https://www.theworkthatholds.com/*',
      host: 'www.theworkthatholds.com',
    });
  });

  test('has nothing to ask for when the URL is not a URL', () => {
    expect(originPattern('not a url')).toBeNull();
    expect(originPattern('chrome://extensions')).toBeNull();
  });
});
