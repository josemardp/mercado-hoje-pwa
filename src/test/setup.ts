// Polyfills IndexedDB (and related globals) so Dexie can run under Node in
// Vitest, without needing a real browser.
import 'fake-indexeddb/auto'
