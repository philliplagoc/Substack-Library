import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { extractArticleMeta } from './extract';

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
