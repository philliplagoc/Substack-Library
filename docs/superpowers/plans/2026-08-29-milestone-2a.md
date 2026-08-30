# Milestone 2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking the toolbar button on a Substack article creates or refreshes a card, opens a companion side panel, and lets the reader take notes and capture selected text as quotes without leaving the page.

**Architecture:** A Chrome side panel entrypoint runs at the `chrome-extension://` origin, so it reads and writes Dexie directly through `db/cards.ts` with `useLiveQuery`, exactly as the board does. The background service worker is the only piece that touches the Substack page: on a toolbar click it uses the `activeTab` grant to run a self-contained extractor via `scripting.executeScript`, feeds the result to the existing `ingestCard()`, records what happened in `browser.storage.session`, and opens the panel. One message type, `capture-selection`, carries a text selection from the page back to the panel.

**Tech Stack:** WXT 0.21, React 19, TypeScript 5.9, Dexie 4, Vitest 4, `fake-indexeddb`, `linkedom` (new).

**Spec:** `docs/superpowers/specs/2026-08-29-milestone-2a-design.md`

## Global Constraints

- **Run `npm run compile` beside `npm run build`.** Vite strips types without reading them, so a green build says nothing about types. Both must be clean before any commit.
- **Version pins are load-bearing.** TypeScript `~5.9.3` (below 7), Vite `^7.3.6` (below 8), and the `overrides` entry holding `@vitejs/plugin-react` at `^5.0.0`. Do not upgrade any of them. Version 6 of the plugin peer-requires Vite `^8` and imports `vite/internal`, a subpath Vite 7 does not export.
- **`noUncheckedIndexedAccess: true`** is set by WXT's generated tsconfig. Every array index read is `T | undefined`. Narrow it once with a helper rather than at each assertion; `src/db/cards.test.ts` has the `onlyCard()` pattern to copy.
- **`noImplicitOverride: true`** is also set. Any class member React's `Component` already declares needs an `override` modifier.
- **The dependency rule**, extended from the Milestone 1 design:

  | Layer          | May import                                   | Must never import                           |
  | -------------- | -------------------------------------------- | ------------------------------------------- |
  | `domain/`      | nothing in this project                      | `db/`, `ui/`, `substack/`, `dexie`, `react` |
  | `substack/`    | **nothing in this project**                  | everything                                  |
  | `db/cards.ts`  | `domain/`, `db/schema.ts`                    | `ui/`, `substack/`                          |
  | `ui/`          | `db/cards.ts`, `domain/`                     | `db/schema.ts`, `dexie`, `substack/`        |
  | `entrypoints/` | `ui/`, `db/cards.ts`, `domain/`, `substack/` | `db/schema.ts`                              |

- **The spike fixtures are anonymized and not byte-faithful.** Query strings are stripped, `data-attrs` removed, and digit runs of six or more zeroed. Never assert on a query parameter or a numeric profile id.
- **Silent failure is banned.** Every failure path ends in a message the reader can see and loses no data.
- **`domain/` stays pure and deterministic.** No `nanoid()`, no `Date.now()`, no `crypto`. A function needing an id or a timestamp takes it as an argument.

---

## Corrections to the design doc

Three things the spec got slightly wrong. Implement what this plan says.

**1. `substack/selectors.ts` does not exist as a separate file.** The spec put every selector in its own module. `scripting.executeScript` serializes the injected function with `Function.prototype.toString()`, so the function cannot close over an imported `SELECTORS` const — it would compile, type-check, and then throw a bare `ReferenceError` inside Substack's document. The selectors live in a `const SELECTORS` block at the top of the injected function's body, in `substack/extract.ts`. One file still holds every selector, which was the point.

**2. The publication host fallback runs in the caller, not the extractor.** The spec's read-path table lists `publicationFromHost()` as publication's last fallback. That function lives in `domain/url.ts`, and `substack/` may import nothing. So `extract.ts` returns `publication: null` when JSON-LD and the breadcrumb both miss, and `background.ts` — which may import `domain/` — applies the host fallback. `publicationFromHost` gets exported for this.

**3. Tasks 4, 5, and 6 are reordered.** The spec listed the click wiring before the panel it opens. Building it that way means writing a throwaway panel in one task and replacing its body two tasks later. This plan builds `CardEditor`, then `ReadingPanel`, then wires the click into the panel that already exists. Same eight tasks, same deliverables, no rework.

**4. The inbox reader route is a fourth capture shape, and it breaks the head-first assumption.** Added 2026-08-30, after `https://substack.com/inbox/post/213391431` opened the board instead of the panel. Neither the spec nor the spike covered `substack.com/inbox/post/<id>`, the route the Substack app serves when a reader opens a post from their inbox. Measured on a live page:

| Read path                         | What it returns on the reader route           |
| --------------------------------- | --------------------------------------------- |
| `link[rel="canonical"]`           | `https://substack.com/inbox`                  |
| `og:title`                        | the shell's title, not the post's             |
| `application/ld+json`             | no blocks at all                              |
| `document.title`                  | `<post title> - by <handle>`                  |
| `.body.markup`                    | present, exactly one, and it is the open post |
| `a[href*="/p/"]` (whole document) | 8 links, all to *other* publications          |

The server renders a shell for `/inbox` and the browser draws the post into it afterwards, so `<head>` describes a different page than `<body>` does. Every head-first read path in `extract.ts` returns a wrong answer, and returns it without a null to signal the miss. `og:title` is the dangerous one: it is non-empty, so the "couldn't read this page's details" notice never fires.

Two things make the route capturable anyway. `.body.markup` is present and unique, so word count, `bodyText`, and Task 7's quote capture need no change. And walking up from `.body.markup` to the nearest `/p/` anchor yields the article's own URL, whose text is the post title:

```
https://improvebypathsofstoicism.substack.com/p/be-delusional-about-what-you-can
```

`articleKey()` already reduces that to `improvebypathsofstoicism/p/be-delusional-about-what-you-can`, the same key the article gets on its own domain. So one article read from both places stays one card, which is the property `cardByArticleKey` depends on.

The unscoped selector must not be used. `a[href*="/p/"]` across the document returns the inbox list, which is still mounted behind the post, and every one of those hrefs carries `source=%2Finbox%2Fpost%2F213391431` — the *current* post id stamped onto links pointing away from it. Scoping the walk to `.body.markup`'s ancestors is what makes the answer unambiguous, the same technique `detectSignedOut` uses to disambiguate a class the Subscribe button shares.

Task 6 absorbs this. `shouldCaptureFrom` gains the route, `domain/url.ts` gains `isReaderRoute()`, `substack/extract.ts` gains `readReaderArticle()`, and `capture()` prefers the reader result over `meta.canonicalUrl` for both url and title.

**Amended 2026-08-30, after Task 7.** There are two of these shells, not one. `substack.com/home/post/p-175437103` is the home feed's reader, found by hand when the toolbar button opened the board on it. It differs twice over: the path segment is `/home` rather than `/inbox`, and the id carries a `p-` prefix the inbox's bare `213391431` does not. `isReaderRoute` now matches `/(inbox|home)/post/(p-)?<digits>`. The id was NOT loosened to any segment, because `/inbox/post/settings` is a settings page and injecting there finds no article. Whether the home shell renders the same body as the inbox shell is unmeasured; `readReaderArticle` returns null when `.body.markup` or the ancestor `/p/` anchor is missing, and `capture()` turns that into a visible refusal, so a wrong guess costs a message rather than a bad card.

---

## File structure

| File                                            | Responsibility                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/domain/url.ts` (modify)                    | add `shouldCaptureFrom()`, `isReaderRoute()`; export `publicationFromHost()`      |
| `src/domain/article.ts` (create)                | `readingMinutes()` — turn a word count into an estimate, or nothing               |
| `src/domain/quote.ts` (create)                  | `createQuote()`, `resolveQuote()` — build a quote, find it again later            |
| `src/messages.ts` (create)                      | the message and session-state types both sides share. Types only, no runtime code |
| `src/substack/extract.ts` (create)              | the self-contained injected functions and every Substack selector                 |
| `src/db/cards.ts` (modify)                      | add `cardByArticleKey()`, `addQuote()`, `updateQuote()`                           |
| `src/ui/CardEditor.tsx` (create)                | shared panel core: title, meta, notes, quotes, then a footer slot                 |
| `src/ui/DetailPanel.tsx` (modify)               | `CardEditor` plus the board's footer (flags, delete)                              |
| `src/ui/ReadingPanel.tsx` (create)              | `CardEditor` plus the reading footer (capture, status), and the notices           |
| `src/entrypoints/sidepanel/index.html` (create) | side panel document                                                               |
| `src/entrypoints/sidepanel/main.tsx` (create)   | React root for the panel                                                          |
| `src/entrypoints/background.ts` (modify)        | the click router, extraction, ingest, session state, panel open                   |
| `wxt.config.ts` (modify)                        | `activeTab` and `scripting` permissions                                           |

---

## Task 1: Scaffold the side panel and route the toolbar click

**Files:**

- Create: `extension/src/entrypoints/sidepanel/index.html`
- Create: `extension/src/entrypoints/sidepanel/main.tsx`
- Modify: `extension/wxt.config.ts`
- Modify: `extension/src/domain/url.ts`
- Modify: `extension/src/entrypoints/background.ts`
- Test: `extension/src/domain/url.test.ts`

**Interfaces:**

- Consumes: `canonicalizeUrl()` and `articleKey()` from `domain/url.ts`.
- Produces: `shouldCaptureFrom(rawUrl: string | undefined | null): boolean`. Task 6's click router calls it. Also a working `sidepanel` entrypoint at the built path `/sidepanel.html`.

- [x] **Step 1: Write the failing test**

Append to `extension/src/domain/url.test.ts`:

```ts
describe('shouldCaptureFrom', () => {
  test('captures an article on a substack.com subdomain', () => {
    expect(shouldCaptureFrom('https://alpha.substack.com/p/questions')).toBe(true);
  });

  test('captures an article on a custom domain', () => {
    expect(shouldCaptureFrom('https://www.theworkthatholds.com/p/on-attention')).toBe(true);
  });

  test('captures an article on the open.substack.com share route', () => {
    expect(shouldCaptureFrom('https://open.substack.com/pub/alpha/p/questions')).toBe(true);
  });

  test('ignores a publication home page', () => {
    expect(shouldCaptureFrom('https://alpha.substack.com')).toBe(false);
  });

  test('ignores the Saved list', () => {
    expect(shouldCaptureFrom('https://substack.com/inbox/saved')).toBe(false);
  });

  test('ignores the board itself', () => {
    expect(shouldCaptureFrom('chrome-extension://abcdefg/board.html')).toBe(false);
  });

  test('ignores a browser page', () => {
    expect(shouldCaptureFrom('chrome://extensions')).toBe(false);
  });

  test('ignores an undefined url without throwing', () => {
    expect(shouldCaptureFrom(undefined)).toBe(false);
    expect(shouldCaptureFrom(null)).toBe(false);
    expect(shouldCaptureFrom('')).toBe(false);
  });
});
```

Update the import at the top of the file to `import { articleKey, canonicalizeUrl, shouldCaptureFrom } from './url';`

- [x] **Step 2: Run the test and watch it fail**

Run: `cd extension; npx vitest run src/domain/url.test.ts`  
Expected: FAIL. `shouldCaptureFrom is not a function`.

- [x] **Step 3: Add the TODO(human) stub**

Append to `extension/src/domain/url.ts`:

```ts
/**
 * Does this URL name a Substack article the extension should capture?
 *
 * The board wins every other URL: the toolbar button opens it instead.
 *
 * A false positive is cheap. A non-Substack page with a `/p/` path gets
 * injected, yields no Substack metadata, and says so. A false NEGATIVE is
 * expensive: the reader clicks on a real article and gets the board.
 */
