import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { detectSignedOut, extractArticleMeta, readReaderArticle } from './extract';

/**
 * The fixtures live in `spike/`, which this project does not import code from.
 * Reading a data file is not a module edge, and copying three large anonymized
 * HTML files into a second place is how anonymized files drift.
 */
function fixture(name: string): Document {
  const path = new URL(`../../../spike/fixtures/${name}`, import.meta.url);
  const { document } = parseHTML(readFileSync(path, 'utf8'));
  return document as unknown as Document;
}

describe('extractArticleMeta on the free article', () => {
  const meta = extractArticleMeta(fixture('article-free.html'));

  test('reads the title from og:title', () => {
    expect(meta.title).toBe(
      'I Posted on Substack Notes 365 Days Straight. Here are the only 3 types that brought subscribers.',
    );
  });

  test('reads the author', () => {
    expect(meta.author).toBe('Wes Pearce');
  });

  test('reads the publication from JSON-LD, since og:site_name does not exist', () => {
    expect(meta.publication).toBe('Escape the Cubicle');
  });

  test('reads the canonical url', () => {
    expect(meta.canonicalUrl).toBe(
      'https://escapethecubicle.substack.com/p/i-posted-on-substack-notes-365-days',
    );
  });

  test('counts the body words from .body.markup, not from article', () => {
    expect(meta.wordCount).toBe(1599);
  });

  test('reports the article as readable', () => {
    expect(meta.readable).toBe(true);
  });

  test('returns the body text for quote resolution', () => {
    expect(meta.bodyText.length).toBeGreaterThan(1000);
  });
});

describe('extractArticleMeta on the paywalled article', () => {
  const meta = extractArticleMeta(fixture('article-paywalled.html'));

  test('still reads every metadata field', () => {
    expect(meta.title).toBe('How I grew 3,000+ Subs my first month on substack');
    expect(meta.author).toBe('Kevin Szabo');
    expect(meta.publication).toBe('The Writing Chronicles');
    expect(meta.canonicalUrl).toBe(
      'https://kevinszabo.substack.com/p/how-i-grew-3000-subs-my-first-month',
    );
  });

  test('reports the article as not readable, from isAccessibleForFree', () => {
    expect(meta.readable).toBe(false);
  });

  test('still counts words, because the paywall does not truncate the DOM', () => {
    expect(meta.wordCount).toBe(684);
  });
});

describe('extractArticleMeta on a page with nothing to read', () => {
  const { document } = parseHTML('<html><head></head><body><p>hello</p></body></html>');
  const meta = extractArticleMeta(document as unknown as Document);

  test('returns nulls rather than throwing', () => {
    expect(meta.title).toBe(null);
    expect(meta.author).toBe(null);
    expect(meta.publication).toBe(null);
    expect(meta.canonicalUrl).toBe(null);
    expect(meta.wordCount).toBe(null);
  });

  test('assumes readable when the page says nothing about access', () => {
    expect(meta.readable).toBe(true);
  });
});

describe('extractArticleMeta JSON-LD handling', () => {
  test('reads author from an array, which is the shape Substack ships', () => {
    const { document } = parseHTML(`<html><head>
      <script type="application/ld+json">
        {"@type":"NewsArticle","headline":"H","author":[{"name":"Array Author"}]}
      </script></head><body></body></html>`);
    const meta = extractArticleMeta(document as unknown as Document);
    expect(meta.author).toBe('Array Author');
    expect(meta.title).toBe('H');
  });

  test('reads author from a bare object too', () => {
    const { document } = parseHTML(`<html><head>
      <script type="application/ld+json">
        {"@type":"Article","author":{"name":"Object Author"}}
      </script></head><body></body></html>`);
    expect(extractArticleMeta(document as unknown as Document).author).toBe('Object Author');
  });

  test('skips a malformed JSON-LD block instead of throwing', () => {
    const { document } = parseHTML(`<html><head>
      <script type="application/ld+json">{ not json </script>
      <meta property="og:title" content="Survived" />
      </head><body></body></html>`);
    expect(extractArticleMeta(document as unknown as Document).title).toBe('Survived');
  });

  test('falls back to the breadcrumb for publication', () => {
    const { document } = parseHTML(`<html><head>
      <script type="application/ld+json">
        {"@type":"BreadcrumbList","itemListElement":[{"name":"Breadcrumb Pub"}]}
      </script></head><body></body></html>`);
    expect(extractArticleMeta(document as unknown as Document).publication).toBe('Breadcrumb Pub');
  });
});

