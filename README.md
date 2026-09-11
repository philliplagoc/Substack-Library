# Substack Library

Substack Library is a local-first Chrome extension to help you track and take notes on what you have saved on Substack.

## What it does

- Sync your existing saved articles. It reads the title, author, publication.
- Track your reading progress on a Kanban Board.
- Open on articles to save them to your Board.
- Take notes in a side panel docked beside the article on its own page.
- Select text to keep it as a quote, and comment on the quotes.
- Export your notes as Markdown.
- Backup your Substack Library as a JSON so you can resume your reading on other devices.

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

## Quickstart

*Prerequisite: Ensure the extension is loaded and click the toolbar button once to initialize.*

### Open the board

Click the toolbar button on any non-article page to open or focus your reading board.

### Import saved Substack articles

Click **Import Saved Articles** on the board while logged into Substack to sync your library into the **To Read** column without creating duplicates.

### Add a single article

Open an article, click the toolbar button to launch the side panel, and select **Add to board and start taking notes** (grant permissions if prompted on custom domains).

### Track reading progress

Drag cards between **To Read**, **Reading**, and **Processed** to update status.

### Take notes

Open any card's side panel from the board or directly on an article; edits typed into **Notes** save automatically.

### Capture a quote

Highlight text on an open article and click **Capture** in the side panel to save the passage and attach comments.

### Tag and filter

Add keywords in the **Tags** field, then use the top search bar and tag toggles to filter your board by title, author, or topic.

### Export notes as Markdown

Click **Export Markdown** on a single card or **Export Notes** on the board to generate YAML-frontmatted Markdown files ready for tools like Obsidian.

### Back up and sync

Click **Back Up Library** to export a JSON file of your board, then use **Restore Backup** on another device to merge your data.

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

## License

MIT. See [LICENSE](LICENSE).
