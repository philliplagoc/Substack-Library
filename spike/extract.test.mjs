import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import './extract.js';

const { extractArticleMeta } = globalThis.spike;
const manifest = JSON.parse(await readFile(new URL('./fixtures/manifest.json', import.meta.url), 'utf8'));

async function loadFixture(file) {
  const html = await readFile(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
  return parseHTML(html).document;
}

for (const entry of manifest.filter((e) => e.kind === 'article')) {
  test(`extractArticleMeta: ${entry.file}`, async () => {
    const doc = await loadFixture(entry.file);
    const meta = extractArticleMeta(doc);
    assert.equal(meta.title, entry.expected.title);
    assert.equal(meta.author, entry.expected.author);
    assert.equal(meta.publication, entry.expected.publication);
    assert.equal(meta.canonicalUrl, entry.expected.canonicalUrl);
    if (entry.expected.bodyReadable) {
      assert.ok(meta.wordCount >= entry.expected.minWordCount, `wordCount ${meta.wordCount} < ${entry.expected.minWordCount}`);
      assert.equal(meta.isPreview, false);
    } else {
      assert.equal(meta.isPreview, true);
    }
  });
}

test('extractArticleMeta never throws on an empty document', () => {
  const { document } = parseHTML('<html><head></head><body></body></html>');
  const meta = extractArticleMeta(document);
  assert.equal(meta.title, null);
  assert.equal(meta.wordCount, null);
});