export function shouldCaptureFrom(rawUrl: string | undefined | null): boolean {
  // TODO(human)
  return false;
}
```

**This step is the developer's.** Stop here and make the Learn-by-Doing request. Do not implement it.

- [x] **Step 4: Run the test and watch it pass**

Run: `cd extension; npx vitest run src/domain/url.test.ts`  
Expected: PASS, all 8 new tests.

- [x] **Step 5: Export `publicationFromHost` for Task 6**

In `extension/src/domain/url.ts`, change `function publicationFromHost(` to `export function publicationFromHost(`. Leave the body and the comment above it alone.

- [x] **Step 6: Create the side panel document**

`extension/src/entrypoints/sidepanel/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Substack Library</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [x] **Step 7: Create the panel React root**

`extension/src/entrypoints/sidepanel/main.tsx`. `ReadingPanel` does not exist until Task 5, so this renders a placeholder that Task 5 replaces.

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from '../../ui/ErrorBoundary';
import '../../ui/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <p className="notice">Side panel scaffold. Task 5 renders the reading panel here.</p>
    </ErrorBoundary>
  </React.StrictMode>,
);
```

- [x] **Step 8: Add the two permissions**

In `extension/wxt.config.ts`, change the permissions line to:

```ts
    permissions: ['storage', 'activeTab', 'scripting'],
```

Do **not** add `sidePanel`. WXT adds it automatically when it finds a sidepanel entrypoint, along with `side_panel.default_path`. Adding it by hand duplicates it.

- [x] **Step 9: Route the toolbar click**

Replace the body of the `browser.action.onClicked` listener in `extension/src/entrypoints/background.ts` so the board path becomes a named function and the article path gets a stub Task 6 fills in:

```ts
import { shouldCaptureFrom } from '../domain/url';

export default defineBackground({
  main() {
    const BOARD_PATH = '/board.html';

    async function openBoard() {
      const { boardTabId } = await browser.storage.session.get('boardTabId');

      if (typeof boardTabId === 'number') {
        try {
          const tab = await browser.tabs.update(boardTabId, { active: true });
          if (tab?.windowId != null) {
            await browser.windows.update(tab.windowId, { focused: true });
          }
          return;
        } catch {
          // The remembered tab is gone. Fall through and open a new one.
        }
      }

      const tab = await browser.tabs.create({ url: browser.runtime.getURL(BOARD_PATH) });
      if (tab.id != null) {
        await browser.storage.session.set({ boardTabId: tab.id });
      }
    }

    browser.action.onClicked.addListener(async (tab) => {
      if (!shouldCaptureFrom(tab.url) || tab.id == null) {
        await openBoard();
        return;
      }
      // Task 6 extracts, ingests, and records state here.
      await browser.sidePanel.open({ tabId: tab.id });
    });
  },
});
```

- [x] **Step 10: Verify the build and the types**

Run: `cd extension; npm run compile; npm run build`  
Expected: `compile` prints nothing. `build` succeeds, with the standing warning that `package.json` carries no `version` field.

- [x] **Step 11: Verify the manifest gained the side panel**

Run: `cd extension; cat .output/chrome-mv3/manifest.json`  
Expected: `permissions` contains `storage`, `activeTab`, `scripting`, and `sidePanel`. A `side_panel` key holds `"default_path": "sidepanel.html"`.

- [x] **Step 12: Verify by hand**

Load `extension/.output/chrome-mv3/` unpacked. Click the toolbar button on a non-article page: the board opens, as before. Open any Substack article and click: the side panel opens showing the scaffold text.

- [x] **Step 13: Commit**

```bash
git add extension/src extension/wxt.config.ts
git commit -m "feat(extension): add the side panel entrypoint and route the toolbar click"
```

---

## Task 2: Extract article metadata from the page

**Files:**

- Create: `extension/src/substack/extract.ts`
- Test: `extension/src/substack/extract.test.ts`
- Modify: `extension/package.json` (add `linkedom`)

**Interfaces:**

- Consumes: nothing. `substack/` imports nothing in this project.
- Produces: `ArticleMeta` and `extractArticleMeta(doc?: Document): ArticleMeta`. Task 6 hands the function to `executeScript`. Task 7 adds `readSelection` to the same file.

```ts
export interface ArticleMeta {
  title: string | null;
  author: string | null;
  publication: string | null;
  canonicalUrl: string | null;
  wordCount: number | null;
  readable: boolean;
  bodyText: string;
}
```

- [x] **Step 1: Install linkedom**

Run: `cd extension; npm install --save-dev linkedom @types/node`  
Expected: it resolves and `package.json` gains `linkedom` and `@types/node` under `devDependencies`.

> **Correction, found during execution.** The plan originally installed only  
> `linkedom`, and Step 7 then failed with  
> `TS2307: Cannot find module 'node:fs'`. WXT's generated `.wxt/tsconfig.json`  
> sets `lib` to `ESNext`, `DOM`, and `DOM.Iterable` and pulls in no Node types,  
> so the `node:fs` import in the test has no declarations. `npm test` still  
> passed, because Vite strips types without reading them - the same trap the  
> Global Constraints warn about. `@types/node` is the fix. It is a test-only  
> dependency; nothing under `src/` outside a `.test.ts` file may import a Node  
> builtin.

- [x] **Step 2: Write the failing test**

`extension/src/substack/extract.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { extractArticleMeta } from './extract';

/**
 * The fixtures live in `spike/`, which this project does not import code from.
 * Reading a data file is not a module edge, and copying three large anonymized
 * HTML files into a second place is how anonymized files drift.
 */
function fixture(name: string): Document {
  const path = new URL(`../../../spike/fixtures/${name}`, import.meta.url);
  const { document } = parseHTML(readFileSync(path, 'utf8'));
  return document as unknown as Document;
}

describe('extractArticleMeta on the free article', () => {
  const meta = extractArticleMeta(fixture('article-free.html'));

  test('reads the title from og:title', () => {
    expect(meta.title).toBe(
      'I Posted on Substack Notes 365 Days Straight. Here are the only 3 types that brought subscribers.',
    );
  });

  test('reads the author', () => {
    expect(meta.author).toBe('Wes Pearce');
  });

  test('reads the publication from JSON-LD, since og:site_name does not exist', () => {
    expect(meta.publication).toBe('Escape the Cubicle');
  });

  test('reads the canonical url', () => {
    expect(meta.canonicalUrl).toBe(
      'https://escapethecubicle.substack.com/p/i-posted-on-substack-notes-365-days',
    );
  });

  test('counts the body words from .body.markup, not from article', () => {
    expect(meta.wordCount).toBe(1599);
  });

  test('reports the article as readable', () => {
    expect(meta.readable).toBe(true);
  });

  test('returns the body text for quote resolution', () => {
    expect(meta.bodyText.length).toBeGreaterThan(1000);
  });
});

describe('extractArticleMeta on the paywalled article', () => {
  const meta = extractArticleMeta(fixture('article-paywalled.html'));

  test('still reads every metadata field', () => {
    expect(meta.title).toBe('How I grew 3,000+ Subs my first month on substack');
    expect(meta.author).toBe('Kevin Szabo');
    expect(meta.publication).toBe('The Writing Chronicles');
    expect(meta.canonicalUrl).toBe(
      'https://kevinszabo.substack.com/p/how-i-grew-3000-subs-my-first-month',
    );
  });

  test('reports the article as not readable, from isAccessibleForFree', () => {
    expect(meta.readable).toBe(false);
  });

  test('still counts words, because the paywall does not truncate the DOM', () => {
    expect(meta.wordCount).toBe(684);
  });
});

describe('extractArticleMeta on a page with nothing to read', () => {
  const { document } = parseHTML('<html><head></head><body><p>hello</p></body></html>');
  const meta = extractArticleMeta(document as unknown as Document);

  test('returns nulls rather than throwing', () => {
    expect(meta.title).toBe(null);
    expect(meta.author).toBe(null);
    expect(meta.publication).toBe(null);
    expect(meta.canonicalUrl).toBe(null);
    expect(meta.wordCount).toBe(null);
  });

  test('assumes readable when the page says nothing about access', () => {
    expect(meta.readable).toBe(true);
  });
});

describe('extractArticleMeta JSON-LD handling', () => {
  test('reads author from an array, which is the shape Substack ships', () => {
    const { document } = parseHTML(`<html><head>
      <script type="application/ld+json">
        {"@type":"NewsArticle","headline":"H","author":[{"name":"Array Author"}]}
      </script></head><body></body></html>`);
    const meta = extractArticleMeta(document as unknown as Document);
    expect(meta.author).toBe('Array Author');
    expect(meta.title).toBe('H');
  });

  test('reads author from a bare object too', () => {
    const { document } = parseHTML(`<html><head>
      <script type="application/ld+json">
        {"@type":"Article","author":{"name":"Object Author"}}
      </script></head><body></body></html>`);
    expect(extractArticleMeta(document as unknown as Document).author).toBe('Object Author');
  });

  test('skips a malformed JSON-LD block instead of throwing', () => {
    const { document } = parseHTML(`<html><head>
      <script type="application/ld+json">{ not json </script>
      <meta property="og:title" content="Survived" />
      </head><body></body></html>`);
    expect(extractArticleMeta(document as unknown as Document).title).toBe('Survived');
  });

  test('falls back to the breadcrumb for publication', () => {
    const { document } = parseHTML(`<html><head>
      <script type="application/ld+json">
        {"@type":"BreadcrumbList","itemListElement":[{"name":"Breadcrumb Pub"}]}
      </script></head><body></body></html>`);
    expect(extractArticleMeta(document as unknown as Document).publication).toBe('Breadcrumb Pub');
  });
});
```

- [x] **Step 3: Run the test and watch it fail**

Run: `cd extension; npx vitest run src/substack/extract.test.ts`  
Expected: FAIL. Cannot find module `./extract`.

- [x] **Step 4: Write the extractor**

`extension/src/substack/extract.ts`. Everything is inside the one function on purpose — read the header comment before changing its shape.

```ts
/**
 * The code that knows Substack's DOM. Every read path here is sourced to
 * `spike/README.md`, "Article metadata read paths".
 *
 * THIS FILE IMPORTS NOTHING, AND THE FUNCTION BELOW DEFINES EVERYTHING IT USES
 * INSIDE ITS OWN BODY.
 *
 * `chrome.scripting.executeScript` ships a function into the page by calling
 * `Function.prototype.toString()` on it. Anything the function closes over -
 * an imported constant, a helper declared beside it in this module - is not
 * part of that string. Such code compiles, type-checks, and then throws a bare
 * ReferenceError inside Substack's document, where nothing is watching.
 *
 * The `doc: Document = document` default is what keeps it testable. Injection
 * calls it with no arguments and the page's own `document` resolves at
 * runtime; tests pass a linkedom document straight in.
 */

export interface ArticleMeta {
  title: string | null;
  author: string | null;
  publication: string | null;
  canonicalUrl: string | null;
  wordCount: number | null;
  /** From JSON-LD isAccessibleForFree. False means a paywalled preview. */
  readable: boolean;
  /** The article body as plain text, for locating quotes later. */
  bodyText: string;
}

export function extractArticleMeta(doc: Document = document): ArticleMeta {
  const SELECTORS = {
    // spike/README.md, "Article metadata read paths", body word count row.
    // `.available-content` wraps `.body.markup` and gives the same count.
    // NEVER fall back to `article`: it over-counts by 41 words on the free
    // fixture, because it swallows the title and both UFI bars.
    body: '.body.markup',
    bodyFallback: '.available-content',
    // spike/README.md, "Paywall block". Only the fallback; JSON-LD is primary.
    paywall: '.paywall',
    canonical: 'link[rel="canonical"]',
    jsonLd: 'script[type="application/ld+json"]',
  };

  function metaContent(selector: string): string | null {
    const el = doc.querySelector(selector);
    const value = el && el.getAttribute('content');
    return value && value.trim() ? value.trim() : null;
  }

  function clean(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function jsonLdBlocks(): Record<string, any>[] {
    const out: Record<string, any>[] = [];
    for (const script of Array.from(doc.querySelectorAll(SELECTORS.jsonLd))) {
      try {
        const parsed = JSON.parse(script.textContent || '');
        if (Array.isArray(parsed)) out.push(...parsed);
        else out.push(parsed);
      } catch {
        // Malformed JSON-LD is not our problem. Skip the block.
      }
    }
    return out;
  }

  const blocks = jsonLdBlocks();
  const article = blocks.find((b) => b && /Article/.test(String(b['@type']))) ?? {};
  const crumbs = blocks.find((b) => b && String(b['@type']) === 'BreadcrumbList');

  // spike/README.md: JSON-LD `author` is an ARRAY. `ld.author.name` returns
  // undefined and throws nothing.
  const ldAuthor = Array.isArray(article.author) ? article.author[0] : article.author;

  const title =
    metaContent('meta[property="og:title"]') ??
    clean(article.headline) ??
    clean(doc.title);

  const author = metaContent('meta[name="author"]') ?? clean(ldAuthor && ldAuthor.name);

  // spike/README.md: og:site_name does NOT exist on a Substack post. There is
  // no OG source for publication at all.
  const publication =
    clean(article.publisher && article.publisher.name) ??
    clean(
      crumbs &&
        Array.isArray(crumbs.itemListElement) &&
        crumbs.itemListElement[0] &&
        crumbs.itemListElement[0].name,
    );

  const canonicalEl = doc.querySelector(SELECTORS.canonical);
  const canonicalUrl =
    clean(canonicalEl && canonicalEl.getAttribute('href')) ??
    metaContent('meta[property="og:url"]');

  const bodyEl =
    doc.querySelector(SELECTORS.body) ?? doc.querySelector(SELECTORS.bodyFallback);
  const bodyText = (bodyEl && bodyEl.textContent ? bodyEl.textContent : '').trim();
  const words = bodyText ? bodyText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length > 0 ? words.length : null;

  // spike/README.md: prefer the JSON-LD boolean. The page states its own
  // access level there, so it survives a class rename. Word count is NOT a
  // substitute: the paywalled preview is 684 words.
  const readable =
    typeof article.isAccessibleForFree === 'boolean'
      ? article.isAccessibleForFree
      : !doc.querySelector(SELECTORS.paywall);

  return { title, author, publication, canonicalUrl, wordCount, readable, bodyText };
}
```

- [x] **Step 5: Run the test and watch it pass**

Run: `cd extension; npx vitest run src/substack/extract.test.ts`  
Expected: PASS, all 16 tests.

- [x] **Step 6: Prove the function is self-contained**

Run: `cd extension; node -e "const s=require('fs').readFileSync('src/substack/extract.ts','utf8'); console.log(/^\s*import /m.test(s) ? 'FAIL: has imports' : 'OK: no imports')"`  
Expected: `OK: no imports`.

- [x] **Step 7: Run the whole suite and the type check**

Run: `cd extension; npm test; npm run compile`  
Expected: every test passes. `compile` prints nothing.

- [x] **Step 8: Commit**

```bash
git add extension/src/substack extension/package.json extension/package-lock.json
git commit -m "feat(extension): read article metadata from a Substack page"
```

---

## Task 3: Turn a word count into a reading estimate

**Files:**

- Create: `extension/src/domain/article.ts`
- Test: `extension/src/domain/article.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `readingMinutes(wordCount: number | null, readable: boolean): number | undefined`. Task 6 calls it between extraction and `ingestCard()`.

- [x] **Step 1: Write the failing test**

`extension/src/domain/article.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { readingMinutes } from './article';

describe('readingMinutes', () => {
  test('divides the word count by 250', () => {
    expect(readingMinutes(1500, true)).toBe(6);
  });

  test('rounds a partial minute up, so an estimate is never optimistic', () => {
    expect(readingMinutes(1599, true)).toBe(7);
  });

  test('gives a very short article one minute rather than zero', () => {
    expect(readingMinutes(12, true)).toBe(1);
  });

  test('returns undefined when only a preview is readable', () => {
    // The paywalled fixture is 684 words of preview. Reporting 3 minutes for
    // an article the reader cannot finish is worse than reporting nothing.
    expect(readingMinutes(684, false)).toBeUndefined();
  });

  test('returns undefined when there was no body to count', () => {
    expect(readingMinutes(null, true)).toBeUndefined();
  });

  test('returns undefined for a zero word count', () => {
    expect(readingMinutes(0, true)).toBeUndefined();
  });
});
```

- [x] **Step 2: Run the test and watch it fail**

Run: `cd extension; npx vitest run src/domain/article.test.ts`  
Expected: FAIL. Cannot find module `./article`.

- [x] **Step 3: Add the TODO(human) stub**

`extension/src/domain/article.ts`:

```ts
/**
 * How long this article takes to read, or nothing.
 *
 * `implementation-plan.md` fixes the rate at 250 words per minute.
 * `spike/README.md` fixes the hard case: a paywalled preview is 684 words,
 * long enough that no word-count rule can tell it from a short free article.
 * The `readable` flag is the only honest signal, and the parent spec says the
 * field "stays blank when only a preview is readable".
 *
 * Returning `undefined` rather than 0 is load-bearing twice over. `mergeCard`
 * folds this in with `??`, so `undefined` leaves an estimate an earlier
 * capture already found; and `visibleCards` hides an unestimated card when a
 * max-minutes filter is set, which it should not do to a card estimated at
 * zero minutes.
 */
export function readingMinutes(
  wordCount: number | null,
  readable: boolean,
): number | undefined {
  // TODO(human)
  return undefined;
}
```

**This step is the developer's.** Stop here and make the Learn-by-Doing request. Do not implement it.

- [x] **Step 4: Run the test and watch it pass**

Run: `cd extension; npx vitest run src/domain/article.test.ts`  
Expected: PASS, all 6 tests.

- [x] **Step 5: Commit**

```bash
git add extension/src/domain/article.ts extension/src/domain/article.test.ts
git commit -m "feat(extension): estimate reading minutes from a word count"
```

---

## Task 4: Extract CardEditor and put the board's panel on it

**Files:**

- Create: `extension/src/ui/CardEditor.tsx`
- Modify: `extension/src/ui/DetailPanel.tsx`
- Modify: `extension/src/db/cards.ts`
- Modify: `extension/src/ui/styles.css`
- Test: `extension/src/db/cards.test.ts`

**Interfaces:**

- Consumes: `updateCard`, `deleteCard` from `db/cards.ts`; `Card`, `Quote` from `domain/types.ts`.
- Produces: `updateQuote(cardId: string, index: number, changes: Partial<Quote>): Promise<void>` in `db/cards.ts`, and the `CardEditor` component:

```tsx
interface Props {
  card: Card;
  footer?: ReactNode;
}
```

- [x] **Step 1: Write the failing test for `updateQuote**`

Append to `extension/src/db/cards.test.ts`:

```ts
describe('updateQuote', () => {
  const q = (text: string): Quote => ({
    text,
    locatorLost: false,
    capturedAt: '2026-08-29T00:00:00.000Z',
  });

  test('writes a comment onto one quote and leaves its neighbours alone', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('first'), q('second')] }));

    await updateQuote('a', 1, { comment: 'my reaction' });

    const card = await getCard('a');
    expect(card?.quotes[0]?.comment).toBeUndefined();
    expect(card?.quotes[1]?.comment).toBe('my reaction');
    expect(card?.quotes[1]?.text).toBe('second');
  });

  test('flips locatorLost without disturbing the verbatim text', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('gone from the article')] }));

    await updateQuote('a', 0, { locatorLost: true });

    const card = await getCard('a');
    expect(card?.quotes[0]?.locatorLost).toBe(true);
    expect(card?.quotes[0]?.text).toBe('gone from the article');
  });

  test('does nothing when the index is out of range', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('only')] }));

    await updateQuote('a', 7, { comment: 'nowhere' });

    const card = await getCard('a');
    expect(card?.quotes).toHaveLength(1);
    expect(card?.quotes[0]?.comment).toBeUndefined();
  });

  test('does nothing when the card is gone', async () => {
    await expect(updateQuote('missing', 0, { comment: 'x' })).resolves.toBeUndefined();
  });
});
```

Add `updateQuote` to the imports from `./cards`, and add `Quote` to the type import from `../domain/types`.

- [x] **Step 2: Run the test and watch it fail**

Run: `cd extension; npx vitest run src/db/cards.test.ts`  
Expected: FAIL. `updateQuote is not a function`.

- [x] **Step 3: Implement `updateQuote**`

Append to `extension/src/db/cards.ts`, and add `Quote` to the type import at the top:

```ts
/**
 * Change one quote on one card.
 *
 * Quotes have no id, so the index is the address. It is stable because quotes
 * are only ever appended, never inserted or reordered. Read, patch, write, in
 * one transaction, because two panels can hold the same card open at once.
 */
export async function updateQuote(
  cardId: string,
  index: number,
  changes: Partial<Quote>,
): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;
    const quote = card.quotes[index];
    if (!quote) return;

    const quotes = card.quotes.slice();
    quotes[index] = { ...quote, ...changes };
    await db.cards.update(cardId, { quotes });
  });
}
```

- [x] **Step 4: Run the test and watch it pass**

Run: `cd extension; npx vitest run src/db/cards.test.ts`  
Expected: PASS.

- [x] **Step 5: Write `CardEditor**`

`extension/src/ui/CardEditor.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { updateCard, updateQuote } from '../db/cards';
import type { Card } from '../domain/types';

interface Props {
  card: Card;
  /**
   * Controls the caller owns, rendered after the quotes. A slot rather than a
   * row of booleans: the board wants flags and delete, the reading panel wants
   * capture and status, and neither needs the other to know about it.
   */
  footer?: ReactNode;
}

export default function CardEditor({ card, footer }: Props) {
  const [notes, setNotes] = useState(card.notes);

  // A different card was selected. Show its notes.
  useEffect(() => {
    setNotes(card.notes);
  }, [card.id]);

  // Write 300ms after the last keystroke, not on every one.
  useEffect(() => {
    if (notes === card.notes) return;
    const timer = setTimeout(() => {
      void updateCard(card.id, { notes });
    }, 300);
    return () => clearTimeout(timer);
  }, [notes, card.id, card.notes]);

  return (
    <>
      <h2>{card.title}</h2>
      <p className="meta">
        {[card.publication, card.author].filter(Boolean).join(' · ')}
        {card.estimatedReadingMinutes != null ? ` · ${card.estimatedReadingMinutes} min` : ''}
      </p>
      <p className="meta">
        <a href={card.url} target="_blank" rel="noreferrer">
          {card.url}
        </a>
      </p>

      <label>
        Notes
        <textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <h3>Quotes</h3>
      {card.quotes.length === 0 ? (
        <p className="meta">No quotes yet.</p>
      ) : (
        <ul className="quotes">
          {card.quotes.map((quote, i) => (
            <li key={i}>
              <blockquote>{quote.text}</blockquote>
              {quote.locatorLost ? (
                <span className="lost">location unavailable</span>
              ) : null}
              <textarea
                rows={2}
                placeholder="Your reaction"
                value={quote.comment ?? ''}
                onChange={(e) => void updateQuote(card.id, i, { comment: e.target.value })}
              />
            </li>
          ))}
        </ul>
      )}

      {footer}
    </>
  );
}
```

The comment field writes on every keystroke rather than debouncing. A comment is a sentence, not a paragraph, and the write is a single indexed record update. If it ever shows up in profiling, lift the debounce out of `notes` into a shared hook and use it for both.

- [x] **Step 6: Put `DetailPanel` on `CardEditor**`

Replace `extension/src/ui/DetailPanel.tsx` entirely:

```tsx
import { deleteCard, updateCard } from '../db/cards';
import CardEditor from './CardEditor';
import type { Card } from '../domain/types';

interface Props {
  card: Card;
  onClose: () => void;
}

export default function DetailPanel({ card, onClose }: Props) {
  async function handleDelete() {
    const ok = window.confirm(`Delete "${card.title}"? This cannot be undone.`);
    if (!ok) return;
    await deleteCard(card.id);
    onClose();
  }

  return (
    <aside className="panel">
      <button className="close" onClick={onClose} aria-label="Close panel">
        ×
      </button>

      <CardEditor
        card={card}
        footer={
          <>
            <h3>Substack</h3>
            <p>
              <label>
                <input
                  type="checkbox"
                  checked={card.liked}
                  onChange={(e) => void updateCard(card.id, { liked: e.target.checked })}
                />{' '}
                Liked
              </label>
            </p>
            <p>
              <label>
                <input
                  type="checkbox"
                  checked={card.commented}
                  onChange={(e) => void updateCard(card.id, { commented: e.target.checked })}
                />{' '}
                Commented
              </label>
            </p>
            <p>
              <label>
                <input
                  type="checkbox"
                  checked={card.unsavedFromSubstack}
                  onChange={(e) =>
                    void updateCard(card.id, { unsavedFromSubstack: e.target.checked })
                  }
                />{' '}
                Unsaved from Substack
              </label>
            </p>
            <p>
              <button onClick={handleDelete}>Delete card</button>
            </p>
          </>
        }
      />
    </aside>
  );
}
```

- [x] **Step 7: Style the quote list**

Replace the `.panel li` and `.panel li .lost` rules in `extension/src/ui/styles.css` with:

```css
.panel li,
.reading li { font-size: 13px; margin-bottom: 12px; }
.quotes { list-style: none; padding: 0; margin: 0; }
.quotes blockquote {
  margin: 0 0 4px;
  padding-left: 8px;
  border-left: 3px solid var(--accent);
}
.quotes .lost { color: #b00; font-size: 11px; display: block; margin-bottom: 4px; }
.quotes textarea { width: 100%; font: inherit; font-size: 12px; }
```

- [x] **Step 8: Verify the whole suite, the types, and the build**

Run: `cd extension; npm test; npm run compile; npm run build`  
Expected: all pass, `compile` silent.

- [x] **Step 9: Verify the dependency rule still holds**

Run: `cd extension; grep -rn "from 'dexie'\|db/schema" src/ui/ || echo "OK: ui touches neither dexie nor schema"`  
Expected: `OK: ui touches neither dexie nor schema`.

- [x] **Step 10: Verify by hand**

Reload the unpacked extension. Open the board, select a card with a quote (add one through backup restore if none exists), and confirm the panel renders title, meta, notes, the quote with a comment box, the three checkboxes, and delete. Type a comment, reload the page, and confirm it persisted.

- [x] **Step 11: Commit**

```bash
git add extension/src
git commit -m "refactor(extension): extract CardEditor and make quote comments editable"
```

---

## Task 5: Build the reading panel

**Files:**

- Create: `extension/src/messages.ts`
- Create: `extension/src/ui/ReadingPanel.tsx`
- Modify: `extension/src/entrypoints/sidepanel/main.tsx`
- Modify: `extension/src/db/cards.ts`
- Modify: `extension/src/ui/styles.css`
- Test: `extension/src/db/cards.test.ts`

**Interfaces:**

- Consumes: `CardEditor` from Task 4; `allCards`, `applyOrder` from `db/cards.ts`; `reorderCards` from `domain/card.ts`.
- Produces: `cardByArticleKey(key: string): Promise<Card | undefined>` in `db/cards.ts`, the `PanelState` type in `src/messages.ts`, and a `ReadingPanel` component mounted at the sidepanel root. Task 6 writes `PanelState` into session storage; Task 7 adds the capture button to this panel's footer.

- [x] **Step 1: Write the failing test for `cardByArticleKey**`

Append to `extension/src/db/cards.test.ts`:

```ts
describe('cardByArticleKey', () => {
  test('finds the card for an article key', async () => {
    await db.cards.add(makeCard({ id: 'a', url: 'https://alpha.substack.com/p/one' }));
    const found = await cardByArticleKey('alpha/p/one');
    expect(found?.id).toBe('a');
  });

  test('finds one card whichever route the reader arrived by', async () => {
    // The same article, added from the share route, keys the same way.
    await db.cards.add(
      makeCard({ id: 'a', url: 'https://open.substack.com/pub/alpha/p/one' }),
    );
    expect((await cardByArticleKey('alpha/p/one'))?.id).toBe('a');
  });

  test('returns undefined for a key no card holds', async () => {
    expect(await cardByArticleKey('alpha/p/nothing')).toBeUndefined();
  });
});
```

Add `cardByArticleKey` to the imports from `./cards`.

- [x] **Step 2: Run the test and watch it fail**

Run: `cd extension; npx vitest run src/db/cards.test.ts`  
Expected: FAIL. `cardByArticleKey is not a function`.

- [x] **Step 3: Implement `cardByArticleKey**`

Append to `extension/src/db/cards.ts`:

```ts
/**
 * The card for one article, whichever of Substack's routes it was added by.
 *
 * `articleKey` is indexed but not unique, because a board written before
 * schema version 2 can already hold a duplicate pair. `.first()` is therefore
 * the honest read: it returns one card, and a board that holds two for one
 * article shows the older of them until the reader deletes one by hand.
 */
export async function cardByArticleKey(key: string): Promise<Card | undefined> {
  return db.cards.where('articleKey').equals(key).first();
}
```

- [x] **Step 4: Run the test and watch it pass**

Run: `cd extension; npx vitest run src/db/cards.test.ts`  
Expected: PASS.

- [x] **Step 5: Declare the shared types**

`extension/src/messages.ts`. Types only, no runtime code, so it belongs to no layer.

```ts
/**
 * The shapes the background and the side panel agree on.
 *
 * Types only. No runtime code lives here, so this file belongs to no layer of
 * the dependency rule and either side may import it.
 */
import type { IngestOutcome } from './db/cards';

/** The session-storage key the background writes and the panel reads. */
export const PANEL_STATE_KEY = 'panel';

export interface PanelState {
  /** Which article the panel is showing. */
  articleKey: string;
  /** The tab the activeTab grant covers, for later selection reads. */
  tabId: number;
  /** What ingestCard() did, so the panel can say so. */
  outcome: IngestOutcome['kind'];
  /** Everything the reader needs told: signed out, paywalled, no title. */
  notices: string[];
  /** The article body as plain text, for locating quotes. */
  bodyText: string;
}

export type PanelMessage = { type: 'capture-selection' };

export type CaptureSelectionReply =
  | { ok: true; text: string; prefix: string }
  | { ok: false; reason: string };
```

- [x] **Step 6: Write `ReadingPanel**`

`extension/src/ui/ReadingPanel.tsx`. Task 7 adds the capture button to the footer; the status buttons and notices are complete here.

```tsx
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { browser } from 'wxt/browser';
import { allCards, applyOrder, cardByArticleKey } from '../db/cards';
import { reorderCards } from '../domain/card';
import { PANEL_STATE_KEY, type PanelState } from '../messages';
import CardEditor from './CardEditor';
import type { Status } from '../domain/types';

const COLUMN_LABELS: Record<Status, string> = {
  to_read: 'To Read',
  reading: 'Reading',
  processed: 'Processed',
};

/**
 * Follow the state the background writes on each toolbar click.
 *
 * Deliberately NOT tab focus. Switching to another article tab without
 * clicking leaves the panel where it was. The panel follows an action the
 * reader took, not one the browser took.
 */
function usePanelState(): PanelState | null | undefined {
  const [state, setState] = useState<PanelState | null | undefined>(undefined);

  useEffect(() => {
    let live = true;

    void browser.storage.session.get(PANEL_STATE_KEY).then((stored) => {
      if (live) setState((stored[PANEL_STATE_KEY] as PanelState | undefined) ?? null);
    });

    // The per-area `storage.session.onChanged` is newer than the generic
    // listener and not everywhere. Filter the generic one instead.
    const onChanged = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== 'session' || !(PANEL_STATE_KEY in changes)) return;
      setState((changes[PANEL_STATE_KEY]?.newValue as PanelState | undefined) ?? null);
    };

    browser.storage.onChanged.addListener(onChanged);
    return () => {
      live = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return state;
}

const OUTCOME_TEXT: Record<PanelState['outcome'], string> = {
  added: 'Added to To Read.',
  updated: 'Already on your board. Metadata refreshed.',
  rejected: "Couldn't read this page as a Substack article.",
};

export default function ReadingPanel() {
  const panel = usePanelState();
  const cards = useLiveQuery(() => allCards(), []);
  const card = useLiveQuery(
    () => (panel ? cardByArticleKey(panel.articleKey) : Promise.resolve(undefined)),
    [panel?.articleKey],
  );

  if (panel === undefined) return <p className="notice">Loading…</p>;

  if (panel === null) {
    return (
      <p className="notice">
        Open a Substack article and click the Substack Library toolbar button.
      </p>
    );
  }

  if (!card) {
    return (
      <div className="reading">
        <p className="notice error">{OUTCOME_TEXT[panel.outcome]}</p>
        {panel.notices.map((n) => (
          <p className="notice" key={n}>
            {n}
          </p>
        ))}
      </div>
    );
  }

  async function moveTo(toStatus: Status) {
    if (!cards || !card) return;
    // reorderCards renumbers whole columns, so it needs every card. toIndex 0
    // puts this one at the top of the target column, which is where the thing
    // being read right now belongs.
    const changes = reorderCards(
      cards,
      { cardId: card.id, toStatus, toIndex: 0 },
      new Date().toISOString(),
    );
    await applyOrder(changes);
  }

  return (
    <div className="reading">
      <p className="notice">{OUTCOME_TEXT[panel.outcome]}</p>
      {panel.notices.map((n) => (
        <p className="notice" key={n}>
          {n}
        </p>
      ))}

      <CardEditor
        card={card}
        footer={
          <p className="statuses">
            {(Object.keys(COLUMN_LABELS) as Status[]).map((status) => (
              <button
                key={status}
                disabled={card.status === status}
                onClick={() => void moveTo(status)}
              >
                {COLUMN_LABELS[status]}
              </button>
            ))}
          </p>
        }
      />
    </div>
  );
}
```

- [x] **Step 7: Mount it**

Replace the placeholder in `extension/src/entrypoints/sidepanel/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from '../../ui/ErrorBoundary';
import ReadingPanel from '../../ui/ReadingPanel';
import '../../ui/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ReadingPanel />
    </ErrorBoundary>
  </React.StrictMode>,
);
```

- [x] **Step 8: Style the panel fluidly**

Append to `extension/src/ui/styles.css`:

```css
/*
 * The sidepanel is NOT the board's 380px panel. Chrome owns this width and the
 * reader drags it, so the layout is fluid with a floor that keeps the quote
 * comment boxes usable.
 */
.reading {
  padding: 12px;
  min-width: 260px;
}
.reading h2 { font-size: 15px; margin: 0 0 4px; }
.reading textarea { width: 100%; font: inherit; }
.reading .statuses { display: flex; gap: 6px; flex-wrap: wrap; }
```

- [x] **Step 9: Verify the whole suite, the types, and the build**

Run: `cd extension; npm test; npm run compile; npm run build`  
Expected: all pass, `compile` silent.

- [x] **Step 10: Verify by hand** — NOT RUN, and superseded rather than passed.

This step expects the panel's empty state, because nothing writes `PanelState` until Task 6. Task 6 landed before anyone ran it, so the condition it was checking for no longer exists. Task 6 Step 16 checks the same panel with the state present, which is the stronger check. Left unrun on purpose.

Reload the unpacked extension. Open a Substack article and click the toolbar button. The panel opens and reads "Open a Substack article and click the Substack Library toolbar button" — correct, because nothing writes `PanelState` until Task 6.

- [x] **Step 11: Commit**

```bash
git add extension/src
git commit -m "feat(extension): add the reading side panel with status controls"
```

---

## Task 6: Wire the click through extraction, ingest, and the panel

**Files:**

- Modify: `extension/src/entrypoints/background.ts`
- Modify: `extension/src/substack/extract.ts`
- Modify: `extension/src/domain/url.ts`
- Test: `extension/src/substack/extract.test.ts`, `extension/src/domain/url.test.ts`

**Interfaces:**

- Consumes: `shouldCaptureFrom`, `publicationFromHost`, `canonicalizeUrl`, `articleKey` (Task 1); `extractArticleMeta` (Task 2); `readingMinutes` (Task 3); `PanelState`, `PANEL_STATE_KEY` (Task 5); `ingestCard` from `db/cards.ts`.
- Produces: a populated `PanelState` in session storage, plus three functions:

```ts
// substack/extract.ts — both self-contained, same injection rule as the rest of the file
detectSignedOut(doc?: Document): boolean
readReaderArticle(doc?: Document): { url: string; title: string } | null

// domain/url.ts
isReaderRoute(rawUrl: string | undefined | null): boolean
```

- [x] **Step 1: Write the failing test for signed-out detection**

Append to `extension/src/substack/extract.test.ts`:

```ts
describe('detectSignedOut', () => {
  test('reports signed in on both committed fixtures', () => {
    // spike/README.md: the nav container holds 5 buttons on both fixtures and
    // neither file contains the string "Sign in".
    expect(detectSignedOut(fixture('article-free.html'))).toBe(false);
    expect(detectSignedOut(fixture('article-paywalled.html'))).toBe(false);
  });

  test('reports signed out when the nav offers Sign in', () => {
    const { document } = parseHTML(`<html><body><div id="main">
      <div class="mainMenuContent-DME8DR"><button>Sign in</button></div>
    </div></body></html>`);
    expect(detectSignedOut(document as unknown as Document)).toBe(true);
  });

  test('is not fooled by a Subscribe button in the same nav', () => {
    const { document } = parseHTML(`<html><body><div id="main">
      <div class="mainMenuContent-DME8DR"><button>Subscribe</button></div>
    </div></body></html>`);
    expect(detectSignedOut(document as unknown as Document)).toBe(false);
  });

  test('reports signed in when the nav is absent entirely', () => {
    const { document } = parseHTML('<html><body></body></html>');
    expect(detectSignedOut(document as unknown as Document)).toBe(false);
  });
});
```

Add `detectSignedOut` to the import from `./extract`.

- [x] **Step 2: Run the test and watch it fail**

Run: `cd extension; npx vitest run src/substack/extract.test.ts`  
Expected: FAIL. `detectSignedOut is not a function`.

- [x] **Step 3: Implement `detectSignedOut**`

Append to `extension/src/substack/extract.ts`. Self-contained, same rule as the rest of the file.

```ts
/**
 * Is the reader signed out of Substack?
 *
 * spike/README.md, "Signed-out state": the sign-in prompt has no id, no
 * aria-label, and no data-testid. Its class chain is eight build hashes deep,
 * and `buttonBase-GK1x3M` is shared with the paywall's Subscribe button, so
 * the hashes name a component type rather than one button. Scope to the nav
 * container and match on text, the same way the Save menu item is read.
 *
 * Signed out is NOT a capture blocker. Metadata reads without a session. Only
 * the native controls need one, and Milestone 2A invokes none.
 */
export function detectSignedOut(doc: Document = document): boolean {
  const nav = doc.querySelector('#main [class*="mainMenuContent"]');
  if (!nav) return false;
  return Array.from(nav.querySelectorAll('button')).some(
    (b) => (b.textContent || '').trim() === 'Sign in',
  );
}
```

- [x] **Step 4: Run the test and watch it pass**

Run: `cd extension; npx vitest run src/substack/extract.test.ts`  
Expected: PASS, all 20 tests.

- [x] **Step 5: Write the failing test for the inbox reader route**

Append to `extension/src/domain/url.test.ts`, and add `isReaderRoute` to the import from `./url`:

```ts
describe('the inbox reader route', () => {
  const READER = 'https://substack.com/inbox/post/213391431';

  test('captures a post opened from the inbox', () => {
    expect(shouldCaptureFrom(READER)).toBe(true);
  });

  test('survives the query string the inbox appends', () => {
    // canonicalizeUrl strips `search`, so utm_medium=reader2 changes nothing.
    expect(shouldCaptureFrom(`${READER}?utm_medium=reader2`)).toBe(true);
  });

  test('still ignores the Saved list beside it', () => {
    expect(shouldCaptureFrom('https://substack.com/inbox/saved')).toBe(false);
  });

  test('ignores the inbox itself', () => {
    expect(shouldCaptureFrom('https://substack.com/inbox')).toBe(false);
  });

  test('ignores a post segment that is not an id', () => {
    expect(shouldCaptureFrom('https://substack.com/inbox/post/settings')).toBe(false);
  });

  test('names the route, so the caller knows the head is untrustworthy', () => {
    expect(isReaderRoute(READER)).toBe(true);
  });

  test('does not call an ordinary article a reader route', () => {
    expect(isReaderRoute('https://alpha.substack.com/p/questions')).toBe(false);
    expect(isReaderRoute('https://substack.com/inbox/saved')).toBe(false);
    expect(isReaderRoute(undefined)).toBe(false);
  });
});
```

- [x] **Step 6: Run the test and watch it fail**

Run: `cd extension; npx vitest run src/domain/url.test.ts`  
Expected: FAIL. `isReaderRoute is not a function`, and the first two cases fail on the current `shouldCaptureFrom`.

- [x] **Step 7: Add `isReaderRoute` and widen `shouldCaptureFrom**`

Append to `extension/src/domain/url.ts`:

```ts
/**
 * Is this the Substack app's inbox reader rather than an article's own page?
 *
 * `substack.com/inbox/post/<id>` draws a post inside the app shell. The server
 * matched `/inbox`, so `<head>` describes the shell and every head-first read
 * path in `extract.ts` answers for the wrong page. A caller that sees true must
 * read the article's identity out of the body instead.
 *
 * The host is part of the rule. No publication serves `/inbox/post/<id>` from
 * its own domain, so matching the path alone would widen this for nothing.
 */
export function isReaderRoute(rawUrl: string | undefined | null): boolean {
  if (typeof rawUrl !== 'string') return false;

  const canonical = canonicalizeUrl(rawUrl);
  if (canonical === null) return false;

  const { hostname, pathname } = new URL(canonical);
  return hostname === 'substack.com' && /^\/inbox\/post\/\d+$/.test(pathname);
}
```

Then change the last line of `shouldCaptureFrom` to:

```ts
  return direct.test(pathname) || shared.test(pathname) || isReaderRoute(canonical);
```

And amend that function's doc comment. Its standing claim, "a false positive is cheap", was true for the two path shapes it was written against, where a miss yields no metadata and says so. The reader route is the exception: it returns a real `og:title` belonging to the app shell, so a wrong answer arrives looking like a right one. Add:

```
 * The inbox reader route is the exception to "a false positive is cheap". It
 * serves a real og:title belonging to the app shell, so a wrong answer arrives
 * looking like a right one. `capture()` carries the guard: when the article's
 * own URL cannot be read out of the body, it refuses out loud.
```

- [x] **Step 8: Run the test and watch it pass**

Run: `cd extension; npx vitest run src/domain/url.test.ts`  
Expected: PASS.

- [x] **Step 9: Write the failing test for `readReaderArticle**`

Append to `extension/src/substack/extract.test.ts`, and add `readReaderArticle` to the import from `./extract`:

```ts
describe('readReaderArticle', () => {
  /**
   * The inbox reader reduced to the shape that matters: the post's own link
   * sits in an ancestor of `.body.markup`, and the inbox list rendered behind
   * it holds links to other publications and no body of its own.
   *
   * Synthetic, not captured. There is no reader-route fixture in `spike/`, so
   * these cases prove the walk against a model of the page. Step 17's manual
   * check against the live route is what proves the model.
   */
  function readerPage(): Document {
    const { document } = parseHTML(`<html><body>
      <nav>
        <a href="https://other.substack.com/p/one?source=%2Finbox%2Fpost%2F999">One</a>
        <a href="https://another.substack.com/p/two?source=%2Finbox%2Fpost%2F999">Two</a>
      </nav>
      <div class="post">
        <a href="https://alpha.substack.com/p/be-delusional?utm_medium=reader2">Be Delusional</a>
        <div class="body markup"><p>The article text.</p></div>
      </div>
    </body></html>`);
    return document as unknown as Document;
  }

  test('reads the open post url, not the first link on the page', () => {
    expect(readReaderArticle(readerPage())?.url).toBe(
      'https://alpha.substack.com/p/be-delusional?utm_medium=reader2',
    );
  });

  test('reads the title from the link text', () => {
    expect(readReaderArticle(readerPage())?.title).toBe('Be Delusional');
  });

  test('returns null when the page has no article body', () => {
    const { document } = parseHTML('<html><body><a href="/p/x">x</a></body></html>');
    expect(readReaderArticle(document as unknown as Document)).toBe(null);
  });

  test('returns null when no ancestor of the body names the article', () => {
    const { document } = parseHTML(
      '<html><body><div class="body markup"><p>text</p></div></body></html>',
    );
    expect(readReaderArticle(document as unknown as Document)).toBe(null);
  });

  test.todo('decide: what this returns on an article page, where capture() never calls it');
});
```

The `test.todo` is a real open question, not a placeholder. `article-free.html` has a `.body.markup` and ancestors carrying `/p/` links of their own, so an unguarded walk finds one there too. `capture()` only calls this behind `isReaderRoute`, so nothing depends on the answer today. Write the assertion once you have decided what the walk should do.

- [x] **Step 10: Run the test and watch it fail**

Run: `cd extension; npx vitest run src/substack/extract.test.ts`  
Expected: FAIL. `readReaderArticle is not a function`.

- [x] **Step 11: Add the `readReaderArticle` TODO(human) stub**

Append to `extension/src/substack/extract.ts`. Self-contained, same rule as the rest of the file.

```ts
/**
 * The article a reader-route page is showing, or nothing.
 *
 * `substack.com/inbox/post/<id>` draws a post inside the app shell. The shell's
 * head describes `/inbox`, so canonical, og:title, and JSON-LD all answer for
 * the wrong page. The body is the only honest source on this route.
 *
 * What to walk to: the post's own link, the one whose href is article-shaped
 * and which sits in an ancestor of `.body.markup`. Its text is the post title.
 * Measured on a live page, `.body.markup` is unique and belongs to the open
 * post; the inbox list behind it carries no body.
 *
 * DO NOT match `a[href*="/p/"]` across the document. That returns the inbox
 * list — eight links to eight other publications, each stamped with the
 * CURRENT post's id in a `source` parameter — and taking the first is a coin
 * flip that produces a card for someone else's article.
 *
 * Three decisions live in here:
 *
 *  - How far up do you walk? Stopping at the first ancestor holding an
 *    article-shaped link is the tight read. Walking as far as `body` always
 *    finds something, which is the problem.
 *  - What counts as article-shaped? An href containing `/p/` also matches a
 *    comment permalink. Anchoring on `/p/<slug>` is tighter.
 *  - An anchor with empty text still yields a usable url. Is a url with no
 *    title worth returning, or is that a null?
 *
 * Returning null is a real answer, not a failure to answer. `capture()` turns
 * it into a refusal the reader can see, rather than keying the card on the
 * inbox URL and making a second card for an article the board already holds.
 */
export function readReaderArticle(
  doc: Document = document,
): { url: string; title: string } | null {
  // TODO(human)
  return null;
}
```

> **Correction, found during execution.** This step was written as the  
> developer's, with a TODO(human) stub and a Learn-by-Doing request. On  
> 2026-08-30 the developer handed it back for lack of time, so it was  
> implemented directly. The three decisions in the comment above were resolved  
> as: stop the walk before `<body>`; skip anchors inside `.body.markup`, so an  
> article linking to another Substack post cannot hand back that post's URL;  
> and treat `/p/<slug>` with nothing after it as article-shaped, so a  
> `/p/<slug>/comment/<id>` permalink cannot key the card on a comment. An empty  
> link text returns an empty title rather than a null, because `createCard`  
> already falls back to the URL for a blank title and the URL is the part that  
> cannot be recovered later. All four are reversible; the tests in Step 9 pin  
> each one.

- [x] **Step 12: Run the test and watch it pass**

Run: `cd extension; npx vitest run src/substack/extract.test.ts`  
Expected: PASS, with one todo.

- [x] **Step 13: Wire the background**

Replace `extension/src/entrypoints/background.ts` entirely:

```ts
import {
  canonicalizeUrl,
  isReaderRoute,
  publicationFromHost,
  shouldCaptureFrom,
} from '../domain/url';
import { readingMinutes } from '../domain/article';
import { ingestCard } from '../db/cards';
import { detectSignedOut, extractArticleMeta, readReaderArticle } from '../substack/extract';
import { PANEL_STATE_KEY, type PanelState } from '../messages';

export default defineBackground({
  main() {
    const BOARD_PATH = '/board.html';

    async function openBoard() {
      const { boardTabId } = await browser.storage.session.get('boardTabId');

      if (typeof boardTabId === 'number') {
        try {
          const tab = await browser.tabs.update(boardTabId, { active: true });
          if (tab?.windowId != null) {
            await browser.windows.update(tab.windowId, { focused: true });
          }
          return;
        } catch {
          // The remembered tab is gone. Fall through and open a new one.
        }
      }

      const tab = await browser.tabs.create({ url: browser.runtime.getURL(BOARD_PATH) });
      if (tab.id != null) {
        await browser.storage.session.set({ boardTabId: tab.id });
      }
    }

    async function capture(tabId: number, tabUrl: string) {
      let meta: Awaited<ReturnType<typeof extractArticleMeta>> | undefined;
      let signedOut = false;

      try {
        const [metaResult, signedOutResult] = await Promise.all([
          browser.scripting.executeScript({ target: { tabId }, func: extractArticleMeta }),
          browser.scripting.executeScript({ target: { tabId }, func: detectSignedOut }),
        ]);
        meta = metaResult[0]?.result;
        signedOut = signedOutResult[0]?.result === true;
      } catch {
        // A chrome:// page, the PDF viewer, or the Web Store. Injection is
        // refused there and no amount of retrying changes it.
      }

      const notices: string[] = [];

      if (!meta) {
        await browser.storage.session.set({
          [PANEL_STATE_KEY]: {
            articleKey: '',
            tabId,
            outcome: 'rejected',
            notices: ["Can't read this page."],
            bodyText: '',
          } satisfies PanelState,
        });
        return;
      }

      // On the inbox reader route the head belongs to the app shell, so
      // meta.canonicalUrl is `https://substack.com/inbox` and meta.title is the
      // shell's. Read this article's own url and title out of the body instead.
      let reader: { url: string; title: string } | null = null;

      if (isReaderRoute(tabUrl)) {
        try {
          const [result] = await browser.scripting.executeScript({
            target: { tabId },
            func: readReaderArticle,
          });
          reader = result?.result ?? null;
        } catch {
          // Same refusal as above, and no more retryable.
        }

        // Without the article's own url there is no honest key for this card.
        // Keying on the inbox url would make a second card for an article the
        // board may already hold, so refuse and say why.
        if (!reader) {
          await browser.storage.session.set({
            [PANEL_STATE_KEY]: {
              articleKey: '',
              tabId,
              outcome: 'rejected',
              notices: [
                "Couldn't tell which article this is. Open it on the publication's own page and click again.",
              ],
              bodyText: '',
            } satisfies PanelState,
          });
          return;
        }
      }

      // The canonical link is more trustworthy than the address bar, which may
      // carry a share token or a tracking parameter. The reader result outranks
      // both: on that route it is the only one describing this article.
      const url = reader?.url ?? meta.canonicalUrl ?? tabUrl;
      const title = reader?.title ?? meta.title;

      if (!title) {
        notices.push(
          "Couldn't read this page's details. Card created from the URL — edit the title below.",
        );
      }
      if (signedOut) {
        notices.push(
          "You're signed out of Substack. Notes and capture work; likes and saves won't.",
        );
      }
      if (!meta.readable) {
        notices.push('Preview only — reading time unavailable.');
      }

      // The host fallback lives here rather than in the extractor, because
      // `publicationFromHost` is domain/ code and substack/ imports nothing.
      const canonical = canonicalizeUrl(url);
      const publication =
        meta.publication ?? (canonical ? publicationFromHost(new URL(canonical).hostname) : '');

      const outcome = await ingestCard({
        url,
        title: title ?? undefined,
        author: meta.author ?? undefined,
        publication: publication || undefined,
        estimatedReadingMinutes: readingMinutes(meta.wordCount, meta.readable),
      });

      await browser.storage.session.set({
        [PANEL_STATE_KEY]: {
          articleKey: outcome.kind === 'rejected' ? '' : outcome.card.articleKey,
          tabId,
          outcome: outcome.kind,
          notices: outcome.kind === 'rejected' ? [outcome.reason] : notices,
          bodyText: meta.bodyText,
        } satisfies PanelState,
      });
    }

    browser.action.onClicked.addListener(async (tab) => {
      if (!shouldCaptureFrom(tab.url) || tab.id == null || !tab.url) {
        await openBoard();
        return;
      }

      // Open the panel FIRST. sidePanel.open() needs the user gesture, and the
      // gesture expires while the awaits below run.
      await browser.sidePanel.open({ tabId: tab.id });
      await capture(tab.id, tab.url);
    });
  },
});
```

Note the ordering in the listener. `sidePanel.open()` must be the first `await` in the chain: Chrome ties it to the user gesture, and the gesture is spent once an unrelated async operation resolves. Capturing first and opening second fails with "sidePanel.open() may only be called in response to a user gesture" — a real bug that only appears at runtime.

- [x] **Step 14: Verify the types and the build**

Run: `cd extension; npm run compile; npm run build`  
Expected: `compile` silent, `build` succeeds.

- [x] **Step 15: Verify the layering held**

Run: `cd extension; node -e "const s=require('fs').readFileSync('src/substack/extract.ts','utf8'); console.log(/^\s*import /m.test(s) ? 'FAIL: has imports' : 'OK: no import statements')"`  
Expected: `OK: no import statements`.

> **Correction, found during execution.** This step originally ran  
> `grep -rn "import" src/substack/extract.ts`, which always reports a match:  
> the file's own header comment contains the word "imported". The check is for  
> import *statements*, so it is the anchored test from Task 2 Step 6, not a  
> substring grep.

Then confirm the injected functions survived the bundler, which is the failure the file's header warns about and which no type check catches:

```bash
cd extension; node -e "
const src = require('fs').readFileSync('.output/chrome-mv3/background.js','utf8');
let i = -1;
while ((i = src.indexOf('.body.markup', i + 1)) !== -1) {
  const slice = src.slice(src.lastIndexOf('function', i), i + 600);
  const helpers = slice.match(/__[a-zA-Z]+/g);
  console.log(helpers ? 'FAIL: closes over ' + [...new Set(helpers)].join(',') : 'OK: self-contained');
}"
```

Expected: `OK: self-contained` twice, once for `extractArticleMeta` and once for `readReaderArticle`. A downlevel helper appearing here means the function references something outside its own body, which compiles, type-checks, and then throws a bare `ReferenceError` inside Substack's document.

- [x] **Step 16: Verify by hand against a free article**

Reload the unpacked extension. Open a free Substack article and click the toolbar button. Expected: the panel opens, says "Added to To Read.", and shows the real title, publication, author, and a reading estimate. Open the board in another tab and confirm the card is in To Read.

- [x] **Step 17: Verify by hand against the other paths**

1. Click again on the same article. Expected: "Already on your board. Metadata refreshed."
2. Open a paywalled article from a publication you do not pay for and click. Expected: the card is created, "Preview only — reading time unavailable." appears, and the card face shows no minutes.
3. Open an article on a custom-domain publication (`https://www.theworkthatholds.com/` has articles under `/p/`) and click. Expected: a card with a real title and publication. **If this fails, stop and record it — the remedy is a fourth fixture, and the spec names it as a known contingency.**
  - DONE, 2026-08-30, and the contingency was wrong. The check failed on the URL, not the title: the card was keyed on `https://www.theworkthatholds.com/`. Substack is a React SPA and `<link rel="canonical">` is server-rendered rather than react-helmet managed, so navigating into the article from the publication's home page left the home page's canonical in the head. A fourth fixture would have proved nothing, because the fixture copies the SERVER's HTML and the server's canonical is correct. Fixed by `resolveArticleUrl` in `domain/url.ts`, which takes the canonical only when it names the same article as the address bar. See `changes.log`.
