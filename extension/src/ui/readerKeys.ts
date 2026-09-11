/**
 * Which article key to ask the board for, given what the tab can tell us and
 * what the background has already resolved.
 *
 * `classifyTab` computes `tab.articleKey` from the address bar alone, which is
 * honest for a publication's own `/p/<slug>` page. On Substack's reader shell
 * — `/inbox/post/<id>`, `/home/post/p-<id>`, `/@<handle>/p-<id>` — the address
 * bar names the app, not the article, so `articleKey()` falls through to the
 * canonical URL string and the board holds nothing under it. Only a DOM read
 * knows the real identity, and the background does exactly that when it
 * ingests, then records the answer under READER_KEYS_KEY.
 *
 * This turns that record into the key the panel queries. A plain function over
 * plain data, in the same spirit as `panelView.ts`: `vitest` runs in the node
 * environment and collects only `src/**\/*.test.ts`, so nothing that renders
 * React can be tested at all. This can.
 */
import type { ReaderKeys } from '../messages';
import type { FocusedTab } from './focusedTab';

/**
 * @param tab what is focused right now.
 * @param remembered the map under READER_KEYS_KEY, or undefined while session
 *   storage is still being read.
 * @param resolvedNow a key the panel learned from an `add-article` reply this
 *   render, before the storage write has come back around. Outranks
 *   `remembered`; null when nothing has been added this visit.
 * @returns the key to query, null when the focused tab is not an article at
 *   all, and undefined when the answer is not knowable yet — the panel treats
 *   that as "wait", which is what keeps the Add button from flashing over an
 *   article that is already on the board.
 */
export function effectiveArticleKey(
  tab: FocusedTab,
  remembered: ReaderKeys | undefined,
  resolvedNow: string | null,
): string | null | undefined {
  if (tab.kind !== 'article') return null;

  // Checked before the wait below: a key this panel just watched the
  // background resolve is the freshest answer there is, and waiting on a
  // record of the very same fact would be waiting for nothing.
  if (resolvedNow != null) return resolvedNow;

  // Every article tab waits, not just a reader-shell one.
  //
  // Telling the two apart here would mean matching URL shapes a second time,
  // in a module whose whole point is that it does not have to: it keys on
  // whatever `articleKey()` already made of the address bar. The cost is one
  // extra frame of "Loading…" on a publication page, against one uniform rule
  // — no answer until the record has been read. The gap is a single session
  // storage read, and `useReaderKeys` starts it on mount.
  if (remembered === undefined) return undefined;

  // A direct `/p/<slug>` tab never has an entry: the background only records
  // a mapping when the provisional key and the real one disagree, which only
  // a reader-shell route makes happen. So the fallback is the common path,
  // not the exceptional one.
  return remembered[tab.articleKey] ?? tab.articleKey;
}
