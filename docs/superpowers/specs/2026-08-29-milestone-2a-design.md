# Milestone 2A design: capture and the companion panel

**Date:** 2026-08-29
**Status:** Approved. Next step is the implementation plan.
**Parent spec:** `implementation-plan.md`, section "Build sequence", Milestone 2,
items 1 and 2.
**Inputs:** `spike/README.md` (the Substack read paths and their traps),
`docs/superpowers/specs/2026-08-26-milestone-1-design.md` (the layer rules this
milestone extends), `prototype/DECISIONS.md` (panel section order).

## Goal

Close the first half of the reading loop. At the end of this milestone, clicking
the toolbar button on a Substack article creates or refreshes a card, opens a
companion panel beside the article, and lets the reader take notes and capture
selected text as quotes without leaving the page.

Milestone 2A writes no Markdown and touches no filesystem. It also invokes no
Substack control: the injected code only reads.

## Scope: why Milestone 2 is split

`implementation-plan.md` lists five items under Milestone 2. Items 3, 4, and 5
(Markdown serialization, versioned download, vault write, and the offer to move
to Processed) do not need the article page. They can hang off the board's
existing detail panel and ship on their own.

The split follows the failure mode, not the feature list:

- **2A fails externally.** Substack renames a class and the parser dies. Its
  evidence is fixtures and visible failure states.
- **2B fails internally.** A serializer has a bug, or a directory handle loses
  permission. Its evidence is pure unit tests.

One spec covering both would mix the two testing strategies, and would let a
stall on Substack's DOM block work that has nothing to do with Substack.

2A ships first because the panel is where the notes get typed, and 2B's export
has more to export once it exists.

## Definition of done

Milestone 2A is the first milestone the developer adopts for real reading.
Milestone 1 was tested scaffolding; this one gets used daily. Two consequences:

1. Data written from here on is real. The Dexie schema still needs no new
   version, because `domain/types.ts` already declares `quotes`, `readAt`, and
   every other field this milestone fills. Declaring the whole `Card` shape in
   Milestone 1 is what buys that.
2. Failure states are not decoration. A reader who loses a captured quote to a
   silent error stops trusting the tool, so every row in the failure table ends
   in a visible message and no data loss.

## Decisions

### The panel is a Chrome side panel, not an injected iframe

The companion panel is a `sidepanel` entrypoint. Chrome renders it in its own
docked pane at the `chrome-extension://` origin, so it reaches the same Dexie and
the same `useLiveQuery` as the board, with no bridge.

**This supersedes the Milestone 1 design.** That document committed to an iframe
injected by the content script and listed in `web_accessible_resources`. Its
reasoning was that the iframe runs at the extension origin and therefore reaches
Dexie directly. `chrome.sidePanel` satisfies that requirement and adds one the
iframe cannot: it never modifies Substack's DOM.

**Why that matters more than it first appears.** An injected iframe has to shrink
Substack's own container to make room for itself. The extension becomes a
co-tenant in a layout it does not control and cannot version. Every Substack
layout change is then a chance to break the panel, on top of the parser drift the
spike already documented. The side panel has no such exposure. Chrome owns the
pane, and Substack cannot reach it.

**Costs, accepted.** `sidePanel.open()` requires a user gesture, so the panel
opens on a toolbar click rather than automatically on page load. The panel is
Chrome and Edge only, which is already the stated v1 scope.

**Rejected: the injected iframe.** Portable to Firefox later, and physically
adjacent to the article text. Neither benefit is claimed in v1, and the second is
paid for with permanent tenancy in someone else's layout.

**Note for a future Firefox port.** The panel is one React tree mounted by an
entrypoint. Mounting that same tree inside an iframe later is a change to one
file. The decision is reversible.

### Injection is `activeTab`, not a declarative content script

The extension declares no content script and no host permissions. On a toolbar
click, the background service worker calls `scripting.executeScript` against the
active tab, which the `activeTab` grant has just authorized.

Permissions in 2A: `storage`, `sidePanel`, `activeTab`, `scripting`.

