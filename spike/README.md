# Substack compatibility spike

Captured: 2026-08-21. Free article fixture re-captured 2026-08-24 to strip a share token. Substack UI is unversioned. Re-check this doc when a fixture test fails.

## Supported desktop pages

| Kind                              | URL pattern                                   | Signed in? | Fixture                         |
| --------------------------------- | --------------------------------------------- | ---------- | ------------------------------- |
| Free article                      | `https://<publication>.substack.com/p/<slug>` | yes        | fixtures/article-free.html      |
| Paywalled article, not subscribed | `https://<publication>.substack.com/p/<slug>` | yes        | fixtures/article-paywalled.html |
| Saved list                        |                                               | yes        | fixtures/saved-list.html        |

Out of scope for v1: a paid article read as a subscriber. The reader pays for no publication.

## Article metadata read paths

| Field                   | Primary path                | Fallback                                         | Notes                                                                                                                                                 |
| ----------------------- | --------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| title                   | `meta[property="og:title"]` | JSON-LD `headline`, then `document.title`        | `og:title` holds the bare title. It does not append the publication name. `document.title` matched it character for character.                        |
| author                  | `meta[name="author"]`       | JSON-LD `author[0].name`                         | JSON-LD `author` is an array, not an object. The extractor must handle both shapes.                                                                   |
| publication             | JSON-LD `publisher.name`    | JSON-LD BreadcrumbList `itemListElement[0].name` | `og:site_name` not found. The only field of the four with no OG source. `publisher.identifier` (`pub:1778977`) is a stable ID that survives a rename. |
| canonical url           | `link[rel="canonical"]`     | `meta[property="og:url"]`                        | Both were identical. JSON-LD `url` and `mainEntityOfPage` carry the same value, so four sources agree.                                                |
| body word count         | `.body.markup`              | `.available-content`, then `article`             | 1599 words on the free fixture, and 1599 again after anonymization. `.available-content` wraps `.body.markup` and returns the same count. `article` over-counts by 41 words: it swallows the title and both UFI bars. Reading time is `wordCount / 250`. |
| paywall / preview state | JSON-LD `isAccessibleForFree` | `.paywall`, then `[class*="paywall"]`          | Free fixture: `isAccessibleForFree` is `true` and every paywall selector matches 0. Unconfirmed against a paywalled page until Task 3 Step 6. Prefer the JSON-LD boolean. The page states its own access level there, so it does not break when Substack renames a class. |

## Saved list read paths

| Field             | Path | Notes |
| ----------------- | ---- | ----- |
| entry container   |      |       |
| entry url         |      |       |
| entry title       |      |       |
| entry publication |      |       |

## Native controls

| Control | Path | State attribute | Notes |
| --- | --- | --- | --- |
| Save / Unsave | Two steps. **1.** Click the trigger: the unlabelled button in either UFI bar, `article .post-ufi-button.style-button:not([aria-label])`. **2.** Wait for the popover, then find the item by text inside `[data-radix-menu-content] button[role="menuitem"]`, matching `innerText.trim()` against `Save` or `Unsave`. | None. Read `innerText`. `Save` means **not saved**. `Unsave` means **saved**. | The label names the action, so it reads inverted. Absent from the DOM until the popover mounts. The item has no `aria-label`, no `id`, and hashed classes (`item-Npdq6R`, `priority_primary-eIAnBM`); `role="menuitem"` and `data-radix-collection-item` are the durable attributes. The popover `id` (`radix-P0-46`) is regenerated on every mount. The `...` trigger appears in both the top and the bottom UFI bar, and both open the same menu. |
| Like | `article .post-ufi-button[aria-label^="Like"]`. Matches 2. Alternative with the same count: `.post-ufi-button.style-button[aria-label^="Like"]`. | `aria-pressed`, `"true"` or `"false"` | Present twice for this post, top and bottom UFI bar, both carrying the same state. Read either. Three more matches for `[aria-label^="Like"]` carry class `style-compressed` and belong to the recommended articles at the page foot; never read those. `aria-label` embeds the like count (`Like (4,160)`), so it changes on every click and an exact-match selector finds nothing. |

