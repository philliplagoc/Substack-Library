# Substack compatibility spike

Captured: 2026-08-19 (fill in). Substack UI is unversioned. Re-check this doc when a fixture test fails.

## Supported desktop pages

| Kind | URL pattern | Signed in? | Fixture |
|---|---|---|---|
| Free article | | yes | fixtures/article-free.html |
| Paywalled article, not subscribed | | yes | fixtures/article-paywalled.html |
| Saved list | | yes | fixtures/saved-list.html |

Out of scope for v1: a paid article read as a subscriber. The reader pays for no publication.

## Article metadata read paths

| Field | Primary path | Fallback | Notes |
|---|---|---|---|
| title | | | |
| author | | | |
| publication | | | |
| canonical url | | | |
| body word count | | | |
| paywall / preview state | | | |

## Saved list read paths

| Field | Path | Notes |
|---|---|---|
| entry container | | |
| entry url | | |
| entry title | | |
| entry publication | | |

## Native controls

| Control | Path | State attribute | Notes |
|---|---|---|---|
| Save / Unsave | | | |
| Like | | | |

## Signed-out state

How to detect: (fill in)

## Risks found

- (fill in)