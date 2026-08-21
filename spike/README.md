# Substack compatibility spike

Captured: 2026-08-21. Substack UI is unversioned. Re-check this doc when a fixture test fails.

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
| body word count         | `.body.markup`              |                                                  |                                                                                                                                                       |
| paywall / preview state |                             |                                                  |                                                                                                                                                       |

## Saved list read paths

| Field             | Path | Notes |
| ----------------- | ---- | ----- |
| entry container   |      |       |
| entry url         |      |       |
| entry title       |      |       |
| entry publication |      |       |

## Native controls

| Control       | Path | State attribute | Notes |
| ------------- | ---- | --------------- | ----- |
| Save / Unsave |      |                 |       |
| Like          |      |                 |       |

## Signed-out state

How to detect: (fill in)

## Risks found

- `og:site_name` is absent on a Substack post page. Publication depends on JSON-LD alone. If that block goes, the remaining fallbacks are the BreadcrumbList and the subdomain of the canonical URL.
- The OG tags carry no publication date. `datePublished` lives only in JSON-LD.
- JSON-LD `author` is an array. Code that reads `ld.author.name` returns `undefined` and fails without an error. Read `author[0].name`.
- Checked on one publication on a `*.substack.com` subdomain. A custom-domain publication is untested.
