# Milestone 3 design: the Saved-list sync

**Date:** 2026-08-31
**Status:** Approved. Next step is the implementation plan.
**Parent spec:** `implementation-plan.md`, "Build sequence", Milestone 3.
**Inputs:** `spike/README.md` ("Saved list read paths", "Risks found"; the scroll
behaviour and the anonymization contract), `spike/extract.js`
(`extractSavedEntries`, the parser this ports), `spike/fixtures/saved-list.html`
(60 entries, the fixture the parser is tested against),
`docs/superpowers/specs/2026-08-29-milestone-2a-design.md` (the injection rule
and the layer rules), `extension/src/domain/ingest.ts` (`mergeCard`, the refresh
rule this reuses), `extension/src/db/cards.ts` (`ingestCard`, the single door).

## Goal

Articles saved on the phone appear on the board.

Today the board only holds what a desktop toolbar click put there. Substack's
Saved list is where articles actually arrive, from any device, and nothing reads
it. At the end of this milestone one click on the board drains that list onto
the board.

This is the last milestone in `implementation-plan.md`.

## Scope

Milestone 3 items 1, 2, and 3:

1. The Saved-list parser, in its own module, fixture-tested.
2. A manual **Sync Saved**: import new, refresh known, flag missing.
3. The first-run backlog import, over the same path.

**Item 4, the explicit unsave, is not in this milestone.** Milestone 3 is
read-only against Substack.

### Why unsave is deferred

Everything the extension does today reads Substack and writes only its own
database. Unsave would be the first irreversible outward action, and
`spike/README.md` records that it is also the most fragile thing on the site: the
control does not exist in the DOM until a Radix popover mounts, its classes are
hashed and regenerated per mount, and its label is inverted, reading `Save` when
the article is not saved. Three steps, all drift-prone, to change something the
extension cannot undo.

None of that is needed to get saved articles onto the board. It gets its own
small spec if it is ever wanted.

### Why the vault write is not here either

Milestone 2C, the Obsidian vault write, was deferred on 2026-08-31 to a future
update of the extension. It is not part of v1 and does not block shipping. The
versioned Markdown download from 2B already gets a note out of the extension.

## Definition of done

- One click on the board reads the Substack Saved list to its end and reports
  what it found.
- New entries become cards in To Read carrying title, author, publication, and a
  reading estimate.
- Known entries refresh their metadata and keep their status, notes, and quotes.
- A card whose article has left the Saved list carries a visible warning and is
  neither moved nor deleted.
- A card that was never in the Saved list is never warned about.
- A run that could not read the list completely writes no warnings at all.
- Every failure says on screen what failed, per `implementation-plan.md`,
  "Reliability".
- `npm test`, `npm run compile`, and `npm run build` are clean, and the
  dependency-rule greps still pass.

## The four decisions this design rests on

Each was put to the developer and answered on 2026-08-31.

### Saved is an inbox to drain, not a mirror to reconcile

The Saved list is where articles arrive. The board is the source of truth for
status. Sync pulls entries in; it never pushes status out and never deletes.

The consequence that matters: **an article moved to Processed is done, and sync
must never resurrect it into To Read**, even though it is still saved on
Substack. The rejected alternative was a mirror, where an article leaving the
Saved list means the card should go too. That makes an unsave tapped on a phone
a destructive input to a card holding notes and quotes, which is the one thing
this extension exists to protect.

### Sync drives a tab the developer can watch

The Saved list loads more entries on scroll and does not virtualize
(`spike/README.md`, "Risks found"): 20 entries at the top of the page, 85 at the
bottom, and still 85 back at the top. Entries loaded once stay in the DOM. So a
parser must drive the page to its end before it reads, and it never has to track
an entry disappearing while it scrolls.

Sync opens or focuses `substack.com/inbox/saved` in a **visible foreground tab**
and scrolls it. Two alternatives were rejected. A background tab is tidier and
does not steal focus, but Chrome throttles timers and lazy loading in background
tabs, so the scroll loop can stall and under-collect - and a silent
under-collection is indistinguishable from "you have no new saved articles". A
read-only pass over a tab the developer has already scrolled themselves is the
least code and cannot stall, but it makes a short scroll silently sync a partial
list.