describe('detectSignedOut', () => {
  test('reports signed in on both committed fixtures', () => {
    // spike/README.md: the nav container holds 5 buttons on both fixtures and
    // neither file contains the string "Sign in".
    expect(detectSignedOut(fixture('article-free.html'))).toBe(false);
    expect(detectSignedOut(fixture('article-paywalled.html'))).toBe(false);
  });

  test('reports signed out when the nav offers Sign in', () => {
    const { document } = parseHTML(`<html><body><div id="main">
      <div class="mainMenuContent-DME8DR"><button>Sign in</button></div>
    </div></body></html>`);
    expect(detectSignedOut(document as unknown as Document)).toBe(true);
  });

  test('is not fooled by a Subscribe button in the same nav', () => {
    const { document } = parseHTML(`<html><body><div id="main">
      <div class="mainMenuContent-DME8DR"><button>Subscribe</button></div>
    </div></body></html>`);
    expect(detectSignedOut(document as unknown as Document)).toBe(false);
  });

  test('reports signed in when the nav is absent entirely', () => {
    const { document } = parseHTML('<html><body></body></html>');
    expect(detectSignedOut(document as unknown as Document)).toBe(false);
  });
});

describe('readReaderArticle', () => {
  /**
   * The inbox reader reduced to the shape that matters: the post's own link
   * sits in an ancestor of `.body.markup`, and the inbox list rendered behind
   * it holds links to other publications and no body of its own.
   *
   * Synthetic, not captured. There is no reader-route fixture in `spike/`, so
   * these cases prove the walk against a model of the page. Task 6 Step 17
   * check 6, against the live route, is what proves the model.
   */
  function readerPage(): Document {
    const { document } = parseHTML(`<html><body>
      <nav>
        <a href="https://other.substack.com/p/one?source=%2Finbox%2Fpost%2F999">One</a>
        <a href="https://another.substack.com/p/two?source=%2Finbox%2Fpost%2F999">Two</a>
      </nav>
      <div class="post">
        <a href="https://alpha.substack.com/p/be-delusional?utm_medium=reader2">Be Delusional</a>
        <div class="body markup"><p>The article text.</p></div>
      </div>
    </body></html>`);
    return document as unknown as Document;
  }

  test('reads the open post url, not the first link on the page', () => {
    expect(readReaderArticle(readerPage())?.url).toBe(
      'https://alpha.substack.com/p/be-delusional?utm_medium=reader2',
    );
  });

  test('reads the title from the link text', () => {
    expect(readReaderArticle(readerPage())?.title).toBe('Be Delusional');
  });

  test('returns null when the page has no article body', () => {
    const { document } = parseHTML('<html><body><a href="/p/x">x</a></body></html>');
    expect(readReaderArticle(document as unknown as Document)).toBe(null);
  });

  test('returns null when no ancestor of the body names the article', () => {
    const { document } = parseHTML(
      '<html><body><div class="body markup"><p>text</p></div></body></html>',
    );
    expect(readReaderArticle(document as unknown as Document)).toBe(null);
  });

  test('ignores a link whose href is not article-shaped', () => {
    // A comment permalink lives under /p/<slug>/comment/<id>. Matching a bare
    // "/p/" substring would take it and key the card on a comment.
    const { document } = parseHTML(`<html><body><div class="post">
      <a href="https://alpha.substack.com/p/slug/comment/12345">A comment</a>
      <div class="body markup"><p>text</p></div>
    </div></body></html>`);
    expect(readReaderArticle(document as unknown as Document)).toBe(null);
  });

  test.todo('decide: what this returns on an article page, where capture() never calls it');
});
