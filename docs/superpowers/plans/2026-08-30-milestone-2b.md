# Milestone 2B Implementation Plan: Markdown export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One click in the reading panel or the board's detail panel downloads a
card as a Markdown file, records the export on the card, and offers to move the
card to Processed.

**Architecture:** `domain/markdown.ts` holds two pure functions, `toMarkdown` and
`exportFilename`, importing types only. `db/cards.ts` gains `recordExport` and
`moveCardTo`, both transactional. `ui/exportCard.ts` is the glue that serializes,
downloads through a blob and a synthetic anchor, and then records. One
`ui/ExportButton.tsx` mounts in both editors' footers.

**Tech Stack:** TypeScript, React 19, Dexie, Vitest with `fake-indexeddb`, WXT.
No new dependency and no new permission.

**Spec:** `docs/superpowers/specs/2026-08-30-milestone-2b-design.md`

## Global Constraints

- **Run every command from `extension/`.** Vitest run from the repository root
  also sweeps `.worktrees/`, where a stale worktree fails on a missing IndexedDB.
- **`npm run build` proves nothing about types.** Vite strips types without
  reading them. Run `npm run compile` beside it, every time.
- `npm run build` emits a standing warning that `package.json` carries no
  `version` field. That warning is expected and is not a failure.
- **Dependency rule.** `src/domain/` imports no `dexie`, no `react`, no
  `nanoid`, and calls no `new Date()`. `src/ui/` imports neither `dexie` nor
  `db/schema.ts`. `src/substack/` imports nothing at all.
- **`domain/markdown.ts` imports types only** — `import type { Card, Quote } from
  './types'` and nothing else. Every timestamp it needs is passed in.
- The generated `.wxt/tsconfig.json` sets `noUncheckedIndexedAccess: true`, so
  every array index read is `T | undefined`. Use `?? ''` or a non-null assertion
  where the index is provably in range.
- The generated tsconfig also sets `noImplicitOverride: true`. Nothing in this
  milestone subclasses anything, so it should not come up.
- **Dexie stays at version 2.** No step in this plan may touch
  `src/db/schema.ts`. `exportVersion`, `lastExportedAt`, and `tags` are already
  on `Card`.
- **No silent failure.** Every failure path in this plan ends in a visible
  string. Per `implementation-plan.md`, "Reliability".
- `src/ui/` has no automated tests by design. Anything written there is verified
  by `extension/MANUAL-CHECKS.md`. Keep the untested surface thin.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `extension/src/domain/markdown.ts` | Create | `toMarkdown(card)` and `exportFilename(card, version)`. Pure. Types-only imports. |
| `extension/src/domain/markdown.test.ts` | Create | Every serializer and filename case. |
| `extension/src/db/cards.ts` | Modify | Add `recordExport` and `moveCardTo`. |
| `extension/src/db/cards.test.ts` | Modify | Tests for both. |
| `extension/src/ui/exportCard.ts` | Create | Serialize, blob, anchor click, record. Returns a typed outcome. |
| `extension/src/ui/ExportButton.tsx` | Create | The button, the notice, and the Processed offer. |
| `extension/src/ui/ReadingPanel.tsx` | Modify | Mount `ExportButton`; status buttons call `moveCardTo`; delete the private `moveTo`. |
| `extension/src/ui/DetailPanel.tsx` | Modify | Mount `ExportButton` in its footer. |
| `extension/src/ui/styles.css` | Modify | The offer row. |
| `extension/MANUAL-CHECKS.md` | Modify | A new "Markdown export" section. |

`CardEditor`'s `footer` prop is a slot its parents fill. That contract does not
change; both parents put `<ExportButton>` into the content they already pass.

---

## Task 1: Serialize a card to Markdown

**Files:**
- Create: `extension/src/domain/markdown.ts`
- Test: `extension/src/domain/markdown.test.ts`

**Interfaces:**
- Consumes: `Card` and `Quote` from `src/domain/types.ts`. `makeCard(overrides)`
  from `src/test-support/factory.ts`, which builds a whole `Card` and derives a
  consistent `articleKey`.
- Produces: `toMarkdown(card: Card): string`. Task 4 calls it.

**Carries a `TODO(human)`** on `quoteBlock`. See Step 7.

- [ ] **Step 1: Write the failing frontmatter tests**

