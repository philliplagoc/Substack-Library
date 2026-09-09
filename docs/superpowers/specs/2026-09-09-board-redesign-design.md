# Board redesign design: a restrained visual overhaul and a layout restructure

**Date:** 2026-09-09
**Status:** Approved. Next step is the implementation plan.
**Parent:** the side panel redesign (`changes.log`, 2026-09-08 entries;
commits `6359d51`..`a785c52`).
**Inputs:** `docs/board.png` (the Stitch AI mockup the developer generated),
`extension/src/ui/styles.css` (the single stylesheet, board rules lines 1-276
and the `.reading` block from 278 to EOF), `extension/src/ui/App.tsx`,
`Toolbar.tsx`, `Column.tsx`, `CardTile.tsx`, `prototype/DECISIONS.md` (the
binding board layout constraints), `changes.log` "Open questions" (the toolbar
height problem).

## Goal

The board reads as the same product as the side panel, and the tag taxonomy
gets room to grow.

The side panel was redesigned on 2026-09-08 onto a warm parchment palette with
Substack orange as the only accent. The board still wears its Milestone 1
prototype styling: cool grey columns, a plain toolbar, a tag filter crammed into
40% of the toolbar row. This work brings the board onto the panel's visual
language and moves the tag filter to a row of its own.

## Scope

A restyle of structure that already exists, plus one structural change.

The board already has a full-width header with search, a max-minutes filter,
Sync, Export all, Export JSON, and Restore, and a horizontal tag filter strip.
None of that is new. What changes:

1. The page becomes a column-flex shell with a real board-root element, so the
   tag filter can be its own full-width row instead of a segment inside the
   fixed-height toolbar.
2. The board's colour tokens are unified with the panel's.
3. The header, the tag row, the columns, and the card faces are restyled to the
   hairline-border parchment language.
4. The tag row gains a `TAGS:` label and a per-tag count.

Nothing in `domain/` or `db/` changes. No test changes. Card face **content**
does not change.

## What this redesign does not do

Each of these was on the mockup and was cut with the developer.

- **No serif on the board.** The mockup sets titles in Newsreader. Newsreader
  cannot ship (Manifest V3 blocks a remote font) and the panel already falls
  back to Georgia through `--font-editorial`. The board keeps system-sans for
  card titles and column headers. Rejected: borrowing `--font-editorial` for
  card titles, which would have matched the panel but the developer preferred
  the denser sans on a triage surface.
- **No new card-face content.** No tag chips on the card, no quote or note
  preview, no "Open Panel" link, no state chips ("Done", "Archive"). Card-face
  tags were already cut in Milestone 4 as too dense; that holds. `CardTile`'s
  markup is frozen; only its CSS moves.
- **No new tag-row controls.** No "All" pill, no "Reset Filter" link, no
  "+ New" pill. The "+ New" pill in particular has nowhere to write: a tag is
  only created by attaching it to a card in an editor, so a global "new tag"
  with no card is meaningless.
- **No filter-logic change.** The tag filter stays AND-match: a card must carry
  every selected tag. `changes.log` notes ANY-match is the better browse, but
  that is a behaviour change with its own tests and is out of a styling pass.
- **No new column-header furniture.** No status dots, no count badges, no
  subtitles ("In progress"), no orange rule on the active column. The header
  stays the plain "To Read (26)" text, restyled.
- **No new header items.** No "Studio" pill, no "40 essays saved" statistics
  line, no keyboard-shortcut hint on the search box. The statistics line was
  kept out of the panel redesign for the same reason: it is new behaviour, not
  a restyle. "Max minutes" keeps its label.

## Constraints

Inherited from the side panel redesign, and binding here.

- **No Tailwind, no Google Fonts `<link>`.** Manifest V3 blocks the remote
  script and the remote font. All CSS is hand-written into the single
  `extension/src/ui/styles.css`.
- **No icon dependency.** Icons are the nine hand-rolled glyphs in
  `extension/src/ui/icons.tsx`. `TagIcon` already exists; the tag row reuses it
  and no new glyph is drawn.
- **The board must not move the side panel.** This is the mirror of the
  `.reading` scoping rule the panel redesign follows. `CardEditor`,
  `TagEditor`, and `ExportButton` render in both the board's `DetailPanel` and
  the side panel. The board restyle must not touch any `.reading …` rule, the
  shared `.tags` / `.chips` rules, the `.panel .section-icon` /
  `.section-head .count` / `.panel .export-row` rules, or the bare `.notice`
  rule. Every new rule is scoped under `.toolbar`, `.board-root`, or
  `.tag-filter`.