4. Open `chrome://extensions` and click. Expected: the board opens, because the URL is not article-shaped.
5. Sign out of Substack in a private window, open an article, and click. Expected: the card is created and the signed-out notice appears.
6. **The inbox reader route.** Open a post from your Substack inbox, so the address bar reads `https://substack.com/inbox/post/<id>`, and click. Expected: a card with the post's real title and publication, not "Subscriptions | Substack". This is the step that proves the synthetic fixture in Step 9 modelled the real page. **If the title is the shell's, `readReaderArticle` returned null or matched the wrong anchor — stop and re-run the DevTools walk from the 2026-08-30 learning note before changing anything.**
7. **The same article, twice, by two routes.** Note the card from the previous check, then open that same article on the publication's own domain and click. Expected: "Already on your board. Metadata refreshed." and still one card. Two cards means the reader route is keying on something other than `<publication>/p/<slug>`, which is the failure this whole branch exists to prevent.

- [x] **Step 18: Verify the status buttons**

With the panel open on an article, click **Reading**. Expected: the button disables, and on the board the card is at the top of the Reading column. Open the card's detail panel on the board and confirm `readAt` was stamped by checking the card survives a reload in Reading.

- [x] **Step 19: Commit**

```bash
git add extension/src
git commit -m "feat(extension): capture an article on toolbar click and open the panel"
```

