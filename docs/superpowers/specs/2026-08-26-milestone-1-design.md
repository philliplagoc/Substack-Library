# Milestone 1 design: extension scaffold and board

**Date:** 2026-08-26
**Status:** Approved. Next step is the implementation plan.
**Parent spec:** `implementation-plan.md`, section "Build sequence", Milestone 1.
**Inputs from Milestone 0:** `prototype/DECISIONS.md` (binding layout constraints),
`spike/README.md` (reference only; Milestone 1 reads no Substack page).

## Goal

Build the extension shell and the board. At the end of this milestone the
extension installs, opens a three-column board from the toolbar, stores cards in
IndexedDB, and supports drag and drop, a card detail panel, manual card creation
by URL, and JSON backup and restore.

Milestone 1 reads no Substack page. Capture, the companion panel, and Saved sync
belong to Milestones 2 and 3.

## Definition of done

Milestone 1 is **tested scaffolding**, not a daily driver. The developer does not
adopt the extension for real reading until Milestone 2 adds one-click capture.

Two consequences follow:

1. Automated tests are the primary evidence that the board works. The board is
   never exercised by daily use, so a bug that no test covers stays hidden.
2. Data in the Milestone 1 database is disposable. The Dexie schema still gets a
   version number, so the habit is in place before Milestone 2 needs an upgrade
   path, but no migration safety is owed for data written during this milestone.

The prototype already answered the layout questions. Milestone 1 rebuilds that
settled layout on real infrastructure; it does not reopen design questions.

## Decisions

### Data access: direct Dexie, iframe panel in Milestone 2

The board page runs at the `chrome-extension://` origin and talks to Dexie
directly through a repository module. React reads through `useLiveQuery`, so the
UI re-renders when the database changes. No message passing exists in
Milestone 1.

**Why this needs deciding now.** An MV3 extension is several documents with
separate storage. A content script injected into a Substack article runs in an
isolated JavaScript world but shares **substack.com's** origin for storage. A
content script that opens IndexedDB opens Substack's database, not the
extension's. Milestone 2 puts a notes panel on the article page, so the seam
between page context and extension storage has to go somewhere.

**Where it goes.** In Milestone 2 the companion panel is an iframe whose `src`
is a `chrome-extension://` URL listed in `web_accessible_resources`. That iframe
runs at the extension origin, so it reaches the same Dexie and the same
`useLiveQuery` with no bridge. Only the thin content script that reads article
metadata and clicks Substack's native Save button messages the extension, and it
messages a small surface rather than the whole data layer.

**Rejected: the service worker owns all data.** Every read and write would go
through `chrome.runtime.sendMessage` to a background worker. Milestone 2's
content script would get data access for free. The cost is paid immediately and
in full: reads become async and manually invalidated, which forfeits
`useLiveQuery` and reintroduces the "wrote the record, UI shows the old value"
bug class; MV3 service workers are killed when idle and restart cold, adding a
wake-up race; and database tests grow a fake messaging layer. This pays
Milestone 2's tax during Milestone 1 to solve a problem the iframe dissolves.

**Rejected: defer the panel decision to Milestone 2.** The Milestone 1 code is
identical either way. Deferring buys nothing and starts Milestone 2 with an open
architecture question instead of a decision to execute.

### Extension shell: WXT

WXT generates the MV3 manifest from entrypoint file conventions, ships a working
dev-reload loop, and is actively maintained. This closes the open question
recorded in `changes.log`.

**Rejected: CRXJS.** A thinner Vite plugin that leaves more of the manifest
hand-written. It went through a maintenance gap and offers nothing this project
needs.

**Rejected: plain Vite with a hand-written manifest.** Maximum control and good
for learning what a manifest is, but the build wiring and reload loop become the
developer's to own, which is cost with no payoff here.

### Ordering: dense integers

`sortOrder` is a number scoped per column. A drop rewrites the affected columns
so the sequence stays dense and gap-free. `prototype/DECISIONS.md` requires
dropping between cards, not only at the end of a column, so reordering within a
column is in scope.

