
# Substack Reading Kanban: Implementation Plan

## Problem and workflow

The old workflow had seven steps: save on Substack, add to Todoist, read, take notes, retype notes into Obsidian, go back to like/comment, unsave. The extension absorbs the Todoist entry and the note retyping, and it uses Substack Saved as a capture channel, since phone discovery drives much of real use. The new workflow:

1. **Capture.** On desktop, one click on an article page creates a card in To Read. On the phone, tap Substack's own save button; the next Saved sync pulls it onto the board.
2. **Read.** Open the article from its card and move it to Reading. The article opens on its original Substack page with the companion panel beside it, so likes, comments, and the paid session stay native.
3. **Note.** You collect freeform notes and selected-text quotes with commentary in the panel while you read.
4. **Export.** You export the Markdown with one action: a versioned download by default, or a direct write into a connected Obsidian vault.
5. **Process.** After a successful export, the panel offers the move to Processed. Liking, commenting, and unsaving the original post stay explicit actions on the card.

## Scope

**v1 (this plan):** Chrome/Edge Manifest V3 extension, single user, no accounts, no backend. All data lives in the extension's IndexedDB. Three-column board with search and filters, article companion panel, quote capture, manual Saved sync, one-time backlog import, Markdown export by download or vault write, JSON backup.

**Deferred:**

- Mobile app surfaces, audio, and car/listening workflows ("listened, needs processing" state, voice memo transcription)
- Cloud sync, multi-device state, accounts, collaboration, sharing
- AI summaries or recommendations, automated likes/comments
- Firefox/Safari ports

Rejected: Todoist integration. The board replaces the reading list; syncing two systems is a month-long feature with no payoff.

## Architecture

|Piece|Choice|Why|
|---|---|---|
|Extension shell|Manifest V3 via WXT (or CRXJS)|One installable holds board, capture, and panel|
|UI|React + TypeScript|Board page and side panel share components|
|Drag and drop|dnd-kit|Maintained, accessible|
|Storage|IndexedDB via Dexie, extension origin|Local-first, survives browser restarts|
|Capture|Content script on Substack article pages + toolbar action|Reads metadata and selections from the live DOM, no CORS|
|Saved sync|Parser over the Saved page, manual trigger|Phone-to-desktop capture without a backend|
|Export|Versioned `.md` download (default); File System Access API vault write (optional)|Download works for everyone; vault write removes the last manual step for Obsidian users|

Card creation runs through one plain `ingestCard()` function that owns URL canonicalization and dedup. The toolbar action, the companion panel, Saved sync, and backlog import all call it, so merge rules live in one place.

The export code works within two constraints. The File System Access API works in full-tab extension pages with a user gesture and fails in the service worker, so vault writes stay in the UI layer. The saved directory handle loses write permission between sessions, so the settings page needs a visible "reconnect vault" state.

Saved parsing and panel injection depend on Substack's unversioned, signed-in UI. The Milestone 0 spike picks the most stable read paths, the parser sits behind one module to contain drift, and every DOM-dependent feature fails with a visible message and no data loss (see Reliability).

## Data model

One Dexie table, `cards`:

```ts
interface Card {
  id: string;              // nanoid
  url: string;             // canonical article URL, unique index, dedup key
  title: string;
  author: string;
  publication: string;
  estimatedReadingMinutes?: number;  // word count / 250 at capture; blank when the body is unreadable
  status: 'to_read' | 'reading' | 'processed';
  savedAt: string;         // ISO timestamp
  readAt?: string;
  lastExportedAt?: string;
  exportVersion: number;   // increments per export, drives versioned filenames
  lastSeenInSaved?: string;   // last sync that found this article in Substack Saved
  syncWarning?: string;       // e.g. "missing from Saved since 2026-08-20"
  tags: string[];
  notes: string;           // markdown body
  quotes: Quote[];
  liked: boolean;
  commented: boolean;
  unsavedFromSubstack: boolean;
  sortOrder: number;       // position within column
}

interface Quote {
  text: string;            // always preserved verbatim
  comment?: string;        // your reaction, rendered under the quote
  locator?: string;        // best-effort position in the article
  locatorLost: boolean;    // article changed and the position no longer resolves
  capturedAt: string;
}
```

Dedup on canonical `url`: `ingestCard()` merges an already-known article into its existing card and keeps user-authored notes. Substack Saved is an import source; the extension's records are the authority, and sync never deletes them.

## Board

Three columns: **To Read**, **Reading**, **Processed**. Cards show title, publication, author, estimated reading time, saved date, and note/export status. Search plus filters on publication, saved date, and reading time. The reading-time filter is the main triage tool: filter to under twenty minutes and read what fits the time you have.

## Capture and sync

