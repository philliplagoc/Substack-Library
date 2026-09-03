# Reading workflow feedback design

**Date:** 2026-09-03
**Status:** Approved. Next step is the implementation plan.
**Parent spec:** none. This work comes from feedback the developer wrote on
2026-09-03 after using the extension for several days of real reading. It is not
in `implementation-plan.md`. It is deliberately NOT numbered: Milestone 5 is
already reserved for the self-filling Add-by-URL form, which is untouched by this
work and still next in the plan.
**Inputs:** `docs/superpowers/specs/2026-08-29-milestone-2a-design.md` (the
`CardEditor` footer contract, the quote capture path, the locator design this
milestone reverses), `docs/superpowers/specs/2026-08-30-milestone-2b-design.md`
(the serializer and `cardBody`),
`docs/superpowers/specs/2026-08-31-milestone-4-design.md` (the heading-level
parameter on `cardBody`, the schema-version-3 removal this milestone's migration
copies).

## Goal

The extension works. Several days of use showed where it argues with the reader
instead of getting out of the way.

Seven items were named. Six of them are changes. The seventh turned out to be
already done, and is recorded here so nobody looks for it twice.

## Scope

1. A quote can be removed.
2. The quote location subsystem is deleted, label and machinery both.
3. A saved indicator appears in the card editor.
4. Exported Markdown puts Notes first and Quotes second, each under its own
   heading.
5. Every textarea resizes vertically only.
6. The status-move buttons are removed from the side panel and from the export
   button.
7. The three Substack checkboxes: nothing to do. See below.

This work adds no permission, opens no tab, injects no script, and reads no
page. It removes one thing the extension used to read.

### Item 7 is already done

The developer reported the "Liked", "Commented", and "Unsaved from Substack"
checkboxes still showing on the board's card detail. They are not in the source.
Milestone 4 removed them: `db/schema.ts` version 3 deletes the three fields from
every stored card, and no component renders them.

A stale unpacked build explains what the developer saw. The implementation plan
carries one verification step, not a code task: build, reload the unpacked
extension from `extension/.output/chrome-mv3`, and confirm the checkboxes are
gone.

## Definition of done

- A quote can be removed from either editor, behind a confirmation.
- No quote carries `locator` or `locatorLost`, in the type, in the database, in
  the UI, or in exported Markdown.
- Editing notes or a quote comment shows the editor moving from saving to saved
  and back to quiet.
- A single-card export and the library export both emit `Notes` before `Quotes`,
  each heading present only when its section has content.
- No textarea in the extension resizes horizontally.
- No button anywhere changes a card's status. Dragging on the board is the only
  way.
- `npm test` is green. Every new box in `extension/MANUAL-CHECKS.md` is ticked
  against a loaded build.

## Decisions

### A quote gets an id, because removal ends append-only

`db/cards.ts` addresses a quote by its index into `card.quotes`. The comment on
`updateQuote` states the precondition plainly: the index is stable "because
quotes are only ever appended, never inserted or reordered."

Removal ends that. Remove quote 0 while a comment textarea for quote 1 is
mounted, and the next keystroke in that textarea writes into what is now quote
0. The reader's reaction to one passage silently overwrites their reaction to
another. React's `key={i}` in `CardEditor` makes it worse: the list re-keys
around the hole, and the surviving textareas keep their old DOM state under new
indices.

So `Quote` gains an `id`, `updateQuote` and the new `removeQuote` take an id
instead of an index, and `CardEditor` keys on `quote.id`.

Rejected: keeping index addressing and re-rendering the list hard after each
removal. It would work until two panels hold the same card open, which is a
state this codebase already designs for — `updateQuote`, `addQuote`, and
`recordExport` each run in a transaction for that reason.

Rejected: tombstoning removed quotes with a `removed: true` flag to preserve
indices. It keeps deleted text in the database forever and every reader of
`card.quotes` grows a filter.

### `createQuote` takes the id through `deps`

`createQuote` is pure: its timestamp arrives through a `deps` argument rather
than a clock it reads. The id follows the same route. `db/cards.ts` calls
`nanoid()` and passes it in, the same way `ingestCard` already supplies a card
id.

### The whole locator subsystem is deleted, not hidden

`domain/quote.ts` holds `resolveQuote`, about ninety lines that answer "where is
this quote in the article now". `ReadingPanel` re-runs it in an effect whenever the card, its quote count, or
the article text changes, writing `locatorLost` back to the database.

It does not work in normal use. The developer closed the article tab, refreshed
the board, and every quote read "location unavailable"; re-opening the tab did
not clear it. That is the design working as written rather than a bug in it:
`locatorLost` is persisted state, and the only thing that ever clears it is a
panel that has `bodyText` for that article. A board with no article tab open has
no article text, so it can only ever show the last verdict, and the last verdict
outlives its evidence.

A label that says "unavailable" when it means "not checked recently" is worse
than no label. Nothing downstream reads the offset — `resolveQuote` returns a
character position that no caller uses for anything except a null check, because
the quote's verbatim text is stored on the quote and never read back from the
article.