**Why dense.** One user, a few hundred cards. A column rewrite is a single Dexie
transaction over a few dozen small records.

**Rejected: sparse integers with gaps.** Averaging neighbours reduces writes per
drop, but gaps exhaust and owe a renormalization pass, and floating-point
precision runs out after roughly fifty inserts into one gap. Gap schemes exist to
avoid write amplification at multi-user scale. Buying that here adds a
renormalization bug class that then needs its own tests.

**Rejected: fractional indexing (LexoRank).** Never needs renormalization. Needs
a string-ordering library and a mental model this project does not otherwise
require.

### Restore semantics: replace by URL, never delete

Restore reads a backup file and writes whole cards through `restoreCards()` in
`db/cards.ts`. A card with the same canonical URL is replaced, keeping the id
already on the board. A card the board does not have is added. A local card the
file does not mention is left alone. The button asks for confirmation first and
states the overwrite rule in words.

**Why not `ingestCard()`.** The first draft of this design routed restore
through `ingestCard()`. That was wrong. `ingestCard()` carries metadata only:
url, title, author, publication, reading minutes. A backup carries whole cards,
including notes, quotes, tags, status, and export history. Merging a backup
through `ingestCard()` would drop every note in the file, which defeats the
purpose of a backup.

`ingestCard()` stays the single path for capture: the add-by-URL form, the
Milestone 2 content script, and Milestone 3 sync.

**Cost, accepted.** Restore never deletes, so it does not undo an add. It does
undo a deletion, which is the case a backup exists for.

**Rejected: wipe and replace the whole table.** It would make restore exact, at
the price of destroying every card added since the backup was taken.

### Test depth: logic and Dexie, no UI

Vitest over the pure `domain/` layer and over the `db/` repository with
`fake-indexeddb`. No React rendering tests, no end-to-end browser test.

**Why.** The bugs that matter here are silent: a `sortOrder` collision that
scrambles a column, a dedup rule that overwrites notes. A broken button is loud
and surfaces the first time the board is opened. `fake-indexeddb` reimplements
IndexedDB in memory, so nothing in this project needs a browser to be verified.

**Consequence, binding on the architecture.** The `ui/` layer is the only
untested layer, so every rule that lives there is a rule nothing verifies. This
is why the dependency rule below pushes all decisions out of components.

**Rejected: adding component tests.** React Testing Library over the board would
catch wiring bugs, at the cost of a jsdom setup and tests that break on markup
changes. Task 11's written manual checklist covers the same ground for a
single-user project.

**Rejected: adding a Playwright end-to-end test.** The only way to prove the MV3
manifest and permissions are correct, but significant setup for one or two tests
when loading the extension unpacked once proves the same thing.

## Architecture

### Layout

The extension lives in `extension/` at the repo root, a sibling of `spike/` and
`prototype/`, with its own `package.json`. No project imports from another.

```
extension/
  wxt.config.ts            # entrypoints -> generated MV3 manifest
  vitest.config.ts
  package.json  tsconfig.json
  entrypoints/
    background.ts          # toolbar click -> open or focus the board tab
    board/index.html
    board/main.tsx         # React root
  src/
    domain/                # PURE. No Dexie, no React, no browser APIs.
      types.ts             # Card, Quote, Status
      url.ts               # canonicalizeUrl()
      card.ts              # createCard(), reorderCards(), visibleCards()
      ingest.ts            # mergeCard(existing, incoming)
      backup.ts            # toBackup(), fromBackup()
    db/
      schema.ts            # Dexie subclass, version(1).stores(...)
      cards.ts             # repository - the ONLY module that touches the table
    ui/
      App.tsx  Toolbar.tsx  ErrorBoundary.tsx
      Board.tsx  Column.tsx  CardTile.tsx
      DetailPanel.tsx  AddByUrlForm.tsx  BackupControls.tsx
  test/
    setup.ts               # installs fake-indexeddb
```

### Dependency rule

