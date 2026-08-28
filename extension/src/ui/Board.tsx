import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import Column from './Column';
import { reorderCards } from '../domain/card';
import { applyOrder } from '../db/cards';
import type { Card, Status } from '../domain/types';

export const COLUMNS: Array<{ status: Status; label: string }> = [
  { status: 'to_read', label: 'To Read' },
  { status: 'reading', label: 'Reading' },
  { status: 'processed', label: 'Processed' },
];

const STATUSES = COLUMNS.map((c) => c.status);

function isStatus(value: string): value is Status {
  return (STATUSES as string[]).includes(value);
}

interface Props {
  cards: Card[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Board({ cards, selectedId, onSelect }: Props) {
  const sensors = useSensors(
    // A small distance keeps a plain click from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const cardId = String(active.id);
    const overId = String(over.id);

    let toStatus: Status;
    let toIndex: number;

    if (overId.startsWith('column:')) {
      const status = overId.slice('column:'.length);
      if (!isStatus(status)) return;
      toStatus = status;
      toIndex = cards.filter((c) => c.status === status && c.id !== cardId).length;
    } else {
      const overCard = cards.find((c) => c.id === overId);
      if (!overCard) return;
      toStatus = overCard.status;
      toIndex = cards.filter((c) => c.status === toStatus && c.id !== cardId).indexOf(overCard);
      if (toIndex < 0) toIndex = 0;
    }

    await applyOrder(reorderCards(cards, { cardId, toStatus, toIndex }, new Date().toISOString()));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
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
    </DndContext>
  );
}