---

## Task 7: Capture selected text as quotes

**Files:**

- Modify: `extension/src/substack/extract.ts`
- Modify: `extension/src/entrypoints/background.ts`
- Modify: `extension/src/ui/ReadingPanel.tsx`
- Modify: `extension/src/db/cards.ts`
- Create: `extension/src/domain/quote.ts`
- Test: `extension/src/domain/quote.test.ts`, `extension/src/db/cards.test.ts`

**Interfaces:**

- Consumes: `PanelMessage`, `CaptureSelectionReply` (Task 5); `Quote` from `domain/types.ts`.
- Produces: `createQuote()`, `resolveQuote()` in `domain/quote.ts`; `addQuote()` in `db/cards.ts`; `readSelection()` in `substack/extract.ts`.

```ts
createQuote(input: { text: string; prefix: string }, deps: { capturedAt: string }): Quote
resolveQuote(articleText: string, quote: Quote): number | null
addQuote(cardId: string, quote: Quote): Promise<void>
```

- [x] **Step 1: Write the failing test for `createQuote**`

`extension/src/domain/quote.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createQuote, resolveQuote } from './quote';
import type { Quote } from './types';

describe('createQuote', () => {
  test('is deterministic given an injected timestamp', () => {
    expect(
      createQuote(
        { text: 'the quoted sentence', prefix: 'words before it. ' },
        { capturedAt: '2026-08-29T10:00:00.000Z' },
      ),
    ).toEqual({
      text: 'the quoted sentence',
      locator: 'words before it. ',
      locatorLost: false,
      capturedAt: '2026-08-29T10:00:00.000Z',
    });
  });

  test('starts life resolved, because it was just seen in the article', () => {
    const q = createQuote({ text: 'x', prefix: '' }, { capturedAt: '2026-08-29T10:00:00.000Z' });
    expect(q.locatorLost).toBe(false);
  });
});
```

