import { useEffect, useRef, type RefObject } from 'react';
import { browser } from 'wxt/browser';

export interface OwnTab {
  tabId?: number;
  windowId?: number;
}

/**
 * The board page's own tab and window ids, resolved once at mount.
 *
 * `sidePanel.open()` runs only while the click that asked for it still counts
 * as a user gesture, and a single `await` inside the handler spends it. So the
 * ids cannot be looked up when the reader clicks; they have to be waiting.
 *
 * A ref rather than state: the click handler needs the value, the render does
 * not, and a re-render of the whole board on mount buys nothing.
 *
 * `tabs.getCurrent()` needs no `tabs` permission. It returns the page's own
 * tab, and `id` and `windowId` are always on it; only `url`, `title`, and
 * `favIconUrl` are withheld without the permission.
 */
export function useOwnTab(): RefObject<OwnTab> {
  const tab = useRef<OwnTab>({});

  useEffect(() => {
    void browser.tabs
      .getCurrent()
      .then((found) => {
        tab.current = { tabId: found?.id, windowId: found?.windowId };
      })
      .catch(() => {
        // Leave it empty. The caller falls back to telling the reader to use
        // the toolbar button rather than failing silently.
      });
  }, []);

  return tab;
}
