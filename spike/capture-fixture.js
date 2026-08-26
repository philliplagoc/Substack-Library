(async function captureFixture() {
    const PRIVATE_STRINGS = [
        'Phillip Lagoc',
        '@philliplagoc',
        'lagocphillip13@gmail.com',
        'phillip-lagoc',
    ];

    // Adds the shapes a page prints that PRIVATE_STRINGS does not hold
    // verbatim. The paywall greeted the reader as "Hi Phillip" while the list
    // above held only the full name. Keep this list explicit: every term here
    // is one a human decided is safe to blank out. redact() matches with the
    // `i` flag, so one casing of each term covers every casing.
    function expandPrivateStrings(strings) {
        return [...strings, 'Phillip', 'Lagoc'];
    }

    const REDACT_TERMS = expandPrivateStrings(PRIVATE_STRINGS);

    function redact(text) {
        // Replace every term, case-insensitive, with READER
        if (!text || REDACT_TERMS.length === 0) return text;
        // Longest first, so "Phillip Lagoc" is consumed whole before a shorter
        // "Phillip" can turn it into "READER Lagoc".
        const ordered = [...REDACT_TERMS].sort((a, b) => b.length - a.length);
        const escaped = ordered.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = new RegExp(escaped.join('|'), 'gi');
        return text.replace(pattern, 'READER');
    }

    function stripIdentifiers(url) {
        for (const key of [...url.searchParams.keys()]) url.searchParams.delete(key);
        url.pathname = url.pathname.replace(/\d{6,}/g, '0');
    }

    function cleanUrl(value) {
        const trimmed = value.trim();

        // new URL() does NOT throw on plain text. It treats the text as a
        // relative path and returns a valid URL. That turned og:title into
        // "/p/I%20Posted%20on%20Substack..." in the 15:12 capture.
        // So try/catch is not enough. Only touch a value that already
        // looks like a URL.
        if (!/^(https?:\/\/|\/\/|\/|\?)/i.test(trimmed)) return value;

        let url;
        try {
            url = new URL(trimmed, location.href);
        } catch (_) {
            return value; // Malformed. Leave it alone.
        }
        stripIdentifiers(url);

        // Give back the same shape we were handed. Turning a relative href
        // absolute would make the fixture stop matching the live page.
        const tail = url.pathname + url.search + url.hash;
        if (/^https?:\/\//i.test(trimmed)) return url.href;
        if (trimmed.startsWith('//')) return '//' + url.host + tail;
        if (trimmed.startsWith('?')) return url.search + url.hash;
        return tail;
    }

    // Handle a URL that hides inside other data.
    function cleanEmbedded(value) {
        return null;
    }

    // Routes URL-bearing attributes through cleanUrl, and
    // attributes that hold serialized JSON through cleanEmbedded.
    // Note: 'content' is NOT in URL_ATTRS. It holds og:title and og:description,
    // which are prose. The 15:12 capture proved what happens when it is.
    function scrubIdentifiers(root) {
        const URL_ATTRS = ['href', 'src', 'data-href', 'action'];
        const JSON_ATTRS = ['data-attrs'];
        for (const el of root.querySelectorAll('*')) {
            for (const name of URL_ATTRS) {
                const value = el.getAttribute(name);
                if (!value) continue;
                el.setAttribute(name, cleanUrl(value));
            }
            for (const name of JSON_ATTRS) {
                const value = el.getAttribute(name);
                if (!value) continue;
                const out = cleanEmbedded(value);
                if (out === null) el.removeAttribute(name);
                else el.setAttribute(name, out);
            }
        }
        // og:url and og:image are the only content= values that hold a URL.
        for (const el of root.querySelectorAll('meta[property="og:url"], meta[property="og:image"], meta[name^="twitter:image"]')) {
            const value = el.getAttribute('content');
            if (value) el.setAttribute('content', cleanUrl(value));
        }
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

    // 3.5. Strip ids and tokens that a literal string match cannot reach.
    scrubIdentifiers(clone);

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
