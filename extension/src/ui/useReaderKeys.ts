import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { READER_KEYS_KEY, type ReaderKeys } from '../messages';

/**
 * What the background has resolved about reader-shell URLs, live.
 *
 * `undefined` until session storage answers, which `effectiveArticleKey`
 * reads as "wait": a panel that guessed "not on the board" during that gap
 * would flash the Add button over an article the reader already has.
 *
 * One writer, the background, in `addArticle`. Same generic-listener
 * filtering as `usePanelState`, for the same reason — the per-area
 * `storage.session.onChanged` is newer than the generic one and not
 * everywhere.
 */
export function useReaderKeys(): ReaderKeys | undefined {
  const [keys, setKeys] = useState<ReaderKeys | undefined>(undefined);

  useEffect(() => {
    let live = true;

    void browser.storage.session.get(READER_KEYS_KEY).then((stored) => {
      if (live) setKeys((stored[READER_KEYS_KEY] as ReaderKeys | undefined) ?? {});
    });

    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'session' || !(READER_KEYS_KEY in changes)) return;
      setKeys((changes[READER_KEYS_KEY]?.newValue as ReaderKeys | undefined) ?? {});
    };

    browser.storage.onChanged.addListener(onChanged);
    return () => {
      live = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return keys;
}