- [x] **Step 2: Write the failing test for `resolveQuote**`

Append to `extension/src/domain/quote.test.ts`. The last two cases are `test.todo` on purpose: the spec leaves those decisions to the implementer, who writes the assertion that matches the rule they choose.

```ts
function q(text: string, locator = ''): Quote {
  return { text, locator, locatorLost: false, capturedAt: '2026-08-29T10:00:00.000Z' };
}

describe('resolveQuote', () => {
  const ARTICLE = 'Alpha beta gamma. The quoted sentence lands here. Delta epsilon.';

  test('finds a quote that appears once', () => {
    expect(resolveQuote(ARTICLE, q('The quoted sentence'))).toBe(18);
  });

  test('returns null when the author edited the sentence away', () => {
    expect(resolveQuote(ARTICLE, q('a sentence that is gone'))).toBe(null);
  });

  test('returns null for an empty quote rather than matching at zero', () => {
    expect(resolveQuote(ARTICLE, q(''))).toBe(null);
  });

  test('matches across a whitespace difference', () => {
    // The selection carried a newline where the DOM text renders a space.
    expect(resolveQuote('one two three', q('one\ntwo'))).toBe(0);
  });

  test('uses the prefix to pick between two identical passages', () => {
    const doubled = 'First run: repeated text. Second run: repeated text.';
    expect(resolveQuote(doubled, q('repeated text', 'Second run: '))).toBe(38);
  });

  test('finds the only occurrence even when the prefix has moved', () => {
    expect(resolveQuote(ARTICLE, q('The quoted sentence', 'a prefix that is gone'))).toBe(18);
  });

  test.todo('decide: two matches, and the prefix no longer identifies either');

  test.todo('decide: how aggressively whitespace normalizes before comparing');
});
```