- **Desktop capture:** the toolbar button or panel action creates the card and invokes Substack's native Save when possible, so the phone and desktop lists agree.
- **Phone capture:** Substack's own save button; the next sync picks it up.
- **Sync Saved:** a manual button in v1. It imports new saves into To Read and refreshes metadata on known cards. Sync sets `syncWarning` on an article that has gone missing from Saved; the card, notes, and export history stay intact.
- **Backlog import:** a first-run flow walks the existing Saved list into To Read through the same parser and `ingestCard()` path, so it ships with sync at no extra cost.
- **Unsave:** an explicit per-card action. No move, export, or sync triggers it.

## Notes and quotes

The extension injects the companion panel beside supported Substack article pages. You add standalone notes or select text and save it as a quote with optional commentary. Quotes store a best-effort locator; when the panel can't resolve it on a later visit (edited or truncated article), the verbatim text survives with a "location unavailable" label.

## Export format

Default export downloads a Markdown file, and the user files it wherever they like; this path assumes nothing about Obsidian. Filename is date-first with the title, versioned on re-export: `2026-08-16 - How Great Questions Change a Company (v2).md`. Re-exports never overwrite a previous file.

Optional vault export writes the same file into a folder you connect once in settings via the File System Access API.

```markdown
---
title: "Article Title"
author: "Author Name"
publication: "Publication Name"
url: https://example.substack.com/p/article-slug
saved: 2026-08-16
read: 2026-08-18
tags: [substack, reading]
---

> First captured quote text.

My reaction to that quote.

> Second captured quote.

## Notes

Freeform notes body from the card.
```

Frontmatter keys stay flat and lowercase so Obsidian's Properties view and Dataview queries pick them up without configuration; any other Markdown tool opens the same file without complaint.

## Build sequence

**Milestone 0, before product code, two cheap probes:**

1. **Compatibility spike.** Catalog the supported desktop pages and find the most stable way to read Saved entries, article metadata, and the native Save/Unsave controls. Output: a short doc naming the selectors and read paths v1 relies on, and captured anonymized page fixtures for tests.
2. **Throwaway board prototype.** Columns, cards, notes panel, markdown preview, to settle layout before real code.

**Milestone 1: extension scaffold and board**

1. WXT project, MV3 manifest, board as a full-tab extension page off the toolbar button
2. Dexie schema, three columns with drag and drop, `sortOrder` persistence
3. Card detail: metadata, notes editor, quotes list, liked/commented/unsaved flags, delete
4. Manual "add by URL" form as the capture stopgap
5. JSON backup and restore of the whole board

**Milestone 2: the reading loop**

1. Content script on article pages: metadata read, shared `ingestCard()` capture, native Save invocation
2. Companion side panel: notes, selection-to-quote with commentary, status controls
3. Markdown serialization, versioned download export
4. Vault connection in settings, direct write path, reconnect state
5. Offer the move to Processed after a successful export

**Milestone 3: sync**

1. Saved-list parser behind its own module, fixture-tested
2. Manual Sync Saved: import new, refresh known, flag missing
3. First-run backlog import over the same path
4. Explicit unsave action with real-completion-state reporting

## Reliability

Substack's UI and signed-in behavior can change under the extension, so integration failures must be visible and non-destructive:

- Signed out: prompt the user to sign in to Substack.
- Saved page or article structure unreadable: keep all local data, show a retryable explanation.
- Native Save/Unsave fails: leave the card unchanged and show the actual completion state.
- Source article changed: preserve quote text, label the lost location.
- Silent failure is banned throughout; export and sync always surface a visible state.

## Verification

- Unit tests: status transitions, URL canonicalization and dedup, metadata merge rules, Markdown serialization, versioned filename generation.
- Fixture tests: Saved-list and article-page parsing against the captured anonymized structures from the Milestone 0 spike.
- Manual pre-release checks: signed-in capture, Saved sync, paid and free article states, a deliberately changed source, a failed native unsave.

## Risks

- **Substack UI drift.** The spike, the isolated parser module, fixtures, and visible failure states contain it; when parsing breaks, capture by URL still works and the extension deletes nothing.
- **Reading-time estimates on paywalled or truncated pages.** The field stays blank when only a preview is readable.
- **Missing or renamed OG tags.** Fallback chain from day one: og tags, then `document.title`, then hand-edit.
- **Vault permission decay.** The reconnect state covers it, and the download path stays available as the fallback.

## Success criteria

Two weeks of real use, then judge:

- Cards flow across the board instead of piling up in To Read
- The Todoist reading list goes quiet
- Articles saved on the phone appear on the board after a sync
- Notes reach the vault or Downloads without retyping
- The reading-time filter gets real use for "what fits right now" decisions

If To Read turns into a second graveyard, the problem is triage; build prioritization next (reading-time sort, pinning, aging indicators, a weekly review prompt) before polishing capture.