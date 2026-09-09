import { useEffect, useRef, useState, type ReactNode } from 'react';
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

  // The debounce for the notes box. A ref, not state, because it is the answer
  // to "is a local edit pending?" and every reader of it needs the answer now,
  // not on the next render.
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The write the pending timer would issue, held so a card switch can fire it
  // early instead of dropping what the reader just typed.
  const notesFlush = useRef<(() => void) | null>(null);

  // Write 300ms after the last keystroke, not on every one. Driven from the
  // change handler rather than from an effect over `notes`: an effect that
  // compares the draft against the stored value cannot tell the reader's own
  // typing apart from a value that arrived from the other panel, and writes the
  // stale draft back over it.
  function handleNotesChange(value: string) {
    setNotes(value);
    const cardId = card.id;

    if (notesTimer.current) clearTimeout(notesTimer.current);
    else save.beginSave(); // Idle to pending: announce it once, not per keystroke.

    notesFlush.current = () => {
      notesTimer.current = null;
      notesFlush.current = null;
      void updateCard(cardId, { notes: value }).then(save.endSave).catch(() => {});
    };
    notesTimer.current = setTimeout(() => notesFlush.current?.(), DEBOUNCE_MS);
  }

  // Adopt the stored notes only when no write of our own is pending. The same
  // card can be open in the side panel and the board's detail panel at once, so
  // this value changes from outside while this editor is mounted. Mid-edit the
  // local draft wins and will be written; once it lands, the next outside
  // change is adopted, which is what stops the two panels reverting each other.
  useEffect(() => {
    if (notesTimer.current === null) setNotes(card.notes);
  }, [card.notes]);

  // A different card was selected. The pending write belongs to the card we are
  // leaving, and it is addressed by that card's id, so fire it rather than
  // discard the reader's last keystrokes. Then show the new card's notes.
  useEffect(() => {
    if (notesTimer.current) {
      clearTimeout(notesTimer.current);
      notesFlush.current?.();
    }
    setNotes(card.notes);
  }, [card.id]);

  // Unmounting with a debounce still pending: nothing will write it, so take
  // the announced save back off the indicator.
  useEffect(() => {
    return () => {
      if (notesTimer.current) {
        clearTimeout(notesTimer.current);
        notesTimer.current = null;
        notesFlush.current = null;
        save.abortSave();
      }
    };
  }, []);

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
        <textarea rows={8} value={notes} onChange={(e) => handleNotesChange(e.target.value)} />
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
 *
 * `initial` is live: the same card can be open in two panels, so the stored
 * comment changes underneath a mounted box. The rule is to adopt the incoming
 * value only when no write of our own is pending. While the reader is mid-edit
 * their draft wins; once it lands, the next incoming value is adopted. Without
 * that rule the two panels write each other's stale drafts back and forth.
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

  // Whether a debounced write of our own is waiting. Same shape as the notes
  // box above, for the same reason.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(value: string) {
    setComment(value);

    if (timer.current) clearTimeout(timer.current);
    else onSaveStart(); // Idle to pending: announce it once, not per keystroke.

    timer.current = setTimeout(() => {
      timer.current = null;
      void updateQuote(cardId, quoteId, { comment: value }).then(onSaveEnd).catch(() => {});
    }, DEBOUNCE_MS);
  }

  // Adopt the incoming comment only when nothing of ours is pending.
  useEffect(() => {
    if (timer.current === null) setComment(initial);
  }, [initial]);

  // An abandoned debounce is a save that was announced and will never arrive.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        onAbort();
      }
    };
  }, []);

  return (
    <textarea
      rows={2}
      placeholder="Your reaction"
      value={comment}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
}