## Signed-out state

How to detect: (fill in)

## Risks found

- `og:site_name` is absent on a Substack post page. Publication depends on JSON-LD alone. If that block goes, the remaining fallbacks are the BreadcrumbList and the subdomain of the canonical URL.
- The OG tags carry no publication date. `datePublished` lives only in JSON-LD.
- JSON-LD `author` is an array. Code that reads `ld.author.name` returns `undefined` and fails without an error. Read `author[0].name`.
- Checked on one publication on a `*.substack.com` subdomain. A custom-domain publication is untested.
- The Save control is not on the page. It is a menu item inside a Radix popover behind the post `...` button, and it does not exist in the DOM until the reader opens that menu. A content script that runs on page load cannot find it and cannot tell whether the article is saved. This constrains `implementation-plan.md:88` ("invokes Substack native Save"): capture must click the trigger, wait for the popover to mount, then click the item. Reading `unsavedFromSubstack` costs the same three steps.
- The Save item carries no `aria-pressed`, no `aria-label`, no `id`, and no `data-testid`. Its classes (`item-Npdq6R`, `priority_primary-eIAnBM`) are build hashes. Its state lives in `innerText`. `role="menuitem"` and `data-radix-collection-item` are the only durable attributes on it.
- **The Save label is inverted.** It reads `Save` when the article is not saved and `Unsave` when it is, because the text names the action rather than the state. Code that maps `"Save"` to saved is backwards and throws nothing. Milestone 2 needs a named helper and a test for both directions.
- `implementation-plan.md:166` ("show the actual completion state") is buildable. Click the item, reopen the menu, and read the label: `Save` flipped to `Unsave` confirms the save, and an unchanged label means it failed. The check costs a second popover open, so the reported state is real rather than assumed.
- Substack builds its two toggles differently. Like exposes `aria-pressed`; Save exposes nothing and hides behind a menu. One shared `readToggleState()` helper does not cover both. Milestone 2 needs a strategy per control.
- The popover `id` is Radix-generated (`radix-P0-46`) and changes on every mount. Never record or rely on it.
- `button[aria-label^="Like"]` matches 5 buttons on one article page. Two are this post (top and bottom UFI bars, class `style-button`). Three belong to recommended articles at the page foot (class `style-compressed`). Scope every UFI read to `.style-button` or the post `article` element, or the extension reports a stranger article state as this one.
- `aria-label` on a Like button embeds the like count (`"Like (4,160)"`). An exact-match selector finds nothing. Use `^=` or `*=`.
- Comment Like buttons did not appear in a census taken right after load. They may mount on scroll. The parser must not assume a fixed button count.
- **The fixtures are anonymized, so they are not byte-faithful.** `capture-fixture.js` removes every `data-attrs` attribute, deletes every query string from `href`, `src`, `data-href`, and `action`, and replaces any run of 6 or more digits in a URL path with `0`. A test that asserts on a query parameter, on a numeric profile id, or on in-body button metadata will pass against the live page and fail against the fixture. The word count is unaffected: 1599 before and after.
- A signed share token rides in the article body, inside a JSON blob in `data-attrs`: `{"url":"…?…&token=eyJ1c2VyX2lk…"}`. Its payload holds the reader's numeric `user_id`, a `post_id`, and an expiry roughly 30 days out. Base64 hides it from any literal string match, and JSON hides it from any URL parser, so two anonymization passes missed it before the third caught it. Re-check this whenever the capture snippet changes.
- `new URL(value, base)` does not throw on plain text. It reads the text as a relative path and returns a valid URL, so a sanitizer guarded only by `try`/`catch` rewrote `og:title` to `/p/I%20Posted%20on%20Substack…` and raised nothing. Any code that cleans an attribute must first confirm the value looks like a URL.
- `grep -c` counts matching lines, and this page ships its `<head>` on one line. It reported 1 JSON-LD block where `querySelectorAll` finds 2. Count fixture elements with a DOM parser, never with a line-based tool.
