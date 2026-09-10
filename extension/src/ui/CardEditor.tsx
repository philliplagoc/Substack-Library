import { useEffect, useRef, useState, type ReactNode } from 'react';
import { removeQuote, updateCard, updateQuote } from '../db/cards';
import { useSaveStatus, type SaveStatus } from './useSaveStatus';
import TagEditor from './TagEditor';
import { BookmarkIcon, ExternalLinkIcon, PencilIcon, TrashIcon } from './icons';
import type { Card } from '../domain/types';

/** How long after the last keystroke a field is written. */
const DEBOUNCE_MS = 300;

/** Ties the Notes label to its box. Only one editor is mounted per document. */
const NOTES_ID = 'card-notes';

interface Props {
  card: Card;
  /**
   * Controls the caller owns, rendered after the quotes. A slot rather than a
   * row of booleans: the board wants delete, the reading panel wants capture,
   * and neither needs the other to know about it.
   */
  footer?: ReactNode;
  /**
   * A control the caller owns, rendered on the right of the Quotes heading.
   * Same reasoning as `footer`: the reading panel wants Capture up there beside
   * the count, and the board wants nothing at all.
   */
  quotesAction?: ReactNode;
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

export default function CardEditor({ card, footer, quotesAction }: Props) {
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

  // Adopt the stored notes only when no write of our own is pending. One card
  // can be open in two side panels, one per Chrome window, so this value
  // changes from outside while this editor is mounted. Mid-edit the
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
      {/*
        * Title first in the DOM, publication and author after it. The mockup
        * draws the byline above the title, and the panel's stylesheet puts it
        * there with `order`. Reordering the markup instead would move the
        * board's detail panel too, and would read the byline out before the
        * article it belongs to.
        */}
      <section className="editor-header">
        <h2 className="editor-title">
          <span className="title-text">{card.title}</span>
          <span className="save-status" aria-live="polite">
            {SAVE_TEXT[save.status]}
          </span>
        </h2>

        <p className="meta byline">
          <BookmarkIcon className="section-icon" />
          {card.publication ? <span className="publication">{card.publication}</span> : null}
          {card.publication && card.author ? <span className="sep"> · </span> : null}
          {card.author ? <span className="author">{card.author}</span> : null}
          {card.estimatedReadingMinutes != null ? (
            <>
              {card.publication || card.author ? <span className="sep"> · </span> : null}
              <span className="reading-time">{card.estimatedReadingMinutes} min read</span>
            </>
          ) : null}
        </p>

        <p className="meta source">
          <a href={card.url} target="_blank" rel="noreferrer">
            <ExternalLinkIcon className="section-icon" />
            <span className="url-text">{card.url}</span>
          </a>
        </p>
      </section>

      <TagEditor card={card} />

      <section className="editor-notes">
        <div className="section-head">
          <PencilIcon className="section-icon" />
          {/* A label, not a heading: it names the box it is tied to. */}
          <label htmlFor={NOTES_ID}>Notes</label>
        </div>
        <textarea
          id={NOTES_ID}
          rows={8}
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
        />
      </section>

      <section className="editor-quotes">
        <div className="section-head">
          <h3>
            Quotes
            {card.quotes.length > 0 ? <span className="count">{card.quotes.length}</span> : null}
          </h3>
          {quotesAction}
        </div>

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
                  {/*
                    * Icon and words both, and each stylesheet drops the one it
                    * does not want: the panel keeps the icon, the board keeps
                    * the words. The aria-label carries the meaning either way.
                    */}
                  <button
                    className="remove-quote"
                    aria-label="Remove quote"
                    onClick={() => void handleRemoveQuote(quote.id, quote.text)}
                  >
                    <TrashIcon className="section-icon" />
                    <span className="label">Remove quote</span>
                  </button>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

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