A visible tab makes a sign-in wall or a layout change obvious rather than
silent, which is what "Silent failure is banned throughout" asks for.

### The Saved list already carries a reading estimate, so sync fetches nothing

This overturns an earlier answer in the same brainstorm. The first plan was to
fetch each new article's HTML and run `extractArticleMeta` over it, because a
synced card would otherwise have no reading estimate - and a card with no
estimate is hidden by the board's Max minutes filter, so an 85-article backlog
would be invisible to the exact filter `implementation-plan.md` names as a
success criterion.

Reading the fixture closed that. Each entry's `.reader2-item-meta` holds
`Author∙14 min read`, present on 58 of the 60 fixture entries. The list yields
six fields with no network at all: publication, publish date, title, subtitle,
author, and a duration.

So sync stays a pure page read. No fetch fan-out, no rate-limit question, no
partial-failure class, and a first-run import of 85 articles costs one page load
rather than 85 requests. Word count and paywall state still arrive the first
time the article is opened with the toolbar button, through the 2A path that
already exists.

**Substack's estimate replaces `readingMinutes()` for synced cards.** The two
may disagree; `domain/article.ts` computes 250 words a minute from a word count
sync does not have. Substack's number is the one the developer already sees on
the site, and disagreeing with it would be the confusing outcome.

### Podcasts and videos are imported and marked

Two of the 60 fixture entries read `1 hr 6 min watch` and `1 hr 14 min watch`.
The Saved list is not only articles.

They are imported as cards, the duration becomes the card's minutes, and the
card records its medium. The board stays a complete picture of what was saved,
the Max minutes filter treats a 74-minute item honestly, and a watch item can be
moved to Processed to drain it.

Skipping them was rejected: sync would report 58 of 60 with no explanation on
screen, and those two would never leave the Saved list. Importing them
unmarked was rejected too - a card face reading "74 min" with no hint that there
is no article body to take notes on is a confusing click waiting to happen.

## Architecture

### New and changed files

| File | Holds | May import |
|------|-------|------------|
| `src/substack/saved.ts` (new) | `SavedEntry`, `extractSavedEntries()`, `scrollToEnd()` | **nothing** |
| `src/domain/saved.ts` (new) | `Medium`, `parseItemMeta()`, `savedEntryToInput()` | types only |
| `src/domain/types.ts` | `Card` gains `medium?: Medium` | unchanged |
| `src/db/sync.ts` (new) | `SyncReport`, `applySync()` | `db`, `ingestCard` |
| `src/entrypoints/background.ts` | the `sync-saved` message handler | unchanged |
| `src/messages.ts` | the `sync-saved` message and its reply | types only |
| `src/ui/SyncButton.tsx` (new) | the button, the running state, the report | `db/sync` |
| `src/ui/Toolbar.tsx` | mounts `SyncButton` | unchanged |

### The dependency rule is unchanged

`src/substack/saved.ts` imports nothing, for the reason recorded in the 2A
design: `scripting.executeScript` ships a function into the page by calling
`Function.prototype.toString()` on it, so an injected function cannot close over
anything it did not declare in its own body. Such code compiles, type-checks,
and throws a bare `ReferenceError` inside Substack's document.

This is why the parse is split across two files. The injected side returns raw
strings. `parseItemMeta("Author∙14 min read")` lives in `domain/`, where Vitest
can reach it, because it is the part with edge cases.

`src/ui/` still touches neither Dexie nor the schema directly; `SyncButton`
calls `db/sync.ts`.

### No schema change

`Card` gains `medium?: Medium`, optional and unindexed. Dexie versions on index
changes, not on shape, so **the schema stays at version 2** and there is no
migration.

`domain/backup.ts`'s `describeProblem` must accept the new field on restore, and
must keep accepting a card without it: every card written before this milestone
has no `medium`.