**Why.** `spike/README.md` found that 2 of 60 saved entries live on custom
domains (`theworkthatholds.com`, `freyaindia.co.uk`). Custom Substack domains
cannot be enumerated in a manifest. A declarative script matched on
`*://*.substack.com/*` is structurally blind to those publications and fails
silently on them. `activeTab` grants access to whichever tab the reader gestured
at, whatever its host, so custom domains work with no extra permission.

The grant is per-click and sticky for that tab until it navigates. One click
therefore covers a whole reading session, including repeated selection reads,
without re-asking.

**Rejected: declarative content script on `*://*.substack.com/*`.** It would
allow an always-on in-page indicator. It cannot see custom-domain publications,
which is the exact case the spike found and flagged.

**Rejected: declarative content script on `<all_urls>`.** It covers custom
domains at the price of the broadest permission Chrome grants, and code running
on every page the reader ever loads, to serve a handful of articles.

### Native Save is deferred to Milestone 3

The 2A injected code reads and never clicks. `unsavedFromSubstack` stays the
manual checkbox Milestone 1 shipped.

**This amends `implementation-plan.md`,** which places native Save invocation in
Milestone 2 item 1.

**Why.** Three reasons compound.

First, the value is not realizable yet. Native Save exists "so the phone and
desktop lists agree", but nothing in the extension reads Substack's Saved list
until Milestone 3. In 2A a successful save writes into a list no code looks at.

Second, the risky half cannot be tested. All three fixtures were captured on page
load, and the Save control does not exist in the DOM until the reader opens a
Radix popover. The trigger is fixture-testable; the menu item is not.

Third, Save and Unsave are one mechanism with one trap. `spike/README.md`:

> **The Save label is inverted.** It reads `Save` when the article is not saved
> and `Unsave` when it is, because the text names the action rather than the
> state. Code that maps `"Save"` to saved is backwards and throws nothing.

Milestone 3 has to build that driver for Unsave regardless. Building it in 2A
means writing it twice, or front-loading Milestone 3's hardest work into a
milestone that already carries injection, a side panel, and quote capture.

**A side benefit, and the reason this is more than scheduling.** It keeps 2A
read-only against Substack. Code that only reads cannot corrupt anything on
Substack's side, so "did the extension just unsave the wrong article?" is not yet
a bug class that exists.

**Cost, accepted.** Between 2A and Milestone 3, an article captured on the
desktop is not in Substack Saved, so the two lists diverge for that window.

### Quote locators are prefix-anchored text searches

`Quote.locator` holds roughly 40 characters of article text immediately preceding
the quote. Resolution searches the live article's text for the quote's own
`text`:

- exactly one match: resolved, at that offset
- several matches: the prefix picks the right one
- zero matches: `locatorLost = true`

The quote text does most of the work, so the locator stays small and resolution
is one pure function over two strings.

**Why this shape.** It never depends on document structure, so it survives
Substack re-rendering its markup, re-ordering sections, or inserting paragraphs.
It fails exactly when it should: the author edited that sentence.

**Rejected: paragraph index plus offset.** Trivial to compute. One inserted
paragraph above silently shifts every locator in the article, and it then reports
success while pointing at the wrong text. That is silent wrongness, which is
worse than the clean `locatorLost` the field exists to produce.

**Rejected: a W3C text fragment URL.** Zero resolution code, because Chrome
scrolls and highlights natively. But nothing can tell whether it resolved before
navigating, so `locatorLost` could never be set, and the "location unavailable"
label the parent spec requires becomes unimplementable. Worth generating anyway
in 2B's Markdown export, where navigation is the point.

**Out of scope: jump to quote.** Scrolling the article to a resolved quote is a
small addition on top of this design. The parent spec never asks for it.

### `isPreview` reads JSON-LD, not the paywall class

`isAccessibleForFree` from JSON-LD is the primary path. `.paywall`, then
`[class*="paywall"]`, are fallbacks.

**This closes the question carried forward from Milestone 1,** where
`spike/extract.js` and `spike/README.md` disagreed. The spike's own reasoning
settles it: the page states its own access level in JSON-LD, so it does not break
when Substack renames a class. The class is a guess about the page; the field is
the page's statement about itself.

`spike/extract.js` is not corrected. The spike is finished and frozen.
`substack/extract.ts` is the code that ships.

