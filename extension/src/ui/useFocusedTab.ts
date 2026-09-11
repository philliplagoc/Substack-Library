import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { BOARD_TAB_KEY } from '../messages';
import { classifyTab, type FocusedTab } from './focusedTab';

/**
 * The focused tab of this window, classified once against `classifyTab`
 * instead of by the three separate `tabs.*` listener sets `useLiveArticle`,
 * `useBoardFocused`, and `captureTarget` used to keep in sync with each
 * other.
 */
export function useFocusedTab(): FocusedTab {
  const [focused, setFocused] = useState<FocusedTab>({ kind: 'checking' });

  useEffect(() => {
    let alive = true;
    const boardUrl = browser.runtime.getURL('/board.html');

    async function look(): Promise<FocusedTab> {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const { [BOARD_TAB_KEY]: boardTabId } = await browser.storage.session.get(BOARD_TAB_KEY);
      return classifyTab(tab, typeof boardTabId === 'number' ? boardTabId : undefined, boardUrl);
    }

    function refresh() {
      void look().then((next) => {
        if (alive) setFocused(next);
      });
    }

    refresh();

    // A navigation reports as a `url` change once the address bar moves and
    // again as `status: 'complete'`. Either is worth a re-look.
    const onUpdated = (_id: number, info: { url?: string; status?: string }) => {
      if (info.url != null || info.status === 'complete') refresh();
    };

    // The board opening or closing changes BOARD_TAB_KEY while this panel is
    // already up; same filtering pattern as `useBoardFocused.ts`.
    const onStored = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'session' && BOARD_TAB_KEY in changes) refresh();
    };

    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(refresh);
    browser.tabs.onCreated.addListener(refresh);
    browser.tabs.onActivated.addListener(refresh);
    browser.storage.onChanged.addListener(onStored);

    return () => {
      alive = false;
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(refresh);
      browser.tabs.onCreated.removeListener(refresh);
      browser.tabs.onActivated.removeListener(refresh);
      browser.storage.onChanged.removeListener(onStored);
    };
  }, []);

  return focused;
}