> **Correction, found during execution.** Both `test.todo` entries are real  
> tests in the file that landed, so the suite reports 11 tests and 0 todo rather  
> than the "8 tests, 2 todo" Step 5 predicts. The instruction above says the  
> implementer "writes the assertion that matches the rule they choose", and a  
> decision made but left unpinned is a decision the next reader has to  
> re-derive. Two matches the prefix cannot separate return null; whitespace runs  
> collapse and case and punctuation do not. A third test was added beside them,  
> asserting the returned offset indexes `articleText` itself rather than a  
> normalized copy - that is the property the regex-over-the-original approach  
> exists to hold, and nothing else in the file was checking it.

- [x] **Step 3: Run the tests and watch them fail**

Run: `cd extension; npx vitest run src/domain/quote.test.ts`  
Expected: FAIL. Cannot find module `./quote`.

- [x] **Step 4: Write `createQuote` and the TODO(human) stub**

`extension/src/domain/quote.ts`:

```ts
import type { Quote } from './types';

/**
 * Build a quote from what the reader selected.
 *
 * Pure: the timestamp comes in through `deps`, so the same arguments always
 * give the same quote.
 */
export function createQuote(
  input: { text: string; prefix: string },
  deps: { capturedAt: string },
): Quote {
  return {
    text: input.text,
    locator: input.prefix,
    // It was on the page a moment ago. Nothing is lost yet.
    locatorLost: false,
    capturedAt: deps.capturedAt,
  };
}

/**
 * Where is this quote in the article now, if anywhere?
 *
 * Returns a character offset into `articleText`, or null when the quote can no
 * longer be found — which the panel turns into `locatorLost` and the
 * "location unavailable" label.
 *
 * The quote's own text does most of the work. `quote.locator` holds the ~40
 * characters that preceded it at capture time, and exists only to break ties
 * when the same passage appears more than once.
 *
 * Four decisions live in here, and the spec deliberately left them open:
 *
 *  - Substack's textContent collapses whitespace differently than the
 *    selection did. Normalize before comparing, and how far?
 *  - Zero matches means lost. One match means found. What does three mean when
 *    the prefix has moved too — the first, or nothing?
 *  - Is a match at a different offset than last time the same quote, or a
 *    coincidence?
 *  - A quote spanning a paragraph break picked up a newline the DOM renders
 *    differently. Does that still count as a match?
 *
 * Whatever you decide, an empty quote must return null. Every string contains
 * the empty string at index 0, and reporting a confident 0 would be a lie.
 */
export function resolveQuote(articleText: string, quote: Quote): number | null {
  // TODO(human)
  return null;
}
```

