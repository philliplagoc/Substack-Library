import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { extractSavedEntries } from './saved';

/**
 * Captured Substack pages with the reader's identity stripped. They live next to
 * this test in `__fixtures__/`; see that folder's README for what was removed
 * and why `saved-page.html` was trimmed from 48 feed units to 6.
 */
function fixture(name: string): Document {
  const path = new URL(`./__fixtures__/${name}`, import.meta.url);
  const { document } = parseHTML(readFileSync(path, 'utf8'));
  return document as unknown as Document;
}

describe('extractSavedEntries on the saved-page fixture', () => {
  const entries = extractSavedEntries(fixture('saved-page.html'));

  // 6 feed units in the trimmed fixture, 5 of them articles and 1 a Note. A
  // parser that counts units rather than attachments returns 6 and hands the
  // Note no URL.
  test('finds every article and skips the Note', () => {
    expect(entries).toHaveLength(5);
  });

  test('gives every entry an absolute article url', () => {
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\//);
      expect(entry.url).toContain('/p/');
    }
  });

  test('reads a title and a publication for every entry', () => {
    expect(entries.every((e) => (e.title ?? '').length > 0)).toBe(true);
    expect(entries.every((e) => (e.publication ?? '').length > 0)).toBe(true);
  });

  // The author lives on the feed unit, outside the attachment card, so this
  // fails for every entry if the read starts at the attachment.
  test('reads the author off the feed unit', () => {
    expect(entries.every((e) => (e.author ?? '').length > 0)).toBe(true);
  });

  test('reads the first entry exactly', () => {
    expect(entries[0]).toEqual({
      url: 'https://champenoise.substack.com/p/22-profitable-niches-for-your-current',
      title:
        '22 Profitable Niches for your Current (or Next) Substack + 240 Substack Ideas You Can Steal Right Now.',
      publication: 'Champenoise',
      author: 'Christina',
    });
  });

  // The publication is the attachment's own label, and the author is the
  // profile behind the avatar. They are different fields and the fixture holds
  // entries where they differ ("Pixels for Breakfast" writes "Indie Dispatch").
  test('does not confuse the author with the publication', () => {
    const differing = entries.filter((e) => e.author !== e.publication);
    expect(differing.length).toBeGreaterThan(0);
  });

  // One kept entry (Stat Significant) serves from www.statsignificant.com. The
  // selectors name no host, and this is what proves it.
  test('reads custom-domain entries as well as substack.com ones', () => {
    const hosts = new Set(entries.map((e) => new URL(e.url).hostname));
    expect([...hosts].some((h) => !h.endsWith('substack.com'))).toBe(true);
  });
});

describe('extractSavedEntries on a page it cannot read', () => {
  // The legacy /inbox/saved DOM shares no class with /saved. Reading it must
  // yield nothing rather than something wrong: applySync turns an empty result
  // into a reported problem, and a wrong result into silent bad data.
  test('returns nothing for the legacy reader-view fixture', () => {
    expect(extractSavedEntries(fixture('saved-list.html'))).toHaveLength(0);
  });

  test('returns nothing for an empty document', () => {
    const { document } = parseHTML('<html><body></body></html>');
    expect(extractSavedEntries(document as unknown as Document)).toHaveLength(0);
  });
});