| Layer | May import | Must never import |
|---|---|---|
| `domain/` | nothing in this project | `db/`, `ui/`, `dexie`, `react` |
| `db/cards.ts` | `domain/`, `db/schema.ts` | `ui/` |
| `ui/` | `db/cards.ts`, `domain/types.ts` | `db/schema.ts`, `dexie` |
| `entrypoints/` | `ui/` | `db/`, `domain/` |

A component reads from the repository, renders, and calls a repository function
on interaction. A component that grows a decision has code that belongs one
layer down.

### Responsibilities

- `domain/` holds every rule. Pure data in, pure data out. Testable with no setup.
  Pure means deterministic: no `nanoid()`, no `Date.now()`, no `crypto`. A
  function that needs an id or a timestamp takes it as an argument, and
  `db/cards.ts` supplies it at the call site. `createCard(input, { id, savedAt })`
  is therefore assertable against a literal expected object, with no clock
  stubbing and no id regex in the test.
- `db/cards.ts` is the single choke point for reads and writes. Milestones 2 and 3
  call it rather than opening the database themselves.
- `ui/` renders and dispatches. It owns no rules.
- `entrypoints/background.ts` owns the toolbar action and nothing else.

### The `ingestCard()` split

`implementation-plan.md` requires all card creation to run through one
`ingestCard()` so merge rules live in one place. That function splits across two
layers:

- `domain/ingest.ts` exports the pure `mergeCard(existing, incoming)`: given an
  existing card and incoming metadata, return the merged card. Testable without a
  database.
- `db/cards.ts` exports the transactional `ingestCard(incoming)`: canonicalize
  the URL, look up by `url`, apply `mergeCard` or insert, write in one
  transaction.

Milestone 1's only caller is the add-by-URL form. Milestone 2's capture and
Milestone 3's sync and backlog import land on the same function.

## Data model

`domain/types.ts` declares the complete `Card` interface from
`implementation-plan.md`, including the fields Milestones 2 and 3 use
(`lastExportedAt`, `exportVersion`, `lastSeenInSaved`, `syncWarning`, `liked`,
`commented`, `unsavedFromSubstack`). Types cost nothing at runtime, and declaring
the whole shape now prevents Milestone 2 from inventing a second, subtly
different `Card`.

### Schema

```ts
db.version(1).stores({
  cards: 'id, &url, status, savedAt, [status+sortOrder]'
});
```

Dexie's `stores()` string lists **indexes**, not columns. IndexedDB stores whole
objects, so unindexed fields are still saved and read back; they cannot be
queried efficiently.

- `id` is the primary key (nanoid).
- `&url` is unique. A duplicate insert throws rather than producing two cards for
  one article. This is the enforcement arm of "silent failure is banned".
- `[status+sortOrder]` is compound. A column reads its cards already ordered
  straight from the index, instead of loading every card and sorting in
  JavaScript.

### URL canonicalization

`canonicalizeUrl()` lowercases the host, drops the hash, drops a trailing slash,
and strips the query string. It returns `null` for anything unparseable and never
throws, matching the contract the spike established.

Stripping the query string is load-bearing. The Milestone 0 spike captured Saved
list entries carrying `?utm_source=...`, so one article reached by two routes
yields two URLs. Without stripping, `&url` never fires and duplicates accumulate.

### Merge rules

`mergeCard(existing, incoming)`:

- Refresh metadata: `title`, `author`, `publication`, `estimatedReadingMinutes`.
- Never touch user-authored state: `notes`, `quotes`, `tags`, `status`,
  `sortOrder`, `readAt`, `lastExportedAt`, `exportVersion`, and the three
  Substack flags.

### Status transitions

Any column may move to any other column. There is no enforced order, because the
real workflow abandons articles and revisits them, and a board that refuses a
move is a board fought rather than used.

One side effect attaches: `readAt` is stamped the first time a card enters
`reading`, and is never overwritten afterwards. The Markdown export's `read:`
frontmatter key reads it in Milestone 2, so it needs a defined origin now.
A card dragged straight from To Read to Processed gets no `readAt`, and the
export leaves that key blank, which the parent spec's format already allows.

### Backup shape

