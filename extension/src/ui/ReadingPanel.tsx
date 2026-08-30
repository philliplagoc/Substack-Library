import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { browser } from 'wxt/browser';
import { allCards, applyOrder, cardByArticleKey } from '../db/cards';
import { reorderCards } from '../domain/card';
import { PANEL_STATE_KEY, type PanelState } from '../messages';
import CardEditor from './CardEditor';
import type { Status } from '../domain/types';

const COLUMN_LABELS: Record<Status, string> = {
  to_read: 'To Read',
  reading: 'Reading',
  processed: 'Processed',
};

/**
 * Follow the state the background writes on each toolbar click.
 *
 * Deliberately NOT tab focus. Switching to another article tab without
 * clicking leaves the panel where it was. The panel follows an action the
 * reader took, not one the browser took.
 */
function usePanelState(): PanelState | null | undefined {
  const [state, setState] = useState<PanelState | null | undefined>(undefined);

  useEffect(() => {
    let live = true;

    void browser.storage.session.get(PANEL_STATE_KEY).then((stored) => {
      if (live) setState((stored[PANEL_STATE_KEY] as PanelState | undefined) ?? null);
    });

    // The per-area `storage.session.onChanged` is newer than the generic
    // listener and not everywhere. Filter the generic one instead.
    const onChanged = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== 'session' || !(PANEL_STATE_KEY in changes)) return;
      setState((changes[PANEL_STATE_KEY]?.newValue as PanelState | undefined) ?? null);
    };

    browser.storage.onChanged.addListener(onChanged);
    return () => {
      live = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return state;
}

const OUTCOME_TEXT: Record<PanelState['outcome'], string> = {
  added: 'Added to To Read.',
  updated: 'Already on your board. Metadata refreshed.',
  rejected: "Couldn't read this page as a Substack article.",
};

export default function ReadingPanel() {
  const panel = usePanelState();
  const cards = useLiveQuery(() => allCards(), []);
  const card = useLiveQuery(
    () => (panel ? cardByArticleKey(panel.articleKey) : Promise.resolve(undefined)),
    [panel?.articleKey],
  );

  if (panel === undefined) return <p className="notice">Loading…</p>;

  if (panel === null) {
    return (
      <p className="notice">
        Open a Substack article and click the Substack Library toolbar button.
      </p>
    );
  }

  if (!card) {
    return (
      <div className="reading">
        <p className="notice error">{OUTCOME_TEXT[panel.outcome]}</p>
        {panel.notices.map((n) => (
          <p className="notice" key={n}>
            {n}
          </p>
        ))}
      </div>
    );
  }

  async function moveTo(toStatus: Status) {
    if (!cards || !card) return;
    // reorderCards renumbers whole columns, so it needs every card. toIndex 0
    // puts this one at the top of the target column, which is where the thing
    // being read right now belongs.
    const changes = reorderCards(
      cards,
      { cardId: card.id, toStatus, toIndex: 0 },
      new Date().toISOString(),
    );
    await applyOrder(changes);
  }

  return (
    <div className="reading">
      <p className="notice">{OUTCOME_TEXT[panel.outcome]}</p>
      {panel.notices.map((n) => (
        <p className="notice" key={n}>
          {n}
        </p>
      ))}

      <CardEditor
        card={card}
        footer={
          <p className="statuses">
            {(Object.keys(COLUMN_LABELS) as Status[]).map((status) => (
              <button
                key={status}
                disabled={card.status === status}
                onClick={() => void moveTo(status)}
              >
                {COLUMN_LABELS[status]}
              </button>
            ))}
          </p>
        }
      />
    </div>
  );
}
