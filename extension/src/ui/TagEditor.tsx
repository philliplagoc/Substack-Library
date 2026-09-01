import { useState, type KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { allCards, updateCard } from '../db/cards';
import { addTag, allTags, removeTag } from '../domain/tags';
import type { Card } from '../domain/types';

const SUGGESTIONS_ID = 'tag-suggestions';

/**
 * Tags on one card, in both editors.
 *
 * It reads the vocabulary itself rather than taking it as a prop. Milestone 1
 * decided that UI reads Dexie directly with no messaging layer, and a
 * `suggestions` prop would mean `CardEditor` growing a prop it does not use so
 * that both of its parents can supply it. The cost is that opening the side
 * panel now reads every card to build a suggestion list.
 */
export default function TagEditor({ card }: { card: Card }) {
  const [draft, setDraft] = useState('');
  const cards = useLiveQuery(() => allCards(), []);
  const vocabulary = allTags(cards ?? []);
  const tags = card.tags ?? [];

  function commit() {
    const next = addTag(tags, draft);
    setDraft('');
    // A rejected tag returns the same array. Nothing to write, and nothing to
    // say: the chip the reader wanted is already on screen.
    if (next.length !== tags.length) void updateCard(card.id, { tags: next });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter inside a form would submit it; a comma would land in the draft
      // only to be stripped by normalizeTag a moment later.
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      event.preventDefault();
      void updateCard(card.id, { tags: tags.slice(0, -1) });
    }
  }

  return (
    <div className="tags">
      <label htmlFor="tag-input">Tags</label>
      {tags.length > 0 ? (
        <ul className="chips">
          {tags.map((tag) => (
            <li key={tag}>
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => void updateCard(card.id, { tags: removeTag(tags, tag) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id="tag-input"
        list={SUGGESTIONS_ID}
        placeholder="Add a tag"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        // A typed but uncommitted tag survives clicking away.
        onBlur={commit}
      />
      <datalist id={SUGGESTIONS_ID}>
        {vocabulary.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}
