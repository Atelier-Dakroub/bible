// The named workspaces, the same on every device: on Cloudflare, where Access
// knows the reader, the Worker keeps a copy of each reader's named workspaces
// (edge/workspaces.js), and each device sends its own and takes the result.
//
// Each workspace carries the time it was saved, and the later of two wins. A
// deleted workspace is kept as a mark, `removed`, with the time it was
// deleted, so a device that still has the old one does not bring it back.
//
// Where the app has no such copy (npm run dev, npm start), the request finds
// nothing, and the workspaces stay in this browser alone.

/** @typedef {{ saved: string, workspace?: any, removed?: boolean }} Entry */
/** @typedef {Record<string, Entry>} Entries */

export const MAX_NAME = 120;
export const MAX_ENTRY = 512 * 1024;
export const MAX_ENTRIES = 500;

/**
 * True for an entry that can be kept: a time, and a workspace or the mark of
 * a deletion.
 *
 * @param {string} name
 * @param {any} entry
 * @returns {entry is Entry}
 */
export function valid(name, entry) {
  if (!name || name.length > MAX_NAME) return false;
  if (!entry || typeof entry !== 'object' || typeof entry.saved !== 'string' || Number.isNaN(Date.parse(entry.saved))) return false;
  if (entry.removed === true) return true;
  return Boolean(entry.workspace) && typeof entry.workspace === 'object' && JSON.stringify(entry.workspace).length <= MAX_ENTRY;
}

/** @param {Entry} entry */
const time = (entry) => Date.parse(entry.saved);

/**
 * The two sets as one: for each name, the entry saved last. On the same
 * time, `a` wins.
 *
 * @param {Entries} a
 * @param {Entries} b
 * @returns {Entries}
 */
export function merge(a, b) {
  /** @type {Entries} */
  const all = {};
  for (const [name, entry] of Object.entries(a)) if (valid(name, entry)) all[name] = entry;
  for (const [name, entry] of Object.entries(b)) {
    if (!valid(name, entry)) continue;
    const mine = all[name];
    if (!mine || time(entry) > time(mine)) all[name] = entry;
  }
  return all;
}

/**
 * Sends this device's named workspaces, and answers with the set the server
 * keeps now, or null when there is no server copy or it cannot be reached.
 *
 * @param {Entries} entries
 * @returns {Promise<Entries | null>}
 */
export async function exchange(entries) {
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaces: entries }),
      // Access sends the reader to sign in when the session is over: that is
      // not an answer.
      redirect: 'error',
    });
    if (!response.ok) return null;
    const { workspaces } = await response.json();
    return workspaces && typeof workspaces === 'object' ? workspaces : null;
  } catch {
    return null;
  }
}
