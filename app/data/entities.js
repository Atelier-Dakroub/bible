// The entity layer, for the server: people, places, groups and events from
// Theographic (CC BY-SA 4.0), and Easton's Bible Dictionary.
//
// Dates follow Floyd Nolen Jones's chronology in astronomical years (-4003 is
// 4004 BC). Everything that shows a date also shows that source.

import { loaders } from './entities/verses/index.js';
import timeline from './entities/timeline.json' with { type: 'json' };
import world from './world/polities.json' with { type: 'json' };

/**
 * @typedef {{
 *   kind: 'person' | 'place' | 'group' | 'event', name: string, title: string,
 *   summary?: string, verses: string[], [field: string]: any
 * }} Entity
 */

export { timeline, world };

/**
 * The base map, with a marker for every place that has coordinates on it.
 *
 * @returns {Promise<{ width: number, height: number, land: string[], lakes: string[], rivers: string[], places: { id: string, name: string, x: string, y: string }[] }>}
 */
export async function mapOf() {
  const [{ default: base }, { onMap, project }, known] = await Promise.all([
    import('./map/near-east.json', { with: { type: 'json' } }),
    import('../lib/map.js'),
    entities(),
  ]);
  const places = Object.entries(known)
    .filter(([, place]) => place.kind === 'place' && place.lat !== null && onMap(place.lon, place.lat))
    .map(([id, place]) => {
      const { x, y } = project(place.lon, place.lat);
      return { id, name: place.title, x: x.toFixed(1), y: y.toFixed(1) };
    });
  return { width: base.width, height: base.height, land: base.land, lakes: base.lakes, rivers: base.rivers, places };
}

/** @type {Promise<Record<string, Entity>> | null} */
let all = null;

/** @returns {Promise<Record<string, Entity>>} */
export function entities() {
  all ??= import('./entities/entities.json', { with: { type: 'json' } }).then((module) => module.default);
  return all;
}

/** @param {string} id */
export async function entity(id) {
  return (await entities())[id] ?? null;
}

/** @type {Promise<Record<string, { term: string, text: string }>> | null} */
let dictionary = null;

/**
 * Easton's entry for a word, trying the forms a name takes in the text:
 * "Hittite" finds "Hittites", "Amorites" finds "Amorites", "David's" finds
 * "David".
 *
 * @param {string} word
 */
export async function eastonFor(word) {
  dictionary ??= import('./entities/easton.json', { with: { type: 'json' } }).then((module) => module.default);
  const terms = await dictionary;
  const base = word.toLowerCase().replace(/[’']s$/, '').replace(/[^\p{L}-]/gu, '');
  if (base.length < 3) return null;
  for (const key of [base, `${base}s`, base.replace(/s$/, ''), base.replace(/es$/, '')]) {
    if (terms[key]) return terms[key];
  }
  return null;
}

/** @type {Map<string, Promise<Record<string, string[]>>>} */
const verseMaps = new Map();

/**
 * Which entities each verse of a book names.
 *
 * @param {string} book
 * @returns {Promise<Record<string, string[]>>}
 */
export function namedIn(book) {
  let promise = verseMaps.get(book);
  if (!promise) {
    const load = loaders[/** @type {keyof typeof loaders} */ (book)];
    promise = load().then((module) => /** @type {Record<string, string[]>} */ (module.default));
    verseMaps.set(book, promise);
  }
  return promise;
}

/** @param {string} word */
export function nameKey(word) {
  return word.toLowerCase().replace(/[’']s\b/g, '').replace(/[^\p{L}]/gu, '');
}

/**
 * The names a verse's people, places and groups go by, mapped to their ids,
 * so a word in the verse can be matched to what it names. Events are named
 * by titles, not by words, so they are left out.
 *
 * @param {string[]} ids
 * @returns {Promise<Map<string, string>>}
 */
export async function namesFor(ids) {
  const known = await entities();
  /** @type {Map<string, string>} */
  const names = new Map();
  for (const id of ids) {
    const found = known[id];
    if (!found || found.kind === 'event') continue;
    const forms = [found.name, ...String(found.alsoCalled ?? '').split(',')];
    for (const form of forms) {
      const key = nameKey(form.trim());
      if (key && !names.has(key)) names.set(key, id);
    }
  }
  return names;
}

/**
 * A year as people write it: -4003 is "4004 BC", 30 is "AD 30".
 *
 * @param {number | null | undefined} year
 */
export function formatYear(year) {
  if (year === null || year === undefined) return '';
  return year <= 0 ? `${1 - year} BC` : `AD ${year}`;
}
