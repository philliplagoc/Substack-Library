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

render();