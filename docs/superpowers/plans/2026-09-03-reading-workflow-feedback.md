# Reading Workflow Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Act on seven pieces of feedback from several days of real reading: quotes become removable, the unreliable quote-location subsystem is deleted, the editor says when it saved, exported Markdown puts Notes before Quotes, textareas resize vertically only, and no button moves a card between columns.

**Architecture:** Every change is local to the extension. Quotes gain a stable `id` so removal cannot corrupt a neighbour's comment, which needs Dexie schema version 4. The locator subsystem comes out root and branch, from `resolveQuote` down to the `prefix` the content script used to read. A single `useSaveStatus` hook in `CardEditor` serves both panels, because both render through it.

**Tech Stack:** TypeScript, React 19, Dexie 4 (IndexedDB), WXT (extension build), Vitest with fake-indexeddb, nanoid.

**Spec:** `docs/superpowers/specs/2026-09-03-reading-workflow-feedback-design.md`

## Global Constraints

- **Dependency rule:** `domain/` imports nothing from `db/` or `ui/`. Anything impure (a clock, an id generator) is passed in through a `deps` argument.
- **No new dependency.** `nanoid` is already in `package.json`.
- **No new permission, no new tab, no injected script.** This work only removes a page read.
- **`src/ui/` has no automated tests, by design.** Every UI behaviour is verified by a box in `extension/MANUAL-CHECKS.md`.
- **Run every command from `extension/`.** `npm test` is `vitest run`; `npm run compile` is `tsc --noEmit`.
- **TypeScript runs with `noUncheckedIndexedAccess`.** Any array index read is `T | undefined` and needs `?.` or a `!`.
- **Commit per task.** Each task below ends with one commit and is independently reviewable.
- **Commit trailer** — every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0126jAh6PJunMNRdaNdbkAnU
  ```
- **`changes.log`** gets one entry when the whole plan is done, not one per task. Use the template in that file.

## File Structure

| File | Responsibility after this plan |
| --- | --- |
| `src/domain/types.ts` | `Quote` carries `id`, `text`, optional `comment`, `capturedAt`. Nothing about location. |
| `src/domain/quote.ts` | `createQuote` only. About 20 lines, down from 99. |
| `src/domain/markdown.ts` | `cardBody` emits `Notes` then `Quotes`, each behind its own heading. |
| `src/db/schema.ts` | Version 4 assigns quote ids and strips the two dead fields. |
| `src/db/cards.ts` | Quotes addressed by id. `removeQuote` added, `moveCardTo` gone. |
| `src/messages.ts` | `PanelState` without `bodyText`; `CaptureSelectionReply` without `prefix`. |
| `src/substack/extract.ts` | `readSelection` returns `string | null`. |
| `src/ui/useSaveStatus.ts` | **New.** Three-state save indicator, shared by every field in one editor. |
| `src/ui/CardEditor.tsx` | Remove button per quote, the indicator, a debounce on comments. |
| `src/ui/ReadingPanel.tsx` | Capture and export only. No status row, no re-check effect. |
| `src/ui/ExportButton.tsx` | Export and its outcome notice only. No Processed offer. |

## Task Order

Task 1 comes first and everything else follows it: tasks 2 and 5 both address quotes by id, and task 3 deletes fields that task 1's migration is written against. Tasks 4, 6, and 7 are independent of each other but are written to run after 3, so no task ever touches a `locatorLost` that a later task deletes.

---

### Task 1: Quotes get a stable id

**Files:**
- Modify: `src/domain/types.ts:3-9`
- Modify: `src/domain/quote.ts:1-19`
- Modify: `src/domain/quote.test.ts:1-24`
- Modify: `src/db/schema.ts:49` (append version 4 before the closing brace)
- Modify: `src/db/schema.test.ts` (append a new describe block)
- Modify: `src/db/cards.ts:128-149` (`updateQuote`), `src/db/cards.ts:163-176` (`addQuote`), `src/db/cards.ts:86-125` (`restoreCards`)
- Modify: `src/db/cards.test.ts:320-361` (the `updateQuote` block), `383-416` (the `addQuote` block)
- Modify: `src/ui/CardEditor.tsx:63` (the `key` and the `updateQuote` call)
- Test: `src/domain/quote.test.ts`, `src/db/schema.test.ts`, `src/db/cards.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface Quote { id: string; text: string; comment?: string; locator?: string; locatorLost: boolean; capturedAt: string }` — `locator` and `locatorLost` still present here; task 3 removes them.
  - `createQuote(input: { text: string; prefix: string }, deps: { id: string; capturedAt: string }): Quote`
  - `updateQuote(cardId: string, quoteId: string, changes: Partial<Quote>): Promise<void>`
  - `addQuote(cardId: string, quote: Quote): Promise<void>` — unchanged signature.
  - Dexie schema version 4.

- [ ] **Step 1: Add `id` to the `Quote` type**

In `src/domain/types.ts`, replace the `Quote` interface:

```ts
export interface Quote {
  /**
   * Stable across a removal. Quotes used to be addressed by their index into
   * `card.quotes`, which was sound only while quotes were append-only.
   */
  id: string;
  text: string;
  comment?: string;
  locator?: string;
  locatorLost: boolean;
  capturedAt: string;
}
```

- [ ] **Step 2: Write the failing test for `createQuote`**

In `src/domain/quote.test.ts`, replace the whole first `describe('createQuote')` block with:

```ts
describe('createQuote', () => {
  test('is deterministic given an injected id and timestamp', () => {
    expect(
      createQuote(
        { text: 'the quoted sentence', prefix: 'words before it. ' },
        { id: 'q1', capturedAt: '2026-08-29T10:00:00.000Z' },
      ),
    ).toEqual({
      id: 'q1',
      text: 'the quoted sentence',
      locator: 'words before it. ',
      locatorLost: false,
      capturedAt: '2026-08-29T10:00:00.000Z',
    });
  });

  test('starts life resolved, because it was just seen in the article', () => {
    const q = createQuote(
      { text: 'x', prefix: '' },
      { id: 'q2', capturedAt: '2026-08-29T10:00:00.000Z' },
    );
    expect(q.locatorLost).toBe(false);
  });
});
```

Also update the local `q` helper further down that file so its quotes type-check:

```ts
function q(text: string, locator = ''): Quote {
  return { id: `q-${text}`, text, locator, locatorLost: false, capturedAt: '2026-08-29T10:00:00.000Z' };
}
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npm test -- src/domain/quote.test.ts`
Expected: FAIL. The received object has no `id` property, so `toEqual` reports a missing key.

- [ ] **Step 4: Take the id through `deps`**

In `src/domain/quote.ts`, replace `createQuote`:

```ts
/**
 * Build a quote from what the reader selected.
 *
 * Pure: the id and the timestamp both come in through `deps`, so the same
 * arguments always give the same quote. `db/cards.ts` owns the nanoid call,
 * the same way it owns the one for a card id.
 */