```json
{ "version": 1, "exportedAt": "<ISO timestamp>", "cards": [] }
```

`fromBackup(json)` returns `{ cards, errors }` rather than throwing. A file with
three bad records restores the good ones and names the three that failed by
index. It never rejects the whole file and never drops rows silently.

## Board

### Layout constraints from `prototype/DECISIONS.md`

`prototype/DECISIONS.md` is the specification of the layout. The Milestone 0 plan
bans reusing prototype code, and these two facts do not conflict: the grid and
the panel are re-implemented from that description, and no file is copied.

Binding constraints:

- Three equal columns in a CSS grid.
- Card faces show title, `publication · author`, and reading minutes, plus a
  status line for notes and quote counts. **The saved date comes off.**
- A card with no reading-time estimate **hides** when a max-minutes filter is set.
- Panel on the right at a fixed 380px width.
- Panel section order: title, meta, notes, quotes, Markdown preview.
- The Markdown preview sits **behind a toggle**. Milestone 2 owns it; the
  constraint is recorded here so that milestone inherits it.
- dnd-kit is confirmed. Drops between cards are required, not only at column end.

### Shell and entry

`wxt.config.ts` declares an action with no `default_popup`, which is what allows
`chrome.action.onClicked` to fire. `entrypoints/background.ts` looks for an
already-open board tab and focuses it; it opens a new tab only when none exists.

Permissions in v1: `storage` only. Host permissions arrive with the Milestone 2
content script.

### Reading and filtering

The board runs one `useLiveQuery` over all cards, ordered by the
`[status+sortOrder]` index. Filtering and grouping happen in the pure
`visibleCards(cards, { query, maxMinutes })`, which is where the
hide-unestimated rule lives.

Milestone 1 ships two controls, matching what the prototype settled: a text
search across title, author, and publication, and a maximum reading time. The
parent spec's Board section also names filters on publication and saved date;
both are deferred. The prototype never tested them, and the reading-time filter
is the one the parent spec calls "the main triage tool". The `savedAt` index is
declared in the schema anyway, so adding the saved-date filter later costs no
migration.

### Drag and drop

dnd-kit supplies `DndContext` with a `SortableContext` per column. Its
`KeyboardSensor` closes the gap the prototype found: native HTML5 drag has no
keyboard path.

On drop, the component performs no arithmetic. It calls
`reorderCards(cards, { cardId, toStatus, toIndex })` in `domain/card.ts`, which
returns the new `(id, status, sortOrder)` triples, then hands those to
`cardsRepo.applyOrder()` for one transactional write. dnd-kit's event shapes stay
in `ui/`; the ordering math stays testable.

`reorderCards` is one function covering both moves. A within-column move is the
case where `toStatus` equals the card's current status. Splitting it into
"reorder" and "move between columns" would give two functions that both have to
renumber a column, and two places for the dense-sequence rule to drift.

### Card detail panel

Milestone 1 contents: title, a meta line, a notes textarea, the quotes list
read-only, the three Substack flags as checkboxes, and delete.

- The notes textarea debounces roughly 300ms before writing, so a paragraph of
  typing produces a few writes rather than a few hundred.
- Delete asks for confirmation. There is no undo.
- No Markdown preview. Serialization is a Milestone 2 item.

### Add by URL

A form taking a required URL and optional title, author, publication, and reading
minutes, since no content script exists yet to read them. It canonicalizes, then
calls `ingestCard()`.

It always reports which outcome occurred: "added", or "already on the board,
metadata refreshed". A form that silently no-ops on a duplicate is the silent
failure the spec bans.

### Backup and restore

Export builds the backup object and downloads it with a Blob and an anchor
element, which needs no `downloads` permission. Restore reads a file, runs
`fromBackup()`, merges through `ingestCard()`, and reports added, updated, and
skipped-with-reason counts.

## Failure behaviour

Most Reliability rules in `implementation-plan.md` describe Substack integration
and bind Milestones 2 and 3. The rule that binds Milestone 1 is "silent failure
is banned". It cashes out as four things:

