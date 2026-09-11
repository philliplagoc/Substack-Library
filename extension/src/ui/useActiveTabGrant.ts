import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { ACTIVE_TAB_GRANT_KEY } from '../messages';

/**
 * The tab the toolbar's last `activeTab` grant covers, or null.
 *
 * The floor under `useCapturePermission`: that grant reaches one tab with no
 * host permission at all, which is what makes Capture work the moment the
 * panel opens, before the reader has granted this publication anything.
 */
export function useActiveTabGrant(): number | null {
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    void browser.storage.session.get(ACTIVE_TAB_GRANT_KEY).then((stored) => {
      const value = stored[ACTIVE_TAB_GRANT_KEY];
      if (alive) setTabId(typeof value === 'number' ? value : null);
    });

    // The per-area `storage.session.onChanged` is newer than the generic
    // listener and not everywhere. Filter the generic one instead.
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'session' || !(ACTIVE_TAB_GRANT_KEY in changes)) return;
      const value = changes[ACTIVE_TAB_GRANT_KEY]?.newValue;
      setTabId(typeof value === 'number' ? value : null);
    };

    browser.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return tabId;
}