Create `extension/src/domain/markdown.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { makeCard } from '../test-support/factory';
import { toMarkdown } from './markdown';

/** The frontmatter block, without its --- fences. */
function frontmatterOf(markdown: string): string[] {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`No frontmatter in:\n${markdown}`);
  return match[1]!.split('\n');
}

describe('toMarkdown frontmatter', () => {
  test('carries the five always-present keys', () => {
    const card = makeCard({
      title: 'How Great Questions Change a Company',
      author: 'Jane Doe',
      publication: 'The Work That Holds',
      url: 'https://www.theworkthatholds.com/p/great-questions',
      savedAt: '2026-08-16T09:31:00.000Z',
      estimatedReadingMinutes: undefined,
      readAt: undefined,
    });

    expect(frontmatterOf(toMarkdown(card))).toEqual([
      'title: "How Great Questions Change a Company"',
      'author: "Jane Doe"',
      'publication: "The Work That Holds"',
      'url: https://www.theworkthatholds.com/p/great-questions',
      'saved: 2026-08-16',
      'tags: []',
    ]);
  });

  test('quotes a title holding a colon, so the YAML still parses', () => {
    const card = makeCard({ title: 'On Writing: a short case' });
    expect(toMarkdown(card)).toContain('title: "On Writing: a short case"');
  });

  test('escapes a double quote inside a title', () => {
    const card = makeCard({ title: 'The "Deep Work" Problem' });
    expect(toMarkdown(card)).toContain('title: "The \\"Deep Work\\" Problem"');
  });

  test('escapes a backslash inside a title', () => {
    const card = makeCard({ title: 'Either\\Or' });
    expect(toMarkdown(card)).toContain('title: "Either\\\\Or"');
  });

  test('emits read only when the card has been read', () => {
    const unread = makeCard({ readAt: undefined });
    expect(toMarkdown(unread)).not.toContain('read:');

    const read = makeCard({ readAt: '2026-08-18T22:04:00.000Z' });
    expect(toMarkdown(read)).toContain('read: 2026-08-18');
  });

  test('emits reading_minutes only when there is an estimate', () => {
    const paywalled = makeCard({ estimatedReadingMinutes: undefined });
    expect(toMarkdown(paywalled)).not.toContain('reading_minutes:');

    const readable = makeCard({ estimatedReadingMinutes: 12 });
    expect(toMarkdown(readable)).toContain('reading_minutes: 12');
  });

  test('emits an empty tags list rather than dropping the key', () => {
    expect(toMarkdown(makeCard({ tags: [] }))).toContain('tags: []');
  });

  test('renders tags as a flow sequence', () => {
    const card = makeCard({ tags: ['substack', 'reading'] });
    expect(toMarkdown(card)).toContain('tags: [substack, reading]');
  });
});
```

`tags: []` is emitted on purpose. The key has to be present for Obsidian's
Properties view to offer it, and a reader who wants to tag the note in Obsidian
should not have to type the key first.

- [ ] **Step 2: Run the tests and watch them fail**

```bash
cd extension
npx vitest run src/domain/markdown.test.ts
```

Expected: every test fails with `Failed to resolve import "./markdown"`.

- [ ] **Step 3: Write the frontmatter**

Create `extension/src/domain/markdown.ts`:

```ts
import type { Card, Quote } from './types';

/**
 * A YAML double-quoted scalar.
 *
 * Titles are quoted because Substack titles carry colons, and an unquoted YAML
 * scalar containing ": " is a parse error rather than a string. Inside double
 * quotes YAML reads backslash escapes, so a literal backslash has to be doubled
 * BEFORE the quotes are escaped, or the escaping of a quote would itself be
 * escaped away.
 */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function frontmatter(card: Card): string {
  const lines = [
    `title: ${yamlString(card.title)}`,
    `author: ${yamlString(card.author)}`,
    `publication: ${yamlString(card.publication)}`,
    // A URL holds no YAML metacharacter that needs quoting.
    `url: ${card.url}`,
    `saved: ${card.savedAt.slice(0, 10)}`,
  ];

  // A key with no value is omitted, never emitted empty: `read:` with nothing
  // after it reads as null in Obsidian's Properties view and looks like a bug.
  if (card.readAt) lines.push(`read: ${card.readAt.slice(0, 10)}`);
  if (typeof card.estimatedReadingMinutes === 'number') {
    lines.push(`reading_minutes: ${card.estimatedReadingMinutes}`);
  }

  // The one deliberate exception: an empty list still emits its key, so the
  // field shows up in Obsidian and can be filled there.
  lines.push(`tags: [${card.tags.join(', ')}]`);

  return ['---', ...lines, '---'].join('\n');
}

export function toMarkdown(card: Card): string {
  return frontmatter(card) + '\n';
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
cd extension
npx vitest run src/domain/markdown.test.ts
```

Expected: 8 passed.

- [ ] **Step 5: Write the failing body tests**

Append to `extension/src/domain/markdown.test.ts`:

```ts
describe('toMarkdown body', () => {
  const quote = (text: string, extra: Partial<Quote> = {}): Quote => ({
    text,
    locatorLost: false,
    capturedAt: '2026-08-17T00:00:00.000Z',
    ...extra,
  });

  test('renders a quote with no comment as a bare blockquote', () => {
    const card = makeCard({ notes: '', quotes: [quote('First captured quote text.')] });
    expect(toMarkdown(card)).toContain('\n> First captured quote text.\n');
  });

  test('puts a comment in its own paragraph under the quote', () => {
    const card = makeCard({
      notes: '',
      quotes: [quote('First captured quote text.', { comment: 'My reaction to that quote.' })],
    });
    expect(toMarkdown(card)).toContain(
      '> First captured quote text.\n\nMy reaction to that quote.\n',
    );
  });

  test('keeps a quote spanning a paragraph break as one blockquote', () => {
    const card = makeCard({ notes: '', quotes: [quote('First line.\n\nSecond line.')] });
    expect(toMarkdown(card)).toContain('> First line.\n>\n> Second line.');
  });

  test('marks a quote whose location no longer resolves', () => {
    const card = makeCard({
      notes: '',
      quotes: [quote('Second captured quote.', { locatorLost: true })],
    });
    expect(toMarkdown(card)).toContain(
      '> Second captured quote.\n\n*— location no longer resolves in the source article*',
    );
  });

  test('puts the lost marker after the comment when a quote has both', () => {
    const card = makeCard({
      notes: '',
      quotes: [quote('Second captured quote.', { comment: 'Still true.', locatorLost: true })],
    });
    expect(toMarkdown(card)).toContain(
      '> Second captured quote.\n\nStill true.\n\n*— location no longer resolves in the source article*',
    );
  });

  test('renders the notes under a Notes heading', () => {
    const card = makeCard({ notes: 'Freeform notes body from the card.', quotes: [] });
    expect(toMarkdown(card)).toContain('## Notes\n\nFreeform notes body from the card.\n');
  });

  test('drops the Notes heading when there are no notes', () => {
    expect(toMarkdown(makeCard({ notes: '', quotes: [] }))).not.toContain('## Notes');
  });

  test('drops the Notes heading when the notes are only whitespace', () => {
    expect(toMarkdown(makeCard({ notes: '   \n\n  ', quotes: [] }))).not.toContain('## Notes');
  });

  test('exports frontmatter alone for a card with neither notes nor quotes', () => {
    const markdown = toMarkdown(makeCard({ notes: '', quotes: [] }));
    expect(markdown).not.toContain('## Notes');
    expect(markdown).not.toContain('>');
    expect(markdown.trimEnd().endsWith('---')).toBe(true);
  });

  test('ends with exactly one newline', () => {
    const card = makeCard({ notes: 'Body.', quotes: [quote('Quoted.')] });
    const markdown = toMarkdown(card);
    expect(markdown.endsWith('\n')).toBe(true);
    expect(markdown.endsWith('\n\n')).toBe(false);
  });

  test('renders two quotes and notes in order', () => {
    const card = makeCard({
      notes: 'Freeform notes body from the card.',
      quotes: [
        quote('First captured quote text.', { comment: 'My reaction to that quote.' }),
        quote('Second captured quote.'),
      ],
    });
    const markdown = toMarkdown(card);

    const first = markdown.indexOf('> First captured quote text.');
    const reaction = markdown.indexOf('My reaction to that quote.');
    const second = markdown.indexOf('> Second captured quote.');
    const notes = markdown.indexOf('## Notes');

    expect(first).toBeGreaterThan(0);
    expect(reaction).toBeGreaterThan(first);
    expect(second).toBeGreaterThan(reaction);
    expect(notes).toBeGreaterThan(second);
  });
});
```