### The fields Milestone 1 already provisioned

`Card` already carries `lastSeenInSaved?: string`, `syncWarning?: string`, and
`unsavedFromSubstack: boolean`, written in Milestone 1 and never assigned since.
`CardInput`'s own doc comment reads "Milestone 2's content script and Milestone
3's sync both produce this shape". Sync is a new producer for a door that
already exists, not a new door.

### Sync, end to end

1. The board's **Sync Saved** button sends `{ kind: 'sync-saved' }` to the
   background. The board never touches tabs and never reads Substack.
2. The background opens or focuses `substack.com/inbox/saved` in a visible tab,
   reusing the tab-tracking pattern the toolbar handler already uses for the
   board tab.
3. It injects `scrollToEnd()`, which scrolls to the bottom, waits, re-counts
   `.visibility-check`, and repeats until the count has stopped growing twice in
   a row or a hard cap is reached. It returns the final count and whether it
   stopped on the cap.
4. It injects `detectSignedOut()`, then `extractSavedEntries()`, which returns
   `SavedEntry[]`.
5. It calls `applySync(entries, ranAt, complete)` and returns the `SyncReport`
   to the board.

The scroll and the extract are two injections, not one. The scroll is slow and
retryable; the extract is instant and pure. Fusing them would mean re-scrolling
a fully loaded list to retry a parse failure.

**The stop condition is two flat readings, not one.** A single flat count cannot
tell "the list ended" from "the next page has not landed yet". A growing count is
the only signal the page offers, because entries never unmount.

## What the parser reads

`SavedEntry` is what the injected function returns. Every field is a raw string
or null; nothing is parsed on the page side.

```ts
interface SavedEntry {
  url: string;          // absolute, from the entry's /p/ anchor
  title: string | null;
  publication: string | null;
  itemMeta: string | null;   // "Hussain Ibarra∙14 min read"
}
```

The selectors, all verified against `spike/fixtures/saved-list.html` and
recorded in `spike/README.md`:

| Field | Selector | Note |
|-------|----------|------|
| entry | `.visibility-check` | exactly 60 on the fixture |
| url | `a[href*="/p/"]` inside the entry | each entry holds two anchors and only the article link contains `/p/`; 2 of 60 are custom domains and resolve correctly, because the selector never names a host |
| title | `.reader2-post-title.reader2-clamp-lines` | |
| publication | `.pub-name` | |
| item meta | `.reader2-item-meta` | 58 of 60; absent is not an error |

The publish date and the subtitle are read by neither. The board shows neither,
and `Card` has nowhere to put them. Adding fields nothing displays is how a
schema grows without paying for itself.

### `parseItemMeta`, in `domain/`

Input `"Hussain Ibarra∙14 min read"`, output
`{ author: 'Hussain Ibarra', minutes: 14, medium: 'read' }`.

**Match the duration from the end of the string, do not split on the bullet.**
An author name can contain the separator, the separator is a styled `<span>`
Substack can restyle, and one fixture entry already reads
`"Wyndo and Dheeraj Sharma∙ 1 hr 6 min watch"`. The duration is the anchored,
structured end of the string; the author is whatever is left once the duration
and any trailing separator are removed.

Hours are accumulated: `1 hr 6 min` is 66 minutes. `read`, `watch`, and `listen`
are the three media; anything else, or no match at all, yields no minutes and no
medium rather than a guess.

## Reconciliation

`applySync(entries, ranAt, complete)` wraps the whole run in one
`db.transaction('rw', db.cards, ...)`. `ingestCard`'s own transaction joins that
one rather than opening a second, the same Dexie behaviour `moveCardTo` already
relies on.

1. **Every entry goes through `ingestCard()`.** New entries become cards in To
   Read. Known entries go through `mergeCard`, which refreshes title, author,
   publication, and minutes and touches nothing else.
2. **Each ingested card is stamped** `lastSeenInSaved = ranAt`, and any
   `syncWarning` on it is cleared.
