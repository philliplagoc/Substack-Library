import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  return (
    <article
      ref={setNodeRef}
      className={`card${selected ? ' selected' : ''}${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={() => onSelect(card.id)}
      {...attributes}
      {...listeners}
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