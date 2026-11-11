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
  /** @type {Suggestion[]} */
  const found = [];

  // A Strong's number, or a word of the original as it is said.
  lexicon ??= import('../../data/strongs/lexicon.json', { with: { type: 'json' } }).then((module) => /** @type {any} */ (module.default));
  const words = await lexicon;
  const strongs = /^([hg])0*(\d{1,5})$/.exec(wanted);
  const codes = strongs ? [`${strongs[1].toUpperCase()}${strongs[2]}`] : /^[\p{L}ʼʻ'’-]{3,}$/u.test(wanted) ? await lemmaCodes(wanted) : [];
  for (const code of codes.slice(0, 2)) {
    const entry = words[code];
    if (entry) found.push({ kind: 'word', address: code, label: `${code} ${entry.xlit}`, detail: short(entry.def, 60) });
  }

  // People, places, groups and events whose name (or other name) begins so:
  // a whole name first, people and places before events, then the most
  // told of (in the most verses). Two of one name with one summary (the two
  // Beth-horons) show once.
  const all = await entities();
  const ORDER = ['person', 'place', 'group', 'event'];
  /** @type {{ id: string, rank: number, kind: number, verses: number }[]} */
  const matches = [];
  for (const [id, entity] of Object.entries(all)) {
    const names = [entity.title, entity.name, ...String(entity.alsoCalled ?? '').split(/,\s*/)].filter(Boolean).map((each) => each.toLowerCase());
    const rank = names.some((each) => each === wanted) ? 0 : names.some((each) => each.startsWith(wanted)) ? 1 : -1;
    if (rank >= 0) matches.push({ id, rank, kind: ORDER.indexOf(entity.kind), verses: Array.isArray(entity.verses) ? entity.verses.length : 0 });
  }
  matches.sort((a, b) => a.rank - b.rank || a.kind - b.kind || b.verses - a.verses);
  const seen = new Set();
  for (const { id } of matches) {
    if (found.length >= LIMIT) break;
    const entity = all[id];
    const detail = short(String(entity.summary ?? ''));
    const key = `${entity.title}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ kind: entity.kind, address: id, label: entity.title, detail });
  }
  return found;
}

/** @param {{ params: Record<string, string>, request: Request }} ctx */
export const GET = async ({ params, request }) => {
  const text = decodeURIComponent(params.text ?? '').slice(0, 60);
  const kind = new URL(request.url).searchParams.get('kind');
  const found = kind === 'ref' ? await reference(text) : await named(text);
  return Response.json(found, { headers: { 'Cache-Control': 'max-age=3600' } });
};
