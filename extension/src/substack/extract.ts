/**
 * The code that knows Substack's DOM. Every read path here is sourced to
 * `spike/README.md`, "Article metadata read paths".
 *
 * THIS FILE IMPORTS NOTHING, AND THE FUNCTION BELOW DEFINES EVERYTHING IT USES
 * INSIDE ITS OWN BODY.
 *
 * `chrome.scripting.executeScript` ships a function into the page by calling
 * `Function.prototype.toString()` on it. Anything the function closes over -
 * an imported constant, a helper declared beside it in this module - is not
 * part of that string. Such code compiles, type-checks, and then throws a bare
 * ReferenceError inside Substack's document, where nothing is watching.
 *
 * The `doc: Document = document` default is what keeps it testable. Injection
 * calls it with no arguments and the page's own `document` resolves at
 * runtime; tests pass a linkedom document straight in.
 */

export interface ArticleMeta {
  title: string | null;
  author: string | null;
  publication: string | null;
  canonicalUrl: string | null;
  wordCount: number | null;
  /** From JSON-LD isAccessibleForFree. False means a paywalled preview. */
  readable: boolean;
  /** The article body as plain text, for locating quotes later. */
  bodyText: string;
}

export function extractArticleMeta(doc: Document = document): ArticleMeta {
  const SELECTORS = {
    // spike/README.md, "Article metadata read paths", body word count row.
    // `.available-content` wraps `.body.markup` and gives the same count.
    // NEVER fall back to `article`: it over-counts by 41 words on the free
    // fixture, because it swallows the title and both UFI bars.
    body: '.body.markup',
    bodyFallback: '.available-content',
    // spike/README.md, "Paywall block". Only the fallback; JSON-LD is primary.
    paywall: '.paywall',
    canonical: 'link[rel="canonical"]',
    jsonLd: 'script[type="application/ld+json"]',
  };

  function metaContent(selector: string): string | null {
    const el = doc.querySelector(selector);
    const value = el && el.getAttribute('content');
    return value && value.trim() ? value.trim() : null;
  }

  function clean(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function jsonLdBlocks(): Record<string, any>[] {
    const out: Record<string, any>[] = [];
    for (const script of Array.from(doc.querySelectorAll(SELECTORS.jsonLd))) {
      try {
        const parsed = JSON.parse(script.textContent || '');
        if (Array.isArray(parsed)) out.push(...parsed);
        else out.push(parsed);
      } catch {
        // Malformed JSON-LD is not our problem. Skip the block.
      }
    }
    return out;
  }

  const blocks = jsonLdBlocks();
  const article = blocks.find((b) => b && /Article/.test(String(b['@type']))) ?? {};
  const crumbs = blocks.find((b) => b && String(b['@type']) === 'BreadcrumbList');

  // spike/README.md: JSON-LD `author` is an ARRAY. `ld.author.name` returns
  // undefined and throws nothing.
  const ldAuthor = Array.isArray(article.author) ? article.author[0] : article.author;

  const title =
    metaContent('meta[property="og:title"]') ??
    clean(article.headline) ??
    clean(doc.title);

  const author = metaContent('meta[name="author"]') ?? clean(ldAuthor && ldAuthor.name);

  // spike/README.md: og:site_name does NOT exist on a Substack post. There is
  // no OG source for publication at all.
  const publication =
    clean(article.publisher && article.publisher.name) ??
    clean(
      crumbs &&
        Array.isArray(crumbs.itemListElement) &&
        crumbs.itemListElement[0] &&
        crumbs.itemListElement[0].name,
    );

  const canonicalEl = doc.querySelector(SELECTORS.canonical);
  const canonicalUrl =
    clean(canonicalEl && canonicalEl.getAttribute('href')) ??
    metaContent('meta[property="og:url"]');

  const bodyEl =
    doc.querySelector(SELECTORS.body) ?? doc.querySelector(SELECTORS.bodyFallback);
  const bodyText = (bodyEl && bodyEl.textContent ? bodyEl.textContent : '').trim();
  const words = bodyText ? bodyText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length > 0 ? words.length : null;

  // spike/README.md: prefer the JSON-LD boolean. The page states its own
  // access level there, so it survives a class rename. Word count is NOT a
  // substitute: the paywalled preview is 684 words.
  const readable =
    typeof article.isAccessibleForFree === 'boolean'
      ? article.isAccessibleForFree
      : !doc.querySelector(SELECTORS.paywall);

  return { title, author, publication, canonicalUrl, wordCount, readable, bodyText };
}