export function createQuote(
  input: { text: string; prefix: string },
  deps: { id: string; capturedAt: string },
): Quote {
  return {
    id: deps.id,
    text: input.text,
    locator: input.prefix,
    // It was on the page a moment ago. Nothing is lost yet.
    locatorLost: false,
    capturedAt: deps.capturedAt,
  };
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm test -- src/domain/quote.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing migration test**

In `src/db/schema.test.ts`, append:

```ts
/** The version 3 store definition, frozen. History does not change. */
const V3_STORES = { cards: 'id, &url, articleKey, status, savedAt, [status+sortOrder]' };

describe('the version 4 upgrade', () => {
  test('gives every stored quote an id and strips the dead locator fields', async () => {
    const name = `migration-${Math.random().toString(36).slice(2)}`;

    const v3 = new Dexie(name);
    v3.version(1).stores(V1_STORES);
    v3.version(2).stores(V2_STORES);
    v3.version(3).stores(V3_STORES);
    await v3.open();
    await v3.table('cards').add({
      ...makeCard({ id: 'quoted' }),
      quotes: [
        {
          text: 'first passage',
          comment: 'my reaction',
          locator: 'words before ',
          locatorLost: true,
          capturedAt: '2026-08-29T00:00:00.000Z',
        },
        {
          text: 'second passage',
          locator: '',
          locatorLost: false,
          capturedAt: '2026-08-29T00:00:00.000Z',
        },
      ],
    });
    v3.close();

    const v4 = new SubstackLibraryDb(name);
    await v4.open();
    const row = await v4.cards.get('quoted');
    v4.close();

    const quotes = (row?.quotes ?? []) as Record<string, unknown>[];
    expect(quotes).toHaveLength(2);
    // Ids exist and are distinct. Their values are nanoid's business.
    expect(typeof quotes[0]?.id).toBe('string');
    expect(quotes[0]?.id).not.toBe(quotes[1]?.id);
    for (const quote of quotes) {
      expect('locator' in quote).toBe(false);
      expect('locatorLost' in quote).toBe(false);
    }
    // Everything the reader wrote survives.
    expect(quotes[0]?.text).toBe('first passage');
    expect(quotes[0]?.comment).toBe('my reaction');
    expect(quotes[1]?.text).toBe('second passage');
  });

  test('leaves a card with no quotes alone', async () => {
    const name = `migration-${Math.random().toString(36).slice(2)}`;

    const v3 = new Dexie(name);
    v3.version(1).stores(V1_STORES);
    v3.version(2).stores(V2_STORES);
    v3.version(3).stores(V3_STORES);
    await v3.open();
    await v3.table('cards').add(makeCard({ id: 'bare', quotes: [] }));
    v3.close();

    const v4 = new SubstackLibraryDb(name);
    await v4.open();
    const row = await v4.cards.get('bare');
    v4.close();

    expect(row?.quotes).toEqual([]);
  });
});
```

- [ ] **Step 7: Run it and confirm it fails**

Run: `npm test -- src/db/schema.test.ts`
Expected: FAIL on `typeof quotes[0]?.id` — it is `undefined`, not `string`, because version 4 does not exist yet.

- [ ] **Step 8: Add schema version 4**

In `src/db/schema.ts`, add `import { nanoid } from 'nanoid';` at the top, then append after the version 3 block, still inside the constructor:

```ts
        // Quotes get an id. Until now `db/cards.ts` addressed a quote by its
        // index into card.quotes, which was sound only while quotes were
        // append-only. Removal ends that: take one out and every index below
        // it shifts, so a comment being typed into quote 2 lands on quote 1.
        //
        // The two locator fields go in the same pass. The staleness check they
        // fed never worked outside an open article tab, and it is deleted.
        //
        // The store string is identical to version 3. No index changes; only
        // the rows do.
        this.version(4)
            .stores({
                cards: 'id, &url, articleKey, status, savedAt, [status+sortOrder]',
            })
            .upgrade((tx) =>
                tx.table('cards').toCollection().modify((card: Record<string, unknown>) => {
                    const quotes = card.quotes;
                    if (!Array.isArray(quotes)) return;
                    for (const quote of quotes as Record<string, unknown>[]) {
                        // A card written by an aborted upgrade may already have
                        // one. Never reissue an id something else may reference.
                        if (typeof quote.id !== 'string') quote.id = nanoid();
                        delete quote.locator;
                        delete quote.locatorLost;
                    }
                }),
            );
```

- [ ] **Step 9: Run it and confirm it passes**

Run: `npm test -- src/db/schema.test.ts`
Expected: PASS, including the version 2 and version 3 blocks that were already there.

- [ ] **Step 10: Write the failing tests for id-addressed quote writes**

In `src/db/cards.test.ts`, replace the whole `describe('updateQuote')` block with:

```ts
describe('updateQuote', () => {
  const q = (id: string, text: string): Quote => ({
    id,
    text,
    locatorLost: false,
    capturedAt: '2026-08-29T00:00:00.000Z',
  });

  test('writes a comment onto one quote and leaves its neighbours alone', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'first'), q('q2', 'second')] }));

    await updateQuote('a', 'q2', { comment: 'my reaction' });

    const card = await getCard('a');
    expect(card?.quotes[0]?.comment).toBeUndefined();
    expect(card?.quotes[1]?.comment).toBe('my reaction');
    expect(card?.quotes[1]?.text).toBe('second');
  });

  test('finds a quote by id, not by position', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'first'), q('q2', 'second')] }));

    await updateQuote('a', 'q1', { comment: 'on the first' });

    const card = await getCard('a');
    expect(card?.quotes[0]?.comment).toBe('on the first');
    expect(card?.quotes[1]?.comment).toBeUndefined();
  });

  test('leaves the verbatim text alone', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'the exact words')] }));

    await updateQuote('a', 'q1', { comment: 'hm' });

    expect((await getCard('a'))?.quotes[0]?.text).toBe('the exact words');
  });

  test('does nothing when no quote carries that id', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'only')] }));

    await updateQuote('a', 'gone', { comment: 'nowhere' });

    const card = await getCard('a');
    expect(card?.quotes).toHaveLength(1);
    expect(card?.quotes[0]?.comment).toBeUndefined();
  });

  test('does nothing when the card is gone', async () => {
    await expect(updateQuote('missing', 'q1', { comment: 'x' })).resolves.toBeUndefined();
  });
});
```

And in the `describe('addQuote')` block, change its `q` helper and the two calls that build quotes:

```ts
  const q = (text: string): Quote => ({
    id: `id-${text}`,
    text,
    locatorLost: false,
    capturedAt: '2026-08-29T00:00:00.000Z',
  });
```

- [ ] **Step 11: Run them and confirm they fail**

Run: `npm test -- src/db/cards.test.ts`
Expected: FAIL. `updateQuote('a', 'q2', ...)` passes a string where the signature wants a number, so Vitest reports a type error, and at runtime `card.quotes['q2']` is `undefined` and the write is skipped.

- [ ] **Step 12: Address quotes by id in `db/cards.ts`**

Replace `updateQuote`:

```ts
/**
 * Change one quote on one card.
 *
 * Addressed by `quote.id`, not by position. Removal means a quote's index is
 * no longer stable, and an index that shifts under a mounted textarea writes
 * the reader's reaction onto the wrong passage.
 *
 * Read, patch, write, in one transaction, because two panels can hold the same
 * card open at once.
 */
export async function updateQuote(
  cardId: string,
  quoteId: string,
  changes: Partial<Quote>,
): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;

    const index = card.quotes.findIndex((quote) => quote.id === quoteId);
    if (index === -1) return;

    const quotes = card.quotes.slice();
    quotes[index] = { ...quotes[index]!, ...changes };
    await db.cards.update(cardId, { quotes });
  });
}
```

And update `addQuote`'s doc comment, whose old text asserts the invariant this task just retired:

```ts
/**
 * Append a quote to a card.
 *
 * Read, append, write, in one transaction. Position no longer addresses
 * anything, so appending is simply where a new quote reads best: last captured,
 * last shown.
 */
```

- [ ] **Step 13: Run the tests and confirm they pass**

Run: `npm test -- src/db/cards.test.ts`
Expected: PASS.

- [ ] **Step 14: Write the failing test for a backup with idless quotes**

`restoreCards` writes whole cards and deliberately bypasses migrations, so a backup file written before this task carries quotes with no id. In `src/db/cards.test.ts`, inside `describe('restoreCards')`, append:

```ts
  test('gives an id to a quote from a file written before quotes had one', async () => {
    const older = makeCard({ id: 'a' });
    // The shape a pre-version-4 backup holds: no id, and the two dead fields.
    const legacy = {
      ...older,
      quotes: [
        {
          text: 'a passage',
          comment: 'kept',
          locator: 'before it ',
          locatorLost: true,
          capturedAt: '2026-08-29T00:00:00.000Z',
        },
      ],
    } as unknown as Card;

    await restoreCards([legacy]);

    const quote = (await onlyCard()).quotes[0] as Record<string, unknown> | undefined;
    expect(typeof quote?.id).toBe('string');
    expect(quote?.text).toBe('a passage');
    expect(quote?.comment).toBe('kept');
    expect('locator' in (quote ?? {})).toBe(false);
    expect('locatorLost' in (quote ?? {})).toBe(false);
  });
```

- [ ] **Step 15: Run it and confirm it fails**

Run: `npm test -- src/db/cards.test.ts -t 'written before quotes had one'`
Expected: FAIL on `typeof quote?.id` being `undefined`.

- [ ] **Step 16: Normalize quotes inside `restoreCards`**

In `src/db/cards.ts`, add this helper above `restoreCards`:

```ts
/**
 * One quote from a backup file, brought up to the current shape.
 *
 * restoreCards writes whole cards and runs no migration, so a file written
 * before schema version 4 arrives with idless quotes carrying the two dead
 * locator fields. This is the same reason articleKey is recomputed below
 * rather than trusted: a file is a record of the past, not of the schema.
 */
function normalizeQuote(quote: Quote): Quote {
  const { locator: _locator, locatorLost: _locatorLost, ...rest } = quote as Quote & {
    locator?: string;
    locatorLost?: boolean;
  };
  return { ...rest, id: rest.id ?? nanoid() };
}
```

Then inside the `for (const card of cards)` loop, immediately after the `articleKey` line, add:

```ts
      const quotes = (card.quotes ?? []).map(normalizeQuote);
```

and put `quotes` into both `db.cards.put` calls in that loop:

```ts
      if (existing) {
        await db.cards.put({ ...card, id: existing.id, url, articleKey: key, quotes });
        replaced += 1;
      } else {
        await db.cards.put({ ...card, url, articleKey: key, quotes });
        added += 1;
      }
```

- [ ] **Step 17: Generate the id at the call site**

In `src/db/cards.ts`, nothing else changes — `nanoid` is already imported at line 1. In `src/ui/ReadingPanel.tsx`, the `createQuote` call now needs an id. Replace it:

```ts
    await addQuote(
      card.id,
      createQuote(
        { text: reply.text, prefix: reply.prefix },
        { id: nanoid(), capturedAt: new Date().toISOString() },
      ),
    );
```

and add `import { nanoid } from 'nanoid';` to that file's imports.

- [ ] **Step 18: Point `CardEditor` at ids**

In `src/ui/CardEditor.tsx`, change the quote list's key and its write call:

```tsx
          {card.quotes.map((quote) => (
            <li key={quote.id}>
              <blockquote>{quote.text}</blockquote>
              {quote.locatorLost ? (
                <span className="lost">location unavailable</span>
              ) : null}
              <textarea
                rows={2}
                placeholder="Your reaction"
                value={quote.comment ?? ''}
                onChange={(e) => void updateQuote(card.id, quote.id, { comment: e.target.value })}
              />
            </li>
          ))}
```

Note the `, i)` parameter is gone from the map callback.

- [ ] **Step 19: Run the whole suite and the type check**

Run: `npm test && npm run compile`
Expected: both green. `ReadingPanel.tsx`'s re-check effect still calls `updateQuote(card.id, i, ...)` with an index — fix it to `updateQuote(card.id, quote.id, ...)` if the compiler flags it; task 3 deletes that effect entirely.

- [ ] **Step 20: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(quotes): address a quote by id, not by position

db/cards.ts addressed a quote by its index into card.quotes under a
stated precondition: quotes are only ever appended. Removal, which is
coming next, ends that. Take a quote out and every index below it
shifts, so a comment being typed into one passage lands on another.

Schema version 4 assigns an id to every stored quote and strips the two
locator fields on the way past. restoreCards does the same for quotes
arriving from a backup written before this version, because it writes
whole cards and runs no migration.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jAh6PJunMNRdaNdbkAnU
EOF
```

---

### Task 2: `removeQuote`

**Files:**
- Modify: `src/db/cards.ts` (append after `updateQuote`)
- Test: `src/db/cards.test.ts` (append a new describe block)

**Interfaces:**
- Consumes: `Quote.id` and id-addressed `updateQuote` from Task 1.
- Produces: `removeQuote(cardId: string, quoteId: string): Promise<void>` — used by `CardEditor` in Task 5.

- [ ] **Step 1: Write the failing tests**

In `src/db/cards.test.ts`, append:

```ts
describe('removeQuote', () => {
  const q = (id: string, text: string): Quote => ({
    id,
    text,
    locatorLost: false,
    capturedAt: '2026-08-29T00:00:00.000Z',
  });

  test('removes the named quote and leaves the others in order', async () => {
    await db.cards.add(
      makeCard({ id: 'a', quotes: [q('q1', 'first'), q('q2', 'second'), q('q3', 'third')] }),
    );

    await removeQuote('a', 'q2');

    const card = await getCard('a');
    expect(card?.quotes.map((x) => x.id)).toEqual(['q1', 'q3']);
    expect(card?.quotes.map((x) => x.text)).toEqual(['first', 'third']);
  });

  test('leaves every surviving comment on its own quote', async () => {
    await db.cards.add(
      makeCard({
        id: 'a',
        quotes: [
          { ...q('q1', 'first'), comment: 'on the first' },
          { ...q('q2', 'second'), comment: 'on the second' },
          { ...q('q3', 'third'), comment: 'on the third' },
        ],
      }),
    );

    await removeQuote('a', 'q1');

    const card = await getCard('a');
    expect(card?.quotes[0]?.comment).toBe('on the second');
    expect(card?.quotes[1]?.comment).toBe('on the third');
  });

  test('removes the only quote, leaving an empty list rather than undefined', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'only')] }));

    await removeQuote('a', 'q1');

    expect((await getCard('a'))?.quotes).toEqual([]);
  });

  test('leaves the notes and the status alone', async () => {
    await db.cards.add(
      makeCard({ id: 'a', notes: 'kept', status: 'reading', quotes: [q('q1', 'x')] }),
    );

    await removeQuote('a', 'q1');

    const card = await getCard('a');
    expect(card?.notes).toBe('kept');
    expect(card?.status).toBe('reading');
  });

  test('does nothing when no quote carries that id', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'only')] }));

    await removeQuote('a', 'gone');

    expect((await getCard('a'))?.quotes).toHaveLength(1);
  });

  test('does nothing when the card is gone', async () => {
    await expect(removeQuote('missing', 'q1')).resolves.toBeUndefined();
  });

  test('is idempotent, so two panels removing the same quote is one removal', async () => {
    await db.cards.add(makeCard({ id: 'a', quotes: [q('q1', 'first'), q('q2', 'second')] }));

    await removeQuote('a', 'q1');
    await removeQuote('a', 'q1');

    expect((await getCard('a'))?.quotes.map((x) => x.id)).toEqual(['q2']);
  });
});
```

Add `removeQuote` to the import list at the top of the file.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/db/cards.test.ts -t removeQuote`
Expected: FAIL with `removeQuote is not a function` (or a TypeScript error on the missing export).

