import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { extractSavedEntries } from './saved';

/**
 * The fixture lives in `spike/`, which this project does not import code from.
 * Reading a data file is not a module edge, and a second copy of an anonymized
 * file is how anonymized files drift.
 */
function fixture(name: string): Document {
  const path = new URL(`../../../spike/fixtures/${name}`, import.meta.url);
  const { document } = parseHTML(readFileSync(path, 'utf8'));
  return document as unknown as Document;
}

describe('extractSavedEntries on the saved-list fixture', () => {
  const entries = extractSavedEntries(fixture('saved-list.html'));

  test('finds every entry', () => {
    expect(entries).toHaveLength(60);
  });

  test('gives every entry an absolute url', () => {
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\//);
      expect(entry.url).toContain('/p/');
    }
  });

  // All 60. The design doc predicted two entries without meta ("a podcast and a
  // video"); the fixture has none. Every entry, the two watch entries included,
  // carries a ".reader2-item-meta" string. The field stays nullable anyway: a
  // future capture may omit it, and a missing string is not an error.
  test('reads item meta on every entry the fixture has', () => {
    const withMeta = entries.filter((e) => e.itemMeta !== null);
    expect(withMeta).toHaveLength(60);
  });

  test('carries the two watch entries through rather than dropping them', () => {
    const watches = entries.filter((e) => (e.itemMeta ?? '').includes('watch'));
    expect(watches).toHaveLength(2);
  });

  test('reads a title and a publication for every entry', () => {
    expect(entries.every((e) => (e.title ?? '').length > 0)).toBe(true);
    expect(entries.every((e) => (e.publication ?? '').length > 0)).toBe(true);
  });

  // spike/README.md: 58 of 60 link to *.substack.com and two use a custom
  // domain. The selector never names a host, and this is what proves it.
  test('reads custom-domain entries as well as substack.com ones', () => {
    const hosts = new Set(entries.map((e) => new URL(e.url).hostname));
    expect([...hosts].some((h) => !h.endsWith('substack.com'))).toBe(true);
  });
});
