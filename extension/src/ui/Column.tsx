import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import CardTile from './CardTile';
import type { Card, Status } from '../domain/types';

interface Props {
  status: Status;
  label: string;
  cards: Card[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Column({ status, label, cards, selectedId, onSelect }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });

  return (
    <div className={`column${isOver ? ' over' : ''}`} data-status={status}>
      <h2>
        {label} <span className="count">({cards.length})</span>
      </h2>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="cards" ref={setNodeRef}>
          {cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              selected={card.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}