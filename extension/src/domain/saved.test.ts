import { describe, test, expect } from 'vitest';
import { savedEntryToInput } from './saved';

/**
 * `parseItemMeta` is gone with the route it served. `substack.com/inbox/saved`
 * printed "Hussain Ibarra∙14 min read" under each entry and that string held
 * the author, the minutes, and the medium. `substack.com/saved` prints no such
 * string: the captured Saved page holds 0 occurrences of "min read" against 58
 * on the reader-view capture. The author now arrives as its own field, and the
 * other two are not on the page to read.
 */
describe('savedEntryToInput', () => {
  test('maps a full entry to a CardInput', () => {
    expect(
      savedEntryToInput({
        url: 'https://alpha.substack.com/p/one',
        title: 'One',
        publication: 'Alpha Notes',
        author: 'A. Writer',
      }),
    ).toEqual({
      input: {
        url: 'https://alpha.substack.com/p/one',
        title: 'One',
        author: 'A. Writer',
        publication: 'Alpha Notes',
        estimatedReadingMinutes: undefined,
      },
      medium: null,
    });
  });

  // undefined, not null or ''. mergeCard keeps the existing value when the
  // incoming one is falsy, so an absent field must not overwrite a good one.
  test('leaves missing fields undefined rather than empty', () => {
    expect(
      savedEntryToInput({
        url: 'https://alpha.substack.com/p/two',
        title: null,
        publication: null,
        author: null,
      }),
    ).toEqual({
      input: {
        url: 'https://alpha.substack.com/p/two',
        title: undefined,
        author: undefined,
        publication: undefined,
        estimatedReadingMinutes: undefined,
      },
      medium: null,
    });
  });

  test('trims a padded title, publication, and author', () => {
    const result = savedEntryToInput({
      url: 'https://alpha.substack.com/p/three',
      title: '  Three  ',
      publication: '  Alpha Notes  ',
      author: '  A. Writer  ',
    });
    expect(result.input.title).toBe('Three');
    expect(result.input.publication).toBe('Alpha Notes');
    expect(result.input.author).toBe('A. Writer');
  });

  // The reason this matters: a sync must never blank a reading time that a
  // capture already worked out from the article's own body.
  test('never carries a reading time, because the page has none', () => {
    const result = savedEntryToInput({
      url: 'https://alpha.substack.com/p/four',
      title: 'Four',
      publication: 'Alpha Notes',
      author: 'A. Writer',
    });
    expect(result.input.estimatedReadingMinutes).toBeUndefined();
    expect(result.medium).toBeNull();
  });
});