Add `Quote` to the type import at the top of the test file:

```ts
import type { Quote } from './types';
```

- [ ] **Step 6: Run the tests and watch them fail**

```bash
cd extension
npx vitest run src/domain/markdown.test.ts
```

Expected: the 8 frontmatter tests pass and the 11 body tests fail, because
`toMarkdown` returns frontmatter only.

- [ ] **Step 7: `TODO(human)` — write `quoteBlock`**

Add the constant, the stub, and the assembled `toMarkdown` to
`extension/src/domain/markdown.ts`, replacing the one-line `toMarkdown` from
Step 3:

```ts
const LOST_MARKER = '*— location no longer resolves in the source article*';

/**
 * One quote as a Markdown block.
 *
 * Every line of the text is prefixed, so a quote spanning a paragraph break
 * stays ONE blockquote instead of two. A blank line inside the quote becomes a
 * bare ">", which is what holds the block together.
 */
function quoteBlock(quote: Quote): string {
  // TODO(human)
  return '';
}

export function toMarkdown(card: Card): string {
  const blocks: string[] = [frontmatter(card)];

  for (const quote of card.quotes) blocks.push(quoteBlock(quote));

  // The heading and the body are omitted together. There is no empty heading.
  if (card.notes.trim()) blocks.push('## Notes', card.notes.trim());

  return blocks.join('\n\n') + '\n';
}
```

Then make the request. The contribution is the quote block's internal shape:
how a comment sits under its quote, and where `LOST_MARKER` goes when a quote
carries both a comment and a lost locator. The tests in Step 5 pin both answers,
so the failing output is the specification.

The reference implementation, for the reviewer only:

```ts
function quoteBlock(quote: Quote): string {
  const blocks = [
    quote.text
      .split('\n')
      .map((line) => `> ${line}`.trimEnd())
      .join('\n'),
  ];

  if (quote.comment?.trim()) blocks.push(quote.comment.trim());
  if (quote.locatorLost) blocks.push(LOST_MARKER);

  return blocks.join('\n\n');
}
```

`.trimEnd()` on each line is what turns an empty line into `>` rather than
`"> "`, which matters because a trailing space in Markdown is a hard line break.

- [ ] **Step 8: Run the tests and watch them pass**

```bash
cd extension
npx vitest run src/domain/markdown.test.ts
```

Expected: 19 passed.

- [ ] **Step 9: Run the whole suite and the type check**

```bash
cd extension
npm test
npm run compile
```

Expected: `npm test` passes with 19 more tests than the 170 it passed at the end
of Milestone 2A, in one more file. `npm run compile` prints nothing.

- [ ] **Step 10: Check the dependency rule by hand**

```bash
cd extension
grep -n "^import" src/domain/markdown.ts
```

Expected: exactly one line, `import type { Card, Quote } from './types';`. A
non-`type` import here is a rule violation even if it compiles.

- [ ] **Step 11: Commit**

```bash
git add extension/src/domain/markdown.ts extension/src/domain/markdown.test.ts
git commit -m "feat(export): serialize a card to Markdown"
```

---

## Task 2: Build the versioned filename

**Files:**
- Modify: `extension/src/domain/markdown.ts`
- Test: `extension/src/domain/markdown.test.ts`

**Interfaces:**
- Consumes: `Card` from `src/domain/types.ts`.
- Produces: `exportFilename(card: Card, version: number): string`. Task 4 calls
  it as `exportFilename(card, card.exportVersion + 1)`.

**Carries a `TODO(human)`** on the sanitization. See Step 3.

- [ ] **Step 1: Write the failing filename tests**

Append to `extension/src/domain/markdown.test.ts`. Add `exportFilename` to the
`./markdown` import at the top of the file, and add `Card` to the type import
from `./types` that Task 1 Step 5 created:

