# Milestone 2B design: Markdown export

**Date:** 2026-08-30
**Status:** Approved. Next step is the implementation plan.
**Parent spec:** `implementation-plan.md`, sections "Export format" and "Build
sequence", Milestone 2, items 3 and 5.
**Inputs:** `docs/superpowers/specs/2026-08-29-milestone-2a-design.md` (the layer
rules and the `CardEditor` footer contract this milestone extends),
`docs/superpowers/specs/2026-08-26-milestone-1-design.md` (the dependency rule),
`extension/src/domain/backup.ts` (the pure-serializer precedent),
`extension/src/ui/BackupControls.tsx` (the download mechanism this reuses).

## Goal

Close the second half of the reading loop. At the end of this milestone, one
click in either editor turns a card into a Markdown file on disk, and the card
records that it happened.

Notes stop living only in the extension's database.

## Scope

Milestone 2B is `implementation-plan.md` Milestone 2 items 3 and 5:

1. Markdown serialization.
2. The versioned download.
3. The offer to move the card to Processed after a successful export.

**Item 4, the Obsidian vault write, is not in this milestone.** It moves to a
later spec. See "Amendments to earlier documents".

2B touches no filesystem API beyond a blob download, reads no page, and injects
no code. Every decision in it is a decision about a string.

### Why the vault is deferred

The three items above are pure functions plus fifteen lines of glue. The vault
write is a different animal: the File System Access API, a directory handle
persisted across sessions, a write permission that lapses when the browser
restarts, a settings surface to connect and reconnect, and a re-export rule that
has to decide what happens to a note the reader has since hand-edited in
Obsidian. None of that is needed to get a note out of the extension.

Shipping the download first also answers the vault's hardest question with
evidence instead of a guess. Once real exported notes exist in a real vault, the
overwrite-versus-version decision is a decision about files the developer can
see.

## Definition of done

- One click in the reading panel, and one in the board's detail panel, downloads
  a Markdown file matching the format below.
- A second export of the same card produces a `(v2)` file and never overwrites
  the first.
- The card's `exportVersion` and `lastExportedAt` reflect the exports.
- The footer offers the move to Processed and honours both answers.
- A failure at any step says on screen what failed. No silent failure, per
  `implementation-plan.md`, "Reliability".
- `npm test`, `npm run compile`, and `npm run build` are clean.
- The dependency-rule greps still pass. `domain/markdown.ts` imports nothing but
  types.

## Decisions

### The serializer is pure, and the download is shared glue

`domain/markdown.ts` holds `toMarkdown(card)` and `exportFilename(card, version)`.
Neither reads a clock, a database, or a DOM. `db/cards.ts` holds
`recordExport(id, at)`. `ui/exportCard.ts` holds the fifteen lines that join
them: serialize, blob, anchor click, record. `ui/ExportButton.tsx` is the one
component both editors mount.

Rejected: one `domain/export.ts` with the download written inline in each of the
two components. It saves a file and costs the thing that matters. `src/ui/` has
no tests by design, so anything written there is verified only by
`MANUAL-CHECKS.md`, and writing the blob-and-anchor sequence twice puts two
untested copies of the same error handling in two files that will drift.

Rejected: downloading through `chrome.downloads` from the background worker. It
offers real filename control and OS-level conflict handling, and it costs a new
`downloads` permission, a message round trip, and a collision:
`conflictAction: 'uniquify'` appends its own ` (1)` on top of the ` (v2)` this
design generates, putting two versioning schemes in one filename. The anchor
path already works in this extension's pages; `BackupControls.tsx` has shipped
on it since Milestone 1.

### The export is recorded after the file is written, not before

`exportCard` downloads first and calls `recordExport` second.

If the counter moved first and the download then failed, the card would carry a
version number for a file that does not exist, and the next export would skip a
number for no reason a reader could reconstruct.

In this order the worst case is the opposite. The file lands, `recordExport`
throws, the counter stays put, and the next export generates the same filename,
where Chrome's own conflict handling appends ` (1)`. A duplicate file on disk is
recoverable. A phantom version in the database is not.

When `recordExport` throws, the notice says the file saved and the export was
not recorded. It does not report a clean success.

This is a general rule and it is worth naming: order the steps so the
irreversible one runs first and the recoverable bookkeeping runs second. A
counter bump can always be re-run. A download cannot be taken back.

### The version counter is a history, not an inventory

`exportVersion` counts how many times the reader exported the card. It does not
count the files in the Downloads folder, and it cannot: the extension has no
read access to that folder and asks for none.

