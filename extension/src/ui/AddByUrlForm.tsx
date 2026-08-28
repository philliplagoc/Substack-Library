import { useState, type FormEvent } from 'react';
import { ingestCard } from '../db/cards';

export default function AddByUrlForm() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publication, setPublication] = useState('');
  const [minutes, setMinutes] = useState('');
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  function reset() {
    setUrl('');
    setTitle('');
    setAuthor('');
    setPublication('');
    setMinutes('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const result = await ingestCard({
      url,
      title: title || undefined,
      author: author || undefined,
      publication: publication || undefined,
      estimatedReadingMinutes: minutes === '' ? undefined : Number(minutes),
    });

    if (result.kind === 'added') {
      setNotice({ text: `Added "${result.card.title}" to To Read.`, error: false });
      reset();
    } else if (result.kind === 'updated') {
      setNotice({
        text: `Already on the board in ${result.card.status}. Metadata refreshed.`,
        error: false,
      });
      reset();
    } else {
      setNotice({ text: result.reason, error: true });
    }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)}>Add by URL</button>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        required
        placeholder="Article URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="text" placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <input
        type="text"
        placeholder="Publication"
        value={publication}
        onChange={(e) => setPublication(e.target.value)}
      />
      <input
        type="number"
        min={0}
        placeholder="Min"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
      />
      <button type="submit">Add</button>
      <button type="button" onClick={() => { setOpen(false); setNotice(null); }}>
        Close
      </button>
      {notice ? <span className={`notice${notice.error ? ' error' : ''}`}>{notice.text}</span> : null}
    </form>
  );
}