import { useEffect, useState, type ReactNode } from 'react';
import { updateCard, updateQuote } from '../db/cards';
import TagEditor from './TagEditor';
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
              <textarea
                rows={2}
                placeholder="Your reaction"
                value={quote.comment ?? ''}
                onChange={(e) => void updateQuote(card.id, quote.id, { comment: e.target.value })}
              />
            </li>
          ))}
        </ul>
      )}

      {footer}
    </>
  );
}