```ts
describe('exportFilename', () => {
  // Every case in this block wants the same savedAt, because the date prefix
  // comes from it and is not what any of them is testing.
  const card = (overrides: Partial<Card> = {}) =>
    makeCard({ savedAt: '2026-08-16T09:31:00.000Z', ...overrides });

  test('is date first, then the title', () => {
    const subject = card({ title: 'How Great Questions Change a Company' });
    expect(exportFilename(subject, 1)).toBe(
      '2026-08-16 - How Great Questions Change a Company.md',
    );
  });

  test('adds no suffix for the first export', () => {
    expect(exportFilename(card({ title: 'Once' }), 1)).toBe('2026-08-16 - Once.md');
  });

  test('puts the version before the extension on a re-export', () => {
    expect(exportFilename(card({ title: 'Once' }), 2)).toBe('2026-08-16 - Once (v2).md');
    expect(exportFilename(card({ title: 'Once' }), 11)).toBe('2026-08-16 - Once (v11).md');
  });

  test('replaces every character Windows forbids in a filename', () => {
    const subject = card({ title: 'a\\b/c:d*e?f"g<h>i|j' });
    expect(exportFilename(subject, 1)).toBe('2026-08-16 - a-b-c-d-e-f-g-h-i-j.md');
  });

  test('collapses runs of whitespace to one space', () => {
    expect(exportFilename(card({ title: 'Too    many\n\nspaces' }), 1)).toBe(
      '2026-08-16 - Too many spaces.md',
    );
  });

  test('strips the trailing dots a title ending in an ellipsis leaves behind', () => {
    // Windows forbids a trailing dot as well as the nine forbidden characters.
    expect(exportFilename(card({ title: 'And then...' }), 1)).toBe(
      '2026-08-16 - And then.md',
    );
  });

  test('strips leading dots and spaces', () => {
    expect(exportFilename(card({ title: '  .hidden' }), 1)).toBe('2026-08-16 - hidden.md');
  });

  test('truncates a long title on a word boundary', () => {
    const title = 'word '.repeat(40).trim(); // 199 characters
    const name = exportFilename(card({ title }), 1);
    const stem = name.slice('2026-08-16 - '.length, -'.md'.length);

    expect(stem.length).toBeLessThanOrEqual(120);
    expect(stem.endsWith('word')).toBe(true);
    expect(stem).not.toContain('  ');
  });

  test('falls back to the article slug when the title sanitizes to nothing', () => {
    const subject = card({
      title: '///',
      url: 'https://alpha.substack.com/p/great-questions',
    });
    expect(exportFilename(subject, 1)).toBe('2026-08-16 - great-questions.md');
  });

  test('falls back to untitled when the URL has no slug either', () => {
    const subject = card({ title: '///', url: 'https://alpha.substack.com/' });
    expect(exportFilename(subject, 1)).toBe('2026-08-16 - untitled.md');
  });

  test('falls back to untitled when the URL is unparseable', () => {
    const subject = card({ title: '   ', url: 'not-a-url' });
    expect(exportFilename(subject, 1)).toBe('2026-08-16 - untitled.md');
  });
});
```

The `'a\\b/c:d*e?f"g<h>i|j'` title is one character from each of the nine
Windows forbids, in one string, so a fix that misses one fails visibly.

- [ ] **Step 2: Run the tests and watch them fail**

```bash
cd extension
npx vitest run src/domain/markdown.test.ts
```

Expected: the 19 Task 1 tests pass and the 11 new ones fail with
`exportFilename is not a function`.

- [ ] **Step 3: `TODO(human)` — write the sanitization**

Append the stubs to `extension/src/domain/markdown.ts`:

```ts
/** Every character Windows forbids in a filename. */
const FORBIDDEN = /[\\/:*?"<>|]/g;

const MAX_TITLE = 120;

/**
 * A title made safe to be a filename.
 *
 * Order matters: replace, collapse, trim, truncate. Replacing after trimming
 * would reintroduce a leading "-" from a title starting with "/".
 */
function sanitizeTitle(raw: string): string {
  // TODO(human)
  return '';
}

/** The last path segment of a URL, sanitized. Empty when there is none. */
function slugFromUrl(raw: string): string {
  try {
    const segments = new URL(raw).pathname.split('/').filter(Boolean);
    return sanitizeTitle(segments[segments.length - 1] ?? '');
  } catch {
    // A card can hold a URL this cannot parse. A filename is not the place to
    // find that out, so fall through to `untitled`.
    return '';
  }
}

/**
 * `YYYY-MM-DD - Title.md`, with ` (vN)` before the extension when N > 1.
 *
 * The date is savedAt, not the export date, so two exports of one card sort
 * next to each other in a Downloads folder.
 */
export function exportFilename(card: Card, version: number): string {
  const date = card.savedAt.slice(0, 10);
  const stem = sanitizeTitle(card.title) || slugFromUrl(card.url) || 'untitled';
  const suffix = version > 1 ? ` (v${version})` : '';
  return `${date} - ${stem}${suffix}.md`;
}
```

Then make the request. The contribution is `sanitizeTitle`: the order of the
four operations, and where a 120-character truncation is allowed to cut.

The reference implementation, for the reviewer only:

```ts
function sanitizeTitle(raw: string): string {
  const replaced = raw.replace(FORBIDDEN, '-').replace(/\s+/g, ' ');
  const trimmed = replaced.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');

  if (trimmed.length <= MAX_TITLE) return trimmed;

  const cut = trimmed.slice(0, MAX_TITLE);
  const lastSpace = cut.lastIndexOf(' ');
  // A single 120-character word has no boundary to cut on. Cut it anyway; a
  // truncated word beats a filename the filesystem refuses.
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.\s]+$/, '');
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
cd extension
npx vitest run src/domain/markdown.test.ts
```

