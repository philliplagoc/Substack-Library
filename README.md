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
- Milestone 2B built, pending a manual browser pass: one click in the reading
  panel or the board's detail panel downloads a card as a Markdown file, names
  it `YYYY-MM-DD - <title>.md` dated by when the card was saved, records the
  export on the card, and offers to move the card to Processed. A second export
  of the same card lands as ` (v2)` and never overwrites the first. See
  `docs/superpowers/specs/2026-08-30-milestone-2b-design.md`.
- Not built yet: the write into an Obsidian vault and its settings surface, the
  Saved-list sync with native Save and Unsave, and the backlog import. Until the
  vault write lands, export a JSON backup from the board for a full copy.
- Next: run the 13-box "Markdown export (Milestone 2B)" section of
  `extension/MANUAL-CHECKS.md` against an unpacked build, then the Obsidian
  vault write, which needs its own design.

## Development

Extension: `cd extension; npm install; npm run build`, then load
`extension/.output/chrome-mv3` as an unpacked extension.
Extension tests: `cd extension; npm test`
Manual checks: `extension/MANUAL-CHECKS.md`
Spike tests: `cd spike; npm test`
Prototype: open `prototype/index.html` in a browser.