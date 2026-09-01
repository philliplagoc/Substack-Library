# Milestone 4 design: release polish

**Date:** 2026-08-31
**Status:** Approved. Next step is the implementation plan.
**Parent spec:** none. This milestone comes from a list the developer wrote on
2026-08-31 of what has to exist before the extension is worth releasing. It is
not in `implementation-plan.md`.
**Inputs:** `docs/superpowers/specs/2026-08-26-milestone-1-design.md` (the
dependency rule, the direct-Dexie decision),
`docs/superpowers/specs/2026-08-29-milestone-2a-design.md` (the `CardEditor`
footer contract), `docs/superpowers/specs/2026-08-30-milestone-2b-design.md`
(the serializer and the download mechanism this milestone extends),
`extension/src/domain/card.ts` (`CardFilter` and `visibleCards`, which the tag
filter joins).

## Goal

Close the gap between an extension that works and an extension the developer is
willing to hand to somebody else.

Five things were named. Four of them are in this milestone. Each is small on its
own. Together they are the difference between a tool that demands you know its
habits and a tool that explains itself.

## Scope

1. A button in the side panel that opens the board.
2. Tags on a card, entered in either editor, and a tag filter on the board.
3. The Substack section removed from the card detail panel.
4. One button that exports every card the board is showing into one Markdown
   file.

**The fifth item, an Add-by-URL form that fills its own fields, is not in this
milestone.** It becomes Milestone 5. See "Why item 5 is deferred".

Milestone 4 adds no permission, opens no tab, injects no script, and reads no
page. Every decision in it is a decision about data the extension already owns.

### Why item 5 is deferred

The four items above move data across a boundary the extension already sits on
both sides of. Item 5 does not. Filling the form from a pasted URL means reading
a page nobody is looking at, and `wxt.config.ts` grants host permission for
`substack.com` and nothing else. A publication on its own domain is outside that
grant.

The developer chose the mechanism on 2026-08-31: open a tab, inject the existing
extractors, close the tab. That reuses `extractArticleMeta` and
`readReaderArticle` unchanged, which is worth a great deal, because those two
functions are already proven against four page shapes and a signed-in session.
What it does not settle is what the extension asks for at install, and that is a
decision about how the extension presents itself to a stranger. It belongs in a
spec that can spend its whole length on it.

Splitting also lets items 1 to 4 ship the moment they are done, instead of
waiting behind a permission prompt.

### Blocking precondition

Milestone 3 is built and its manual checks have never been run.
`extension/src/ui/SyncButton.tsx` is untracked and nine files are modified.

**Run the Milestone 3 manual checks and commit before Milestone 4 starts.** If
Milestone 4 lands on top of unverified sync work, a manual-check failure later
cannot say whether sync or tags caused it, and the cheapest way to find out is
to have not created the ambiguity.

## Definition of done

- A button in the reading panel opens the board, or focuses the board tab that
  is already open.
- A tag typed in either editor is saved on the card, shown as a chip, and
  removable.
- Tags already used on other cards are offered as suggestions.
- Selecting tags on the board narrows it to cards carrying all of them, and
  combines with the search box and the minutes box.
- The Substack heading and its three checkboxes are gone from the detail panel,
  and the three fields are gone from `Card` and from stored rows.
- One button writes every card the board is showing into one Markdown file, and
  changes no card.
- `npm test`, `npm run compile`, and `npm run build` are clean.
- The dependency-rule greps still pass. `domain/tags.ts` imports types only.
- Every new box in `extension/MANUAL-CHECKS.md` is ticked against a loaded
  build.

## Decisions

### The panel asks the background to open the board

The side panel could call `browser.tabs.create` itself. It is an extension page
and the API is there.

It does not, because the board tab's id lives in `browser.storage.session` under
`boardTabId`, and `openBoard()` in the background is what reads it, reuses it,
and replaces it when the remembered tab is gone. A second caller writing that
key would be a second owner of one piece of state, and the bug it produces is a
duplicate board tab that only appears after you close the first one.

So the panel sends `{ type: 'open-board' }` and the background does what it
already knows how to do. This is the third message on a channel that already
carries `capture-selection` and `sync-saved`.

The handler sends no reply. `browser.runtime.onMessage` returns `false` for it,
which closes the channel at once, because there is nothing to wait for.

### Tags are lowercased, and that is the whole point

`normalizeTag` trims, collapses whitespace runs to one space, and lowercases.