So all of it goes:

| Deleted | Where |
| --- | --- |
| `resolveQuote` and its tests | `domain/quote.ts`, `domain/quote.test.ts` |
| `locator`, `locatorLost` | `domain/types.ts` |
| the re-check effect | `ui/ReadingPanel.tsx` |
| the `location unavailable` span | `ui/CardEditor.tsx` |
| `.quotes .lost` | `ui/styles.css` |
| `LOST_MARKER` and its branch | `domain/markdown.ts` |
| `bodyText` | `messages.ts`, and the two writes in `entrypoints/background.ts` |
| `prefix` | `CaptureSelectionReply` in `messages.ts`, the `sendResponse` in `entrypoints/background.ts`, and the `createQuote` call in `ui/ReadingPanel.tsx` |
| the prefix half of `readSelection` | `substack/extract.ts` |

**Amendment, 2026-09-03, while writing the plan:** the `prefix` chain was not in
the first draft of this table. `quote.locator` is only ever fed by it, so with
the locator gone every link in that chain is dead: the Range walk in
`readSelection`, the field on `CaptureSelectionReply`, and the argument to
`createQuote`. `readSelection` becomes `(win?) => string | null`, which is what
its one caller wanted all along.

Rejected: hiding the label and keeping the machinery, in case jump-to-quote is
wanted later. It leaves an effect writing to the database on every panel open to
maintain a field nothing reads. If jump-to-quote is built, it will want to
resolve on demand against a page that is open, which is a different function
from this one.

`bodyText` stays in `substack/extract.ts`. `ExtractedMeta` derives `wordCount`
from it, and that is a separate consumer. Only its trip through `PanelState` to
the panel ends.

### The saved indicator is one per editor, not one per field

`CardEditor` owns a single `useSaveStatus` hook and renders its state beside the
card title. Both the notes textarea and every quote comment report through it.

One indicator rather than one per field, because the editor writes one card. Two
markers disagreeing about whether the card is saved is a question the reader
should never have to answer. Both panels get it for free: the side panel and the
board's detail panel both render through `CardEditor`.

States are `idle`, `saving`, and `saved`. A debounce starting sets `saving`, the
write resolving sets `saved`, and `saved` returns to `idle` after two seconds.
`idle` renders nothing. An editor at rest is quiet, which is the resting state
the reader spends nearly all their time in.

### Quote comments get the debounce that notes already have

Notes write 300ms after the last keystroke. Quote comments call `updateQuote` on
every keystroke, with no debounce. That was already a Dexie transaction per
character; it becomes visible once an indicator describes it, because an
indicator driven by per-keystroke writes never leaves `saving`.

Both paths take the same 300ms debounce. The indicator then describes one
behaviour instead of two.

This is the one change in the milestone the developer did not ask for. It is
here because the requested feature cannot be built honestly without it.

### `cardBody` emits Notes then Quotes, each behind its own heading

`cardBody(card, level)` currently emits quote blocks with no heading at all,
then `Notes` and its body. It becomes `Notes` first, then `Quotes`, each heading
emitted only when its section has content.

The heading-level parameter keeps doing its job. A single-card export passes 2
and gets `## Notes` and `## Quotes`. The library export passes 4 and gets
`#### Notes` and `#### Quotes` under each `### Title`. One builder, two files,
as Milestone 4 established.

An empty section is omitted entirely, heading and all. This extends the rule the
code already applies to notes: "the heading and the body are omitted together.
There is no empty heading." A card exported after only highlighting has no
`Notes` heading.

Rejected: always emitting both headings so every file has one shape. It writes
empty scaffolding into a vault, and the frontmatter already gives every file a
common shape.

Rejected: a `---` rule between the sections. In Markdown a `---` on the line
after a paragraph is a setext heading, not a rule, so it needs a blank line
above it to mean what it looks like. Two headings already separate the sections.

### Removing a quote confirms first

The `×` on a quote opens `window.confirm` naming the first sixty characters of
the quote text. Deleting a card already confirms this way, and this extension
has no undo anywhere. The passage may have come from a page the reader has
closed and cannot easily find again.

Rejected: a two-step inline confirm. It guards the same misclick with a pattern
this codebase uses nowhere else.

### No button changes status any more

Two controls move a card between columns:

- The three-button row at the bottom of `ReadingPanel`.
- The "Move to Processed?" offer that appears in `ExportButton` after a
  successful export.

Both go, along with `COLUMN_LABELS`, the `Status` import in `ReadingPanel`, and
the offer's state in `ExportButton`. `moveCardTo` in `db/cards.ts` then has no
callers and is deleted with its tests.

`reorderCards` in `domain/card.ts` stays. The board's drag calls it through
`applyOrder`, and dragging on the board becomes the only way a card changes
column. That is the point: the developer moves cards when they decide the card
has moved, not when a button infers it.

