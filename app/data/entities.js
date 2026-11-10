// The entity layer, for the server: people, places, groups and events from
// Theographic (CC BY-SA 4.0), and Easton's Bible Dictionary.
//
// Dates follow Floyd Nolen Jones's chronology in astronomical years (-4003 is
// 4004 BC). Everything that shows a date also shows that source.

import { loaders } from './entities/verses/index.js';
import timeline from './entities/timeline.json' with { type: 'json' };
import world from './world/polities.json' with { type: 'json' };
import books from './kjv/books.json' with { type: 'json' };

/**
 * @typedef {{
 *   kind: 'person' | 'place' | 'group' | 'event', name: string, title: string,
 *   summary?: string, verses: string[], [field: string]: any
 * }} Entity
 */

export { timeline, world };

/**
 * The map as the card first draws it: light enough for the whole map.
 *
 * @typedef {{
 *   width: number, height: number,
 *   land: string[], lakes: string[], rivers: string[],
 *   coast: { land: string, lakes: string, sea: string },
 *   relief: {
 *     far: { n: number, d: string }[],
 *     shades: Record<string, { x: number, y: number, w: number, h: number }>
 *   },
 *   places: { id: string, name: string, x: string, y: string, verses: number, peak: boolean }[],
 *   ranges: { name: string, scale: string, angle: number, x: string, y: string }[],
 *   ancient: {
 *     layers: { id: string, name: string, when: string, kind: string, d: string }[],
 *     shores: { id: string, name: string, when: string, d: string }[]
 *   }
 * }} BaseMap `ancient` is the extents of empires and kingdoms, the Roman provinces, and the shores of four ages (tools/import-ancient.js)
 */

/**
 * The map's detail, which the card loads when it is first zoomed in
 * (map-view): the close coast and lakes, the sea around that coast, the fine
 * relief bands, and the Levant's own sharper relief.
 *
 * @typedef {{
 *   coast: { land: string, lakes: string, sea: string },
 *   bands: { n: number, d: string }[],
 *   levant: { n: number, d: string }[]
 * }} MapDetail
 */

/**
 * The sea: a box a little larger than the map's, with the land cut out of
 * it (fill-rule evenodd). The map draws it over the relief, so the relief
 * needs no clip, and its edge is the coast. The box's own edge is outside
 * the map, where no view reaches.
 *
 * @param {number} width
 * @param {number} height
 * @param {string} land
 */
const seaOf = (width, height, land) => `M-10 -10H${width + 10}V${height + 10}H-10Z${land}`;

/** @returns {Promise<MapDetail>} */
export async function mapDetail() {
  const [{ default: base }, { default: relief }] = await Promise.all([
    import('./map/near-east.json', { with: { type: 'json' } }),
    import('./map/relief.json', { with: { type: 'json' } }),
  ]);
  const land = (base.landDetail ?? base.land).join('');
  return {
    coast: { land, lakes: (base.lakesDetail ?? base.lakes).join(''), sea: seaOf(base.width, base.height, land) },
    bands: relief.bands.map((d, n) => ({ n, d })),
    levant: relief.levant.bands.map((d, n) => ({ n, d })),
  };
}

/**
 * The base map, with a marker for every place that has coordinates on it.
 *
 * `land`, `lakes` and `rivers` are lists of paths. `coast` has the land and
 * the lakes as one path each (for a clip and an outline), for the whole map
 * and for a close view. `relief` is tools/import-relief.js's output: the
 * land at or above each height, for the whole map and, sharper, for the
 * Levant, and where the hill shade images go.
 *
 * @returns {Promise<BaseMap>}
 */
export async function mapOf() {
  const [{ default: base }, { default: relief }, { onMap, project }, { ranges }, known, { default: ancient }] = await Promise.all([
    import('./map/near-east.json', { with: { type: 'json' } }),
    import('./map/relief.json', { with: { type: 'json' } }),
    import('../lib/map.js'),
    import('./map/ranges.js'),
    entities(),
    import('./map/ancient.json', { with: { type: 'json' } }),
  ]);
  const places = Object.entries(known)
    .filter(([, place]) => place.kind === 'place' && place.lat !== null && onMap(place.lon, place.lat))
    .map(([id, place]) => {
      const { x, y } = project(place.lon, place.lat);
      // A mountain is marked as a peak, not a dot.
      return { id, name: place.title, x: x.toFixed(1), y: y.toFixed(1), verses: place.verses.length, peak: place.type === 'Mountain' };
    })
    // The least named first, so the most named are drawn on top. The map
    // names the most named first (lib/map.js nameLevels).
    .sort((a, b) => a.verses - b.verses || b.name.localeCompare(a.name));
  return {
    width: base.width,
    height: base.height,
    land: base.land,
    lakes: base.lakes,
    rivers: base.rivers,
    coast: {
      land: base.land.join(''),
      lakes: base.lakes.join(''),
      sea: seaOf(base.width, base.height, base.land.join('')),
    },
    relief: {
      far: relief.far.map((d, n) => ({ n, d })),
      shades: relief.shades,
    },
    places,
    ancient: { layers: ancient.layers, shores: ancient.shores },
    ranges: ranges
      .filter((range) => onMap(range.lon, range.lat))
      .map((range) => {
        const { x, y } = project(range.lon, range.lat);
        return { name: range.name, scale: range.scale, angle: range.angle, x: x.toFixed(1), y: y.toFixed(1) };
      }),
  };
}

/** @typedef {{ id: string, title: string, label: string }} EventMark a dated event, marked where its passage begins */

/** @type {Promise<Map<string, EventMark[]>> | null} */
let marks = null;

/**
 * The dated events, by the verse where each one's passage begins: a verse
 * that tells an event shows a mark that opens it, and its tick on the
 * timeline. An event told in several places is marked at the start of
 * each; the verses that follow on are not marked, so a long event, such as
 * the Creation, has one mark, not 34.
 *
 * @returns {Promise<Map<string, EventMark[]>>}
 */
export function eventMarks() {
  marks ??= entities().then((known) => {
    /** @type {Map<string, number>} each verse's place in the Bible */
    const order = new Map();
    let n = 0;
    for (const book of /** @type {{ id: string, verses: number[] }[]} */ (books)) {
      book.verses.forEach((count, i) => {
        for (let v = 1; v <= count; v += 1) order.set(`${book.id}.${i + 1}.${v}`, n++);
      });
    }
    /** @type {Map<string, EventMark[]>} */
    const found = new Map();
    for (const [id, event] of Object.entries(known)) {
      if (event.kind !== 'event' || typeof event.start !== 'number') continue;
      const mark = { id, title: event.title, label: `${event.approx ? 'about ' : ''}${event.start <= 0 ? `${1 - event.start} BC` : `AD ${event.start}`}` };
      const places = event.verses.map((verse) => order.get(verse) ?? -1).filter((at) => at >= 0).sort((a, b) => a - b);
      const verses = event.verses.filter((verse) => order.has(verse)).sort((a, b) => /** @type {number} */ (order.get(a)) - /** @type {number} */ (order.get(b)));
      places.forEach((at, i) => {
        if (i > 0 && places[i - 1] === at - 1) return;
        const verse = verses[i];
        found.set(verse, [...(found.get(verse) ?? []), mark]);
      });
    }
    return found;
  });
  return marks;
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
