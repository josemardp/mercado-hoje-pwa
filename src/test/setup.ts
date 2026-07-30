// Polyfills IndexedDB (and related globals) so Dexie can run under Node in
// Vitest, without needing a real browser.
import 'fake-indexeddb/auto'

// src/lib cross-hook notifications (e.g. AUD-004's reconciliation events)
// call window.dispatchEvent/addEventListener directly — Node has no
// `window`, only the underlying EventTarget/Event/CustomEvent globals it's
// built from. A full DOM (jsdom/happy-dom) isn't needed just for that.
if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  (globalThis as unknown as { window: EventTarget }).window = new EventTarget()
}
