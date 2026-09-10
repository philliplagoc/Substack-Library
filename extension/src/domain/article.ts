/**
 * How long this article takes to read, or nothing.
 *
 * The rate is fixed at 250 words per minute. The hard case: a paywalled preview
 * is around 684 words, long enough that no word-count rule can tell it from a
 * short free article. The `readable` flag is the only honest signal, so the
 * field stays blank when only a preview is readable.
 *
 * Returning `undefined` rather than 0 still matters. `mergeCard` folds this in
 * with `??`, so `undefined` leaves an estimate an earlier capture already
 * found; and the card face and the Markdown export print "— min" for
 * `undefined` but "0 min" for 0, and a preview-only article is not a
 * zero-minute read.
 */
export function readingMinutes(
  wordCount: number | null,
  readable: boolean,
): number | undefined {
  if (!readable || wordCount == null || wordCount <= 0) return undefined;
  return Math.ceil(wordCount / 250);
}
