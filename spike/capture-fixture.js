(async function captureFixture() {
    const PRIVATE_STRINGS = [
        'the'
    ];

    function redact(text) {
        // Replace every private string, case-insensitive, with READER
        if (!text || PRIVATE_STRINGS.length === 0) return text;
        const escaped = PRIVATE_STRINGS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = new RegExp(escaped.join('|'), 'gi');
        return text.replace(pattern, 'READER');
    }

    const clone = document.documentElement.cloneNode(true);

    // 1. Drop scripts and styles
    for (const el of clone.querySelectorAll('script:not([type="application/ld+json"]), style, link[rel="stylesheet"], noscript, iframe, svg, video, audio')) {
        el.remove();
    }

    // 2. Drop images and their lazy-load attributes. Fixture size matters.
    for (const img of clone.querySelectorAll('img, picture, source')) {
        img.remove();
    }

    // 3. Drop inline event handlers and tracking attributes
    for (const el of clone.querySelectorAll('*')) {
        for (const attr of [...el.attributes]) {
            if (attr.name.startsWith('on') || attr.name.startsWith('data-track')) {
                el.removeAttribute(attr.name);
            }
        }
    }

    // 4. Redact private strings 
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        node.nodeValue = redact(node.nodeValue);
    }
    for (const el of clone.querySelectorAll('*')) {
        for (const attr of [...el.attributes]) {
            const clean = redact(attr.value);
            if (clean !== attr.value) el.setAttribute(attr.name, clean);
        }
    }

    const html = '<!DOCTYPE html>\n' + clone.outerHTML;

    // The Clipboard API refuses to write while the document is unfocused, and
    // DevTools holds focus whenever a snippet runs. Download the file instead.
    const slug = (location.pathname.split('/').filter(Boolean).pop() || 'fixture')
        .replace(/[^a-z0-9-]/gi, '-');
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = slug + '.html';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

    console.log('Fixture downloaded:', link.download);
    console.log('URL:', location.href);
    console.log('Size (KB):', Math.round(html.length / 1024));
    console.log('Title:', document.title);
})();
