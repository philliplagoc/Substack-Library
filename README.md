# Substack-Library
A local-first Chrome/Edge extension for a deliberate Substack reading workflow: capture articles from any device, triage them on a three-column board, take notes beside the article on its original page, and export those notes as Markdown, as a download or written into an Obsidian vault.

## Status

- Milestone 0 complete: see `spike/README.md` for Substack read paths and
  `prototype/DECISIONS.md` for board layout.
- Milestone 1 complete: the extension scaffold and the board. See
  `docs/superpowers/specs/2026-08-26-milestone-1-design.md`.
- Next: Milestone 2 (the reading loop). See `implementation-plan.md`.

## Development

Extension: `cd extension; npm install; npm run build`, then load
`extension/.output/chrome-mv3` as an unpacked extension.
Extension tests: `cd extension; npm test`
Manual checks: `extension/MANUAL-CHECKS.md`
Spike tests: `cd spike; npm test`
Prototype: open `prototype/index.html` in a browser.