3. **The missing pass**, and only if `complete`: every card carrying a
   `lastSeenInSaved` that is not `ranAt` gets
   `syncWarning = "No longer in your Substack Saved list (last seen <date>)"`.

Three consequences, each of which is the design working rather than code to
write.

**"Never resurrect a Processed card" needs no code.** `mergeCard` spreads
`...existing` and overwrites four metadata fields. `status` is not one of them.
The inbox model is already the merge rule's behaviour, and the test that pins it
is the valuable part.

**A card never seen in Saved is never flagged.** A card added by URL or captured
with the toolbar button has no `lastSeenInSaved`, so it cannot go stale. The
warning means "this left your Saved list", not "this is not in it".

**`unsavedFromSubstack` is not touched.** That flag belongs to the deferred
explicit unsave. "It left the Saved list" and "the extension unsaved it" are
different facts, and collapsing them now would make that milestone harder.

### The rule that protects the board

> **The missing pass runs only on a run believed complete.** Zero entries
> parsed, or a scroll loop that stopped on its cap, skips step 3 entirely.

Without it, one renamed Substack class turns "I could not read the page" into a
warning on every card on the board. This is the same shape as 2B's "write the
file, then increment the version": order the steps so that a failure leaves a
recoverable state rather than a confident wrong one. Here the recoverable state
is that nothing happened.

## Failure behaviour

| Condition | On screen | Writes |
|-----------|-----------|--------|
| Signed out | "Sign in to Substack, then sync again." | nothing |
| Parsed 0 entries | "Read the Saved list but found no entries. Substack's layout may have changed." | nothing |
| Scroll stopped on the cap | "Synced the first N entries. The list did not finish loading." | steps 1 and 2 only |
| The tab could not be opened or injected | the error, named | nothing |
| Clean run | "12 added, 46 refreshed, 3 no longer saved." | all three steps |

The signed-out case reuses `detectSignedOut()` from `substack/extract.ts`. The
background injects it into the Saved tab as a third injection, exactly as the
toolbar handler already injects it into an article tab; `substack/saved.ts` does
not get its own copy, because two copies of a signed-out heuristic drift apart
and only one of them gets fixed.

**It is checked before the entry count**, so a sign-in wall never reports as a
layout change. Both conditions produce zero entries, and only the order of the
checks tells them apart.

### The report

```ts
interface SyncReport {
  ranAt: string;
  complete: boolean;      // false when the scroll stopped on its cap
  entriesSeen: number;
  added: number;
  refreshed: number;
  warned: number;         // 0 whenever complete is false
  rejected: number;       // entries ingestCard refused, e.g. an unparseable url
  problem?: string;       // set on any of the failure rows above
}
```

`warned` and `complete` are reported together on purpose. "3 no longer saved" and
"the list did not finish loading" appearing in the same message would be a
contradiction, and the type makes it one the compiler can see.

## The backlog import is not a feature

`implementation-plan.md` item 3 is the first run of item 2. On a board with no
cards, every entry is new and `ingestCard` adds it. There is no separate code
path, no first-run flag, and no special UI. "Over the same path" was the
requirement and this is what satisfying it looks like.

The one thing worth checking by hand is the shape of it: 85 cards arriving in To
Read at once, all with today's `savedAt`, because the Saved list carries no
saved-on date. That is honest - the extension learned about all of them today -
and it means `savedAt` orders the backlog arbitrarily within the day.

## Testing

### Automated

`domain/saved.ts`, pure and the richest in edge cases:

- `"Hussain Ibarra∙14 min read"` gives author, 14, `read`
- `"Wyndo and Dheeraj Sharma∙ 1 hr 6 min watch"` gives 66 and `watch`
- an author name containing the separator still parses, because the match is
  anchored at the end
- meta missing entirely gives no minutes and no medium
- an unrecognized medium gives no minutes and no medium, not a guess
- `savedEntryToInput` maps a `SavedEntry` to a `CardInput` plus a medium

`db/sync.ts`, on `fake-indexeddb`, following the `beforeEach` clear and the
`onlyCard()` helper already in `cards.test.ts`:

