/**
 * How long this article takes to read, or nothing.
 *
 * `implementation-plan.md` fixes the rate at 250 words per minute.
 * `spike/README.md` fixes the hard case: a paywalled preview is 684 words,
 * long enough that no word-count rule can tell it from a short free article.
 * The `readable` flag is the only honest signal, and the parent spec says the
 * field "stays blank when only a preview is readable".
 *
 * Returning `undefined` rather than 0 is load-bearing twice over. `mergeCard`
 * folds this in with `??`, so `undefined` leaves an estimate an earlier
 * capture already found; and `visibleCards` hides an unestimated card when a
 * max-minutes filter is set, which it should not do to a card estimated at
 * zero minutes.
 */
export function readingMinutes(
  wordCount: number | null,
  readable: boolean,
): number | undefined {
  if (!readable || wordCount == null || wordCount <= 0) return undefined;
  return Math.ceil(wordCount / 250);
}