Expected: 30 passed.

- [ ] **Step 5: Run the whole suite and the type check**

```bash
cd extension
npm test
npm run compile
```

Expected: both clean. `src/domain/markdown.ts` still imports types only, so no
new grep is needed beyond Task 1 Step 10.

- [ ] **Step 6: Commit**

```bash
git add extension/src/domain/markdown.ts extension/src/domain/markdown.test.ts
git commit -m "feat(export): build the versioned export filename"
```

---

## Task 3: Record an export, and move a card from the db layer

**Files:**
- Modify: `extension/src/db/cards.ts`
- Modify: `extension/src/db/cards.test.ts`
- Modify: `extension/src/ui/ReadingPanel.tsx:117-128` (delete the private
  `moveTo` and call `moveCardTo` instead)

**Interfaces:**
- Consumes: `db` from `./schema`, `reorderCards` and `OrderChange` from
  `../domain/card`, `Card` and `Status` from `../domain/types`. All four are
  already imported by `cards.ts`.
- Produces: `recordExport(cardId: string, at: string): Promise<void>` and
  `moveCardTo(cardId: string, toStatus: Status, now: string): Promise<void>`.
  Task 4 calls both.

Both take their timestamp as an argument rather than calling `new Date()`, so
the tests are deterministic. `ingestCard` calls `new Date()` itself, but it has
no caller who cares what the answer was; these two do.

- [ ] **Step 1: Write the failing `recordExport` tests**

`cards.test.ts` already opens with a `beforeEach` that clears the table and an
`onlyCard()` helper. Add to it:

```ts
describe('recordExport', () => {
  test('takes a never-exported card to version 1', async () => {
    await db.cards.add(makeCard({ id: 'c1', exportVersion: 0 }));

    await recordExport('c1', '2026-08-30T10:00:00.000Z');

    const card = await db.cards.get('c1');
    expect(card?.exportVersion).toBe(1);
    expect(card?.lastExportedAt).toBe('2026-08-30T10:00:00.000Z');
  });

  test('increments an already-exported card', async () => {
    await db.cards.add(
      makeCard({ id: 'c1', exportVersion: 1, lastExportedAt: '2026-08-29T10:00:00.000Z' }),
    );

    await recordExport('c1', '2026-08-30T10:00:00.000Z');

    const card = await db.cards.get('c1');
    expect(card?.exportVersion).toBe(2);
    expect(card?.lastExportedAt).toBe('2026-08-30T10:00:00.000Z');
  });

  test('changes nothing else on the card', async () => {
    await db.cards.add(makeCard({ id: 'c1', notes: 'kept', status: 'reading' }));

    await recordExport('c1', '2026-08-30T10:00:00.000Z');

    const card = await db.cards.get('c1');
    expect(card?.notes).toBe('kept');
    expect(card?.status).toBe('reading');
  });

  test('does nothing for a card that is not there', async () => {
    await expect(recordExport('missing', '2026-08-30T10:00:00.000Z')).resolves.toBeUndefined();
    expect(await db.cards.count()).toBe(0);
  });
});
```

Add `recordExport` to the import from `./cards` at the top of the test file.

- [ ] **Step 2: Run the tests and watch them fail**

```bash
cd extension
npx vitest run src/db/cards.test.ts
```

Expected: four failures, `recordExport is not a function`.

- [ ] **Step 3: Write `recordExport`**

Append to `extension/src/db/cards.ts`:

```ts
/**
 * Record that a card was exported.
 *
 * Read, increment, write, in one transaction, because the board's detail panel
 * and the reading panel can hold the same card open at once and two clicks
 * racing through get-then-update would both read the same version.
 *
 * A card that is gone is not an error. The reader deleted it between the click
 * and this write, and there is nothing left to record against.
 */
export async function recordExport(cardId: string, at: string): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;
    await db.cards.update(cardId, {
      exportVersion: card.exportVersion + 1,
      lastExportedAt: at,
    });
  });
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
cd extension
npx vitest run src/db/cards.test.ts
```

Expected: the four new tests pass alongside the file's existing ones.

- [ ] **Step 5: Write the failing `moveCardTo` tests**

Append to `extension/src/db/cards.test.ts`:

```ts
describe('moveCardTo', () => {
  test('puts the card at the top of the target column', async () => {
    await db.cards.bulkAdd([
      makeCard({ id: 'a', status: 'processed', sortOrder: 0 }),
      makeCard({ id: 'b', status: 'processed', sortOrder: 1 }),
      makeCard({ id: 'c', status: 'reading', sortOrder: 0 }),
    ]);

    await moveCardTo('c', 'processed', '2026-08-30T10:00:00.000Z');

    const processed = await db.cards
      .where('status')
      .equals('processed')
      .sortBy('sortOrder');
    expect(processed.map((card) => card.id)).toEqual(['c', 'a', 'b']);
  });

  test('leaves the cards it did not move in their order', async () => {
    await db.cards.bulkAdd([
      makeCard({ id: 'a', status: 'to_read', sortOrder: 0 }),
      makeCard({ id: 'b', status: 'to_read', sortOrder: 1 }),
      makeCard({ id: 'c', status: 'to_read', sortOrder: 2 }),
    ]);

    await moveCardTo('b', 'processed', '2026-08-30T10:00:00.000Z');

    const toRead = await db.cards.where('status').equals('to_read').sortBy('sortOrder');
    expect(toRead.map((card) => card.id)).toEqual(['a', 'c']);
  });

  test('stamps readAt on a first move into Reading', async () => {
    await db.cards.add(makeCard({ id: 'a', status: 'to_read', readAt: undefined }));

    await moveCardTo('a', 'reading', '2026-08-30T10:00:00.000Z');

    expect((await db.cards.get('a'))?.readAt).toBe('2026-08-30T10:00:00.000Z');
  });

  test('does nothing for a card that is not there', async () => {
    await db.cards.add(makeCard({ id: 'a', status: 'to_read', sortOrder: 0 }));

    await moveCardTo('missing', 'processed', '2026-08-30T10:00:00.000Z');

    expect((await db.cards.get('a'))?.status).toBe('to_read');
  });
});
```