- [ ] **Step 3: Implement `removeQuote`**

In `src/db/cards.ts`, directly after `updateQuote`:

```ts
/**
 * Remove one quote from a card.
 *
 * Filtering by id rather than splicing an index is what makes this idempotent:
 * two panels holding the same card and both removing the same quote produce
 * one removal and one no-op, instead of a second removal taking a neighbour.
 *
 * A card that is gone is not an error, and neither is a quote that is already
 * gone. In both cases there is nothing left to remove.
 */
export async function removeQuote(cardId: string, quoteId: string): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (!card) return;

    const quotes = card.quotes.filter((quote) => quote.id !== quoteId);
    if (quotes.length === card.quotes.length) return;

    await db.cards.update(cardId, { quotes });
  });
}
```

- [ ] **Step 4: Run them and confirm they pass**

Run: `npm test -- src/db/cards.test.ts -t removeQuote`
Expected: PASS, seven tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test && npm run compile`
Expected: both green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(quotes): removeQuote

Filters by id rather than splicing an index, which makes it idempotent:
two panels removing the same quote is one removal, not a removal and a
neighbour taken by mistake.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jAh6PJunMNRdaNdbkAnU
EOF
```

---

### Task 3: Delete the quote-location subsystem

**Files:**
- Modify: `src/domain/types.ts` (drop `locator`, `locatorLost`)
- Modify: `src/domain/quote.ts` (delete `resolveQuote`, simplify `createQuote`)
- Modify: `src/domain/quote.test.ts` (delete the `resolveQuote` block)
- Modify: `src/domain/markdown.ts:47,56-68` (`LOST_MARKER` and its branch)
- Modify: `src/domain/markdown.test.ts:87-133` (the quote helper and the two lost-marker tests)
- Modify: `src/messages.ts:23,32` (`bodyText`, `prefix`)
- Modify: `src/entrypoints/background.ts:113,210,305`
- Modify: `src/substack/extract.ts:198-236` (`readSelection`)
- Modify: `src/ui/ReadingPanel.tsx:81-91,130-135` (the effect, the `createQuote` call)
- Modify: `src/ui/CardEditor.tsx` (the `location unavailable` span)
- Modify: `src/ui/styles.css:105` (`.quotes .lost`)
- Modify: `src/db/cards.test.ts`, `src/db/schema.test.ts` (any remaining `locatorLost` in a fixture)