**What follows.** When `isAccessibleForFree` is `false`,
`estimatedReadingMinutes` is left `undefined`, per the parent spec's "The field
stays blank when only a preview is readable." Word count cannot substitute: the
paywalled fixture's preview is 684 words, above the 500-word floor a naive
heuristic would use, so "short body means paywalled" is wrong in both directions.

`mergeCard` already refreshes that field with
`incoming.estimatedReadingMinutes ?? existing.estimatedReadingMinutes`, so
re-capturing an article on a day the paywall hides its length leaves an existing
estimate intact rather than blanking it.

### One shared `CardEditor`, composed by both panels

The board's detail panel and the reading panel render one shared component with a
footer slot, rather than being written separately.

```ts
interface Props {
  card: Card;
  footer?: ReactNode;
}
```

`CardEditor` renders the section order `prototype/DECISIONS.md` fixes (title,
meta, notes, quotes), then the footer. Because quotes are last in that order, the
footer lands directly beneath the quote list, which is where both callers want
their extra controls.

| Caller | Footer |
|---|---|
| `DetailPanel.tsx` (board) | Liked, Commented, Unsaved checkboxes; Delete |
| `ReadingPanel.tsx` (sidepanel) | Capture quote; three status buttons |

**One prop and one slot, deliberately.** A shared component configured by a row
of booleans (`showDelete`, `showFlags`, `quotesEditable`) is a component whose
behaviour space multiplies with each flag, in the one layer of this codebase that
has no tests. A slot is composition and adds no behaviour at all.

**Consequence: quote comments become editable on the board too.** Milestone 1
shipped the board's quote list read-only. There is no real reason a reader should
not annotate a quote during triage, it is the same debounced write, and allowing
it removes the last configuration prop `CardEditor` would have carried. This is a
small deliberate addition to Milestone 1 behaviour.

**Rejected: no sharing.** Fastest to write, but the notes debounce logic gets
copied, and a bug fixed in one panel then silently persists in the other.

### The panel follows clicks, not tab focus

One key in `browser.storage.session`, written by the background on each toolbar
click, read by the panel with a change listener. No per-tab bookkeeping, no
`tabs` permission, no `tabs.query` from inside the panel.

**Consequence, stated so it is not later read as a bug.** Switching to a
different article tab without clicking the toolbar leaves the panel showing the
previous article. This is defensible as well as cheap: the panel follows
deliberate action rather than passive focus. Whether it is right is a question
only real use answers.

## Architecture

### Layout

```
extension/src/
  domain/                      # PURE. No DOM, no Dexie, no React.
    article.ts        NEW      # readingMinutes(), isReadable()
    quote.ts          NEW      # createQuote(), resolveQuote()
    url.ts            EDIT     # + shouldCaptureFrom()
  substack/           NEW DIR  # the ONLY code that knows Substack's DOM
    selectors.ts               # every selector, sourced to spike/README.md
    extract.ts                 # the injected functions
  db/
    cards.ts          EDIT     # + cardByArticleKey(), addQuote(), updateQuote()
  ui/
    CardEditor.tsx    NEW      # shared core + footer slot
    ReadingPanel.tsx  NEW      # sidepanel tree
    DetailPanel.tsx   EDIT     # becomes CardEditor + a board footer
  entrypoints/
    background.ts     EDIT     # the click router
    sidepanel/        NEW      # index.html + main.tsx
```

### Dependency rule

The Milestone 1 table gains one row.

| Layer | May import | Must never import |
|---|---|---|
| `domain/` | nothing in this project | `db/`, `ui/`, `substack/`, `dexie`, `react` |
| `substack/` | **nothing in this project** | everything |
| `db/cards.ts` | `domain/`, `db/schema.ts` | `ui/`, `substack/` |
| `ui/` | `db/cards.ts`, `domain/` | `db/schema.ts`, `dexie`, `substack/` |
| `entrypoints/` | `ui/`, `db/cards.ts`, `domain/`, `substack/` | `db/schema.ts` |

`substack/` may import nothing, and the reason is mechanical rather than
stylistic. `scripting.executeScript` serializes the function and ships it into
the page, so it cannot close over imports. A module that imports a helper
compiles, passes type-checking, and then fails at runtime with a bare
`ReferenceError` inside someone else's document. Making it a rule in the table
turns a runtime trap into a review-time one.

