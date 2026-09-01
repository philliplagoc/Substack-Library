import { describe, test, expect } from 'vitest';
import { addTag, allTags, normalizeTag, removeTag } from './tags';
import { makeCard } from '../test-support/factory';

describe('normalizeTag', () => {
  test('lowercases, so AI and ai are one tag', () => {
    expect(normalizeTag('AI')).toBe('ai');
  });

  test('trims surrounding whitespace', () => {
    expect(normalizeTag('  economics  ')).toBe('economics');
  });

  test('collapses an internal whitespace run to one space', () => {
    expect(normalizeTag('long    read')).toBe('long read');
  });

  test('strips a comma, which would split a YAML flow sequence', () => {
    expect(normalizeTag('a,b')).toBe('ab');
  });

  test('strips brackets, which would close a YAML flow sequence', () => {
    expect(normalizeTag('[ai]')).toBe('ai');
  });

  test('strips a double quote', () => {
    expect(normalizeTag('a"b')).toBe('ab');
  });

  test('returns null for whitespace only', () => {
    expect(normalizeTag('   ')).toBeNull();
  });

  test('returns null for a tag that strips down to nothing', () => {
    expect(normalizeTag('[,]')).toBeNull();
  });

  test('returns null for the empty string', () => {
    expect(normalizeTag('')).toBeNull();
  });
});

describe('addTag', () => {
  test('appends a normalized tag', () => {
    expect(addTag(['ai'], 'Economics')).toEqual(['ai', 'economics']);
  });

  test('rejects a duplicate that differs only in case', () => {
    expect(addTag(['ai'], 'AI')).toEqual(['ai']);
  });

  test('rejects a duplicate that differs only in surrounding whitespace', () => {
    expect(addTag(['ai'], '  ai ')).toEqual(['ai']);
  });

  test('rejects a tag that normalizes to nothing', () => {
    expect(addTag(['ai'], '   ')).toEqual(['ai']);
  });

  test('does not mutate the array it was given', () => {
    const tags = ['ai'];
    addTag(tags, 'economics');
    expect(tags).toEqual(['ai']);
  });
});

describe('removeTag', () => {
  test('removes one tag and leaves the rest in order', () => {
    expect(removeTag(['ai', 'economics', 'long read'], 'economics')).toEqual([
      'ai',
      'long read',
    ]);
  });

  test('leaves the array alone when the tag is not there', () => {
    expect(removeTag(['ai'], 'economics')).toEqual(['ai']);
  });
});

describe('allTags', () => {
  test('returns each distinct tag once, sorted', () => {
    const cards = [
      makeCard({ tags: ['economics', 'ai'] }),
      makeCard({ tags: ['ai', 'long read'] }),
    ];
    expect(allTags(cards)).toEqual(['ai', 'economics', 'long read']);
  });

  test('returns an empty array for no cards', () => {
    expect(allTags([])).toEqual([]);
  });

  test('tolerates a card whose tags field is missing', () => {
    const card = makeCard();
    delete (card as { tags?: string[] }).tags;
    expect(allTags([card])).toEqual([]);
  });
});