**Interfaces:**
- Consumes: `Quote.id` from Task 1.
- Produces:
  - `interface Quote { id: string; text: string; comment?: string; capturedAt: string }` — final shape.
  - `createQuote(input: { text: string }, deps: { id: string; capturedAt: string }): Quote`
  - `readSelection(win?: Window): string | null`
  - `CaptureSelectionReply = { ok: true; text: string } | { ok: false; reason: string }`
  - `PanelState` without `bodyText`.

- [ ] **Step 1: Delete the tests for the behaviour being removed**

In `src/domain/quote.test.ts`: delete the entire `describe('resolveQuote')` block, the `q` helper above it, the `resolveQuote` import, and the `Quote` type import if nothing else uses it. Update the surviving `createQuote` tests to the final shape:

```ts
import { describe, test, expect } from 'vitest';
import { createQuote } from './quote';

describe('createQuote', () => {
  test('is deterministic given an injected id and timestamp', () => {
    expect(
      createQuote({ text: 'the quoted sentence' }, { id: 'q1', capturedAt: '2026-08-29T10:00:00.000Z' }),
    ).toEqual({
      id: 'q1',
      text: 'the quoted sentence',
      capturedAt: '2026-08-29T10:00:00.000Z',
    });
  });
});
```

In `src/domain/markdown.test.ts`: delete the two tests named `'marks a quote whose location no longer resolves'` and `'puts the lost marker after the comment when a quote has both'`, and change the `quote` helper in `describe('toMarkdown body')` to:

```ts
  const quote = (text: string, extra: Partial<Quote> = {}): Quote => ({
    id: `id-${text}`,
    text,
    capturedAt: '2026-08-17T00:00:00.000Z',
    ...extra,
  });
```

- [ ] **Step 2: Run the suite and see it fail on the type, not on behaviour**

Run: `npm test`
Expected: FAIL. `createQuote({ text })` is missing the required `prefix`, and the markdown helper omits the required `locatorLost`. These failures are the point: they list every place the fields reach.

- [ ] **Step 3: Cut the two fields from the type**

In `src/domain/types.ts`:

```ts
export interface Quote {
  /**
   * Stable across a removal. Quotes used to be addressed by their index into
   * `card.quotes`, which was sound only while quotes were append-only.
   */
  id: string;
  text: string;
  comment?: string;
  capturedAt: string;
}
```

- [ ] **Step 4: Reduce `domain/quote.ts` to `createQuote`**

Replace the entire file:

```ts
import type { Quote } from './types';

/**
 * Build a quote from what the reader selected.
 *
 * Pure: the id and the timestamp both come in through `deps`, so the same
 * arguments always give the same quote.
 *
 * This file used to hold `resolveQuote`, which answered "where is this quote in
 * the article now" and wrote a `locatorLost` flag back to the card. It was
 * deleted on 2026-09-03. The flag was persisted, and the only thing that could
 * ever clear it was a panel holding the live article text, so a board with no
 * article tab open showed "location unavailable" against quotes that were
 * perfectly intact. See the design doc for the full argument.
 */
export function createQuote(
  input: { text: string },
  deps: { id: string; capturedAt: string },
): Quote {
  return {
    id: deps.id,
    text: input.text,
    capturedAt: deps.capturedAt,
  };
}
```

