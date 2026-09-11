import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { originPattern } from '../domain/url';

/**
 * The permission half of what `useLiveArticle` used to answer alone: whether
 * a host permission is held for one article's origin.
 *
 * Split out because seeing a tab and injecting into it are now two different
 * rights: the `tabs` permission grants the first, a per-publication host
 * permission still gates the second.
 */
export type CapturePermission =
  | { kind: 'checking' }
  | { kind: 'granted' }
  | { kind: 'ask'; pattern: string; host: string }
  | { kind: 'unavailable' };

export function useCapturePermission(url: string | null): CapturePermission {
  const [permission, setPermission] = useState<CapturePermission>({ kind: 'checking' });

  useEffect(() => {
    if (url === null) {
      setPermission({ kind: 'checking' });
      return;
    }

    let alive = true;
    const origin = originPattern(url);

    async function look(): Promise<CapturePermission> {
      if (origin === null) return { kind: 'unavailable' };
      const granted = await browser.permissions.contains({ origins: [origin.pattern] });
      return granted
        ? { kind: 'granted' }
        : { kind: 'ask', pattern: origin.pattern, host: origin.host };
    }

    function refresh() {
      void look().then((next) => {
        if (alive) setPermission(next);
      });
    }

    refresh();

    // The grant arrives from Chrome's own dialog, which this hook does not
    // control and cannot await past.
    browser.permissions.onAdded.addListener(refresh);
    browser.permissions.onRemoved.addListener(refresh);

    return () => {
      alive = false;
      browser.permissions.onAdded.removeListener(refresh);
      browser.permissions.onRemoved.removeListener(refresh);
    };
  }, [url]);

  return permission;
}