`entrypoints/background.ts` grows. It may now read `domain/url.ts`, call
`db/cards.ts`, and hand `substack/extract.ts` to `executeScript`. It remains the
only module that talks to browser APIs beyond storage.

### The click, end to end

```
toolbar click
  |- background.ts
       |- shouldCaptureFrom(tab.url)?
       |    no  -> open or focus the board tab      (Milestone 1 behaviour)
       |    yes v
       |- scripting.executeScript(tabId, extractArticleMeta)   <- activeTab grant
       |- ingestCard({ url, title, author, publication, estimatedReadingMinutes })
       |- storage.session.set({ panel: { articleKey, tabId, outcome, bodyText } })
       |- sidePanel.open({ windowId })              <- the click is the gesture
             |- ReadingPanel reads storage.session, then
                useLiveQuery(cardByArticleKey) for everything after that
```

`shouldCaptureFrom` is a pure function over the URL. The article-shape test
already exists and is already tested: `articleKey()` in `domain/url.ts` returns a
`publication/p/slug` shape for article URLs and falls through to the canonical URL
for everything else.

A false positive costs nothing. A non-Substack page with a `/p/` path gets
injected, yields no Substack metadata, and reports "couldn't read this page as a
Substack article". Visible, non-destructive, and recoverable through the
add-by-URL form.

### Capturing a selection

The selection lives in Substack's document. The panel is a different document.

```
reader selects text, clicks "Capture quote" in the panel
  |- panel -> runtime.sendMessage({ type: 'capture-selection' })
       |- background -> scripting.executeScript(rememberedTabId, readSelection)
            |- returns { text, prefix }        prefix = ~40 chars preceding
       |- background -> replies to the panel
  |- panel -> createQuote(...) -> cardsRepo.addQuote(cardId, quote)
       |- useLiveQuery re-renders
```

Clicking inside the side panel does not clear the article's selection, because
focus moves between documents rather than within one.

**This is the extension's only message passing.** One message type and its reply.
Everything else in the panel reads and writes Dexie directly through
`db/cards.ts`, exactly as the board does. That property is what the side panel
decision bought, and it is worth defending: the moment a second data path opens,
`useLiveQuery` stops being the single source of truth for the UI.

The article body text rides in `storage.session` from the initial extraction
rather than being fetched again, because `extract.ts` already reads
`.body.markup` to count words.

## Substack read paths

`substack/selectors.ts` holds every selector in one file, each with a comment
naming its source row in `spike/README.md`. When Substack drifts, one file
changes.

| Field | Primary | Fallback | Then |
|---|---|---|---|
| title | `og:title` | JSON-LD `headline` | `document.title` |
| author | `meta[name="author"]` | JSON-LD `author[0].name` | blank |
| publication | JSON-LD `publisher.name` | BreadcrumbList `itemListElement[0].name` | `publicationFromHost()` |
| canonical url | `link[rel="canonical"]` | `og:url` | the tab's own URL |
| word count | `.body.markup` | `.available-content` | none |
| readable | JSON-LD `isAccessibleForFree` | `.paywall` | assume readable |

Three rules, each one a trap the spike paid to find:

- **JSON-LD `author` is an array.** `ld.author.name` returns `undefined` and
  throws nothing. Read `author[0].name`.
- **`og:site_name` does not exist on a Substack post.** Publication has no OG
  source at all. It is JSON-LD, the breadcrumb, or the host.
- **Never fall back to `article` for word count.** It over-counts by 41 words on
  the free fixture, because it swallows the title and both UFI bars.

## The panel

### Contents

`ReadingPanel` composes `CardEditor` and adds a footer. `CardEditor` renders
title, meta, notes, and quotes, in that order, per `prototype/DECISIONS.md`.

The notes textarea keeps Milestone 1's roughly 300ms debounce, moved into
`CardEditor` so it exists once.

### Width

`prototype/DECISIONS.md` fixes the panel at 380px. That constraint binds the
board's `DetailPanel` and still does. It does not bind the sidepanel: Chrome owns
that width and the reader drags it. `ReadingPanel` is fluid, with a `min-width`
guard so the quote list does not collapse when the pane is narrowed. Recorded so
the constraint is not later read as violated.

