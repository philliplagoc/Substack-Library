import { describe, test, expect, afterEach, vi } from 'vitest';
import { checkSubstackSession } from './session';

/**
 * `classify` is left throwing on purpose (see the `TODO(human)` in
 * `session.ts`), so every case below currently fails: `checkSubstackSession`
 * rejects instead of resolving to the value asserted here. That is expected
 * for this task. The assertions themselves are not provisional - they are
 * the fail-open contract `classify` has to satisfy once it is implemented:
 * a 200 from an authenticated-only endpoint is the one unambiguous positive
 * signal, so it is the only case that resolves to `'signed-in'`. Nothing
 * here is treated as a confirmed `'signed-out'` - a 401 or 403 from this
 * endpoint could mean "no session" but could just as easily mean something
 * else (a transient auth hiccup, a changed response shape), and guessing
 * wrong blocks a reader who IS signed in. So every other outcome, failed
 * request included, resolves to `'unknown'`.
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

  test('a 401 is not treated as a confirmed sign-out', async () => {
    stubFetchResolve(401);
    await expect(checkSubstackSession()).resolves.toBe('unknown');
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
