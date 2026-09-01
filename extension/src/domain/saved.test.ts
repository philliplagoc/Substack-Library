import { describe, test, expect } from 'vitest';
import { parseItemMeta, savedEntryToInput } from './saved';

describe('parseItemMeta', () => {
  test('reads an author and a minute count', () => {
    expect(parseItemMeta('Hussain Ibarra∙14 min read')).toEqual({
      author: 'Hussain Ibarra',
      minutes: 14,
      medium: 'read',
    });
  });

  test('accumulates hours into minutes', () => {
    expect(parseItemMeta('Wyndo and Dheeraj Sharma∙ 1 hr 6 min watch')).toEqual({
      author: 'Wyndo and Dheeraj Sharma',
      minutes: 66,
      medium: 'watch',
    });
  });

  test('reads a whole number of hours', () => {
    expect(parseItemMeta('A. Writer∙2 hr listen')).toEqual({
      author: 'A. Writer',
      minutes: 120,
      medium: 'listen',
    });
  });

  // The reason the duration is matched from the END of the string rather than
  // split on the separator: the separator can appear in a name.
  test('keeps an author name that contains the separator', () => {
    expect(parseItemMeta('Bar∙Foo Collective∙9 min read')).toEqual({
      author: 'Bar∙Foo Collective',
      minutes: 9,
      medium: 'read',
    });
  });

  test('collapses whitespace runs before matching', () => {
    expect(parseItemMeta('  A. Writer ∙  12   min   read  ')).toEqual({
      author: 'A. Writer',
      minutes: 12,
      medium: 'read',
    });
  });

  test('returns nothing at all for null, because 58 of 60 entries is not all of them', () => {
    expect(parseItemMeta(null)).toEqual({ author: null, minutes: null, medium: null });
  });

  test('returns nothing at all for an empty string', () => {
    expect(parseItemMeta('   ')).toEqual({ author: null, minutes: null, medium: null });
  });

  // An unrecognized medium is not a guess. A duration with no medium word is
  // not a reading estimate, so the whole string stays the author's problem.
  test('gives no minutes when no medium word closes the string', () => {
    expect(parseItemMeta('A. Writer∙14 min')).toEqual({
      author: 'A. Writer∙14 min',
      minutes: null,
      medium: null,
    });
  });

  test('gives no minutes for an unknown medium word', () => {
    expect(parseItemMeta('A. Writer∙14 min skim')).toEqual({
      author: 'A. Writer∙14 min skim',
      minutes: null,
      medium: null,
    });
  });

  test('reads a medium with no duration as a medium with no minutes', () => {
    expect(parseItemMeta('A. Writer∙read')).toEqual({
      author: 'A. Writer',
      minutes: null,
      medium: 'read',
    });
  });
});

describe('savedEntryToInput', () => {
  test('maps a full entry to a CardInput and a medium', () => {
    expect(
      savedEntryToInput({
        url: 'https://alpha.substack.com/p/one',
        title: 'One',
        publication: 'Alpha Notes',
        itemMeta: 'A. Writer∙7 min read',
      }),
    ).toEqual({
      input: {
        url: 'https://alpha.substack.com/p/one',
        title: 'One',
        author: 'A. Writer',
        publication: 'Alpha Notes',
        estimatedReadingMinutes: 7,
      },
      medium: 'read',
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
        itemMeta: null,
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

  test('trims a padded title and publication', () => {
    const result = savedEntryToInput({
      url: 'https://alpha.substack.com/p/three',
      title: '  Three  ',
      publication: '  Alpha Notes  ',
      itemMeta: null,
    });
    expect(result.input.title).toBe('Three');
    expect(result.input.publication).toBe('Alpha Notes');
  });
});