Lowercasing is what makes the suggestion list worth building. Without it `AI`
and `ai` are two tags, the filter row shows both, and neither one finds all the
cards. The reader is then maintaining a vocabulary by hand, which is the job the
autocomplete was added to do.

The cost is that a tag cannot be capitalized. For a personal reading library
that is not a loss worth code.

### Four characters are stripped, for a reason that is not cosmetic

`normalizeTag` removes `,` `[` `]` and `"`.

`domain/markdown.ts` writes tags as a YAML flow sequence:

    tags: [ai, economics]

A tag holding a comma splits into two entries. A tag holding a bracket closes
the sequence early. Either one corrupts the frontmatter block, and Obsidian's
response to broken frontmatter is to fail the whole block, not the one line. So
the note loses its title, its author, and its URL because of a punctuation mark
in a tag.

Stripping at the point of entry is the fix, rather than quoting at the point of
export. A tag is a short label the reader typed; there is no meaning in a comma
inside one worth preserving. Quoting would keep the character and push the
problem into every consumer of the tag: the filter row, the datalist, and a
future search.

### The tag editor reads Dexie itself

`TagEditor` needs the list of tags in use. It gets it from its own
`useLiveQuery(allCards)` rather than from a prop.

Milestone 1 decided that UI reads Dexie directly with no messaging layer, and
this follows it. The alternative is a `suggestions` prop, which means
`CardEditor` grows a prop it does not use, and both of its parents have to
supply it. The reading panel currently loads one card, so it would have to start
loading all of them anyway. The prop would buy nothing and cost a wider
interface on a shared component.

The real cost is that opening the side panel now reads every card to build a
suggestion list. For a library of a few hundred cards that is a few milliseconds
against an IndexedDB store that is already open.

### The tag filter matches ALL selected tags

Two selected tags show the cards carrying both, not the cards carrying either.