1. The add-by-URL form always states which outcome occurred.
2. Restore reports added, updated, and skipped counts with reasons.
3. Delete asks for confirmation before it removes a card.
4. A React error boundary wraps the board, so a Dexie failure shows a readable
   message rather than a white screen.

## Testing

Vitest, configured in `extension/vitest.config.ts`. `test/setup.ts` imports
`fake-indexeddb/auto`, which installs an in-memory IndexedDB onto `globalThis`
before Dexie opens a database.

Vitest rather than the `node --test` used in `spike/`, because this project is
TypeScript on a Vite toolchain already present. Vitest reads the same config and
needs no separate compile step.

| Layer | Tests |
|---|---|
| `domain/url.ts` | strips query string, hash, trailing slash; lowercases host; returns `null` on garbage without throwing |
| `domain/ingest.ts` | refreshes metadata; never touches `notes`, `quotes`, `tags`, `status`, `sortOrder`, or export history |
| `domain/card.ts` | `createCard` is deterministic given an injected id and timestamp; a move into `reading` stamps `readAt` once and never rewrites it |
| `domain/card.ts` | `reorderCards` yields a dense gap-free sequence for within-column and cross-column moves, and renumbers both affected columns |
| `domain/card.ts` | `visibleCards`: search matching, and a card with no estimate hides when a max is set |
| `domain/backup.ts` | `toBackup` to `fromBackup` round-trips; a file with bad records restores the good ones and reports the bad by index |
| `db/cards.ts` | `&url` uniqueness rejects a duplicate; `ingestCard` merges rather than inserting; `reorder` writes atomically |

`implementation-plan.md` also names Markdown serialization and versioned filename
generation. Both belong to Milestone 2.

## Learning mode

The plan keeps the Milestone 0 rhythm: roughly one hands-on contribution per
task, marked `TODO(human)`, on decision-shaped pure functions. Only one is open
at any time. The developer writes the rules; the assistant writes the React
components, WXT configuration, and Dexie wiring around them.

Planned contributions: `canonicalizeUrl`, `mergeCard`, `visibleCards`,
`reorderCards`, and `fromBackup` validation. Each is a pure function of roughly
ten lines with a real decision inside it.

## Task shape

Eleven tasks, each ending in a commit.

1. WXT, React, and TypeScript scaffold; toolbar click opens the board tab
2. `domain/types.ts` and `domain/url.ts` with tests. TODO(human): `canonicalizeUrl`
3. Dexie schema and the `cards` repository, with `fake-indexeddb` tests
4. `domain/ingest.ts` merge rules. TODO(human): `mergeCard`
5. Board renders three columns from `useLiveQuery`; card faces per `DECISIONS.md`
6. Toolbar search and reading-time filter. TODO(human): `visibleCards`
7. dnd-kit drag and drop, within and across columns. TODO(human): `reorderCards`
8. Card detail panel: notes, quotes, flags, delete
9. Add-by-URL form through `ingestCard()`
10. JSON backup and restore. TODO(human): `fromBackup` validation
11. Error boundary, a written manual-verification checklist, and wrap-up

Task 11's manual checklist replaces the component tests this milestone skips:
load unpacked, add a URL, drag within a column, drag across columns, drag with
the keyboard, edit notes, reload, export, restore. It is written into the repo so
it is repeatable rather than remembered.

Task 11 also corrects two records left inconsistent by Milestone 0:
`changes.log`'s "Current state" still reports Milestone 0 Task 6 as open, and
`prototype/DECISIONS.md` ends with an empty "Open questions for Milestone 1".

## Open questions carried forward

These do not block Milestone 1. They bind Milestone 2.

- `extractArticleMeta` derives `isPreview` from the `.paywall` selector, while
  `spike/README.md` names the JSON-LD `isAccessibleForFree` field as the primary
  path. Code and doc disagree, and both fixtures pass either way. Decide before
  the Milestone 2 content script is written.
- The Markdown preview toggle from `prototype/DECISIONS.md` is unimplemented
  until Milestone 2 adds serialization.
