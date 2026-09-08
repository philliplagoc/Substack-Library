import type { Quote } from './types';

/**
 * Build a quote from what the reader selected.
 *
 * Pure: the id and the timestamp both come in through `deps`, so the same
 * arguments always give the same quote. `db/cards.ts` owns the nanoid call,
 * the same way it owns the one for a card id.
 */
export function createQuote(
  input: { text: string; prefix: string },
  deps: { id: string; capturedAt: string },
): Quote {
  return {
    id: deps.id,
    text: input.text,
    locator: input.prefix,
    // It was on the page a moment ago. Nothing is lost yet.
    locatorLost: false,
    capturedAt: deps.capturedAt,
  };
}

/** Every whitespace run becomes one space. Nothing else changes. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/** Turn a literal into a pattern that matches only itself. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Where is this quote in the article now, if anywhere?
 *
 * Returns a character offset into `articleText`, or null when the quote can no
 * longer be found - which the panel turns into `locatorLost` and the
 * "location unavailable" label.
 *
 * The quote's own text does most of the work. `quote.locator` holds the ~40
 * characters that preceded it at capture time, and exists only to break ties
 * when the same passage appears more than once.
 *
 * The four decisions the spec left open, and which way each one went:
 *
 *  - **Whitespace collapses; nothing else does.** A selection carries the line
 *    breaks the page laid out with, and `textContent` carries different ones,
 *    so every whitespace run in the quote matches every whitespace run in the
 *    article. Case, punctuation, and quotation marks are left alone. An author
 *    who changed one of those made an edit, and reporting an edit is the whole
 *    job of `locatorLost`. Rejected: stripping punctuation, which would report
 *    a quote as intact after the sentence around it was rewritten.
 *
 *  - **Two matches the prefix cannot separate means null.** "It is in two
 *    places" is not an answer to "where is it". Rejected: returning the first
 *    match, which hands the caller a confident offset that is wrong half the
 *    time; null costs the reader a visible label and costs nothing else, since
 *    the verbatim text is stored on the quote and never read back from here.
 *
 *  - **A match at a new offset is still the same quote.** Nothing here compares
 *    against where the quote used to be. An author who inserted a paragraph
 *    above it moved every offset below, and treating that as a loss would mark
 *    the whole article lost on its first edit.
 *
 *  - **A quote spanning a paragraph break still counts.** That is the
 *    whitespace rule doing its work: the break arrives as `\n` or `\n\n` and
 *    matches the single space `textContent` renders.
 *
 * The offset addresses `articleText` as it was passed in, not a normalized
 * copy, so a caller can slice with it. That is why the search builds a
 * whitespace-tolerant pattern and runs it over the original rather than
 * normalizing both sides first: normalizing the article would shift every
 * offset past the first collapsed run.
 *
 * An empty quote returns null. Every string contains the empty string at index
 * 0, and reporting a confident 0 would be a lie.
 */
export function resolveQuote(articleText: string, quote: Quote): number | null {
  const words = quote.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const pattern = new RegExp(words.map(escapeRegExp).join('\\s+'), 'g');

  const matches: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(articleText)) !== null) {
    matches.push(match.index);
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;

  // Ambiguous. The prefix is the only tiebreaker, and an absent one breaks no
  // tie: `''` ends every string, so it would leave every match standing.
  const locator = collapse(quote.locator ?? '');
  if (!locator) return null;

  const identified = matches.filter((at) => collapse(articleText.slice(0, at)).endsWith(locator));
  return identified.length === 1 ? identified[0]! : null;
}
