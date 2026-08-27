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
  return (
    <div className="column" data-status={status}>
      <h2>
        {label} <span className="count">({cards.length})</span>
      </h2>
      <div className="cards">
        {cards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            selected={card.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}