- **The suite stays green.** `npm run compile`, `npm test` (275 passing, 1
  todo), and `npm run build` all pass unchanged; nothing tests `src/ui/`.

## The layout restructure

Today `.toolbar` has `height: var(--toolbar-height)` (57px) and `.layout` is
`height: calc(100vh - var(--toolbar-height))`. The two numbers are locked
together, so a toolbar that grows a row pushes the bottom of the board off the
screen rather than pushing the board down. That is why the tag filter is a
40%-wide sideways-scrolling strip inside the toolbar and not a row of its own.
`changes.log` names the fix: "A page laid out as a column flex container would
fix this and needs a board root element that does not exist yet."

The redesign adds that element. `App` wraps its output in
`<div className="board-root">`, styled `display: flex; flex-direction: column;
height: 100vh` — the same height source the `.reading` shell already uses. The
header and the tag row are `flex: 0 0 auto` and sit at their natural height; the
`.layout` grid is `flex: 1 1 auto; min-height: 0` and takes whatever is left.
`--toolbar-height` and the `calc()` are deleted. When the tag row wraps to two
lines, `.layout` shrinks and the board scrolls inside its own area; the board
bottom stays on screen.

The tag filter leaves `Toolbar` for a new `TagFilter` component, because it must
be a sibling of `<header className="toolbar">`, not a child of it.

## The token unification

The board's `--bg` (`#f6f5f2`) and `--col` (`#ecebe6`) are retired. `body`
points at `--parchment`; `.column` points at `--brand-stone`. `--card`
(`#ffffff`) is folded into `--panel-card` (same value, and `--panel-card`
already has two consumers inside `.reading`, so folding the other way would
edit `.reading`). `--muted` (`#6b6b6b`) stays defined and unchanged because the
shared `.tags` and `.chips` rules read it; the board-owned rules that used it
(`.column .count`, `.card .pub/.row/.status`, `.panel .meta`, `.save-status`)
repoint to `--brand-muted`. The `:root` comment that says the two palettes are
"held apart on purpose … the board must not move under it" is rewritten to say
there is one palette now.

## The tag count

`App` already holds every card for the board. It folds a `Map<string, number>`
of tag to count over the full card list and passes it to `TagFilter` beside the
existing `allTags(cards)` vocabulary. The count is over **all** cards, not the
filtered set, so it matches the vocabulary and reads like the mockup's static
"building 8". No helper is added to `domain/`; an inline fold needs no test and
keeps `domain/` untouched, which the scope requires.

## Definition of done

- The board sits on the same parchment as the side panel, with hairline-bordered
  warm columns and white hairline-bordered cards.
- Card faces show exactly what they show today: title, `publication · author`,
  the minutes line, and the `notes · N quotes · exported vN` status line.
- Card titles and column headers are system-sans.
- The tag filter is its own full-width row under the header, with a `TAGS:`
  label and a count on each tag.
- Filling the tag row wraps it to a second line and the board still reaches the
  bottom of the window.
- Search, the max-minutes filter, the AND-match tag filter, drag between and
  within columns, keyboard drag, the detail panel, Export all, Export JSON,
  Restore, and Sync all work as before.
- The side panel is visually unchanged, and the board's detail panel still has
  no icons, no uppercase section headings, and no parchment body.
- `npm run compile`, `npm test`, and `npm run build` are green.

## Files

| File | Change |
| --- | --- |
| `extension/src/ui/styles.css` | `:root` unification and comment rewrite; delete `--toolbar-height` and the `.layout` `calc()`; `.board-root` flex shell; the restyle; a board-scoped focus ring |
| `extension/src/ui/App.tsx` | `.board-root` wrapper; `tagCounts` map; mount `<TagFilter>`; drop the `tags` prop on `<Toolbar>` |
| `extension/src/ui/Toolbar.tsx` | remove the `tags` prop, the `toggle` handler, and the `.tag-filter` JSX |
| `extension/src/ui/TagFilter.tsx` | new: the full-width tag row with the label and the counts |
| `extension/src/ui/CardTile.tsx`, `Column.tsx`, `Board.tsx` | untouched |
| `extension/MANUAL-CHECKS.md` | append a `## 2026-09-09: board redesign` section |
| `docs/board.png` | commit it (currently untracked) |

## Verification

`npm run compile && npm test && npm run build` from `extension/`, then load
`extension/.output/chrome-mv3/` unpacked and walk the new `MANUAL-CHECKS.md`
section. The two sub-sections that matter most are "The side panel is
unchanged" (the only check that the shared editor's styling did not move) and
"Fluid width / the real second row" (that the restructure fixed the toolbar
height problem rather than moving it).
