// Installs an in-memory IndexedDB onto globalThis before any test runs.
// Dexie then opens a real-behaving database with no browser present.
import 'fake-indexeddb/auto';