- [ ] **Step 5: Cut the lost marker from the serializer**

In `src/domain/markdown.ts`, delete the `LOST_MARKER` constant and the line `if (quote.locatorLost) blocks.push(LOST_MARKER);` from `quoteBlock`.

- [ ] **Step 6: Cut `bodyText` and `prefix` from the message contracts**

In `src/messages.ts`, delete the `bodyText` field and its comment from `PanelState`, and reduce the reply:

```ts
export type CaptureSelectionReply =
  | { ok: true; text: string }
  | { ok: false; reason: string };
```

- [ ] **Step 7: Cut them from the background**

In `src/entrypoints/background.ts`: delete `bodyText: '',` (in `reject`) and `bodyText: meta.bodyText,` (in `capture`), and change the capture-selection response:

```ts
          sendResponse(
            found
              ? { ok: true, text: found }
              : { ok: false, reason: 'Select some text in the article first.' },
          );
```

- [ ] **Step 8: Reduce `readSelection` to the selection**

In `src/substack/extract.ts`, replace the whole `readSelection` function:

```ts
/**
 * What the reader has selected in the article.
 *
 * Returns null when nothing is selected. Self-contained: see the header.
 *
 * This used to also return the ~40 characters preceding the selection, read
 * with a Range, to break ties for `resolveQuote`. Both went on 2026-09-03.
 */
export function readSelection(win: Window = window): string | null {
  const selection = win.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const text = selection.toString().trim();
  return text || null;
}
```

Leave `bodyText` on `ExtractedMeta` alone. `wordCount` is derived from it, which is a separate consumer.

- [ ] **Step 9: Cut the re-check effect from the panel**

In `src/ui/ReadingPanel.tsx`: delete the entire `useEffect` that calls `resolveQuote` (with its long comment), remove `resolveQuote` and `updateQuote` from the imports if nothing else in the file uses them, and simplify the capture call:

```ts
    await addQuote(
      card.id,
      createQuote({ text: reply.text }, { id: nanoid(), capturedAt: new Date().toISOString() }),
    );
```

- [ ] **Step 10: Cut the label and its style**

In `src/ui/CardEditor.tsx`, delete these three lines from the quote list item:

```tsx
              {quote.locatorLost ? (
                <span className="lost">location unavailable</span>
              ) : null}
```

In `src/ui/styles.css`, delete the line `.quotes .lost { color: #b00; font-size: 11px; display: block; margin-bottom: 4px; }`.

- [ ] **Step 11: Clean the remaining fixtures**

Run: `grep -rn "locatorLost\|locator\b\|bodyText\|prefix" src/ --include=*.ts --include=*.tsx`

