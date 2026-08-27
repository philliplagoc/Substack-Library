import Column from './Column';
import type { Card, Status } from '../domain/types';

export const COLUMNS: Array<{ status: Status; label: string }> = [
  { status: 'to_read', label: 'To Read' },
  { status: 'reading', label: 'Reading' },
  { status: 'processed', label: 'Processed' },
];

interface Props {
  cards: Card[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Board({ cards, selectedId, onSelect }: Props) {
  return (
    <section className="board">
      {COLUMNS.map(({ status, label }) => (
        <Column
          key={status}
          status={status}
          label={label}
          cards={cards.filter((c) => c.status === status)}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}