- a new entry is added to To Read with its metadata
- a known entry refreshes metadata and keeps notes, quotes, and status
- **a Processed card stays Processed** when its article is still saved
- a card seen in an earlier run and absent now gets `syncWarning`
- a card with no `lastSeenInSaved` never gets `syncWarning`
- a warned card that reappears has its warning cleared
- **`complete: false` writes no warnings**
- **zero entries writes nothing at all**

`substack/saved.ts`:

- `extractSavedEntries` against `spike/fixtures/saved-list.html`, read in place
  with `node:fs` the way `extract.test.ts` reads its fixtures. A second copy of
  an anonymized fixture is how anonymized fixtures drift.
- 60 entries, every one with a url, 58 with item meta, and the two `watch`
  entries present
- the file passes the self-contained grep: no imports

`scrollToEnd` gets no unit test. It needs a real lazy-loading page, and a
synthetic one would test the mock.

### Manual checks

A new "Saved sync" section in `extension/MANUAL-CHECKS.md`:

- Sync on a signed-in browser opens the Saved tab, visibly scrolls it, and
  reports counts that match the list.
- The count reported matches the number of entries visible after the scroll.
- Sync twice in a row: the second run reports 0 added and the same number
  refreshed.
- A card moved to Processed stays in Processed across a sync.
- Notes and quotes on a card survive a sync.
- Unsave an article on Substack, sync, and the card carries the warning and has
  not moved.
- Re-save it, sync, and the warning goes.
- Sync signed out in a private window: the sign-in message, and no card is
  warned.
- A podcast entry becomes a card marked as a watch or listen, with its full
  duration.
- The first-run backlog: on an empty board, every saved entry arrives.

## Learning mode

Two `TODO(human)` contributions, both real decisions rather than typing:

1. **`parseItemMeta`** in `domain/saved.ts`. The anchored-at-the-end match, what
   to do with an unrecognized medium, and how much of the leftover string is the
   author.
2. **The missing pass** inside `applySync`. The completeness guard is the whole
   point of it, and writing the guard is how it is understood.

## Task shape

Four tasks, in this order:

1. `domain/saved.ts`: `Medium`, `parseItemMeta`, `savedEntryToInput`, and
   `Card.medium`. Pure, fully tested, nothing else depends on it yet. Carries
   the first `TODO(human)`.
2. `substack/saved.ts`: `SavedEntry`, `extractSavedEntries`, `scrollToEnd`.
   Fixture-tested, self-contained, injected by nobody yet.
3. `db/sync.ts`: `SyncReport` and `applySync`. Carries the second
   `TODO(human)`.
4. The wiring: the `sync-saved` message, the background handler that opens the
   tab and runs both injections, `SyncButton`, and the manual checks.

Tasks 1 to 3 each land tested and unused. Task 4 is the only one whose result
can only be seen in a browser, which is where the manual checks live.

## Amendments to earlier documents

**`implementation-plan.md`, Milestone 3 item 4.** The explicit unsave leaves
this milestone. Milestone 3 is read-only against Substack. Item 4 gets its own
spec if it is wanted, and `spike/README.md`'s three-step popover sequence is what
it will cost.

**`implementation-plan.md`, Milestone 2 item 4.** The Obsidian vault write was
already deferred out of 2B into its own spec. As of 2026-08-31 it is deferred
further, out of v1 entirely, to a future update of the extension.

**`implementation-plan.md`, "Verification".** The manual pre-release checks name
"a failed native unsave". No unsave exists in v1, so that check is not written.

**A card's reading estimate now has two sources.** `domain/article.ts` computes
one from a word count at 250 words a minute; sync takes Substack's own. A card
captured by the toolbar and later synced ends up with Substack's number, because
`mergeCard` prefers a non-null incoming value. This is intended: the developer
sees Substack's number on the site, and disagreeing with it is worse than being
slightly wrong.

**`Card` gains a `medium` field.** The board is no longer only about things that
are read. Nothing else in the data model changes.