Deleting `2026-08-16 - Title (v2).md` by hand therefore does not make the next
export `(v2)` again. It will be `(v3)`.

That is the intended meaning. The alternative would need a persistent record of
what the extension believes is on disk, which would be wrong the moment the
reader moved a file, and would trade an honest number for a confident wrong one.

### The vault question stays open, and the download does not answer it

`implementation-plan.md` says re-exports never overwrite a previous file. This
design keeps that rule, because a Downloads folder has no notion of updating a
file in place.

It does not commit that rule to the vault. A vault holding both a v1 and a v2 of
one article splits its backlinks, which is a cost the Downloads folder does not
have. The later vault spec decides it.

### The move to Processed is offered, never taken

After a successful export the footer shows the filename and asks whether to move
the card to Processed. **Yes** moves it. **Not yet** restores the plain export
button and remembers nothing.

Rejected: moving the card automatically with an Undo. It acts on the board
without asking, and it is wrong in a real case — exporting mid-read to check the
format would move a card the reader has not finished.

The offer is skipped when `card.status === 'processed'`, because there is
nowhere to move to and an offer that does nothing teaches the reader to ignore
offers.

The offer's state is local to `ExportButton` and keyed by card id, so switching
articles in the reading panel clears it.

### `moveTo` moves down a layer

`ReadingPanel` owns a private `moveTo` today, serving its three status buttons.
The Processed offer needs the same move from two components.

That logic becomes `moveCardTo(id, status)` in `db/cards.ts`, placing the card at
the top of its new column exactly as `moveTo` does now, and `ReadingPanel`'s
buttons call it too.

This is not tidying. `src/ui/` has no tests by design, so every behaviour living
in a component is a behaviour only a manual check can verify. Moving it into
`db/` converts a manual check into an automated one and puts the move rule in
the layer that already owns transactional writes.

## The format

For a card titled "How Great Questions Change a Company", read 2026-08-18, with
two quotes, the second of which no longer resolves:

```markdown
---
title: "How Great Questions Change a Company"
author: "Jane Doe"
publication: "The Work That Holds"
url: https://www.theworkthatholds.com/p/great-questions
saved: 2026-08-16
read: 2026-08-18
reading_minutes: 12
tags: [substack, reading]
---

> First captured quote text.

My reaction to that quote.

> Second captured quote.

*— location no longer resolves in the source article*

## Notes

Freeform notes body from the card.
```

### Frontmatter rules

| Key | Source | Rule |
|---|---|---|
| `title` | `card.title` | Double-quoted. Any `"` inside is escaped `\"`. |
| `author` | `card.author` | Double-quoted, escaped the same way. |
| `publication` | `card.publication` | Double-quoted, escaped the same way. |
| `url` | `card.url` | Unquoted. A URL holds no YAML metacharacter that needs it. |
| `saved` | `card.savedAt.slice(0, 10)` | A date, not a timestamp. |
| `read` | `card.readAt.slice(0, 10)` | Omitted when `readAt` is unset. |
| `reading_minutes` | `card.estimatedReadingMinutes` | Omitted when blank, which is the paywalled case. |
| `tags` | `card.tags` | Flow sequence. An empty array still emits `tags: []`. |

Titles are quoted because Substack titles carry colons, and an unquoted YAML
scalar containing `: ` is a parse error rather than a string.

A key with no value is omitted rather than emitted empty. `read:` with nothing
after it reads as null in Obsidian's Properties view and looks like a bug.

`tags: []` is the one exception. It is emitted empty on purpose, so the field
appears in the Properties view and the reader can fill it in Obsidian without
adding the key by hand.

### Body rules

- A quote renders as a blockquote. Every line of its text is prefixed `> `, so a
  quote spanning a paragraph break stays one blockquote.
- A quote's comment renders as a plain paragraph under it, with a blank line
  between and no separator.
- A quote with `locatorLost: true` gets one italic line under it, after the
  comment if there is one: `*— location no longer resolves in the source
  article*`. The quote text itself is untouched, which is the
  `implementation-plan.md` reliability rule — preserve the text, label the lost
  location — now applied to the file as well as the panel.
- The `## Notes` heading and its body are omitted together when `notes` is
  empty. There is no empty heading.
- The whole quote block is omitted when there are no quotes.
- A card with neither notes nor quotes exports as frontmatter alone. It is a
  valid note, and a thin one, and that is an accurate record of a card nobody
  wrote anything on.
- The file ends with exactly one newline.

## The filename