**This step is the developer's.** Stop here and make the Learn-by-Doing request. Do not implement `resolveQuote`. Implementing `createQuote` above is fine — it has no decision in it.

> **Correction, found during execution.** The developer asked for the  
> `TODO(human)` to be implemented in the same pass, so `resolveQuote` was  
> written directly and its docstring now records which way each of the four  
> decisions went instead of listing them as open. The shape that landed: split  
> the quote on whitespace, escape each word, join with `\s+`, and run that  
> pattern over the ORIGINAL article. Normalizing the article instead was  
> rejected - it shifts every offset past the first collapsed whitespace run, and  
> the function's contract is an offset a caller can slice with. Zero matches is  
> null, one match wins outright without consulting the prefix, and more than one  
> is settled by the prefix or else null. The empty-locator check sits before the  
> tie-break filter rather than inside it, because `''.endsWith()` is true of  
> every string and would leave every match standing rather than none.

- [x] **Step 5: Run the tests and watch them pass**

Run: `cd extension; npx vitest run src/domain/quote.test.ts`  
Expected: PASS, 8 tests, 2 todo.

- [x] **Step 6: Write the failing test for `addQuote**`

Append to `extension/src/db/cards.test.ts`:

```ts
describe('addQuote', () => {
  const q = (text: string): Quote => ({
    text,
    locatorLost: false,
    capturedAt: '2026-08-29T00:00:00.000Z',
  });

  test('appends to the end, so indexes stay stable', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('first')] }));

    await addQuote('a', q('second'));

    const card = await getCard('a');
    expect(card?.quotes.map((x) => x.text)).toEqual(['first', 'second']);
  });

  test('adds the first quote to a card that has none', async () => {
    await db.cards.add(makeCard({ id: 'a' }));
    await addQuote('a', q('only'));
    expect((await getCard('a'))?.quotes).toHaveLength(1);
  });

  test('leaves the notes and the status alone', async () => {
    await db.cards.add(makeCard({ id: 'a', notes: 'kept', status: 'reading' }));
    await addQuote('a', q('x'));
    const card = await getCard('a');
    expect(card?.notes).toBe('kept');
    expect(card?.status).toBe('reading');
  });

  test('does nothing when the card is gone', async () => {
    await expect(addQuote('missing', q('x'))).resolves.toBeUndefined();
  });
});
```

Add `addQuote` to the imports from `./cards`.

- [x] **Step 7: Run the test and watch it fail**

Run: `cd extension; npx vitest run src/db/cards.test.ts`  
Expected: FAIL. `addQuote is not a function`.

- [x] **Step 8: Implement `addQuote**`

Append to `extension/src/db/cards.ts`:

```ts
/**
 * Append a quote to a card.
 *
 * Read, append, write, in one transaction. Quotes are only ever appended, so
 * the index of an existing quote never moves, which is what lets updateQuote
 * address one by position.
 */
export async function addQuote(cardId: string, quote: Quote): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;
    await db.cards.update(cardId, { quotes: [...card.quotes, quote] });
  });
}
```

- [x] **Step 9: Run the test and watch it pass**

Run: `cd extension; npx vitest run src/db/cards.test.ts`  
Expected: PASS.

- [x] **Step 10: Add `readSelection` to the extractor**

Append to `extension/src/substack/extract.ts`. Self-contained, same rule as the rest of the file.

```ts
/**
 * What the reader has selected in the article, plus the text just before it.
 *
 * The prefix exists to break ties when the same passage appears twice. It is
 * read with a Range rather than by searching the body text, because searching
 * for the selection in order to find the text before the selection is circular
 * and fails on exactly the repeated passages the prefix exists to handle.
 *
 * Returns null when nothing is selected. Self-contained: see the header.
 */
export function readSelection(
  win: Window = window,
): { text: string; prefix: string } | null {
  const selection = win.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  let prefix = '';
  const range = selection.getRangeAt(0);
  const body =
    win.document.querySelector('.body.markup') ??
    win.document.querySelector('.available-content');

  if (body) {
    try {
      const before = range.cloneRange();
      before.selectNodeContents(body);
      before.setEnd(range.startContainer, range.startOffset);
      prefix = before.toString().slice(-40);
    } catch {
      // The selection started outside the article body. No prefix, and the
      // quote text alone still resolves whenever it is unique.
    }
  }

  return { text, prefix };
}
```

- [x] **Step 11: Handle the message in the background**

Add this inside `main()` in `extension/src/entrypoints/background.ts`, after the `browser.action.onClicked` listener, and add `readSelection` to the import from `../substack/extract` and the two message types to the import from `../messages`:

