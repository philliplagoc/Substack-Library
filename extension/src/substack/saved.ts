/**
 * The code that knows the Saved list's DOM. Every selector here is sourced to
 * `spike/README.md`, "Saved list read paths".
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
 * One row of the Saved list.
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
  itemMeta: string | null;
}

export function extractSavedEntries(doc: Document = document): SavedEntry[] {
  const SELECTORS = {
    // spike/README.md: matches exactly 60 elements on the fixture, one per
    // entry, with title, publication, and link counts all agreeing at 60.
    entry: '.visibility-check',
    // Each entry holds two anchors: the article and the publication's home
    // page. Only the article's href contains "/p/". The selector names no
    // host, which is why the two custom-domain entries resolve.
    link: 'a[href*="/p/"]',
    title: '.reader2-post-title.reader2-clamp-lines',
    publication: '.pub-name',
    // "Hussain Ibarra∙14 min read". Present on all 60 fixture entries, the two
    // "1 hr 6 min watch" entries included. Kept nullable: a later capture may
    // drop it, and `domain/saved.ts` already treats a null as "no author, no
    // minutes, no medium".
    itemMeta: '.reader2-item-meta',
  };

  function text(el: Element, selector: string): string | null {
    const found = el.querySelector(selector);
    const value = found && found.textContent ? found.textContent.trim() : '';
    return value ? value : null;
  }

  const out: SavedEntry[] = [];

  for (const el of Array.from(doc.querySelectorAll(SELECTORS.entry))) {
    const link = el.querySelector(SELECTORS.link);
    const href = link ? link.getAttribute('href') : null;
    if (!href) continue;

    let url: string;
    try {
      url = new URL(href, 'https://substack.com').href;
    } catch {
      continue;
    }

    out.push({
      url,
      title: text(el, SELECTORS.title),
      publication: text(el, SELECTORS.publication),
      itemMeta: text(el, SELECTORS.itemMeta),
    });
  }

  return out;
}

/**
 * Scroll the Saved list until it stops growing, and say whether it finished.
 *
 * `spike/README.md`, "Risks found": the list loads more entries on scroll and
 * does NOT virtualize. 20 entries at the top of the page, 85 at the bottom,
 * still 85 back at the top. Entries loaded once stay in the DOM, so the count
 * only ever grows and nothing has to be tracked as it scrolls away.
 *
 * The stop condition is TWO flat readings, not one. A single flat count cannot
 * tell "the list ended" from "the next page has not landed yet", and a growing
 * count is the only signal the page offers.
 *
 * `complete: false` means the cap was hit. The caller must not flag anything
 * as missing on that result: a partial list would flag its whole tail.
 */
export async function scrollToEnd(): Promise<{ count: number; complete: boolean }> {
  const ENTRY = '.visibility-check';
  const SETTLE_MS = 1200;
  // 60 rounds at 20 new entries a round is 1200 entries, and at worst 72
  // seconds. Long enough for any real Saved list, bounded enough that a page
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
