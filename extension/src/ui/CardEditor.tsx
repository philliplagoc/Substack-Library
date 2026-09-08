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
    let fired = false;
    const timer = setTimeout(() => {
      fired = true;
      void updateCard(card.id, { notes }).then(save.endSave).catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      if (!fired) save.abortSave();
    };
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
                onAbort={save.abortSave}
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
  onAbort,
}: {
  cardId: string;
  quoteId: string;
  initial: string;
  onSaveStart: () => void;
  onSaveEnd: () => void;
  onAbort: () => void;
}) {
  const [comment, setComment] = useState(initial);

  useEffect(() => {
    setComment(initial);
  }, [quoteId]);

  useEffect(() => {
    if (comment === initial) return;
    onSaveStart();
    let fired = false;
    const timer = setTimeout(() => {
      fired = true;
      void updateQuote(cardId, quoteId, { comment }).then(onSaveEnd).catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      if (!fired) onAbort();
    };
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
