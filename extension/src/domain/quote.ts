import type { Quote } from './types';

/**
 * Build a quote from what the reader selected.
 *
 * Pure: the id and the timestamp both come in through `deps`, so the same
 * arguments always give the same quote.
 *
 * This file used to hold `resolveQuote`, which answered "where is this quote in
 * the article now" and wrote a `locatorLost` flag back to the card. It was
 * deleted on 2026-09-03. The flag was persisted, and the only thing that could
 * ever clear it was a panel holding the live article text, so a board with no
 * article tab open showed "location unavailable" against quotes that were
 * perfectly intact. See the design doc for the full argument.
 */
export function createQuote(
  input: { text: string },
  deps: { id: string; capturedAt: string },
): Quote {
  return {
    id: deps.id,
    text: input.text,
    capturedAt: deps.capturedAt,
  };
}