### Quote resolution

Two pure functions in `domain/quote.ts`:

```ts
createQuote(input: { text: string; prefix: string }, deps: { capturedAt: string }): Quote
resolveQuote(articleText: string, quote: Quote): number | null
```

Resolution runs on panel mount and after each capture. The result is written back
to the stored `Quote.locatorLost` rather than recomputed on every render.

**Why persist rather than derive.** The board has no article text. `DetailPanel`
can never resolve anything, so if the flag were derived, the board could never
show the "location unavailable" label it already renders today.

### Status controls

Three buttons (To Read, Reading, Processed) with the current status disabled.
Each calls existing code:

```ts
const changes = reorderCards(cards, { cardId, toStatus, toIndex: 0 }, now);
await applyOrder(changes);
```

`toIndex: 0` puts the card at the top of the target column, which is the right
place for the article being read right now. `readAt` stamping comes free:
`reorderCards` already stamps it on first entry into `reading` and never
overwrites it.

`reorderCards` renumbers whole columns, so it needs every card, not just this
one. `ReadingPanel` therefore runs a second `useLiveQuery(allCards)` alongside
its `cardByArticleKey` read. Both are live, so a status change made on the board
in another tab reaches the panel without a refresh.

No new domain function and no new repository function. The panel is the fourth
caller of an interface that already had three.

**Not in 2A:** the offer to move to Processed after a successful export. It is
triggered by an export that does not exist yet.

## Failure behaviour

| Situation | What happens | What the reader sees |
|---|---|---|
| URL is not article-shaped | Board opens. Not a failure. | The board. |
| Injection blocked (`chrome://`, PDF viewer, store page) | No capture, no panel. | "Can't read this page." |
| Article-shaped, extraction found no title | Card created from the URL alone. | "Couldn't read this page's details. Card created from the URL - edit the title below." |
| Signed out | Capture proceeds normally. | "You're signed out of Substack. Notes and capture work; likes and saves won't." |
| Article is paywalled | Card created, reading estimate blank. | "Preview only - reading time unavailable." |
| Already on the board | `ingestCard` returns `updated`. | "Already on your board. Metadata refreshed." |
| Capture quote with nothing selected | No write. | "Select some text in the article first." |
| Quote text no longer in the article | `locatorLost = true`, text preserved verbatim. | The existing "(location unavailable)" label. |

The signed-out row reverses the obvious design deliberately.
`implementation-plan.md` says "Signed out: prompt the user to sign in to
Substack". The spike then found that title, author, publication, and canonical
URL all read without a session, and concluded that signed-out is not a capture
blocker. Only the native controls need a session, and 2A invokes none. The prompt
therefore becomes a note rather than a gate.

## Testing

| Module | Tests |
|---|---|
| `domain/quote.ts` | `resolveQuote`: exact match; whitespace-normalized match; zero matches returns `null`; several matches disambiguated by prefix; several matches where the prefix also moved; a quote spanning a paragraph break |
| `domain/article.ts` | `readingMinutes`: word count divided by 250 and its rounding rule; returns `undefined` when the article is not readable |
| `domain/url.ts` | `shouldCaptureFrom`: article URLs on `*.substack.com`, on a custom domain, and on the `open.substack.com/pub/...` share route; the board's own `chrome-extension://` URL; a `chrome://` page; garbage |
| `substack/extract.ts` | Against all three fixtures via `linkedom`: every field on the free article; the same fields on the paywalled one; `isAccessibleForFree` true and false; JSON-LD `author` read as an array; publication falling through to the host when JSON-LD is absent |
| `db/cards.ts` | `cardByArticleKey` hit and miss; `addQuote` appends without disturbing existing quotes; `updateQuote` writes a comment and flips `locatorLost` |
| `ui/` | None, by design. `MANUAL-CHECKS.md` gains a "Reading panel" section. |

One new devDependency: `linkedom`, already proven in `spike/`.

Extension tests read `../spike/fixtures/*.html` directly. The Milestone 1 rule
"No project imports from another" is about module-graph coupling, and a
`readFileSync` of test data is not a module edge.

