// Runs in the DevTools console and in Node. Assigns to globalThis.spike.
// Pure functions. No network. No file access. Never throws.
(function () {
  const SELECTORS = {
    // From spike/README.md, "Article metadata read paths" and "Native controls".
    body: '.body.markup',
    paywall: '.paywall',
    // Like carries a durable aria-label. Scoped to the post's own UFI bars
    // (style-button) so it never matches a recommended-article button (style-compressed).
    likeButton: 'article .post-ufi-button.style-button[aria-label^="Like"]',
    // Save has no selector of its own: it is a menu item with no aria-label,
    // no id, and hashed classes, hidden inside a popover until the trigger is
    // clicked. This only finds the trigger. Reading the state needs the
    // popover open and a text match on "Save"/"Unsave" (see README, Native controls).
    saveButtonTrigger: 'article .post-ufi-button.style-button:not([aria-label])',
  };

  function meta(doc, selector) {
    const el = doc.querySelector(selector);
    const value = el && el.getAttribute('content');
    return value && value.trim() ? value.trim() : null;
  }

  function jsonLd(doc) {
    const out = [];
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent);
        if (Array.isArray(parsed)) out.push(...parsed);
        else out.push(parsed);
      } catch (_) {
        // Malformed JSON-LD is not our problem. Skip it.
      }
    }
    return out;
  }

  function firstNonNull(candidates) {
    for (const [source, value] of candidates) {
      if (value) return { value, source };
    }
    return { value: null, source: null };
  }

  function extractArticleMeta(doc) {
    const sources = {};
    const ld = jsonLd(doc).find((x) => x && /Article/.test(String(x['@type']))) || {};
    const ldAuthor = Array.isArray(ld.author) ? ld.author[0] : ld.author;

    const title = firstNonNull([
      ['og:title', meta(doc, 'meta[property="og:title"]')],
      ['ld:headline', ld.headline || null],
      ['document.title', doc.title && doc.title.trim() ? doc.title.trim() : null],
    ]);
    const author = firstNonNull([
      ['meta:author', meta(doc, 'meta[name="author"]')],
      ['ld:author.name', ldAuthor && ldAuthor.name ? ldAuthor.name : null],
    ]);
    const publication = firstNonNull([
      ['og:site_name', meta(doc, 'meta[property="og:site_name"]')],
      ['ld:publisher.name', ld.publisher && ld.publisher.name ? ld.publisher.name : null],
    ]);
    const canonical = doc.querySelector('link[rel="canonical"]');
    const canonicalUrl = firstNonNull([
      ['link:canonical', canonical && canonical.getAttribute('href') ? canonical.getAttribute('href') : null],
      ['og:url', meta(doc, 'meta[property="og:url"]')],
    ]);

    let wordCount = null;
    const body = doc.querySelector(SELECTORS.body);
    if (body) {
      const words = (body.textContent || '').trim().split(/\s+/).filter(Boolean);
      wordCount = words.length > 0 ? words.length : null;
      sources.wordCount = SELECTORS.body;
    }


    const isPreview = Boolean(doc.querySelector(SELECTORS.paywall));

    sources.title = title.source;
    sources.author = author.source;
    sources.publication = publication.source;
    sources.canonicalUrl = canonicalUrl.source;

    return {
      title: title.value,
      author: author.value,
      publication: publication.value,
      canonicalUrl: canonicalUrl.value,
      wordCount,
      isPreview,
      sources,
    };
  }

  globalThis.spike = { SELECTORS, extractArticleMeta };
})();
