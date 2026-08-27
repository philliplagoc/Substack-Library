import type { Card } from '../domain/types';

/** The one-line summary under the title. Empty when there is nothing to say. */
export function statusLabel(card: Card): string {
  const bits: string[] = [];
  if (card.notes.trim()) bits.push('notes');
  if (card.quotes.length) bits.push(`${card.quotes.length} quote${card.quotes.length === 1 ? '' : 's'}`);
  if (card.exportVersion > 0) bits.push(`exported v${card.exportVersion}`);
  return bits.join(' · ');
}

interface Props {
  card: Card;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function CardTile({ card, selected, onSelect }: Props) {
  return (
    <article
      className={`card${selected ? ' selected' : ''}`}
      onClick={() => onSelect(card.id)}
    >
      <h3 className="title">{card.title}</h3>
      <p className="pub">
        {[card.publication, card.author].filter(Boolean).join(' · ') || '—'}
      </p>
      <p className="row">
        <span>{card.estimatedReadingMinutes != null ? `${card.estimatedReadingMinutes} min` : '— min'}</span>
      </p>
      <p className="status">{statusLabel(card)}</p>
    </article>
  );
}