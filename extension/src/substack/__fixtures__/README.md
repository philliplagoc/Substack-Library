# Test fixtures

Captured HTML from Substack, used by `extract.test.ts` and `saved.test.ts` to
pin the DOM read paths in `extract.ts` and `saved.ts`. Substack's markup is
unversioned and every class is a build hash, so the parsers match on component
name prefixes and these fixtures are what prove that keeps working.

| File | Page | Notes |
| --- | --- | --- |
| `article-free.html` | A free post | Full body, `isAccessibleForFree: true` |
| `article-paywalled.html` | A paywalled post, not subscribed | Preview body only, `isAccessibleForFree: false` |
| `saved-page.html` | `substack.com/saved` | **Trimmed** from 48 feed units to 6 (5 articles + 1 Note) |
| `saved-list.html` | `substack.com/inbox/saved` (legacy) | The parser must read nothing from this one |

## What was removed

The pages were captured while signed in. Before committing, a capture script
stripped the reader's name, handle, and email, replaced them with `READER`, and
deleted URL query strings (share tokens, tracking parameters) and inline
`style`/`script` blocks.

`saved-page.html` was trimmed further: a full Saved page is a private reading
list, so this copy keeps only the entries the tests need. **The 5 articles left
in it are real, publicly published Substack posts** — their titles, authors, and
publication names are genuine. The 5 were chosen to cover the cases the tests
check: an exact first entry, a custom-domain publication, entries where the
author differs from the publication and one where it does not, and a Note with no
article card.
