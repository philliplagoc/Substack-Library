# Privacy Policy for Substack Library

**Effective date:** 15 September 2026

Substack Library is a local-first browser extension. It has no account system,
no backend server, and no analytics. The developer does not receive, store, or
have any means of accessing your data.

## What the extension stores, and where

All of it stays in your own browser, on your own machine.

| Data | Where it lives | When it is cleared |
| --- | --- | --- |
| Saved articles (title, author, publication, URL), reading status, notes, quotes, comments, tags | IndexedDB, in your browser profile | When you delete the item, or remove the extension |
| Transient UI state (which board tab is open, which card the side panel is showing) | `chrome.storage.session` | Automatically, when you close the browser |

`chrome.storage.session` is held in memory and is never written to disk or
synchronised to a Google account. The extension does not use
`chrome.storage.sync`, so nothing is copied to Google's servers.

## Network requests

The extension makes exactly one network request of its own: a `GET` to
`https://substack.com/api/v1/settings`, sent with the Substack cookies your
browser already holds. Its only purpose is to determine whether you are
currently signed in to Substack, so the extension can avoid opening a tab that
would only show a sign-in wall. The extension reads the HTTP status code and
discards the response body. No information about you is added to this request.

No data is transmitted to the developer or to any third party. There are no
analytics, telemetry, advertising, or tracking services of any kind.

## Reading page content

When you explicitly ask the extension to act on a page — importing your saved
Substack articles, adding an open article to your board, or capturing selected
text as a quote — it reads that page's content in order to extract the article
title, author, publication, and any text you selected. This reading happens
entirely within your browser, and the result is written only to the local
database described above.

## Permissions

- **`storage`** — the local and session storage described above.
- **`activeTab`** — read the article on the tab whose toolbar button you clicked.
- **`scripting`** — run the extraction code that reads an article's title,
  author, and publication from the page.
- **`tabs`** — let the side panel follow the tab you are looking at. Without it,
  Chrome withholds tab URLs and titles from the extension entirely.
- **Host access to `https://substack.com/*`** — required to read your Saved list,
  which is only ever served from that origin.
- **Optional host access to other sites** — Substack publications run on their
  own custom domains. This access is never requested at install. It is requested
  only when you click to add an article on such a domain, one publication at a
  time, and you can revoke it at any time from the extension's settings.

## Exports and backups

Markdown exports and JSON backups are generated in your browser and saved
through your browser's normal download mechanism. They are written to wherever
you choose to save them, and are not uploaded anywhere. Once a backup file
leaves the extension, its contents are yours to manage.

## Data sharing and sale

None. No user data is sold, rented, transferred, or shared with any party, and
none is used for purposes unrelated to the extension's single purpose, for
creditworthiness, or for lending.

## Children

The extension is not directed at children and collects no data from anyone.

## Changes

If this policy changes, the revised version will be published in this repository
and the effective date above updated.

## Contact

Questions about this policy: `[your preferred public contact address]`

## Affiliation

Substack Library is an independent project. It is not affiliated with, endorsed
by, or sponsored by Substack Inc. "Substack" is a trademark of its respective
owner.