Each click narrows. That is what the search box does and what the minutes box
does, and a filter row where one control widens while the others narrow is a
control that has to be explained. ANY-matching is the better browse ("what could
I read tonight"), and it is worth revisiting once there are enough tags to
browse; it is not worth two match modes in the first version.

### The filter row hides itself when there are no tags

A fresh board has no tags. An empty row of buttons above an empty board is
furniture that teaches nothing. `Toolbar` renders the row only when the
vocabulary is non-empty, so the feature appears the first time you use it.

### `App` owns the vocabulary for the toolbar, and `TagEditor` owns its own

Two different components read the same list two different ways, deliberately.

`Toolbar` is presentational. It takes `filter` and `onFilterChange` and holds no
query, and adding one would be the first. `App` already has `cards` in hand for
the board, so it computes `allTags(cards ?? [])` and passes it down for free.

`TagEditor` is not presentational and is mounted inside `CardEditor`, two levels
below either parent. Threading a prop through `CardEditor` to reach it is the
cost described above.

### The three Substack fields leave the schema, not just the screen

`liked`, `commented`, and `unsavedFromSubstack` are deleted from `Card`, from
`createCard`, and from stored rows by a `version(3)` upgrade.

Deleting only the checkboxes would be less work. It would also leave three
fields on the central type of the application that nothing writes and nothing
reads, and the next person to open `types.ts` has to grep the whole tree to find
that out. A grep run on 2026-08-31 found the three checkboxes in
`DetailPanel.tsx` and nothing else outside tests. There is no logic to strand.

`mergeCard` needs no change. It spreads `...existing` and names only the four
fields a capture refreshes.

The store string does not change. Version 3 declares the same indexes as version
2 and carries an `upgrade` that deletes the three keys.

### A restored old backup may carry the dead fields back, and that is accepted

`describeProblem` in `domain/backup.ts` never inspects the three fields, so a
backup written before this milestone restores without complaint. Its cards land
in IndexedDB carrying three properties that are not on `Card`.

They are invisible, unread, and harmless. Stripping them would mean either a
migration that runs on every restore or a field allowlist in `restoreCards`, and
both are more machinery than a stray boolean deserves.

### The library export writes what the board is showing

`ExportAllButton` takes `App`'s already-filtered `shown` array, not `allCards()`.

This is what makes the export compose with the rest of the milestone. Filter to
`economics`, set a maximum of twenty minutes, and export produces exactly that
list. Exporting everything unconditionally would be predictable and would make
the tag filter useless to the feature built beside it.

An unfiltered board still exports everything, because `shown` is then every
card. The predictable behaviour is the default; it is just not the only one.

### The library export changes no card

No `recordExport`. `exportVersion` and `lastExportedAt` stay where they are.

`exportVersion` counts the notes that exist for one article, which is what makes
the ` (v2)` suffix mean something. A bulk snapshot is not a note for an article.
Counting it would mean that exporting the library once turns the next single
export of every card in it into a `(v2)` file, and the reader would be looking
for a v1 that was never written for that card.

The two exports answer different questions. One asks "give me my note on this
piece". The other asks "give me the state of my library". Only the first is
history worth numbering.

### The body builder takes a heading level

`toMarkdown` writes `## Notes`. Inside the library file the same body sits under
a `### Title`, so its notes heading has to be `#### Notes`.

The shared part is factored into one function taking a base level, and both
exports call it. The alternative, a second copy of the quote and notes rules,
means the next change to how a lost locator is marked has to be made twice, and
the day it is made once is the day the two files disagree.

### `downloadFile` is pulled out of `exportCard`

The blob, the object URL, the anchor, the click, the revoke. Three callers now:
`exportCard`, `ExportAllButton`, and `BackupControls`.

Its signature is `downloadFile(filename, text, type)`. The MIME type is a
parameter rather than a hardcoded `text/markdown`, because `BackupControls`
writes `application/json` and is the third caller.

`BackupControls` is moved onto it too. It has held its own copy of the sequence
since Milestone 1 (`BackupControls.tsx:11-18`), and leaving it there while two
new callers share a helper is the state that looks like an oversight to the next
reader.

## The library format

    ---
    exported: 2026-08-31
    count: 12
    ---

    # Substack Library

    ## To Read

    ### The Title Of The Piece

    Author Name · Publication · 14 min

    <https://example.substack.com/p/the-title-of-the-piece>

    Tags: ai, economics

    > A captured quote.

    The reaction to that quote.

    #### Notes

    Whatever was written in the notes field.

    ### The Next Card

    ...

    ## Reading

    ...

    ## Processed

    ...

### Rules

- The frontmatter holds two keys. `exported` is the date the file was written.
  `count` is how many cards it holds, so the file says whether a filter was on
  without the reader having to count.
- The three column headings are always emitted in board order, `To Read`,
  `Reading`, `Processed`, even when a column is empty. A missing heading reads
  as a bug; an empty one reads as an empty column. An empty column emits a
  single italic `*No cards.*` line under its heading.
- Cards appear in the order the board shows them. `allCards` already reads
  through the `[status+sortOrder]` index, so the array arrives ordered and
  nothing sorts it again.
- A card with no notes and no quotes still emits its heading, its meta line, and
  its URL. A library index that silently omits the cards you have not read yet
  is not an index of your library.
- `Tags:` is omitted when the card has none. Unlike the frontmatter of a single
  note, there is nothing here for Obsidian to offer a field for, so an empty
  line is noise.
- The meta line drops the parts that are missing, the same way `CardEditor`'s
  meta line does.
- Exactly one trailing newline.

### The filename

`YYYY-MM-DD - Substack Library.md`, from the export date.

Not versioned. Two exports on one day produce one name, and Chrome appends its
own ` (1)`, which is the right answer for a snapshot: the copies are dated, and
which one is newer is a question the filesystem already answers.

## Architecture

### New and changed files

| File | Status | Holds |
|---|---|---|
| `src/domain/tags.ts` | new | `normalizeTag`, `addTag`, `removeTag`, `allTags`. Types only. |
| `src/domain/tags.test.ts` | new | Normalization, dedupe, removal, vocabulary. |
| `src/domain/types.ts` | changed | The three Substack fields deleted. |
| `src/domain/card.ts` | changed | `CardFilter.tags`; the ALL-match in `visibleCards`; `createCard` loses three fields. |
| `src/domain/card.test.ts` | changed | Tag filtering; the shorter card shape. |
| `src/domain/ingest.test.ts` | changed | Drops the three flags from its merge assertions. |
| `src/domain/markdown.ts` | changed | `toLibraryMarkdown`, `libraryFilename`, and the shared body builder. |
| `src/domain/markdown.test.ts` | changed | Library grouping, heading nesting, empty columns. |
| `src/db/schema.ts` | changed | `version(3)`, same stores, an upgrade that deletes three keys. |
| `src/db/schema.test.ts` | changed | The v2 to v3 upgrade. |
| `src/db/sync.test.ts` | changed | Drops its `unsavedFromSubstack` test. |
| `src/test-support/factory.ts` | changed | Drops three fields. |
| `src/messages.ts` | changed | `{ type: 'open-board' }` joins `PanelMessage`. |
| `src/entrypoints/background.ts` | changed | The `open-board` branch. |
| `src/ui/TagEditor.tsx` | new | Chips, the input, the datalist. |
| `src/ui/ExportAllButton.tsx` | new | The button, the count, the failure notice. |
| `src/ui/downloadFile.ts` | new | Blob, anchor, click, revoke. |
| `src/ui/exportCard.ts` | changed | Calls `downloadFile`. |
| `src/ui/BackupControls.tsx` | changed | Calls `downloadFile`. |
| `src/ui/CardEditor.tsx` | changed | Mounts `TagEditor` between the meta line and Notes. |
| `src/ui/DetailPanel.tsx` | changed | The Substack section deleted. |
| `src/ui/ReadingPanel.tsx` | changed | The board button in its footer. |
| `src/ui/Toolbar.tsx` | changed | The tag filter row; a `tags` prop. |
| `src/ui/App.tsx` | changed | `filter.tags`; the vocabulary; mounts `ExportAllButton`. |
| `src/ui/styles.css` | changed | Chips, the filter row. |

`CardEditor`'s footer slot contract does not change. `TagEditor` goes in the
body, above the footer, because tags belong to the card in both editors, and the
footer is for what only one parent wants.

### Dependency rule

Unchanged. `domain/` imports no Dexie, no React, and no `nanoid`, and calls no
`new Date()`. `domain/tags.ts` imports the `Card` type and nothing else. The export date
`toLibraryMarkdown` writes is produced in `ui/ExportAllButton.tsx` and passed
in, the same way `exportCard` passes `now`.

### Schema

Dexie goes to version 3. The store string is identical to version 2. The
`upgrade` deletes `liked`, `commented`, and `unsavedFromSubstack` from every
row. `tags` needs no migration: it has been on `Card` since Milestone 1, seeded
to `[]` by `createCard`, and validated as an array by `describeProblem`.

`visibleCards` reads `card.tags ?? []` rather than `card.tags`. A card restored
from a hand-edited backup can be missing it, and a filter is not the place to
throw.

## Failure behaviour

- The board button cannot report a failure the reader can act on, so it reports
  none. `openBoard` already falls back to a new tab when the remembered one is
  gone.
- A tag that normalizes to an empty string is dropped without a message. There
  is nothing to say about a space bar.
- A duplicate tag is dropped without a message and the input clears. The chip
  the reader wanted is already on screen.
- A library export that throws says so in a notice beside the button, with the
  message. No silent failure, per `implementation-plan.md`, "Reliability".
- Exporting with nothing on the board is prevented rather than reported. The
  button is disabled at zero and says so.

## Testing

### Automated

`domain/tags.test.ts`:

- `normalizeTag` lowercases, trims, and collapses internal whitespace runs.
- Each of `,` `[` `]` `"` is stripped.
- A tag of only whitespace, and a tag of only stripped characters, both yield
  `null`.
- `addTag` appends, and rejects a duplicate that differs only in case or
  surrounding whitespace.
- `removeTag` removes one and leaves the rest in order.
- `allTags` returns each distinct tag once, sorted, across many cards, and `[]`
  for no cards.

`domain/card.test.ts`:

- One selected tag narrows to the cards carrying it.
- Two selected tags narrow to the cards carrying both, not either.
- No selected tags changes nothing.
- The tag filter combines with `query` and with `maxMinutes`.
- A card whose `tags` is missing is excluded rather than throwing.

`domain/markdown.test.ts`:

- All three column headings present when one column is empty, with the
  `*No cards.*` line under it.
- Cards emitted in the order given.
- A card's notes heading is `####` in the library and `##` in a single note.
- A card with no notes and no quotes emits its heading and meta line.
- `Tags:` omitted for a card with no tags.
- `count` matches the number of cards.
- An empty library still emits its frontmatter and its three headings.
- Exactly one trailing newline.
- A tag that survived `normalizeTag` is valid in the single-note YAML flow
  sequence.

`db/schema.test.ts`:

- A version 2 row holding the three fields loses all three on upgrade, and keeps
  every other field.

### Manual checks

A new `MANUAL-CHECKS.md` section, because `src/ui/` has no tests:

- The board button opens the board from the side panel.
- The board button focuses the existing board tab rather than opening a second.
- Close the board tab, then click the button; a new board opens.
- Type a tag in the side panel and press Enter; the chip appears and survives a
  reload.
- Type a tag ending in a comma; the chip appears and the comma is gone.
- Type a tag already on another card; the suggestion is offered.
- Type the same tag twice; one chip.
- Type `AI` on one card and `ai` on another; the filter row shows one button.
- Remove a chip with its ×, and remove one with Backspace on an empty input.
- The same tag editor works in the board's detail panel.
- The filter row is absent on a board with no tags.
- Select two tags; only cards carrying both remain.
- Select a tag and type in the search box; both apply.
- The detail panel has no Substack heading and no checkboxes.
- Export all on an unfiltered board; every card is in the file, under the right
  column heading.
- Export all with a tag selected; only those cards are in the file, and `count`
  matches.
- Export all, then export one of those cards singly; the single file is `v1`,
  not `v2`.
- Export all with an empty column; the heading is there with `*No cards.*`.
- The export-all button is disabled when the filters leave nothing.
- Open the library file in Obsidian; the frontmatter parses and the headings
  nest.

## Learning mode

Two `TODO(human)` contributions, one open at a time, matching the rhythm of
Milestones 1, 2A, and 2B. Each is a pure function with a real decision inside
it.

- `normalizeTag` in `domain/tags.ts`, in task 1: what to strip, what to
  collapse, and what a tag that normalizes to nothing becomes.
- The card block of `toLibraryMarkdown`, in task 4: what a card with no notes
  and no quotes still emits, and where the tag line sits relative to the meta
  line and the URL.

## Task shape

Five tasks, each ending in a commit.

1. `domain/tags.ts` and its tests. TODO(human) on `normalizeTag`.
2. The tag filter: `CardFilter.tags`, `visibleCards`, and their tests. Then
   `ui/TagEditor.tsx`, its mount in `CardEditor`, the `Toolbar` filter row,
   `App`'s state and vocabulary, and the styles.
3. The Substack removal: `types.ts`, `card.ts`, `DetailPanel.tsx`, the
   `version(3)` upgrade, and every test that names the three fields.
4. `domain/markdown.ts`: the shared body builder, `toLibraryMarkdown`,
   `libraryFilename`, and their tests. TODO(human) on the card block.
5. `ui/downloadFile.ts`, the two callers moved onto it,
   `ui/ExportAllButton.tsx`, its mount in `App`, the `MANUAL-CHECKS.md`
   section, and the wrap-up.

Task 1 has no UI and task 2 depends on it, so the tag work is two tasks rather
than one. Task 3 is independent of both and could move; it is placed third
because it is the only task that shrinks the codebase, and it is easier to
delete three fields before two new features are written against the file than
after.

## Amendments to earlier documents

| Document | Said | Now |
|---|---|---|
| `implementation-plan.md`, the `Card` data model | `Card` carries `liked`, `commented`, `unsavedFromSubstack` | Deleted in Milestone 4. Nothing outside three checkboxes ever read them, and the checkboxes asked the reader to maintain a copy of state Substack already holds. |
| `docs/superpowers/specs/2026-08-30-milestone-2b-design.md`, "The serializer is pure, and the download is shared glue" | `exportCard.ts` holds the download | The download moves to `ui/downloadFile.ts` and gains two callers. `exportCard.ts` keeps the ordering rule and the `recordExport` call. |

`implementation-plan.md` names tags as part of the `Card` model and never says
how they are entered or used. Milestone 4 answers both without contradicting it.

## Open questions carried forward

None block Milestone 4.

- Milestone 5, the self-filling Add-by-URL form. The mechanism is chosen; what
  the extension asks for at install is not.
- ANY-matching for the tag filter. Revisit once the board holds enough tags to
  browse rather than narrow.
- Tags on the card face in `CardTile`. Cut on purpose; tiles are dense and the
  filter row already says which tags are in play. Revisit if a filtered board
  turns out to be hard to read.
- The Markdown preview toggle, carried from 2B. Cheaper still now that there are
  two serializers.
- The Obsidian vault write, carried from 2B and out of v1 by the developer's
  decision on 2026-08-31.
- Whether the reading panel should follow tab focus rather than deliberate
  toolbar clicks. Carried from 2A. Revisit around 2026-09-13.
