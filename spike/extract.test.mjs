// Automated test file
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

test('linkedom parses HTML into a Document', () => {
    const { document } = parseHTML('<html><head><title>Hi</title></head><body></body></html>');
    assert.equal(document.title, 'Hi');
})