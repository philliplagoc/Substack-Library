/**
 * Checks whether the reader currently has a live Substack session, without
 * opening a tab to find out.
 *
 * THIS FILE IS THE ONE EXCEPTION TO THE "NO IMPORTS" RULE IN `src/substack/`.
 * Every other file in this folder is written to be handed to
 * `chrome.scripting.executeScript`, which serializes a function with
 * `Function.prototype.toString()` and injects only that string into the
 * page. Anything the function closed over - an import, a helper declared
 * beside it - is not part of that string, and becomes a bare ReferenceError
 * inside Substack's own document, where nothing is watching. This module is
 * never stringified and never injected: it runs directly in the background
 * service worker, so ordinary imports resolve exactly as they look here.
 *
 * The probe itself replaces a slower path: opening a Substack tab just to
 * discover the reader was signed out the whole time. A plain, direct fetch
 * answers the same question in one round trip, before any tab exists.
 */

export type SubstackSessionState = 'signed-in' | 'signed-out' | 'unknown';

// Authenticated-only endpoint that answers with JSON, not an HTML shell that
// would need parsing either way. `/api/v1/user` was tried first and 404s
// regardless of session state, so it says nothing about being signed in.
const SESSION_PROBE_URL = 'https://substack.com/api/v1/settings';

// Long enough for a normal network round trip, short enough that a hung
// request cannot turn "checking the session" into "the import never runs."
const PROBE_TIMEOUT_MS = 5000;

/**
 * TODO(human): map the probe's outcome to a session state.
 *
 * `status` is the HTTP status from the settings probe, or `null` when the
 * request itself failed (network error, or the timeout firing).
 *
 * Constraint: a wrong `'signed-out'` blocks a reader who IS signed in, which
 * is worse than the slow path this replaces — so anything that is not a
 * clear, confirmed signal must resolve to `'unknown'`, never `'signed-out'`.
 */
function classify(status: number | null): SubstackSessionState {
  throw new Error('not implemented');
}

/**
 * Probes Substack for a live session before the caller opens a tab.
 *
 * Never rejects: a network failure and the timeout firing are both caught
 * here and folded into the same classification step as a real HTTP
 * response, so every caller sees one of the three `SubstackSessionState`
 * values and never has to handle a thrown error.
 */
export async function checkSubstackSession(): Promise<SubstackSessionState> {
  let status: number | null;

  try {
    const response = await fetch(SESSION_PROBE_URL, {
      credentials: 'include',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    status = response.status;
  } catch {
    // A network error and the abort signal firing both land here. Neither
    // tells us anything about the session, so both are represented the same
    // way - as a missing status - and handed to classify like any other
    // outcome.
    status = null;
  }

  return classify(status);
}