`exportFilename(card, version)` returns `YYYY-MM-DD - Title.md`, with ` (vN)`
inserted before the extension when `version > 1`:

```
2026-08-16 - How Great Questions Change a Company.md
2026-08-16 - How Great Questions Change a Company (v2).md
```

- The date is `card.savedAt.slice(0, 10)`. Date-first groups a Downloads folder
  by when the article was saved, so two exports of one card sort next to each
  other.
- The version passed in is `card.exportVersion + 1`. A never-exported card holds
  `exportVersion: 0`, exports as version 1, and gets no suffix.

### Sanitization, in order

1. Replace each of `\ / : * ? " < > |` with `-`. Windows forbids all nine.
2. Collapse runs of whitespace to one space.
3. Strip leading and trailing dots and spaces. Windows also forbids a trailing
   dot, which is what a title ending in an ellipsis produces.
4. Truncate to 120 characters on a word boundary.

A title that sanitizes to nothing falls back to the article slug from
`card.url`. If that is empty too, `untitled`.

Reserved DOS names (`CON`, `PRN`, `NUL`, `AUX`, `COM1` and the rest) are not
special-cased. The date prefix means no generated filename can ever be one.

### Chrome's conflict handling sits underneath this one

If a file with the generated name already exists, Chrome appends its own ` (1)`,
so a filename can land as `... (v2) (1).md`. This is unavoidable through the
anchor path and it fails safe: no previous file is lost. It is recorded in
`MANUAL-CHECKS.md` so a future reader does not file it as a bug.

## Architecture

### New and changed files

| File | Status | Holds |
|---|---|---|
| `src/domain/markdown.ts` | new | `toMarkdown`, `exportFilename`. Imports types only. |
| `src/domain/markdown.test.ts` | new | The serializer and filename tests. |
| `src/db/cards.ts` | changed | `recordExport(id, at)`, `moveCardTo(id, status)`. |
| `src/db/cards.test.ts` | changed | Tests for both. |
| `src/ui/exportCard.ts` | new | The glue: serialize, blob, anchor, record. |
| `src/ui/ExportButton.tsx` | new | The button, the notice, and the Processed offer. |
| `src/ui/ReadingPanel.tsx` | changed | Mounts `ExportButton`; its status buttons call `moveCardTo`. |
| `src/ui/DetailPanel.tsx` | changed | Mounts `ExportButton` in its footer. |
| `src/ui/styles.css` | changed | The offer row. |

`CardEditor`'s footer is a slot its parents fill. That contract does not change;
both parents put `ExportButton` into the content they already pass.

### Dependency rule

Unchanged from Milestone 1. `domain/` imports no Dexie, no React, and no
`nanoid`, and calls no `new Date()`. `domain/markdown.ts` obeys it: the timestamp
`recordExport` writes is produced in `ui/exportCard.ts` and passed in.

### No schema change

Dexie stays at version 2. `exportVersion`, `lastExportedAt`, and `tags` are
already on `Card`, already indexed where they need to be, and already validated
by `describeProblem` in `domain/backup.ts`. Declaring the whole `Card` shape in
Milestone 1 is what buys that, for the second milestone running.

### The export, end to end

1. The reader clicks Export in either footer.
2. `toMarkdown(card)` and `exportFilename(card, card.exportVersion + 1)` run.
   Both are pure and neither throws on a well-formed card.
3. The Markdown becomes a `text/markdown` blob, an object URL, and a synthetic
   anchor click.
4. `recordExport(card.id, new Date().toISOString())` bumps `exportVersion` and
   sets `lastExportedAt` in one Dexie transaction.
5. The footer shows `Exported as "<filename>".`
6. When `card.status !== 'processed'`, the footer also shows `Move to Processed?`
   with **Yes** and **Not yet**.

## Failure behaviour

| Failure | Behaviour |
|---|---|
| The blob or the anchor click throws | Nothing is recorded. The notice says the file could not be saved, with the error message. |
| `recordExport` throws | The notice says the file saved and the export was not recorded. Not reported as a success. |
| `moveCardTo` throws on **Yes** | The notice says the card could not be moved. The export stands and the offer remains. |
| The card has no notes and no quotes | Exports frontmatter alone. No warning; an empty note is a legitimate result. |
| The title sanitizes to nothing | Falls back to the slug, then to `untitled`. No error. |

## Testing

### Automated

`domain/markdown.test.ts`:

- A title holding `"` and a title holding `:` each round-trip through
  frontmatter as valid YAML.
