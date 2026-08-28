import { useEffect, useState } from 'react';
import { updateCard, deleteCard } from '../db/cards';
import type { Card } from '../domain/types';

interface Props {
  card: Card;
  onClose: () => void;
}

export default function DetailPanel({ card, onClose }: Props) {
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
        <p className="meta">No quotes yet. Milestone 2 adds selection capture.</p>
      ) : (
        <ul>
          {card.quotes.map((q, i) => (
            <li key={i}>
              “{q.text}”
              {q.comment ? ` — ${q.comment}` : ''}
              {q.locatorLost ? <span className="lost"> (location unavailable)</span> : null}
            </li>
          ))}
        </ul>
      )}

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
            onChange={(e) => void updateCard(card.id, { unsavedFromSubstack: e.target.checked })}
          />{' '}
          Unsaved from Substack
        </label>
      </p>

      <p>
        <button onClick={handleDelete}>Delete card</button>
      </p>
    </aside>
  );
}