# Substack Library

Substack-Library is a local-first Chrome and Edge extension for a deliberate
Substack reading workflow. You capture articles from any device, triage them on a
three-column board, then read them one at a time with a notes panel docked beside
the article on its own page. When you finish, you export your notes and quotes as
Markdown, either as a download or straight into an Obsidian vault. It turns a pile
of open tabs into one queue you work through.

![The triage board](screenshots/board.png)

![The reading panel beside an article](screenshots/side-panel.png)

## What it does

- **Capture** an article from any Substack page (or a custom domain) with one
  toolbar click. It reads the title, author, publication, and length, and makes
  or refreshes a card. A paywalled article still makes a card and says so.
- **Triage** cards on a three-column board: To Read, Reading, Processed.
- **Take notes** in a side panel docked beside the article on its own page.
  Select text to keep it as a quote, and comment on the quotes.
- **Export** a card as Markdown: a versioned download that never overwrites an
  earlier export. A full JSON backup and restore is on the board.

Everything is stored locally in the browser (IndexedDB). There is no account and
no server.

## Install from source

```sh
cd extension
npm install
npm run build
```

Then open `chrome://extensions` (or `edge://extensions`), turn on Developer
mode, choose **Load unpacked**, and select `extension/.output/chrome-mv3`.

## Develop

```sh
cd extension
npm run dev      # live-reloading dev build
npm test         # vitest
npm run compile  # type-check only
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more, and
[`extension/MANUAL-CHECKS.md`](extension/MANUAL-CHECKS.md) for the checks that
tests do not cover.

## Project layout

```
extension/
  src/
    entrypoints/   background service worker, board tab page, side panel
    domain/        pure logic: cards, articles, Markdown, quotes, sync
    db/            IndexedDB schema and access (Dexie)
    substack/      the code that reads Substack's DOM
      __fixtures__/  captured pages the parser tests run against
    ui/            shared React components
```

## Status

Early. Capture, the board, side-panel notes, quotes, Markdown export, and JSON
backup all work. Not built yet: writing exports straight into an Obsidian vault,
syncing with Substack's native Save/Unsave, and importing an existing backlog.

## License

MIT. See [LICENSE](LICENSE).