Every remaining hit must be one of: `bodyText` inside `src/substack/extract.ts` or `extract.test.ts` (kept — it feeds `wordCount`), the word "prefixed" in the `markdown.ts` comment about blockquotes, or the word "prefix" in the `url.ts` comment. Delete `locatorLost: false,` from every test fixture that still has one, including the `q` helpers in `src/db/cards.test.ts` and the migration fixture in `src/db/schema.test.ts` (leave the version 4 migration test's *input* rows alone — they are deliberately old-shaped and typed as `Record<string, unknown>`).

- [ ] **Step 12: Run the suite and the type check**

Run: `npm test && npm run compile`
Expected: both green. `src/domain/quote.test.ts` is now one test; `src/domain/markdown.test.ts` has two fewer.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -F - <<'EOF'
refactor(quotes): delete the quote-location subsystem

The "location unavailable" label meant "not checked recently", not
"gone". locatorLost was persisted state, and the only thing that could
clear it was a panel holding live article text, so a board with no
article tab open reported every quote lost forever.

Out with it: resolveQuote and its tests, the locator and locatorLost
fields, the re-check effect, the Markdown lost marker, bodyText's trip
through PanelState, and the whole prefix chain that fed the locator -
readSelection's Range walk included. bodyText stays in extract.ts,
where wordCount is derived from it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jAh6PJunMNRdaNdbkAnU
EOF
```

---

### Task 4: Notes before Quotes in exported Markdown

**Files:**
- Modify: `src/domain/markdown.ts:70-91` (`cardBody`)
- Test: `src/domain/markdown.test.ts`

**Interfaces:**
- Consumes: the `Quote` shape from Task 3.
- Produces: `cardBody(card: Card, level: number): string[]` — unchanged signature, new output order. Used by `toMarkdown` (level 2) and `libraryCard` (level 4).

- [ ] **Step 1: Write the failing tests**

In `src/domain/markdown.test.ts`, inside `describe('toMarkdown body')`, replace the existing ordering test (the one that ends `expect(notes).toBeGreaterThan(second)`) with:

```ts
  test('puts Notes before Quotes, each under its own heading', () => {
    const card = makeCard({
      notes: 'Freeform notes body from the card.',
      quotes: [
        quote('First captured quote text.', { comment: 'My reaction to that quote.' }),
        quote('Second captured quote.'),
      ],
    });
    const markdown = toMarkdown(card);

    const notesHeading = markdown.indexOf('## Notes');
    const notesBody = markdown.indexOf('Freeform notes body from the card.');
    const quotesHeading = markdown.indexOf('## Quotes');
    const first = markdown.indexOf('> First captured quote text.');
    const reaction = markdown.indexOf('My reaction to that quote.');
    const second = markdown.indexOf('> Second captured quote.');

    expect(notesHeading).toBeGreaterThan(0);
    expect(notesBody).toBeGreaterThan(notesHeading);
    expect(quotesHeading).toBeGreaterThan(notesBody);
    expect(first).toBeGreaterThan(quotesHeading);
    expect(reaction).toBeGreaterThan(first);
    expect(second).toBeGreaterThan(reaction);
  });

  test('drops the Quotes heading when there are no quotes', () => {
    const markdown = toMarkdown(makeCard({ notes: 'A thought.', quotes: [] }));
    expect(markdown).toContain('## Notes');
    expect(markdown).not.toContain('## Quotes');
  });

  test('drops the Notes heading but keeps Quotes when only quotes were taken', () => {
    const markdown = toMarkdown(makeCard({ notes: '', quotes: [quote('A passage.')] }));
    expect(markdown).not.toContain('## Notes');
    expect(markdown).toContain('## Quotes');
    expect(markdown).toContain('> A passage.');
  });

  test('emits neither heading for a card with no notes and no quotes', () => {
    const markdown = toMarkdown(makeCard({ notes: '', quotes: [] }));
    expect(markdown).not.toContain('## Notes');
    expect(markdown).not.toContain('## Quotes');
  });
```

And in `describe('toLibraryMarkdown')`, beside the existing `expect(out).toContain('#### Notes')` assertion, add:

```ts
  test('nests both headings under the card heading at level four', () => {
    const out = toLibraryMarkdown(
      [makeCard({ title: 'One', notes: 'A thought.', quotes: [quote('A passage.')] })],
      '2026-09-03T00:00:00.000Z',
    );

    expect(out).toContain('#### Notes');
    expect(out).toContain('#### Quotes');
    expect(out).not.toContain('\n## Notes');
    expect(out).not.toContain('\n## Quotes');
    expect(out.indexOf('#### Notes')).toBeGreaterThan(out.indexOf('### One'));
    expect(out.indexOf('#### Quotes')).toBeGreaterThan(out.indexOf('#### Notes'));
  });
```

The `quote` helper lives in the `toMarkdown body` block. Move it to module scope, above the first `describe`, so both blocks can use it.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/domain/markdown.test.ts`
Expected: FAIL. `## Quotes` appears nowhere, and `notesHeading` is greater than `first` rather than less.

- [ ] **Step 3: Reorder `cardBody`**

In `src/domain/markdown.ts`, replace `cardBody`:

```ts
/**
 * The notes and the quotes of one card, in that order.
 *
 * Notes first because they are what the reader wrote about the article as a
 * whole; the quotes are the evidence under it.
 *
 * `level` is the heading level both headings take. A single note nests them
 * under nothing and passes 2. The library nests them under a `###` card heading
 * and passes 4. One builder rather than two copies: the next change to this
 * shape has to hold in both files, and the day it is made once is the day the
 * two disagree.
 *
 * A section with no content emits no heading. There is no empty heading and no
 * heading with nothing under it.
 */
function cardBody(card: Card, level: number): string[] {
  const blocks: string[] = [];
  const heading = '#'.repeat(level);

  if (card.notes.trim()) blocks.push(`${heading} Notes`, card.notes.trim());

  if (card.quotes.length > 0) {
    blocks.push(`${heading} Quotes`);
    for (const quote of card.quotes) blocks.push(quoteBlock(quote));
  }

  return blocks;
}
```

- [ ] **Step 4: Run them and confirm they pass**

Run: `npm test -- src/domain/markdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test && npm run compile`
Expected: both green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(export): Notes before Quotes, each under its own heading

Quotes used to be emitted first with no heading at all, and Notes came
last. Both sections are now labelled and Notes leads, since it is what
the reader wrote about the article rather than the evidence under it.

An empty section still emits no heading, which is the rule the code
already applied to notes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jAh6PJunMNRdaNdbkAnU
EOF
```

---

### Task 5: The saved indicator, the debounce, and the remove button

**Files:**
- Create: `src/ui/useSaveStatus.ts`
- Modify: `src/ui/CardEditor.tsx` (whole file)
- Modify: `src/ui/styles.css` (append)
- Modify: `extension/MANUAL-CHECKS.md` (append a section)

**Interfaces:**
- Consumes: `removeQuote` from Task 2, `updateQuote(cardId, quoteId, changes)` from Task 1.
- Produces: `useSaveStatus(): { status: SaveStatus; beginSave: () => void; endSave: () => void }` where `type SaveStatus = 'idle' | 'saving' | 'saved'`.

- [ ] **Step 1: Write the hook**

Create `src/ui/useSaveStatus.ts`:

```ts
import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved';

/** How long "Saved" stays on screen before the editor goes quiet again. */
const SAVED_MS = 2000;

/**
 * One save indicator for one editor.
 *
 * Every field in the editor reports through the same instance, because the
 * editor writes one card. Two markers disagreeing about whether the card is
 * saved is a question the reader should never have to answer.
 *
 * `beginSave` is called when a debounce starts, not when the write is issued:
 * the seconds between the last keystroke and the write are exactly when the
 * reader most wants to know something is pending.
 *
 * A write that never resolves leaves the indicator at "saving". That is the
 * honest report. This extension has no error toast, and the absence of a
 * success is the failure signal.
 */
export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>('idle');

  // Held in a ref, not in state, so a second save landing during the two-second
  // window cancels the first timer instead of racing it back to idle.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function beginSave() {
    if (timer.current) clearTimeout(timer.current);
    setStatus('saving');
  }

  function endSave() {
    setStatus('saved');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), SAVED_MS);
  }

  return { status, beginSave, endSave };
}
```

- [ ] **Step 2: Rewrite `CardEditor`**

Replace `src/ui/CardEditor.tsx` entirely:

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { removeQuote, updateCard, updateQuote } from '../db/cards';
import { useSaveStatus, type SaveStatus } from './useSaveStatus';
import TagEditor from './TagEditor';
import type { Card } from '../domain/types';

/** How long after the last keystroke a field is written. */
const DEBOUNCE_MS = 300;

interface Props {
  card: Card;
  /**
   * Controls the caller owns, rendered after the quotes. A slot rather than a
   * row of booleans: the board wants delete, the reading panel wants capture,
   * and neither needs the other to know about it.
   */
  footer?: ReactNode;
}

const SAVE_TEXT: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: '✓ Saved',
};

/** The first words of a quote, for a confirmation the reader can recognize. */
function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat;
}

