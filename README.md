# Substack-Library
A local-first Chrome/Edge extension for a deliberate Substack reading workflow: capture articles from any device, triage them on a three-column board, take notes beside the article on its original page, and export those notes as Markdown, as a download or written into an Obsidian vault.

## Status

- Milestone 0 complete: see `spike/README.md` for Substack read paths and
  `prototype/DECISIONS.md` for board layout.
- Milestone 1 complete: the extension scaffold and the board. See
  `docs/superpowers/specs/2026-08-26-milestone-1-design.md`.
- Milestone 2A complete: capture and the reading panel. The toolbar button on
  a Substack article reads its title, author, publication, and length, makes
  or refreshes a card, and opens a side panel beside the article. Custom
  domains work, and so do the app's own reader shells at
  `substack.com/inbox/post/<id>` and `substack.com/home/post/p-<id>`, where
  the page's `<head>` describes the shell rather than the post. In the panel
  you take notes, capture selected text as quotes, comment on them, and move
  the card between columns. A paywalled article still makes a card and says
  so. See `docs/superpowers/specs/2026-08-29-milestone-2a-design.md`.
- Not built yet: Markdown export and the write into an Obsidian vault
  (Milestone 2B), and Saved-list sync with native Save and Unsave
  (Milestone 3). Notes live in the extension's database until 2B lands, so
  export a JSON backup from the board if you want them somewhere else.
- Next: the Milestone 2B design. See `implementation-plan.md`.

## Development

Extension: `cd extension; npm install; npm run build`, then load
`extension/.output/chrome-mv3` as an unpacked extension.
Extension tests: `cd extension; npm test`
Manual checks: `extension/MANUAL-CHECKS.md`
Spike tests: `cd spike; npm test`
Prototype: open `prototype/index.html` in a browser.