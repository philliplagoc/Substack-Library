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

/**
 * Is the reader signed out of Substack?
 *
 * spike/README.md, "Signed-out state": the sign-in prompt has no id, no
 * aria-label, and no data-testid. Its class chain is eight build hashes deep,
 * and `buttonBase-GK1x3M` is shared with the paywall's Subscribe button, so
 * the hashes name a component type rather than one button. Scope to the nav
 * container and match on text, the same way the Save menu item is read.
 *
 * Signed out is NOT a capture blocker. Metadata reads without a session. Only
 * the native controls need one, and Milestone 2A invokes none.
 */
export function detectSignedOut(doc: Document = document): boolean {
  const nav = doc.querySelector('#main [class*="mainMenuContent"]');
  if (!nav) return false;
  return Array.from(nav.querySelectorAll('button')).some(
    (b) => (b.textContent || '').trim() === 'Sign in',
  );
}

/**
 * The article a reader-route page is showing, or nothing.
 *
 * `substack.com/inbox/post/<id>` draws a post inside the app shell. The shell's
 * head describes `/inbox`, so canonical, og:title, and JSON-LD all answer for
 * the wrong page. The body is the only honest source on this route.
 *
 * The target is the post's own link: article-shaped href, sitting in an
 * ancestor of `.body.markup`. Its text is the post title. Measured on a live
 * page, `.body.markup` is unique and belongs to the open post; the inbox list
 * rendered behind it carries no body of its own.
 *
 * DO NOT match `a[href*="/p/"]` across the document. That returns the inbox
 * list - eight links to eight other publications, each stamped with the
 * CURRENT post's id in a `source` parameter - and taking the first is a coin
 * flip that produces a card for someone else's article.
 *
 * Three decisions, all reversible:
 *
 *  - The walk stops before <body>. Reaching <body> would always find a link,
 *    because the inbox list lives there, and always finding one is the failure
 *    this function exists to avoid.
 *  - Anchors inside `.body.markup` are skipped. An article that links to
 *    another Substack post would otherwise hand back that post's URL.
 *  - Article-shaped means `/p/<slug>` and nothing after it. A bare "/p/"
 *    substring also matches `/p/<slug>/comment/<id>`, which would key the card
 *    on a comment.
 *
 * An empty title is returned as an empty string rather than a null result. The
 * URL is the part that cannot be recovered later; `createCard` already falls
 * back to the URL for a blank title, and the panel says so.
 *
 * Returning null is a real answer, not a failure to answer. `capture()` turns
 * it into a refusal the reader can see, rather than keying the card on the
 * inbox URL and making a second card for an article the board already holds.
 */
export function readReaderArticle(
  doc: Document = document,
): { url: string; title: string } | null {
  const ARTICLE_HREF = /\/p\/[^/?#]+(?:[?#].*)?$/;

  const body = doc.querySelector('.body.markup');
  if (!body) return null;

  let node: Element | null = body.parentElement;

  while (node && node !== doc.body) {
    for (const anchor of Array.from(node.querySelectorAll('a[href]'))) {
      if (body.contains(anchor)) continue;

      const href = anchor.getAttribute('href');
      if (href && ARTICLE_HREF.test(href)) {
        return { url: href, title: (anchor.textContent || '').trim() };
      }
    }
    node = node.parentElement;
  }

  return null;
}

/**
 * What the reader has selected in the article.
 *
 * Returns null when nothing is selected. Self-contained: see the header.
 *
 * This used to also return the ~40 characters preceding the selection, read
 * with a Range, to break ties for `resolveQuote`. Both went on 2026-09-03.
 */
export function readSelection(win: Window = window): string | null {
  const selection = win.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const text = selection.toString().trim();
  return text || null;
}
