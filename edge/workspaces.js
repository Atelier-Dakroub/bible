// One reader's named workspaces on Cloudflare (app/lib/sync.js): a Durable
// Object for each reader, named by the email that Access signed in, with each
// workspace stored under its name.

import { DurableObject } from 'cloudflare:workers';
import { MAX_ENTRIES, merge } from '../app/lib/sync.js';

/** @typedef {import('../app/lib/sync.js').Entries} Entries */

const PREFIX = 'w:';
// The mark of a deletion is kept this long, so a device that was away for
// less brings nothing back.
const REMOVED_MS = 365 * 24 * 60 * 60 * 1000;

export class Workspaces extends DurableObject {
  /**
   * Takes a device's named workspaces, and answers with the set kept now:
   * for each name, the one saved last.
   *
   * @param {Entries} sent
   * @returns {Promise<Entries>}
   */
  async exchange(sent) {
    const storage = this.ctx.storage;
    /** @type {Entries} */
    const kept = {};
    for (const [key, value] of await storage.list({ prefix: PREFIX })) kept[key.slice(PREFIX.length)] = /** @type {any} */ (value);
    const all = merge(kept, sent);

    // The oldest marks of deletion go first, then the oldest workspaces,
    // when there are too many.
    const old = Date.now() - REMOVED_MS;
    const names = Object.keys(all).sort((a, b) => Number(!all[a].removed) - Number(!all[b].removed) || Date.parse(all[a].saved) - Date.parse(all[b].saved));
    const gone = names.filter((name, i) => (all[name].removed && Date.parse(all[name].saved) < old) || i < names.length - MAX_ENTRIES);
    for (const name of gone) delete all[name];

    const changed = Object.entries(all).filter(([name, entry]) => kept[name] !== entry);
    for (let i = 0; i < changed.length; i += 100) {
      await storage.put(Object.fromEntries(changed.slice(i, i + 100).map(([name, entry]) => [PREFIX + name, entry])));
    }
    const removed = gone.filter((name) => name in kept).map((name) => PREFIX + name);
    for (let i = 0; i < removed.length; i += 100) await storage.delete(removed.slice(i, i + 100));
    return all;
  }
}
