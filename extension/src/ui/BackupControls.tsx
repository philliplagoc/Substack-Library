import { useRef, useState, type ChangeEvent } from 'react';
import { allCards, restoreCards } from '../db/cards';
import { toBackup, fromBackup } from '../domain/backup';

export default function BackupControls() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  async function handleExport() {
    const file = toBackup(await allCards(), new Date().toISOString());
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `substack-library-${file.exportedAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);

    setNotice({ text: `Exported ${file.cards.length} cards.`, error: false });
  }

  async function handleRestore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // Let the reader pick the same file twice.
    if (!file) return;

    const { cards, errors } = fromBackup(await file.text());

    if (cards.length === 0) {
      setNotice({ text: `Nothing to restore. ${errors.join(' ')}`, error: true });
      return;
    }

    const ok = window.confirm(
      `Restore ${cards.length} cards?\n\n` +
        'A card already on the board with the same URL is overwritten by the file.\n' +
        'Cards not in the file are kept.',
    );
    if (!ok) return;

    const { added, replaced } = await restoreCards(cards);
    const skipped = errors.length ? ` Skipped ${errors.length}: ${errors.join(' ')}` : '';
    setNotice({ text: `Added ${added}. Replaced ${replaced}.${skipped}`, error: errors.length > 0 });
  }

  return (
    <>
      <button onClick={handleExport}>Export JSON</button>
      <button onClick={() => fileInput.current?.click()}>Restore JSON</button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleRestore}
      />
      {notice ? <span className={`notice${notice.error ? ' error' : ''}`}>{notice.text}</span> : null}
    </>
  );
}