export default function CardEditor({ card, footer }: Props) {
  const [notes, setNotes] = useState(card.notes);
  const save = useSaveStatus();

  // A different card was selected. Show its notes.
  useEffect(() => {
    setNotes(card.notes);
  }, [card.id]);

  // Write 300ms after the last keystroke, not on every one.
  useEffect(() => {
    if (notes === card.notes) return;
    save.beginSave();
    const timer = setTimeout(() => {
      void updateCard(card.id, { notes }).then(save.endSave);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [notes, card.id, card.notes]);

  async function handleRemoveQuote(quoteId: string, text: string) {
    const ok = window.confirm(`Remove this quote?\n\n“${preview(text)}”\n\nThis cannot be undone.`);
    if (!ok) return;
    await removeQuote(card.id, quoteId);
  }

  return (
    <>
      <h2 className="editor-title">
        {card.title}
        <span className="save-status" aria-live="polite">
          {SAVE_TEXT[save.status]}
        </span>
      </h2>
      <p className="meta">
        {[card.publication, card.author].filter(Boolean).join(' · ')}
        {card.estimatedReadingMinutes != null ? ` · ${card.estimatedReadingMinutes} min` : ''}
      </p>
      <p className="meta">
        <a href={card.url} target="_blank" rel="noreferrer">
          {card.url}
        </a>
      </p>

      <TagEditor card={card} />

      <label>
        Notes
        <textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <h3>Quotes</h3>
      {card.quotes.length === 0 ? (
        <p className="meta">No quotes yet.</p>
      ) : (
        <ul className="quotes">
          {card.quotes.map((quote) => (
            <li key={quote.id}>
              <blockquote>{quote.text}</blockquote>
              <QuoteComment
                cardId={card.id}
                quoteId={quote.id}
                initial={quote.comment ?? ''}
                onSaveStart={save.beginSave}
                onSaveEnd={save.endSave}
              />
              <p>
                <button
                  className="remove-quote"
                  onClick={() => void handleRemoveQuote(quote.id, quote.text)}
                >
                  Remove quote
                </button>
              </p>
            </li>
          ))}
        </ul>
      )}

      {footer}
    </>
  );
}

/**
 * One quote's comment box.
 *
 * Its own component so each comment owns its own draft and its own debounce
 * timer. Written as one field in the parent, a debounce keyed on a changing
 * quote index would cancel a neighbour's pending write.
 *
 * Comments used to write on every keystroke. They now use the same 300ms
 * debounce as notes, which is what lets one indicator describe both honestly:
 * a per-keystroke write never leaves "Saving…".
 */
function QuoteComment({
  cardId,
  quoteId,
  initial,
  onSaveStart,
  onSaveEnd,
}: {
  cardId: string;
  quoteId: string;
  initial: string;
  onSaveStart: () => void;
  onSaveEnd: () => void;
}) {
  const [comment, setComment] = useState(initial);

  useEffect(() => {
    setComment(initial);
  }, [quoteId]);

  useEffect(() => {
    if (comment === initial) return;
    onSaveStart();
    const timer = setTimeout(() => {
      void updateQuote(cardId, quoteId, { comment }).then(onSaveEnd);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [comment, cardId, quoteId, initial]);

  return (
    <textarea
      rows={2}
      placeholder="Your reaction"
      value={comment}
      onChange={(e) => setComment(e.target.value)}
    />
  );
}
```

- [ ] **Step 3: Style the indicator and the remove button**

In `src/ui/styles.css`, append:

```css
/*
 * The title row carries the save indicator. Space-between rather than a float,
 * so a long title wraps under the indicator instead of behind it.
 */
.editor-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.save-status {
  color: var(--muted);
  font-size: 11px;
  font-weight: normal;
  white-space: nowrap;
}
.remove-quote { font-size: 11px; }
```

- [ ] **Step 4: Type-check and build**

Run: `npm run compile && npm test`
Expected: both green. No automated test covers this task's behaviour; `src/ui/` has none by design.

- [ ] **Step 5: Verify by hand in a loaded build**

Run: `npm run build`, then load `extension/.output/chrome-mv3` as an unpacked extension and check each box in `extension/MANUAL-CHECKS.md` under the new section added in the next step.

- [ ] **Step 6: Add the manual checks**

In `extension/MANUAL-CHECKS.md`, append:

```markdown
## 2026-09-03: reading workflow feedback

### Removing a quote

- [ ] Capture three quotes and write a different comment on each. Remove the
      first; the other two keep their own comments.
- [ ] Remove a quote and cancel the confirmation; nothing is removed.
- [ ] Remove the only quote on a card; the panel shows "No quotes yet."
- [ ] Remove a quote in the side panel while the board's detail panel shows the
      same card; the board updates without a refresh.

### The saved indicator

- [ ] Type in Notes and stop. "Saving…" appears, becomes "✓ Saved", and goes
      away after about two seconds.
- [ ] Type in a quote comment; the same indicator runs, next to the title.
- [ ] Type continuously for ten seconds; the indicator stays on "Saving…" and
      does not flicker between states on every keystroke.
- [ ] Open the panel and touch nothing; no indicator is shown.
- [ ] Type a comment, then reopen the card; the comment is there.
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(editor): remove a quote, and say when a field was saved

One indicator per editor rather than one per field, because the editor
writes one card, and both panels render through CardEditor.

Quote comments move to the 300ms debounce notes already used. They wrote
on every keystroke, which no honest indicator can describe: it would
never leave "Saving…". Each comment is now its own component so one
field's debounce cannot cancel a neighbour's pending write.

Removing a quote confirms first, showing the first 60 characters. There
is no undo anywhere in this extension and the source page may be closed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jAh6PJunMNRdaNdbkAnU
EOF
```

---

### Task 6: No button changes a card's status

**Files:**
- Modify: `src/ui/ReadingPanel.tsx` (delete `COLUMN_LABELS`, the `.statuses` block, the `Status` and `moveCardTo` imports)
- Modify: `src/ui/ExportButton.tsx` (delete the offer)
- Modify: `src/db/cards.ts` (delete `moveCardTo`)
- Modify: `src/db/cards.test.ts:457-500` (delete `describe('moveCardTo')` and the import)
- Modify: `src/ui/styles.css` (delete `.reading .statuses` and `.offer`)
- Modify: `extension/MANUAL-CHECKS.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `moveCardTo` no longer exists. `applyOrder` and `reorderCards` are untouched — the board's drag uses both.

- [ ] **Step 1: Delete the `moveCardTo` tests**

In `src/db/cards.test.ts`, delete the entire `describe('moveCardTo')` block and remove `moveCardTo` from the import list.

- [ ] **Step 2: Run the suite and confirm it still passes**

Run: `npm test -- src/db/cards.test.ts`
Expected: PASS. Deleting tests for behaviour that is about to go is not a regression; the `applyOrder` and `reorderCards` blocks still cover reordering.

- [ ] **Step 3: Cut the status row from the reading panel**

In `src/ui/ReadingPanel.tsx`: delete the `COLUMN_LABELS` constant, the `import type { Status }` line, `moveCardTo` from the `db/cards` import, and this whole block from the footer:

```tsx
            <p className="statuses">
              {(Object.keys(COLUMN_LABELS) as Status[]).map((status) => (
                <button
                  key={status}
                  disabled={card.status === status}
                  onClick={() => void moveCardTo(card.id, status, new Date().toISOString())}
                >
                  {COLUMN_LABELS[status]}
                </button>
              ))}
            </p>
```

- [ ] **Step 4: Cut the offer from the export button**

Replace `src/ui/ExportButton.tsx`:

```tsx
import { useState } from 'react';
import { exportCard, type ExportOutcome } from './exportCard';
import type { Card } from '../domain/types';

interface Props {
  card: Card;
}

/**
 * Export the card and say what happened.
 *
 * It used to offer a move to Processed after a successful export. That offer
 * went on 2026-09-03, along with the reading panel's status row: a card moves
 * column when the reader drags it on the board and at no other time. Exporting
 * mid-read to check the format is not a claim that the article is finished, and
 * inferring one from an export was the extension guessing.
 *
 * Mount this with key={card.id} so switching articles in the reading panel
 * clears the notice rather than showing the previous card's.
 */
export default function ExportButton({ card }: Props) {
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    setOutcome(null);
    setOutcome(await exportCard(card, new Date().toISOString()));
    setBusy(false);
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
    </>
  );
}
```

- [ ] **Step 5: Delete `moveCardTo`**

In `src/db/cards.ts`, delete the whole `moveCardTo` function and its doc comment. Then confirm nothing calls it:

Run: `grep -rn "moveCardTo" src/`
Expected: no output.

Leave `reorderCards` in `src/domain/card.ts` alone. `applyOrder` calls it for the board's drag.

- [ ] **Step 6: Delete the dead styles**

In `src/ui/styles.css`, delete `.reading .statuses { ... }` and the whole `.offer { ... }` rule.

Run: `grep -rn "statuses\|offer" src/`
Expected: no output.

- [ ] **Step 7: Type-check and run everything**

Run: `npm test && npm run compile`
Expected: both green.

- [ ] **Step 8: Add the manual checks**

In `extension/MANUAL-CHECKS.md`, under the `## 2026-09-03` section added in Task 5, append:

```markdown
### No button moves a card

- [ ] The side panel has no To Read / Reading / Processed buttons.
- [ ] Export a card from the side panel; no "Move to Processed?" offer appears.
- [ ] Export a card from the board's detail panel; same.
- [ ] Drag a card from To Read to Reading on the board; it moves and stays there
      after a refresh.
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(board): no button changes a card's status

Removes the reading panel's three-button status row and the "Move to
Processed?" offer after an export. moveCardTo then has no callers and
goes with them; reorderCards stays, since the board's drag needs it.

A card moves column when the reader drags it and at no other time.
Exporting mid-read to check the format was never a claim that the
article was finished.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jAh6PJunMNRdaNdbkAnU
EOF
```

---

### Task 7: Vertical-only resize, and close out the plan

**Files:**
- Modify: `src/ui/styles.css:96,106,122`
- Modify: `extension/MANUAL-CHECKS.md`
- Modify: `changes.log`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. This task is CSS, verification, and the handoff record.

- [ ] **Step 1: Constrain every textarea to vertical resize**

In `src/ui/styles.css`, add `resize: vertical;` to all three textarea rules:

```css
.panel textarea { width: 100%; font: inherit; resize: vertical; }
```

```css
.quotes textarea { width: 100%; font: inherit; font-size: 12px; resize: vertical; }
```

```css
.reading textarea { width: 100%; font: inherit; resize: vertical; }
```

The reason, for anyone reading the diff: these boxes are `width: 100%` inside a panel whose width the browser owns. Dragging one wider overflows the panel; dragging it narrower leaves a column with no way back short of a reload.

- [ ] **Step 2: Confirm no textarea was missed**

Run: `grep -n "textarea" src/ui/styles.css`
Expected: every rule that sets `width: 100%` on a textarea also sets `resize: vertical`.

- [ ] **Step 3: Add the remaining manual checks**

In `extension/MANUAL-CHECKS.md`, under the `## 2026-09-03` section, append:

```markdown
### Textarea resize

- [ ] Drag the corner of the Notes box in the side panel; it grows and shrinks
      vertically only.
- [ ] Same for a quote comment box.
- [ ] Same for both boxes in the board's detail panel.

### Export format

- [ ] Export a card with notes and quotes; the file has `## Notes` above
      `## Quotes`.
- [ ] Export a card with quotes and no notes; there is no `## Notes` heading.
- [ ] Export a card with notes and no quotes; there is no `## Quotes` heading.
- [ ] Export all; each card has `#### Notes` and `#### Quotes` under its `###`
      title.
- [ ] Open both files in Obsidian; the frontmatter parses and the headings nest.

### No quote location label

- [ ] Open a card with quotes while its article tab is closed; no quote shows
      "location unavailable".
- [ ] Capture a quote, close the article tab, refresh the board, and reopen the
      card; still no label.
- [ ] An exported file contains no "location no longer resolves" line.

### Already done in Milestone 4, verified against this build

- [ ] Build with `npm run build`, reload the unpacked extension from
      `extension/.output/chrome-mv3`, and open the board's detail panel. There
      is no Substack heading and no Liked / Commented / Unsaved checkbox.
```

- [ ] **Step 4: Build, reload, and run every new box**

Run: `npm run build`

Load `extension/.output/chrome-mv3` as an unpacked extension (chrome://extensions → Developer mode → Load unpacked), then work through every unticked box in the `## 2026-09-03` section, including the ones added in Tasks 5 and 6. Tick each one as it passes.

If the Substack checkbox box fails, stop: that would mean the fields are live somewhere the source search missed, and the plan needs a new task rather than a tick.

- [ ] **Step 5: Run the full suite one last time**

Run: `npm test && npm run compile`
Expected: both green. Report the actual test count rather than "tests pass".

- [ ] **Step 6: Write the `changes.log` entry**

Add this at the top of the "Entries" section of `changes.log`, filling in the verification line with the real numbers from Step 5:

```markdown
### 2026-09-03 - Reading workflow feedback

**What changed:** Quotes carry an id and can be removed. The quote-location
subsystem is deleted, from `resolveQuote` down to the `prefix` the content
script read. `CardEditor` shows one save indicator for the card and debounces
quote comments the way it already debounced notes. Exported Markdown puts Notes
before Quotes, each under its own heading. Every textarea resizes vertically
only. No button moves a card between columns; dragging on the board is the only
way.
**Why:** Feedback after several days of real reading. The location label was the
sharpest item: it said "unavailable" when it meant "not checked recently",
because `locatorLost` was persisted and only a panel holding live article text
could ever clear it. Rejected: hiding the label and keeping the machinery, which
leaves an effect writing to the database to maintain a field nothing reads.
**Files:** `src/domain/{types,quote,markdown}.ts`, `src/db/{schema,cards}.ts`,
`src/messages.ts`, `src/substack/extract.ts`, `src/entrypoints/background.ts`,
`src/ui/{CardEditor,ReadingPanel,ExportButton,useSaveStatus,styles.css}`, their
tests, `extension/MANUAL-CHECKS.md`.
**Verification:** `npm test` (<N> tests, all passing) and `npm run compile`,
both green. Every box in the "2026-09-03: reading workflow feedback" section of
`MANUAL-CHECKS.md` ticked against a loaded build.
**State after:** Schema version 4. Quotes are id-addressed everywhere. The three
Substack checkboxes were already gone in Milestone 4 and were re-verified
against a fresh build; the earlier report of them was a stale unpacked build.
**Next up:** Milestone 5, the self-filling Add-by-URL form, unchanged by this
work.
**Open questions:** none.
```

Then update the "Current state" section to match: schema version 4, this work complete and verified, Milestone 5 still next.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(ui): vertical-only textarea resize, and close out the feedback work

These boxes are width:100% inside a panel whose width the browser owns.
Dragging one wider overflowed the panel; dragging it narrower left a
column with no way back short of a reload.

Also records the manual checks and the changes.log entry for the whole
seven-task run.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jAh6PJunMNRdaNdbkAnU
EOF
```

---

## Notes for the executor

**The learning notes.** `docs/learning-notes.md` gets an entry only when the developer asks a question, never on your own initiative and never as part of a task. Two questions are likely here: why an array index is an unsafe address for a list that can shrink, and why a debounce is what makes a save indicator truthful. If they ask, write the note in the section for the current date and run the `stop-slop` skill on it.

**`changes.log` gets one entry for the whole plan**, written in Task 7, not one per task. That file records intent, not diffs.

**If a task turns out bigger than written**, stop and say so rather than expanding it silently. The most likely candidate is Task 3: `grep` in its Step 11 is the check that the deletion was complete, and a surprising hit there is worth reporting before deleting it.
