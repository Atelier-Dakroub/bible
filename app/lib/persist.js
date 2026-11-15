// Asks the browser to keep this site's storage: the saved tables in
// localStorage, and the service worker's caches (public/sw.js).
//
// Without it, storage is "best effort": a browser may clear it when the disk
// runs low, and Safari clears it after seven days without a visit, unless
// the app is on the Home Screen. The table asks when the reader saves a table
// under a name, the moment they show they want to keep it. Chrome and Safari
// decide without asking the reader (from how much the site is used, and
// whether it is installed); Firefox asks them, once.

/** @typedef {'kept' | 'refused' | 'unsupported'} Kept */

/**
 * Asks for persistent storage. Called in the tap that saves, before any
 * await, so a browser that asks the reader sees it come from them.
 *
 * @param {{ persist?: () => Promise<boolean> } | undefined} [storage]
 * @returns {Promise<Kept>}
 */
export async function keepStorage(storage = globalThis.navigator?.storage) {
  if (typeof storage?.persist !== 'function') return 'unsupported';
  try {
    // True at once, and no question, where the storage is kept already.
    return (await storage.persist()) ? 'kept' : 'refused';
  } catch {
    return 'unsupported';
  }
}
