/**
 * The code that knows the Saved page's DOM. Every selector here was worked out
 * against a captured Saved page (see `src/substack/__fixtures__/`).
 *
 * Reads `substack.com/saved`, not `substack.com/inbox/saved`. The two are
 * different pages sharing no class: the reader view held 20 entries on
 * 2026-08-31 where this one held 47, and it is shrinking.
 *
 * THIS FILE IMPORTS NOTHING, AND EVERY FUNCTION BELOW DEFINES EVERYTHING IT
 * USES INSIDE ITS OWN BODY.
 *
 * `chrome.scripting.executeScript` ships a function into the page by calling
 * `Function.prototype.toString()` on it. Anything the function closes over is
 * not part of that string, and becomes a bare ReferenceError inside Substack's
 * document where nothing is watching. Type annotations are safe: types are
 * erased before that string exists.
 */

/**
 * One saved article.
 *
 * Not exported, and deliberately a second declaration of `SavedEntry` in
 * `domain/saved.ts`. This file may not import that one, and `domain/` may not
 * import this one. The two are checked against each other in `background.ts`,
 * where the injection result is passed to `applySync`.
 */
interface SavedEntry {
  url: string;
  title: string | null;
  publication: string | null;
  author: string | null;
}

export function extractSavedEntries(doc: Document = document): SavedEntry[] {
  // Every class on this page is a webpack build hash: the fixture carried
  // `feedItem-ONDKv3`, `postAttachment-eYV3fM`, `clamp-2-kM02pu`,
  // `hoverLink-g45pgX`. The hash is regenerated on a Substack build; the name
  // in front of it is the component, and that is what is matched here. Same
  // decision, and the same reasoning, as the sign-in prompt read in
  // `extract.ts`, which matches `[class*="mainMenuContent"]`.
  //
  // The risk this accepts: a future `feedItemHeader-XYZ` would also match
  // `[class*="feedItem-"]`. The trailing hyphen is what keeps that narrow, and
  // the fixture test asserts an exact entry count, so an extra match fails
  // loudly rather than inflating the board.
  const SELECTORS = {
    // The feed unit wrapping one save. One per article, plus one per Note.
    unit: '[class*="feedItem-"]',
    // The article card. An <a>, so its href IS the article url. Absent on a Note.
    attachment: '[class*="postAttachment-"]',
    // Inside the attachment. A line-clamp class, but textContent holds the
    // untruncated title.
    title: '[class*="clamp-2-"]',
    // Inside the attachment. The publication, not the author.
    publication: '[class*="hoverLink-"]',
    // Inside the unit, outside the attachment. Not a class at all: the href
    // shape is the durable thing here. The avatar link shares this href and has
    // no text, so the loop below takes the first non-empty one.
    author: 'a[href^="/@"]',
  };

  function text(el: Element, selector: string): string | null {
    const found = el.querySelector(selector);
    const value = found && found.textContent ? found.textContent.trim() : '';
    return value ? value : null;
  }

  const out: SavedEntry[] = [];

  for (const unit of Array.from(doc.querySelectorAll(SELECTORS.unit))) {
    // A feed unit with no article card is a Note. Skipping it here is what
    // keeps the entry count honest.
    const attachment = unit.querySelector(SELECTORS.attachment);
    if (!attachment) continue;

    const href = attachment.getAttribute('href');
    if (!href) continue;

    let url: string;
    try {
      url = new URL(href, 'https://substack.com').href;
    } catch {
      continue;
    }

    // The avatar and the name are two links to the same profile, and the
    // avatar's text is empty. Take the first one that says something.
    let author: string | null = null;
    for (const link of Array.from(unit.querySelectorAll(SELECTORS.author))) {
      const value = link.textContent ? link.textContent.trim() : '';
      if (value) {
        author = value;
        break;
      }
    }

    out.push({
      url,
      title: text(attachment, SELECTORS.title),
      publication: text(attachment, SELECTORS.publication),
      author,
    });
  }

  return out;
}

/**
 * Scroll the Saved page until it stops growing, and say whether it finished.
 *
 * The page loads more entries on scroll and does NOT virtualize. Entries loaded
 * once stay in the DOM, so the count only ever grows and nothing has to be
 * tracked as it scrolls away. The window is the scroller: on the captured page
 * `document.documentElement` measured 22639 tall against a 911 viewport, and
 * `scrollTop` reached its maximum.
 *
 * The stop condition is TWO flat readings, not one. A single flat count cannot
 * tell "the list ended" from "the next page has not landed yet", and a growing
 * count is the only signal the page offers.
 *
 * `complete: false` means the cap was hit. The caller must not flag anything
 * as missing on that result: a partial list would flag its whole tail.
 */
export async function scrollToEnd(): Promise<{ count: number; complete: boolean }> {
  // Must stay equal to SELECTORS.unit in extractSavedEntries: this counts the
  // same elements that parser reads. The injection boundary forbids sharing a
  // constant between these two functions, because each is stringified on its
  // own, so the value is written twice on purpose.
  const ENTRY = '[class*="feedItem-"]';
  const SETTLE_MS = 1200;
  // 60 rounds at 20 new entries a round is 1200 entries, and at worst 72
  // seconds. Long enough for any real Saved page, bounded enough that a page
  // that never settles still returns.
  const MAX_ROUNDS = 60;

  function count(): number {
    return document.querySelectorAll(ENTRY).length;
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  let seen = count();
  let flat = 0;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    window.scrollTo(0, document.body.scrollHeight);
    await wait(SETTLE_MS);

    const now = count();
    if (now > seen) {
      seen = now;
      flat = 0;
      continue;
    }

    flat += 1;
    if (flat >= 2) return { count: seen, complete: true };
  }

  return { count: seen, complete: false };
}