### Vertical-only resize, everywhere

`resize: vertical` goes on `.panel textarea`, `.reading textarea`, and
`.quotes textarea`. A horizontally dragged textarea in a fixed-width side panel
either overflows the panel or shrinks to a column narrower than the text in it,
and neither state has a way back except reloading.

## Architecture

### Changed files

| File | Change |
| --- | --- |
| `domain/types.ts` | `Quote` gains `id`, loses `locator` and `locatorLost` |
| `domain/quote.ts` | `createQuote` takes `id` in `deps`; `resolveQuote` deleted |
| `domain/markdown.ts` | `cardBody` reordered and given both headings; `LOST_MARKER` deleted |
| `db/schema.ts` | version 4: assign quote ids, strip the two dead fields |
| `db/cards.ts` | `updateQuote` takes an id; `removeQuote` added; `moveCardTo` deleted |
| `messages.ts` | `bodyText` leaves `PanelState` |
| `entrypoints/background.ts` | the two `bodyText` writes removed |
| `ui/CardEditor.tsx` | remove button per quote, save indicator, debounced comments, `key={quote.id}` |
| `ui/ReadingPanel.tsx` | status row and the re-check effect removed |
| `ui/ExportButton.tsx` | the Processed offer removed |
| `ui/useSaveStatus.ts` | new |
| `ui/styles.css` | `resize: vertical`; `.lost` removed |

### Dependency rule

Unchanged. `domain/` imports nothing from `db/` or `ui/`. The quote id is
generated in `db/cards.ts` and handed to `domain/quote.ts`, which is how
`savedAt` and the card id already cross that line.

### Schema

Version 4. The store string is identical to version 3; no index changes, only
rows. The upgrade walks every card, and for each quote assigns `nanoid()` and
deletes `locator` and `locatorLost`. It follows version 3's shape exactly.

A backup file written before this version restores through `restoreCards`, which
writes whole cards and does not run migrations. Its quotes arrive without ids.
`restoreCards` therefore assigns an id to any quote lacking one and drops the two
dead fields, the same way it already recomputes `articleKey` rather than trusting
the file.

## Failure behaviour

- Removing a quote from a card that was deleted in another panel: `removeQuote`
  reads the card inside the transaction, finds nothing, and returns. No error.
- Removing a quote id that is no longer present: same, and for the same reason.
  Two panels both removing the same quote is one removal and one no-op.
- A write failing while the indicator says `saving`: the indicator stays at
  `saving` rather than claiming `saved`. There is no error toast in this
  extension and this milestone does not add one; the honest failure is the
  absence of a success.

## Testing

### Automated

`domain/` and `db/` are covered by Vitest. Written before the code:

- `domain/quote.test.ts`: `createQuote` carries the id through. Every
  `resolveQuote` test is deleted, not adapted.
- `domain/markdown.test.ts`: Notes precedes Quotes; each heading appears only
  with content; both appear at the level passed; the library export nests both
  under `###`; no output contains the lost marker.
- `db/schema.test.ts`: a version-3 database opens at version 4 with every quote
  carrying an id and neither dead field.
- `db/cards.test.ts`: `removeQuote` removes the named quote and leaves the rest;
  `updateQuote` patches by id; both no-op on a missing card or a missing quote;
  a restored backup with idless quotes comes back with ids. The `moveCardTo`
  tests are deleted.

### Manual checks

`src/ui/` has no automated tests, by design. New boxes in
`extension/MANUAL-CHECKS.md`:

- The three Substack checkboxes are absent from a freshly built, freshly loaded
  extension.
- Removing the first of three quotes leaves the other two with their own
  comments intact.
- Cancelling the confirmation removes nothing.
- Typing in notes shows saving, then saved, then nothing.
- Typing in a quote comment drives the same indicator.
- No quote shows a location label, with the article tab open or closed.
- No textarea can be dragged wider or narrower, in either panel.
- The side panel has no status buttons, and no offer appears after an export.
- A card exported with notes and quotes has Notes above Quotes.
- A card exported with quotes and no notes has no Notes heading.

## Learning mode

The developer is learning the stack. Two questions in this milestone are worth a
note in `docs/learning-notes.md` when they ask them: why an array index is an
unsafe address for a mutable list, and why a debounce is what makes a save
indicator truthful rather than decorative.

## Task shape

Seven tasks, each committable on its own:

1. Quote id: type, `createQuote`, schema version 4, `restoreCards`,
   `updateQuote` by id. Tests first.
2. `removeQuote` in `db/cards.ts`, with tests.
3. Delete the locator subsystem across all seven files.
4. `cardBody` reordering, with tests.
5. `useSaveStatus`, the debounce on quote comments, the indicator in
   `CardEditor`, the remove button.
6. Remove the status controls and `moveCardTo`.
7. CSS, the manual-check boxes, and the build-and-reload verification of item 7.

Task 1 comes first: tasks 2 and 5 both address quotes by id.

## Open questions carried forward

None.
