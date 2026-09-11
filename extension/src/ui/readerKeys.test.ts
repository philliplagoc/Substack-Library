import { describe, expect, it } from 'vitest';
import { effectiveArticleKey } from './readerKeys';
import type { FocusedTab } from './focusedTab';
import type { ReaderKeys } from '../messages';

const board: FocusedTab = { kind: 'board', tabId: 3 };
const checking: FocusedTab = { kind: 'checking' };

/** A publication's own page: the address bar names the article. */
const direct: FocusedTab = {
  kind: 'article',
  tabId: 7,
  url: 'https://alpha.substack.com/p/one',
  articleKey: 'alpha/p/one',
  title: 'One',
};

/**
 * The inbox reader shell. `articleKey()` has no pattern for this path, so the
 * provisional key is the canonical URL itself — the exact shape the background
 * writes into READER_KEYS_KEY as the map's key.
 */
const reader: FocusedTab = {
  kind: 'article',
  tabId: 7,
  url: 'https://substack.com/inbox/post/153422347',
  articleKey: 'https://substack.com/inbox/post/153422347',
  title: 'Substack',
};

const remembered: ReaderKeys = {
  'https://substack.com/inbox/post/153422347': 'alpha/p/one',
};

describe('effectiveArticleKey', () => {
  it('has no key to ask for when the focused tab is not an article', () => {
    expect(effectiveArticleKey(board, remembered, null)).toBeNull();
    expect(effectiveArticleKey(checking, remembered, null)).toBeNull();
  });

  it('trusts the tab on a publication page, which names its own article', () => {
    expect(effectiveArticleKey(direct, {}, null)).toBe('alpha/p/one');
  });

  it('waits while the remembered map is still being read', () => {
    expect(effectiveArticleKey(reader, undefined, null)).toBeUndefined();
    expect(effectiveArticleKey(direct, undefined, null)).toBeUndefined();
  });

  /*
   * The bug this module exists for. The reader adds an inbox article, takes
   * notes, clicks over to the board and back. The panel's own memory of the
   * resolved key is gone by then, so the map has to answer instead — or the
   * panel offers to add an article it is already showing.
   */
  it('answers a reader-shell tab from the background record after a tab switch', () => {
    expect(effectiveArticleKey(reader, remembered, null)).toBe('alpha/p/one');
  });

  it('falls back to the provisional key when nothing has resolved this URL', () => {
    expect(effectiveArticleKey(reader, {}, null)).toBe(
      'https://substack.com/inbox/post/153422347',
    );
  });

  /*
   * The add-article reply lands before the storage write comes back through
   * `storage.onChanged`, so the fresh key has to win over an empty or stale
   * map for those few frames.
   */
  it('prefers a key resolved this visit over the remembered map', () => {
    expect(effectiveArticleKey(reader, {}, 'alpha/p/two')).toBe('alpha/p/two');
    expect(effectiveArticleKey(reader, remembered, 'alpha/p/two')).toBe('alpha/p/two');
  });
});
