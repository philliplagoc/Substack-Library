import { deleteCard } from '../db/cards';
import CardEditor from './CardEditor';
import ExportButton from './ExportButton';
import type { Card } from '../domain/types';

interface Props {
  card: Card;
  onClose: () => void;
}

export default function DetailPanel({ card, onClose }: Props) {
  async function handleDelete() {
    const ok = window.confirm(`Delete "${card.title}"? This cannot be undone.`);
    if (!ok) return;
    await deleteCard(card.id);
    onClose();
  }

  return (
    <aside className="panel">
      <button className="close" onClick={onClose} aria-label="Close panel">
        ×
      </button>

      <CardEditor
        card={card}
        footer={
          <>
            <h3>Export</h3>
            <div className="export-row">
              <ExportButton key={card.id} card={card} />
            </div>

            <p>
              <button onClick={handleDelete}>Delete card</button>
            </p>
          </>
        }
      />
    </aside>
  );
}
