// Prototype only. Throwaway. Not reused in Milestone 1.
const STORAGE_KEY = 'substack-library-proto'

let state = load()
let selectedId = null;

function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(window.PROTO_CARDS);
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function statusLabel(card) {
    const bits = []
    if (card.notes && card.notes.trim()) bits.push('notes');
    if (card.quotes.length) bits.push(`${card.quotes.length} quote${card.quotes.length === 1 ? '' : 's'}`);
    if (card.exportVersion > 0) bits.push(`exported v${card.exportVersion}`);
    return bits.join(' . ');
}

function visibleCards() {
    const q = document.getElementById('search').value.trim().toLowerCase();
    const max = Number(document.getElementById('max-minutes').value) || 0;
    return state.filter((c) => {
        const hay = `${c.title} ${c.author} ${c.publication}`.toLowerCase();
        if (q && !hay.includes(q)) return false;
        if (max && (c.estimatedReadingMinutes == null || c.estimatedReadingMinutes > max)) return false;
        return true;
    });
}

function render() {
    const template = document.getElementById('card-template');
    const cards = visibleCards();
    for (const column of document.querySelectorAll('.column')) {
        const status = column.dataset.status;
        const list = column.querySelector('.cards');
        list.replaceChildren();
        const inColumn = cards.filter((c) => c.status === status).sort((a, b) => a.sortOrder - b.sortOrder);
        column.querySelector('.count').textContent = `(${inColumn.length})`;
        for (const card of inColumn) {
            const node = template.content.firstElementChild.cloneNode(true);
            node.dataset.id = card.id;
            node.classList.toggle('selected', card.id === selectedId);
            node.querySelector('.title').textContent = card.title;
            node.querySelector('.pub').textContent = `${card.publication} · ${card.author}`;
            node.querySelector('.minutes').textContent = card.estimatedReadingMinutes != null ? `${card.estimatedReadingMinutes} min` : '- min';
            node.querySelector('.saved').textContent = `saved ${card.savedAt}`;
            node.querySelector('.status').textContent = statusLabel(card);
            list.appendChild(node);
        }
    }
}

document.getElementById('search').addEventListener('input', render);
document.getElementById('max-minutes').addEventListener('input', render);
document.getElementById('reset').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(window.PROTO_CARDS);
    selectedId = null;
    render();
});

// Panel code
const panel = document.getElementById('panel');
const layout = document.querySelector('.layout');

function findCard(id) {
    return state.find((c) => c.id === id) || null;
}

function openPanel(cardId) {
    const card = findCard(cardId);
    if (!card) return;
    selectedId = cardId;
    panel.hidden = false;
    layout.classList.add('with-panel');
    document.getElementById('panel-title').textContent = card.title;
    document.getElementById('panel-meta').textContent = `${card.publication} · ${card.author} · ${card.estimatedReadingMinutes ?? '—'} min · ${card.url}`;
    document.getElementById('panel-notes').value = card.notes;
    const quotes = document.getElementById('panel-quotes');
    quotes.replaceChildren();
    for (const q of card.quotes) {
        const li = document.createElement('li');
        li.textContent = `"${q.text}"`;
        if (q.comment) li.append(` - ${q.comment}`);
        if (q.locatorLost) {
            const lost = document.createElement('span');
            lost.className = 'lost';
            lost.textContent = ' (location unavailable)';
            li.append(lost);
        }
        quotes.appendChild(li);
    }
    refreshMarkdown(card);
    render();
}

function closePanel() {
    selectedId = null;
    panel.hidden = true;
    layout.classList.remove('with-panel');
    render();
}

function refreshMarkdown(card) {
    document.getElementById('panel-markdown').textContent = `# {exportFilename(card)}\n\n${buildMarkdown(card)}`;
}

function exportFilename(card) {
  const safeTitle = card.title.replace(/[\\/:*?"<>|]/g, '').trim();
  const version = card.exportVersion > 1 ? ` (v${card.exportVersion})` : '';
  return `${card.savedAt} - ${safeTitle}${version}.md`;
}

function buildMarkdown(card) {
  const lines = [
    '---',
    `title: "${card.title.replace(/"/g, '\\"')}"`,
    `author: "${card.author}"`,
    `publication: "${card.publication}"`,
    `url: ${card.url}`,
    `saved: ${card.savedAt}`,
    `read: ${card.readAt ?? ''}`,
    'tags: [substack, reading]',
    '---',
    '',
  ];
  for (const q of card.quotes) {
    lines.push(`> ${q.text}`, '');
    if (q.comment) lines.push(q.comment, '');
  }
  lines.push('## Notes', '', card.notes || '');
  return lines.join('\n');
}

document.querySelector('.board').addEventListener('click', (event) => {
  const cardEl = event.target.closest('.card');
  if (cardEl) openPanel(cardEl.dataset.id);
});
document.getElementById('panel-close').addEventListener('click', closePanel);
document.getElementById('panel-notes').addEventListener('input', (event) => {
  const card = findCard(selectedId);
  if (!card) return;
  card.notes = event.target.value;
  save();
  refreshMarkdown(card);
  render();
});

render();