Add `moveCardTo` to the import from `./cards`.

The `readAt` test pins behaviour that already lives in `reorderCards`, not new
behaviour. It is here because `moveCardTo` is now the only path the reading
panel's status buttons take, and a regression in it would silently stop
recording when articles were read.

- [ ] **Step 6: Run the tests and watch them fail**

```bash
cd extension
npx vitest run src/db/cards.test.ts
```

Expected: four failures, `moveCardTo is not a function`.

- [ ] **Step 7: Write `moveCardTo`**

Append to `extension/src/db/cards.ts`:

```ts
/**
 * Move one card to the top of another column.
 *
 * This was `ReadingPanel`'s private `moveTo`. It moved down here because the
 * Processed offer needs the same move from a second component, and because
 * src/ui/ has no automated tests: a behaviour living in a component is a
 * behaviour only a manual check can verify.
 *
 * reorderCards renumbers whole columns, so it needs every card. Reading them
 * inside the transaction is what makes the renumber safe against a concurrent
 * drag on the board. applyOrder called in here joins this transaction rather
 * than opening its own; Dexie reuses an active transaction of a compatible
 * scope.
 */
export async function moveCardTo(
  cardId: string,
  toStatus: Status,
  now: string,
): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const cards = await db.cards.orderBy('[status+sortOrder]').toArray();
    // reorderCards returns [] for a card it cannot find, and applyOrder returns
    // early on an empty list, so a deleted card falls through both.
    await applyOrder(reorderCards(cards, { cardId, toStatus, toIndex: 0 }, now));
  });
}
```

`cards.ts` does **not** import `reorderCards` yet. Its import block at line 3
reads `import { createCard } from '../domain/card';` and it takes `OrderChange`
from the same module as a type-only import at line 8. Change line 3 to:

```ts
import { createCard, reorderCards } from '../domain/card';
```

- [ ] **Step 8: Run the tests and watch them pass**

```bash
cd extension
npx vitest run src/db/cards.test.ts
```

Expected: all eight new tests pass.

- [ ] **Step 9: Put `ReadingPanel`'s status buttons on `moveCardTo`**

In `extension/src/ui/ReadingPanel.tsx`, delete the whole private `moveTo`
function:

```tsx
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
```

Change the status button's handler from `moveTo(status)` to the new call:

```tsx
                  onClick={() => void moveCardTo(card.id, status, new Date().toISOString())}
```

Fix the imports. `applyOrder`, `allCards`, and `reorderCards` were there only
for `moveTo`:

```tsx
import { addQuote, cardByArticleKey, moveCardTo, updateQuote } from '../db/cards';
```

Delete the `reorderCards` import line entirely:

```tsx
import { reorderCards } from '../domain/card';
```

And delete the `cards` query, which nothing reads any more:

```tsx
  const cards = useLiveQuery(() => allCards(), []);
```

- [ ] **Step 10: Run the type check, which is what catches this refactor**

```bash
cd extension
npm run compile
```

Expected: nothing. An unused import or a leftover reference to `cards` shows up
here, not in `npm test`, because the React layer has no tests.

- [ ] **Step 11: Run the whole suite and build**

```bash
cd extension
npm test
npm run build
```

Expected: `npm test` passes with 8 more tests than after Task 2. `npm run build`
is clean apart from the standing missing-`version` warning.

- [ ] **Step 12: Check the dependency rule by hand**

```bash
cd extension
grep -rn "from 'dexie'\|db/schema" src/ui/ && echo "VIOLATION" || echo "OK: ui clean"
```

Expected: `OK: ui clean`.

- [ ] **Step 13: Commit**

```bash
git add extension/src/db/cards.ts extension/src/db/cards.test.ts extension/src/ui/ReadingPanel.tsx
git commit -m "feat(export): record exports and move the column change into db/"
```

---

## Task 4: The export button, both footers, and the Processed offer

**Files:**
- Create: `extension/src/ui/exportCard.ts`
- Create: `extension/src/ui/ExportButton.tsx`
- Modify: `extension/src/ui/ReadingPanel.tsx`
- Modify: `extension/src/ui/DetailPanel.tsx`
- Modify: `extension/src/ui/styles.css`
- Modify: `extension/MANUAL-CHECKS.md`
- Modify: `changes.log`

**Interfaces:**
- Consumes: `toMarkdown(card)` and `exportFilename(card, version)` from Tasks 1
  and 2. `recordExport(cardId, at)` and `moveCardTo(cardId, toStatus, now)` from
  Task 3. `Card` from `src/domain/types.ts`.
- Produces: `exportCard(card: Card, now: string): Promise<ExportOutcome>` and the
  default-exported `ExportButton` component. Nothing after this milestone
  consumes them.

This task writes the only untested code in the milestone. Keep `exportCard`
thin and put every decision that could be wrong into the two pure modules that
already have tests.

- [ ] **Step 1: Write the download glue**

Create `extension/src/ui/exportCard.ts`:

