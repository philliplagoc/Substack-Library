import { updateCard, deleteCard } from '../db/cards';
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
            <ExportButton key={card.id} card={card} />

            <h3>Substack</h3>
            <p>
              <label>
                <input
                  type="checkbox"
                  checked={card.liked}
                  onChange={(e) => void updateCard(card.id, { liked: e.target.checked })}
                />{' '}
                Liked
              </label>
            </p>
            <p>
              <label>
                <input
                  type="checkbox"
                  checked={card.commented}
                  onChange={(e) => void updateCard(card.id, { commented: e.target.checked })}
                />{' '}
                Commented
              </label>
            </p>
            <p>
              <label>
                <input
                  type="checkbox"
                  checked={card.unsavedFromSubstack}
                  onChange={(e) =>
                    void updateCard(card.id, { unsavedFromSubstack: e.target.checked })
                  }
                />{' '}
                Unsaved from Substack
              </label>
            </p>
            <p>
              <button onClick={handleDelete}>Delete card</button>
            </p>
          </>
        }
      />
    </aside>
  );
}