**Rejected: copying the fixtures into `extension/`.** Three large HTML files in
two places drift, and the copy that drifts is the one nobody re-anonymizes.

Two standing constraints on every test written here, both from the spike's risk
list:

- **The fixtures are anonymized and not byte-faithful.** Query strings are
  stripped, `data-attrs` removed, digit runs of six or more zeroed. Never assert
  on a query parameter or a numeric profile id.
- **Count fixture elements with the DOM parser, never with `grep -c`.** The page
  ships its `<head>` on one line; `grep` reported one JSON-LD block where
  `querySelectorAll` finds two.

### Manual checks

Two additions matter more than the rest, because they are the only evidence
available for things no test can reach.

- **A custom-domain publication.** The spike proved custom domains work for the
  Saved-list link and explicitly left article metadata untested.
  `theworkthatholds.com` is reachable. If it fails, the remedy is a fourth
  fixture, and that is a known contingency rather than a surprise.
- **Signed out, in a private window.** The whole signed-out design rests on one
  console check from 2026-08-24 with no fixture behind it.

## Learning mode

Three `TODO(human)` contributions, one open at a time, matching the Milestone 1
rhythm. Each is a pure function of roughly ten lines with a real decision inside
it.

- `shouldCaptureFrom(url)`: what counts as an article, and what the board wins.
- `readingMinutes(wordCount, readable)`: the rounding rule, and the floor.
- `resolveQuote(articleText, quote)`: the substantial one. Whether to normalize
  whitespace before comparing; what several matches mean when the prefix has
  moved too; whether a match at a different offset is the same quote or a
  coincidence.

## Task shape

Eight tasks, each ending in a commit.

1. Sidepanel entrypoint; permissions `sidePanel`, `activeTab`, `scripting`;
   toolbar click routes article against board. TODO(human): `shouldCaptureFrom`
2. `substack/selectors.ts` and `substack/extract.ts`, fixture-tested with
   `linkedom`
3. `domain/article.ts`. TODO(human): `readingMinutes`
4. Wire the click: `executeScript`, `ingestCard`, session storage, and the panel
   showing the card with its capture outcome
5. Extract `CardEditor`; refactor `DetailPanel` onto it; quote comments become
   editable
6. `ReadingPanel` composing `CardEditor` with the status-button footer
7. `domain/quote.ts`, the capture-selection message path, and `addQuote`.
   TODO(human): `resolveQuote`
8. Failure states, `MANUAL-CHECKS.md` additions, wrap-up

## Amendments to earlier documents

This spec contradicts three earlier decisions. They are listed here so a future
reader who finds the contradiction knows which document is authoritative.

| Document | Said | Now |
|---|---|---|
| Milestone 1 design, "Data access" | The Milestone 2 panel is an iframe injected into the article and listed in `web_accessible_resources` | `chrome.sidePanel`. Same extension origin and same direct Dexie access, with no tenancy in Substack's layout. |
| `implementation-plan.md`, "Build sequence", M2 item 1 | Milestone 2 invokes Substack's native Save | Deferred to Milestone 3, where Unsave already lives and the Saved-list parser can verify that a save landed. |
| `implementation-plan.md`, "Reliability" | "Signed out: prompt the user to sign in to Substack" | Capture proceeds; the prompt becomes a note. Metadata reads without a session, and 2A invokes no native control. |

One question is **closed** rather than amended: `isPreview` reads JSON-LD
`isAccessibleForFree` first and `.paywall` second. Milestone 1 carried it forward
explicitly for this milestone to answer.

## Open questions carried forward

None block Milestone 2A.

- The Markdown preview toggle from `prototype/DECISIONS.md` stays unimplemented
  until 2B adds serialization.
- Native Save, Unsave, and reading `unsavedFromSubstack` from the page all land
  in Milestone 3 together, sharing one popover driver and one test for the
  inverted label.
- The panel follows deliberate clicks rather than tab focus. Revisit after two
  weeks of real use, per the parent spec's success criteria.
- Custom-domain article metadata has no fixture. Milestone 2A's manual pass is
  the first real check, and a fourth fixture is the remedy if it fails.