```ts
import { recordExport } from '../db/cards';
import { exportFilename, toMarkdown } from '../domain/markdown';
import type { Card } from '../domain/types';

export type ExportOutcome =
  | { kind: 'ok'; filename: string }
  | { kind: 'not-recorded'; filename: string; reason: string }
  | { kind: 'failed'; reason: string };

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Write a card to a Markdown file the reader's browser downloads.
 *
 * The file is written FIRST and the export recorded second, deliberately. A
 * counter bumped ahead of a failed download would leave a version number for a
 * file that does not exist. In this order the worst case is the opposite: the
 * file lands, the counter stays put, and the next export generates the same
 * name, where Chrome's own conflict handling appends " (1)". A duplicate file
 * is recoverable; a phantom version in the database is not.
 *
 * The blob-and-anchor sequence is the one BackupControls has used since
 * Milestone 1. The extension has no `downloads` permission and needs none.
 */
export async function exportCard(card: Card, now: string): Promise<ExportOutcome> {
  const filename = exportFilename(card, card.exportVersion + 1);

  try {
    const blob = new Blob([toMarkdown(card)], { type: 'text/markdown' });
    const href = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(href);
  } catch (error) {
    return { kind: 'failed', reason: describe(error) };
  }

  try {
    await recordExport(card.id, now);
  } catch (error) {
    return { kind: 'not-recorded', filename, reason: describe(error) };
  }

  return { kind: 'ok', filename };
}
```

- [ ] **Step 2: Write the button and the offer**

Create `extension/src/ui/ExportButton.tsx`:

```tsx
import { useState } from 'react';
import { moveCardTo } from '../db/cards';
import { exportCard, type ExportOutcome } from './exportCard';
import type { Card } from '../domain/types';

interface Props {
  card: Card;
}

/**
 * Export the card, then offer the move to Processed.
 *
 * The offer is an offer. "Not yet" restores the plain button and remembers
 * nothing: exporting mid-read to check the format must not move a card the
 * reader has not finished.
 *
 * Mount this with key={card.id} so switching articles in the reading panel
 * clears the notice and the offer rather than showing the previous card's.
 */
export default function ExportButton({ card }: Props) {
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    setMoveError(null);
    const result = await exportCard(card, new Date().toISOString());
    setOutcome(result);
    // Nowhere to move a card that is already there, and an offer that does
    // nothing teaches the reader to ignore offers.
    setOfferOpen(result.kind !== 'failed' && card.status !== 'processed');
    setBusy(false);
  }

  async function handleMove() {
    setMoveError(null);
    try {
      await moveCardTo(card.id, 'processed', new Date().toISOString());
      setOfferOpen(false);
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <h3>Export</h3>
      <p>
        <button disabled={busy} onClick={() => void handleExport()}>
          Export Markdown
        </button>
      </p>

      {outcome?.kind === 'ok' ? (
        <p className="notice">Exported as “{outcome.filename}”.</p>
      ) : null}

      {outcome?.kind === 'not-recorded' ? (
        <p className="notice error">
          Saved “{outcome.filename}”, but the export was not recorded on the card:{' '}
          {outcome.reason}
        </p>
      ) : null}

      {outcome?.kind === 'failed' ? (
        <p className="notice error">The file could not be saved: {outcome.reason}</p>
      ) : null}

      {offerOpen ? (
        <p className="offer">
          Move to Processed?{' '}
          <button onClick={() => void handleMove()}>Yes</button>{' '}
          <button onClick={() => setOfferOpen(false)}>Not yet</button>
        </p>
      ) : null}

      {moveError ? (
        <p className="notice error">The card could not be moved: {moveError}</p>
      ) : null}
    </>
  );
}
```

The `not-recorded` case reports the file AND the failure. It is not a success
message, and it does not pretend the counter moved.

- [ ] **Step 3: Mount it in the reading panel**

In `extension/src/ui/ReadingPanel.tsx`, import the component:

```tsx
import ExportButton from './ExportButton';
```

Then add it to the footer, between the capture-error notice and the status
buttons:

```tsx
            {captureError ? <p className="notice error">{captureError}</p> : null}

            <ExportButton key={card.id} card={card} />

            <p className="statuses">
```

- [ ] **Step 4: Mount it in the board's detail panel**

In `extension/src/ui/DetailPanel.tsx`, import the component:

```tsx
import ExportButton from './ExportButton';
```

Then add it to the top of the footer, above the `<h3>Substack</h3>` heading:

```tsx
        footer={
          <>
            <ExportButton key={card.id} card={card} />

            <h3>Substack</h3>
```

- [ ] **Step 5: Style the offer row**

Append to `extension/src/ui/styles.css`:

```css
.offer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
```

`flex-wrap` is load-bearing. The side panel is narrow, and the offer's two
buttons must wrap under the question rather than overflow.

- [ ] **Step 6: Run the type check and the build**

```bash
cd extension
npm run compile
npm run build
```

Expected: `npm run compile` prints nothing. `npm run build` is clean apart from
the standing missing-`version` warning. This is the whole automated gate for
this task; the React layer has no tests.

- [ ] **Step 7: Run the whole suite and the dependency greps**

```bash
cd extension
npm test
grep -rn "from 'dexie'\|db/schema" src/ui/ && echo "VIOLATION" || echo "OK: ui clean"
grep -rn "^import" src/domain/markdown.ts
```

Expected: `npm test` unchanged from Task 3, since this task adds no tests.
`OK: ui clean`. `markdown.ts` still shows one type-only import.

- [ ] **Step 8: Add the manual checks**

Append a new section to `extension/MANUAL-CHECKS.md`, matching the file's
existing checkbox style:

