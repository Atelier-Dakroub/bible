// What a note might mean by the words just typed, as JSON, for the note's
// suggestions (lib/note-suggest.js):
//   GET /suggest/John%203:16?kind=ref  ->  [{ kind: 'passage', address: 'JHN.3.16', label: 'John 3:16', detail: 'For God so loved …' }]
//   GET /suggest/abra?kind=at           ->  people, places, groups and events
//     whose name begins so, then words of the Hebrew and the Greek
//     (H430, or as said: agape): [{ kind: 'person', address: 'person:abraham_58', label: 'Abraham', detail: … }, …]
// `ref` gives one passage or none: the words must read as a reference.

import { books, lemmaCodes, passage, preview } from '../../data/bible.js';
import { entities } from '../../data/entities.js';
import { formatReference, parseReference, toAddress } from '../../lib/reference.js';

const LIMIT = 6;

/** @typedef {{ kind: string, address: string, label: string, detail: string }} Suggestion */

/** @type {Promise<Record<string, { xlit: string, def: string }>> | null} */
let lexicon = null;

/** "Abraham", the first words of an entity's summary. */
const short = (/** @type {string} */ text, limit = 70) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.lastIndexOf(' ', limit);
  return `${clean.slice(0, cut > 0 ? cut : limit).replace(/[,;:.]$/, '')} …`;
};

/** @param {string} text @returns {Promise<Suggestion[]>} */
async function reference(text) {
  const ref = parseReference(text, books);
  if (!ref) return [];
  const { verses } = await passage(ref);
  if (!verses.length) return [];
  return [{ kind: 'passage', address: toAddress(ref), label: formatReference(ref, books), detail: preview(verses.slice(0, 1), 70) }];
}

/** @param {string} text @returns {Promise<Suggestion[]>} */
async function named(text) {
  const wanted = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!wanted) return [];
  const words = await wordsFor(wanted);
  return [...words, ...(await entitiesFor(wanted, LIMIT - words.length))];
}

/**
 * The Strong's numbers the words may mean: one typed (H430), or the words
 * of the original as they are said (agape).
 *
 * @param {string} wanted
 * @returns {Promise<string[]>}
 */
async function codesFor(wanted) {
  const strongs = /^([hg])0*(\d{1,5})$/.exec(wanted);
  if (strongs) return [`${strongs[1].toUpperCase()}${strongs[2]}`];
  return /^[\p{L}ʼʻ'’-]{3,}$/u.test(wanted) ? lemmaCodes(wanted) : [];
}

/**
 * A word of the original the words may mean: two at most.
 *
 * @param {string} wanted
 * @returns {Promise<Suggestion[]>}
 */
async function wordsFor(wanted) {
  lexicon ??= import('../../data/strongs/lexicon.json', { with: { type: 'json' } }).then((module) => /** @type {any} */ (module.default));
  const words = await lexicon;
  return (await codesFor(wanted)).slice(0, 2).flatMap((code) => {
    const entry = words[code];
    return entry ? [{ kind: 'word', address: code, label: `${code} ${entry.xlit}`, detail: short(entry.def, 60) }] : [];
  });
}

const ORDER = ['person', 'place', 'group', 'event'];

/** @param {any} entity its names, in small letters: its title, its name, and its other names */
const namesOf = (entity) => [entity.title, entity.name, ...String(entity.alsoCalled ?? '').split(/,\s*/)].filter(Boolean).map((each) => each.toLowerCase());

/**
 * How well names match the words: 0 for a whole name, 1 for a name that
 * begins so, -1 for none.
 *
 * @param {string[]} names
 * @param {string} wanted
 */
function rankOf(names, wanted) {
  if (names.includes(wanted)) return 0;
  return names.some((each) => each.startsWith(wanted)) ? 1 : -1;
}

/**
 * An entity whose name matches, with what orders it; null if none does.
 *
 * @param {string} id
 * @param {any} entity
 * @param {string} wanted
 */
function matchOf(id, entity, wanted) {
  const rank = rankOf(namesOf(entity), wanted);
  if (rank < 0) return null;
  return { id, rank, kind: ORDER.indexOf(entity.kind), verses: Array.isArray(entity.verses) ? entity.verses.length : 0 };
}

/**
 * People, places, groups and events whose name (or other name) begins so:
 * a whole name first, people and places before events, then the most told
 * of (in the most verses). Two of one name with one summary (the two
 * Beth-horons) show once.
 *
 * @param {string} wanted
 * @param {number} room how many may be suggested
 * @returns {Promise<Suggestion[]>}
 */
async function entitiesFor(wanted, room) {
  const all = await entities();
  const matches = Object.entries(all).flatMap(([id, entity]) => matchOf(id, entity, wanted) ?? []);
  matches.sort((a, b) => a.rank - b.rank || a.kind - b.kind || b.verses - a.verses);
  /** @type {Map<string, Suggestion>} */
  const found = new Map();
  for (const { id } of matches) {
    const entity = all[id];
    const detail = short(String(entity.summary ?? ''));
    const key = `${entity.title}|${detail}`;
    if (!found.has(key)) found.set(key, { kind: entity.kind, address: id, label: entity.title, detail });
    if (found.size >= room) break;
  }
  return [...found.values()];
}

/** @param {{ params: Record<string, string>, request: Request }} ctx */
export const GET = async ({ params, request }) => {
  const text = decodeURIComponent(params.text ?? '').slice(0, 60);
  const kind = new URL(request.url).searchParams.get('kind');
  const found = kind === 'ref' ? await reference(text) : await named(text);
  return Response.json(found, { headers: { 'Cache-Control': 'max-age=3600' } });
};
