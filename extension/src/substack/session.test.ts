import { describe, test, expect, afterEach, vi } from 'vitest';
import { checkSubstackSession } from './session';

/**
 * The fail-open contract `classify` satisfies: a 200 from an
 * authenticated-only endpoint is a confirmed `'signed-in'`, and a 401 is a
 * confirmed `'signed-out'` - both measured directly against
 * `https://substack.com/api/v1/settings` (401 is what it returns while
 * signed out). A 403 or a 500 could just as easily be a transient auth
 * hiccup or an unrelated server error as an actual sign-out, and guessing
 * wrong blocks a reader who IS signed in - so those, and a failed request,
 * resolve to `'unknown'` rather than being treated as confirmed.
 */

function stubFetchResolve(status: number): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ status } as Response),
  );
}

function stubFetchReject(error: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkSubstackSession', () => {
  test('a 200 from the settings probe is a confirmed signed-in session', async () => {
    stubFetchResolve(200);
    await expect(checkSubstackSession()).resolves.toBe('signed-in');
  });

  test('a 401 from the settings probe is a confirmed sign-out', async () => {
    stubFetchResolve(401);
    await expect(checkSubstackSession()).resolves.toBe('signed-out');
  });

  test('a 403 is not treated as a confirmed sign-out', async () => {
    stubFetchResolve(403);
    await expect(checkSubstackSession()).resolves.toBe('unknown');
  });

  test('a 500 says nothing about the session either way', async () => {
    stubFetchResolve(500);
    await expect(checkSubstackSession()).resolves.toBe('unknown');
  });

  test('a thrown network error resolves to unknown, not signed-out', async () => {
    stubFetchReject(new TypeError('Failed to fetch'));
    await expect(checkSubstackSession()).resolves.toBe('unknown');
  });

  test('the abort-timeout firing resolves to unknown, not signed-out', async () => {
    // What fetch rejects with when its signal is AbortSignal.timeout() and
    // the timeout fires: the signal's `reason` is a TimeoutError DOMException,
    // and a fetch aborted by its signal rejects with that reason.
    stubFetchReject(new DOMException('signal timed out', 'TimeoutError'));
    await expect(checkSubstackSession()).resolves.toBe('unknown');
  });
});