```markdown
## Markdown export (Milestone 2B)

Load the unpacked build from `extension/.output/chrome-mv3/` first.

- [ ] Open a Substack article, click the toolbar button, and click **Export
      Markdown** in the panel. A file appears in Downloads named
      `YYYY-MM-DD - <title>.md`, dated by when the card was SAVED, not today.
- [ ] Open that file in a text editor. The frontmatter fences are `---`, the
      title is double-quoted, and every quote and note on the card is present.
- [ ] Click **Export Markdown** again on the same card. The second file carries
      ` (v2)` before `.md` and the first file is untouched.
- [ ] Open the board, open a card's detail panel, and export from there. Same
      file shape.
- [ ] Export a card in To Read, then answer **Yes** to "Move to Processed?".
      The card appears at the TOP of the Processed column.
- [ ] Export another card and answer **Not yet**. The card does not move and the
      plain Export button comes back.
- [ ] Export a card already in Processed. The file is written and NO offer
      appears.
- [ ] Export a card with no notes and no quotes. The file holds frontmatter and
      nothing else. This is correct, not a bug.
- [ ] Export a card whose article was paywalled. `reading_minutes` is absent
      from the frontmatter rather than present and empty.
- [ ] Export a card that has never been moved to Reading. `read:` is absent.
- [ ] Copy one exported file into an Obsidian vault, using a card that has been
      read and has a reading estimate so all eight keys are present. The
      Properties view reads title, author, publication, url, saved, read,
      reading_minutes, and tags.
- [ ] Edit an article after quoting it so the panel shows "location
      unavailable", then export. The quote text is intact and an italic line
      under it reads "location no longer resolves in the source article".
- [ ] NOT A BUG: if a file with the generated name already exists, Chrome
      appends its own ` (1)`, so a name can land as `... (v2) (1).md`. The
      extension cannot read the Downloads folder and cannot prevent this. No
      previous file is ever lost.
```

- [ ] **Step 9: Run every box in that section**

Run the section against a loaded build. Tick each box only after seeing it.

If a box fails, stop and fix the code rather than editing the box. The only box
that may be adjusted without a code change is the last one, which records
browser behaviour rather than this extension's.

- [ ] **Step 10: Update the README status**

In `README.md`, change the "Status" section so it reports Milestone 2B complete
and names what is still missing: the Obsidian vault write and its settings
surface, the Saved-list sync, and the backlog import.

- [ ] **Step 11: Write the `changes.log` entry**

Add an entry at the top of the "Entries" section using the template in the file,
and rewrite "Current state" to match. Record:

- What 2B shipped, in the four tasks.
- That the export is recorded after the file is written, and why that order.
- That `exportVersion` counts exports and not files on disk, so deleting a file
  by hand does not reuse its number.
- That `ReadingPanel`'s `moveTo` moved into `db/cards.ts` as `moveCardTo`, and
  that this converted a manual check into an automated one.
- The three amendments to `implementation-plan.md` the design named.
- Next up: the Obsidian vault write, which needs its own design.

- [ ] **Step 12: Commit**

```bash
git add extension/src/ui/exportCard.ts extension/src/ui/ExportButton.tsx \
  extension/src/ui/ReadingPanel.tsx extension/src/ui/DetailPanel.tsx \
  extension/src/ui/styles.css extension/MANUAL-CHECKS.md README.md changes.log
git commit -m "feat(export): export a card as Markdown from both panels"
```

---

## Definition of done

Every box above is ticked and:

- One click in either editor downloads a Markdown file matching the design's
  format.
- A second click produces a `(v2)` file and never overwrites the first.
- The card's `exportVersion` and `lastExportedAt` reflect the exports.
- The footer offers the move to Processed and honours both answers.
- Every failure path shows a visible string.
- `npm test`, `npm run compile`, and `npm run build` are clean from `extension/`.
- Both dependency greps pass, and `src/domain/markdown.ts` imports types only.
- Dexie is still at version 2.

## Corrections to the design doc

### Task 2, Step 3 — the reference `sanitizeTitle` fails two of its own tests

The reference implementation printed in Task 2 Step 3 trims with `/^[.\s]+/`
and `/[.\s]+$/`. Neither class contains `-`, so a title of nothing but
forbidden characters survives sanitization as a run of dashes:
`sanitizeTitle('///')` returns `'---'`, which is truthy and defeats the
`|| slugFromUrl(card.url) || 'untitled'` fallback in `exportFilename`. That
breaks two Step 1 tests: `falls back to the article slug when the title
sanitizes to nothing` and `falls back to untitled when the URL has no slug
either` (both use `title: '///'`).

**Fix, applied in commit 7daf39a:** the two trim regexes are `/^[.\s-]+/` and
`/[.\s-]+$/`. This matches the design's own rationale for the trim step (it
exists to clean up the dashes the replace step injects from leading/trailing
forbidden characters). Cost: an intentional leading or trailing literal dash
in a real title is also stripped (`'-30-'` → `'30'`). For Substack article
titles this is a rare cosmetic loss and the filename stays valid and
non-empty. Found by the Task 2 implementer running the Step 1 tests against
the verbatim reference.

## What is NOT in this milestone

- The Obsidian vault write, its settings surface, its persisted directory
  handle, the write permission that lapses between browser sessions, and the
  overwrite-versus-version rule for a note the reader has hand-edited. Its own
  design doc, after 2B has produced real notes in a real vault.
- The Markdown preview toggle from `prototype/DECISIONS.md`. Cheap once
  `toMarkdown` exists; deliberately out of scope.
- Bulk export of a column or a filtered set.
- Anything touching Substack's DOM. This milestone injects no code and reads no
  page.