```ts
    browser.runtime.onMessage.addListener((message: PanelMessage, _sender, sendResponse) => {
      if (message?.type !== 'capture-selection') return false;

      void (async () => {
        const stored = await browser.storage.session.get(PANEL_STATE_KEY);
        const panel = stored[PANEL_STATE_KEY] as PanelState | undefined;

        if (!panel) {
          sendResponse({ ok: false, reason: 'No article open.' } satisfies CaptureSelectionReply);
          return;
        }

        try {
          const results = await browser.scripting.executeScript({
            target: { tabId: panel.tabId },
            func: readSelection,
          });
          const found = results[0]?.result;

          sendResponse(
            found
              ? { ok: true, text: found.text, prefix: found.prefix }
              : { ok: false, reason: 'Select some text in the article first.' },
          );
        } catch {
          // The tab navigated away, so the activeTab grant is gone with it.
          sendResponse({
            ok: false,
            reason: 'Lost access to the article. Click the toolbar button again.',
          });
        }
      })();

      // Keep the message channel open for the async sendResponse above.
      return true;
    });
```

- [x] **Step 12: Add the capture button and quote resolution to the panel**

In `extension/src/ui/ReadingPanel.tsx`, add these imports:

```tsx
import { addQuote, updateQuote } from '../db/cards';
import { createQuote, resolveQuote } from '../domain/quote';
import type { CaptureSelectionReply, PanelMessage } from '../messages';
```

Add a `captureError` state beside the existing state, inside the component:

```tsx
  const [captureError, setCaptureError] = useState<string | null>(null);
```

Add the capture handler after `moveTo`:

```tsx
  async function captureQuote() {
    if (!card) return;
    setCaptureError(null);

    const reply: CaptureSelectionReply = await browser.runtime.sendMessage({
      type: 'capture-selection',
    } satisfies PanelMessage);

    if (!reply.ok) {
      setCaptureError(reply.reason);
      return;
    }

    await addQuote(
      card.id,
      createQuote(
        { text: reply.text, prefix: reply.prefix },
        { capturedAt: new Date().toISOString() },
      ),
    );
  }
```

> **Correction, found during execution.** The resolution effect below does NOT  
> go after `moveTo`. `ReadingPanel` has three conditional returns above that  
> point - `panel === undefined`, `panel === null`, and `!card` - and a hook  
> placed after them runs on some renders and not others, which is React's  
> "rendered fewer hooks than expected" crash. It goes with the other hooks,  
> directly after the `card` `useLiveQuery` and above the first early return.  
> Its body already guards with `if (!card || !panel?.bodyText) return;`, so  
> moving it up changes nothing about when it does its work. `captureError`'s  
> `useState` belongs up there for the same reason.

Add the resolution effect beside the other hooks, above the early returns:

```tsx
  // Re-check every quote against the article as it stands now. Persisted
  // rather than derived, because the BOARD has no article text: if this flag
  // were computed on render, the board's detail panel could never show the
  // "location unavailable" label it already renders.
  useEffect(() => {
    if (!card || !panel?.bodyText) return;

    card.quotes.forEach((quote, i) => {
      const lost = resolveQuote(panel.bodyText, quote) === null;
      if (lost !== quote.locatorLost) {
        void updateQuote(card.id, i, { locatorLost: lost });
      }
    });
  }, [card?.id, card?.quotes.length, panel?.bodyText]);
```

Add the button to the footer, above the status buttons:

```tsx
          <>
            <p>
              <button onClick={() => void captureQuote()}>Capture quote</button>
            </p>
            {captureError ? <p className="notice error">{captureError}</p> : null}
            <p className="statuses">
              {(Object.keys(COLUMN_LABELS) as Status[]).map((status) => (
                <button
                  key={status}
                  disabled={card.status === status}
                  onClick={() => void moveTo(status)}
                >
                  {COLUMN_LABELS[status]}
                </button>
              ))}
            </p>
          </>
```

- [x] **Step 13: Verify the whole suite, the types, and the build**

Run: `cd extension; npm test; npm run compile; npm run build`  
Expected: all pass, `compile` silent.

- [x] **Step 14: Verify by hand**

> Ran 2026-08-30. All five checks passed. A separate failure surfaced in the  
> same session and belongs to `isReaderRoute`, not to this task: the toolbar  
> button opened the board on `substack.com/home/post/p-<id>`. See the amendment  
> to correction 4.

Reload the unpacked extension. On a free article with the panel open:

1. Select a sentence and click **Capture quote**. Expected: the quote appears with its verbatim text and an empty comment box.
2. Type a comment, then open the board and select the same card. Expected: the comment is there.
3. Click **Capture quote** with nothing selected. Expected: "Select some text in the article first." and no new quote.
4. Select a passage that appears twice in the article and capture it. Expected: one quote, no error.
5. In DevTools, edit the article text of a captured quote so it no longer matches, then click the toolbar button again to refresh the panel. Expected: "location unavailable" under that quote, with the text still intact.

- [x] **Step 15: Commit**

Landed as `4e2c72d`, code only. The `changes.log` entry and these plan
corrections went into `119d057` with the reader-route fix, because git cannot
split one file's hunks across two commits without an interactive add and both
units of work had touched the same two documents.

```bash
git add extension/src
git commit -m "feat(extension): capture selected text as quotes with commentary"
```

---

## Task 8: Manual checks, documentation, and wrap-up

**Files:**

- Modify: `extension/MANUAL-CHECKS.md`
- Modify: `README.md`
- Modify: `changes.log`
- Modify: `docs/learning-notes.md`

**Interfaces:**

- Consumes: everything from Tasks 1 through 7.
- Produces: no code.

- [x] **Step 1: Add the reading-panel checks**

Append to `extension/MANUAL-CHECKS.md`:

```markdown
## Capture from an article page

- [ ] Toolbar click on a free Substack article opens the side panel
- [ ] The panel says "Added to To Read." and shows the real title, publication, and author
- [ ] A reading estimate appears and is plausible for the article's length
- [ ] The card is in To Read on the board
- [ ] A second click on the same article says "Already on your board. Metadata refreshed."
- [ ] A second click creates no duplicate card
- [ ] Clicking from the `open.substack.com/pub/.../p/...` share route finds the same card
- [ ] Toolbar click on a non-article page still opens the board
- [ ] Toolbar click on `chrome://extensions` opens the board and shows no error
- [ ] Toolbar click on a custom-domain publication captures a real title and publication
- [ ] A paywalled article creates a card, shows "Preview only", and leaves the minutes blank
- [ ] Signed out in a private window: the card is still created and the signed-out notice appears

## Reading panel

- [ ] Notes typed in the panel appear on the board's detail panel after a reload
- [ ] Notes typed on the board appear in the panel without a reload
- [ ] The three status buttons move the card, and the current status is disabled
- [ ] Moving to Reading puts the card at the TOP of the Reading column
- [ ] The panel keeps showing the previous article when you switch tabs without clicking
- [ ] Narrowing the panel to its minimum leaves the quote comment boxes usable

## Quotes

- [ ] Selecting text and clicking "Capture quote" adds the quote verbatim
- [ ] A comment typed on a quote survives a reload
- [ ] A comment typed on a quote is editable from the board's detail panel too
- [ ] "Capture quote" with nothing selected says so and adds nothing
- [ ] Capturing a passage that appears twice in the article adds exactly one quote
- [ ] Editing the article in DevTools so a quote no longer matches shows "location unavailable"
- [ ] A quote whose location is lost still shows its full text
```

- [x] **Step 2: Run every box**

Load `extension/.output/chrome-mv3/` unpacked and work through all three new sections. Tick each box in the file as it passes. If a box fails, fix it and re-run the section — do not tick it and move on.

- [x] **Step 3: Update the README status**

In `README.md`, rewrite the "Status" section so it says Milestone 2A is complete: the extension captures an article from the toolbar on any Substack page including custom domains, opens a side panel beside it, and takes notes and quotes. Name what is still missing: Markdown export and the vault write (2B), and Saved sync with native Save and Unsave (Milestone 3).

- [x] **Step 4: Add the changes.log entry**

Add an entry at the top of the "Entries" section using the template in the file, then rewrite "Current state" to match. Record:

- What changed: the eight tasks, in one line each.
- Why: the reading loop's first half is closed; notes are now taken beside the article rather than away from it.
- The three corrections this plan made to the spec: `selectors.ts` folded into `extract.ts` because `executeScript` cannot close over imports; the publication host fallback moved to the background because `substack/` imports nothing; tasks 4 to 6 reordered so the panel exists before the click wires into it.
- The `sidePanel.open()` gesture ordering, because it is a runtime-only failure that no test catches.
- Verification: the exact test count from `npm test`, plus `npm run compile` and `npm run build` results, plus whether every `MANUAL-CHECKS.md` box is ticked.
- Whether the custom-domain check passed. **If it failed, say so plainly and record capturing a fourth fixture as the next step.**
- Next up: the Milestone 2B design.

- [x] **Step 5: Write the learning notes** — nothing to write.

`CLAUDE.md` scopes these notes to questions the developer actually asked while building, and forbids notes on the immediate task. Across Milestone 2A the developer asked none of the first kind. Two of the three `TODO(human)` contributions this step names, `readingMinutes` and `resolveQuote`, were also not written by the developer: the first was handed back for lack of time and the second was requested from the assistant, so neither produced a question either. Writing notes anyway would mean inventing questions nobody asked. `docs/learning-notes.md` is unchanged for this milestone.

For each `TODO(human)` the developer implemented — `shouldCaptureFrom`, `readingMinutes`, `resolveQuote` — add a note to `docs/learning-notes.md` under a `## 2026-08-29 - Milestone 2A` heading, but only for questions the developer actually asked while building. Follow the rules in `CLAUDE.md`: the developer's own words as the `###` heading, the answer you gave but shorter, tables and code blocks kept, and run the `stop-slop` skill on the note text afterwards.

Do not add a `changes.log` entry for the learning notes.

- [x] **Step 6: Final verification**

Run: `cd extension; npm test; npm run compile; npm run build`  
Expected: all pass. Record the exact test and file counts in the changes.log entry.

- [x] **Step 7: Verify the dependency rule one last time**

```bash
cd extension
grep -rn "from 'dexie'\|db/schema" src/ui/ || echo "OK: ui clean"
grep -rn "^import" src/substack/extract.ts || echo "OK: substack imports nothing"
grep -rn "from '\.\./db\|from '\.\./ui\|from 'dexie'\|from 'react'" src/domain/ || echo "OK: domain pure"
```

Expected: three OK lines.

- [x] **Step 8: Commit**

```bash
git add .
git commit -m "docs: complete Milestone 2A with manual checks and wrap-up"
```

---

## Self-review

**Spec coverage.** Every section of the design doc maps to a task: the side panel decision to Task 1; `activeTab` injection to Tasks 1 and 6; native Save deferral to nothing, correctly, since it is out of scope; prefix-anchored locators to Task 7; the JSON-LD `isPreview` decision to Task 2; the shared `CardEditor` to Task 4; panel-follows-clicks to Task 5's `usePanelState`; the read-path table to Task 2; every row of the failure table to Task 6 (five rows), Task 7 (two rows), and Task 4 (the `locatorLost` label); the testing table to Tasks 1, 2, 3, 4, 5, and 7; the three learning-mode contributions to Tasks 1, 3, and 7.

**Types.** `ArticleMeta` (Task 2) is consumed by Task 6. `PanelState` (Task 5) is written by Task 6 and read by Tasks 5 and 7. `IngestOutcome['kind']` reuses the existing union rather than restating it. `Quote` comes from `domain/types.ts` throughout. `readingMinutes` returns `number | undefined`, matching `CardInput.estimatedReadingMinutes`.

**Known gaps, deliberate.** `readSelection` and `detectSignedOut` have no fixture test for the injected path itself — only for their pure logic — because no fixture carries a live selection and no test can run `executeScript`. Both are covered by Task 6 Step 9 and Task 7 Step 14 manual checks. The `resolveQuote` test file carries two `test.todo` entries, which the developer converts to real tests once they decide the two open rules.