- `read` omitted when `readAt` is unset; present when it is.
- `reading_minutes` omitted when `estimatedReadingMinutes` is blank.
- `tags: []` emitted for an empty array.
- A quote with a comment, and one without.
- A quote with `locatorLost: true` carrying the marker line, in both those
  shapes.
- A multi-paragraph quote staying one blockquote.
- Empty `notes` dropping the `## Notes` heading with it.
- A card with neither notes nor quotes.
- Exactly one trailing newline.
- Each of the nine forbidden Windows characters replaced.
- A title of only forbidden characters falling back to the slug, and a card whose
  URL has no slug falling back to `untitled`.
- A title ending in an ellipsis losing its trailing dots.
- The 120-character truncation landing on a word boundary.
- Version 1 producing no suffix; version 2 producing ` (v2)` before `.md`.

`db/cards.test.ts`:

- `recordExport` bumping `exportVersion` 0 to 1 and 1 to 2, and writing
  `lastExportedAt`.
- `moveCardTo` placing the card at the top of the target column and leaving the
  other cards in their order.

### Manual checks

A new `MANUAL-CHECKS.md` section, because `src/ui/` has no tests:

- Export from the reading panel; the file is in Downloads with the right name.
- Export the same card again; the second file carries ` (v2)` and the first is
  untouched.
- Export from the board's detail panel.
- Take **Yes** on the offer; the card moves to the top of Processed.
- Take **Not yet**; the card stays and the plain button returns.
- Export a card already in Processed; no offer appears.
- Export a card with no notes and no quotes; a frontmatter-only file.
- Open an exported file in Obsidian. Use a card that has been read and carries a
  reading estimate, so all eight keys are present, and confirm the Properties
  view reads every one of them.
- A note recording that Chrome may append its own ` (1)` when a filename already
  exists, so a future reader does not file it as a bug.

## Learning mode

Two `TODO(human)` contributions, one open at a time, matching the rhythm of
Milestones 1 and 2A. Each is a pure function with a real decision inside it.

- The quote block of `toMarkdown`, in task 1: how a comment sits under its quote,
  and where the lost-location marker goes when a quote has both a comment and a
  lost locator.
- `exportFilename(card, version)`, in task 2: the sanitization order, what a
  title that sanitizes to nothing falls back to, and where a 120-character
  truncation is allowed to cut.

## Task shape

Four tasks, each ending in a commit.

1. `domain/markdown.ts`: `toMarkdown`, with its frontmatter and body tests.
2. `exportFilename` and its tests. TODO(human).
3. `db/cards.ts`: `recordExport` and `moveCardTo`, with tests.
   `ReadingPanel`'s status buttons move onto `moveCardTo`.
4. `ui/exportCard.ts`, `ui/ExportButton.tsx`, both footers, the failure notices,
   the Processed offer, the `MANUAL-CHECKS.md` section, and the wrap-up.

## Amendments to earlier documents

This spec contradicts three earlier statements. They are listed here so a future
reader who finds the contradiction knows which document is authoritative.

| Document | Said | Now |
|---|---|---|
| `implementation-plan.md`, "Build sequence", M2 item 4 | Milestone 2 builds the vault connection in settings, the direct write path, and the reconnect state | Deferred to its own spec after 2B. 2B ships items 3 and 5 only. |
| `implementation-plan.md`, "Export format" | Seven frontmatter keys | Eight. `reading_minutes` is added, because reading time is the field the board triages on and it is worth having queryable in Dataview. |
| `implementation-plan.md`, "Reliability" | "Source article changed: preserve quote text, label the lost location" — described for the panel | The exported file labels it too, with an italic marker line under the quote. |

The 2A design's own "Open questions carried forward" named the Markdown preview
toggle from `prototype/DECISIONS.md` as waiting on this milestone's serializer.
2B builds the serializer and does **not** build the preview toggle. `toMarkdown`
is a pure function of a card, so a preview is a later, cheap addition; it is not
in this scope.

## Open questions carried forward

None block Milestone 2B.

- The vault write, its settings surface, its permission lifecycle, and the
  overwrite-versus-version rule. Its own spec, after 2B has produced real notes.
- The Markdown preview toggle. Cheap once `toMarkdown` exists; not in 2B.
- Whether the reading panel should follow tab focus rather than deliberate
  toolbar clicks. Carried from 2A. Revisit around 2026-09-13.
- `exportVersion` counts exports, not files on disk. If that number turns out to
  be confusing in real use, the fix is to show it in the detail panel rather than
  to try to track the folder.
