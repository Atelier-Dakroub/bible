// The text, for the server: passages by reference, and search.
//
// A book is loaded the first time something asks for it and kept. Search asks
// for all 66, so the first search takes longer than the rest.

import index from './kjv/books.json' with { type: 'json' };
import { loaders } from './kjv/index.js';
import { loaders as referenceLoaders } from './xrefs/index.js';
import { loaders as strongsLoaders } from './strongs/index.js';
import { loaders as bsbLoaders } from './bsb/index.js';
import { formatReference, parseAddress, parseReference, toAddress } from '../lib/reference.js';
import { onMap } from '../lib/map.js';
import { tokenize } from '../lib/words.js';
import { eastonFor, entities, entity, formatYear, nameKey, namedIn, namesFor, timeline, world } from './entities.js';

/** @typedef {import('../lib/reference.js').Reference} Reference */
/** @typedef {{ text: string, marks: string[] }} Run */
/** @typedef {{ style: string, numbered?: boolean, runs: Run[] }} Block */
/** @typedef {{ n: number, id: string, blocks: Block[] }} Verse */
/** @typedef {{ id: string, name: string, chapters: { n: number, verses: Verse[] }[] }} Book */
/** @typedef {{ text: string, w: number, s: string | null, e: string | null }} Token `s` is the word's Strong's number, `e` the entity it names */
/** @typedef {Run & { tokens: Token[] }} WordRun */
/** @typedef {{ style: string, numbered?: boolean, runs: WordRun[] }} WordBlock */
/** @typedef {{ n: number, id: string, blocks: WordBlock[] }} WordVerse */
/** @typedef {{ text: string, hit: boolean }} Part */
/** @typedef {{ address: string, title: string, parts: Part[] }} Result */
/** @typedef {{ code: string, lemma: string, xlit: string, pron: string, def: string, kjv: string, lang: string, dir: string, count: string }} Entry */
/** @typedef {{ label: string, items: { id: string, name: string }[] }} Relation */
/**
 * An entity as the search panel shows it.
 *
 * `mapped` is true for a place that is on the map.
 *
 * @typedef {{ id: string, kind: string, title: string, facts: string[], summary: string, relations: Relation[], credit: string, mapped: boolean }} EntityView
 */
/**
 * What the search panel shows.
 *   entry       a Strong's dictionary entry: a word study, or a search by number
 *   entity      a person, place, group or event (Theographic)
 *   dictionary  an Easton's dictionary entry for a word that names no entity
 *   refsFor     a verse whose cross-references the panel can switch to
 *   studyCode   a Strong's number the panel can switch to
 *
 * @typedef {{
 *   query: string, summary: string, results: Result[], entry: Entry | null,
 *   entity: EntityView | null, dictionary: { term: string, text: string } | null,
 *   refsFor: string, refsTitle: string, studyCode: string
 * }} Results
 */

/**
 * A full answer from the fields that are set; the rest are empty.
 *
 * @param {Partial<Results>} fields
 * @returns {Results}
 */
function answer(fields) {
  return {
    query: '',
    summary: '',
    results: [],
    entry: null,
    entity: null,
    dictionary: null,
    refsFor: '',
    refsTitle: '',
    studyCode: '',
    ...fields,
  };
}

export const books = index;

/** @type {Map<string, Promise<Book>>} */
const loaded = new Map();

/** @param {string} id */
export function book(id) {
  let promise = loaded.get(id);
  if (!promise) {
    const load = loaders[/** @type {keyof typeof loaders} */ (id)];
    promise = load().then((module) => /** @type {Book} */ (module.default));
    loaded.set(id, promise);
  }
  return promise;
}

/**
 * @param {Reference} ref
 * @returns {Promise<{ title: string, verses: WordVerse[] }>}
 */
export async function passage(ref) {
  const [{ chapters }, codes, named] = await Promise.all([book(ref.book), strongsBook(ref.book), namedIn(ref.book)]);
  const verses = chapters[ref.chapter - 1].verses;
  const from = ref.from ?? 1;
  const to = ref.to ?? ref.from ?? verses.length;
  const chosen = verses.slice(from - 1, to);
  const names = await Promise.all(chosen.map((verse) => namesFor(named[verse.id] ?? [])));
  return {
    title: formatReference(ref, books),
    verses: chosen.map((verse, i) => withWords(verse, codes[verse.id], names[i])),
  };
}

/** @typedef {{ style: string, text: string, numbered: boolean }} PlainBlock a block of the BSB */
/** @typedef {{ verse: WordVerse, bsb: PlainBlock[] }} Row */

/** @type {Map<string, Promise<Record<string, { style: string, text: string }[]>>>} */
const bsbBooks = new Map();

/**
 * The passage in two translations, verse by verse: the KJV verse and the
 * Berean Standard Bible's blocks for the same address. A verse the BSB leaves
 * out has no blocks. The verse number goes on the first block that is not a
 * psalm title.
 *
 * @param {Reference} ref
 * @returns {Promise<{ title: string, rows: Row[] }>}
 */
export async function parallel(ref) {
  let promise = bsbBooks.get(ref.book);
  if (!promise) {
    const load = bsbLoaders[/** @type {keyof typeof bsbLoaders} */ (ref.book)];
    promise = load().then((module) => /** @type {Record<string, { style: string, text: string }[]>} */ (module.default));
    bsbBooks.set(ref.book, promise);
  }
  const [{ title, verses }, bsb] = await Promise.all([passage(ref), promise]);
  const rows = verses.map((verse) => {
    const blocks = bsb[verse.id] ?? [];
    const first = blocks.findIndex((block) => block.style !== 'd');
    return { verse, bsb: blocks.map((block, i) => ({ ...block, numbered: i === first })) };
  });
  return { title, rows };
}

/** @type {Map<string, Promise<Record<string, string>>>} */
const strongsBooks = new Map();

/**
 * Each verse's Strong's numbers, one per word, "-" for none (tools/import-strongs.js).
 *
 * @param {string} id
 */
function strongsBook(id) {
  let promise = strongsBooks.get(id);
  if (!promise) {
    const load = strongsLoaders[/** @type {keyof typeof strongsLoaders} */ (id)];
    promise = load().then((module) => /** @type {Record<string, string>} */ (module.default));
    strongsBooks.set(id, promise);
  }
  return promise;
}

/** @type {Promise<Record<string, { lemma: string, xlit: string, pron: string, def: string, kjv: string }>> | null} */
let lexicon = null;

/**
 * The dictionary entry for a Strong's number (Open Scriptures, CC BY-SA).
 *
 * @param {string} code
 * @param {number} verseCount how many verses use it
 * @returns {Promise<Entry | null>}
 */
async function entryFor(code, verseCount) {
  lexicon ??= import('./strongs/lexicon.json', { with: { type: 'json' } }).then((module) => module.default);
  const found = (await lexicon)[code];
  if (!found) return null;
  const hebrew = code.startsWith('H');
  return {
    code,
    ...found,
    lang: hebrew ? 'he' : 'grc',
    dir: hebrew ? 'rtl' : 'ltr',
    count: verseCount === 1 ? 'in 1 verse' : `in ${verseCount.toLocaleString('en')} verses`,
  };
}

/**
 * The verse with each run split into numbered words (app/lib/words.js), so a
 * card can address a single word. A new object: the loaded book is shared.
 *
 * @param {Verse} verse
 * @param {string} [codes] the verse's Strong's numbers, one per word
 * @param {Map<string, string>} [names] the names of what the verse names, to their entity ids
 * @returns {WordVerse}
 */
export function withWords(verse, codes = '', names = new Map()) {
  const numbers = codes.split(' ');
  let next = 1;
  const blocks = verse.blocks.map((block) => ({
    ...block,
    runs: block.runs.map((run) => {
      const split = tokenize(run.text, next);
      next = split.next;
      const tokens = split.tokens.map((token) => {
        const code = token.w ? numbers[token.w - 1] : undefined;
        const named = token.w ? names.get(nameKey(token.text)) : undefined;
        return { ...token, s: code && code !== '-' ? code : null, e: named ?? null };
      });
      return { ...run, tokens };
    }),
  }));
  return { ...verse, blocks };
}

/**
 * Every verse that uses a Strong's number, in canon order, with the English
 * words that render it marked.
 *
 * @param {string} code such as H2617
 * @param {number} [limit]
 * @returns {Promise<Results>}
 */
export async function strongsResults(code, limit = 50) {
  const all = await Promise.all(books.map((entry) => strongsBook(entry.id)));
  /** @type {string[]} */
  const found = [];
  for (const each of all) {
    for (const [address, codes] of Object.entries(each)) {
      if (codes.split(' ').includes(code)) found.push(address);
    }
  }

  /** @type {Result[]} */
  const results = [];
  for (const address of found.slice(0, limit)) {
    const ref = parseAddress(address, books);
    if (!ref) continue;
    const { title, verses } = await passage(ref);
    results.push({ address, title, parts: markCode(verses[0], code) });
  }

  const entry = await entryFor(code, found.length);
  const summary = !entry
    ? `${code} is not in the dictionary.`
    : results.length < found.length
      ? `The first ${results.length} verses, in canon order.`
      : 'Every verse, in canon order.';
  return answer({ query: code, summary, results, entry });
}

/**
 * A verse's words as parts, with the words that render `code` marked.
 *
 * @param {WordVerse} verse
 * @param {string} code
 * @returns {Part[]}
 */
function markCode(verse, code) {
  /** @type {Part[]} */
  const parts = [];
  for (const block of verse.blocks) {
    for (const run of block.runs) {
      for (const token of run.tokens) {
        const hit = token.s === code;
        const last = parts.at(-1);
        if (last && last.hit === hit) last.text += token.text;
        else parts.push({ text: token.text, hit });
      }
    }
    const last = parts.at(-1);
    if (last && !last.text.endsWith(' ')) last.text += ' ';
  }
  return parts;
}

/**
 * What a tap on a word shows, the first that applies:
 *   1. the person, place or group the word names in this verse;
 *   2. Easton's dictionary entry for the word, such as "Hittites";
 *   3. a study of the word's Strong's number;
 *   4. the verse's cross-references.
 * Each view offers the cross-references, and 1 and 2 offer the word study too.
 *
 * @param {string} address a word address, such as JHN.3.16.w4
 * @returns {Promise<Results>}
 */
export async function wordResults(address) {
  const verseAddress = address.replace(/\.w\d+$/, '');
  const number = Number(/\.w(\d+)$/.exec(address)?.[1]);
  const ref = parseAddress(verseAddress, books);
  if (!ref || !number) return referenceResults(verseAddress);

  const { verses } = await passage(ref);
  const token = verses[0]?.blocks
    .flatMap((block) => block.runs.flatMap((run) => run.tokens))
    .find((each) => each.w === number);
  if (!token) return referenceResults(verseAddress);

  const offers = { refsFor: verseAddress, refsTitle: formatReference(ref, books) };
  if (token.e) return { ...(await entityResults(token.e)), ...offers, studyCode: token.s ?? '' };

  const easton = await eastonFor(token.text.trim());
  if (easton) {
    const rest = token.s ? await strongsResults(token.s) : await referenceResults(verseAddress);
    return { ...rest, query: '', dictionary: easton, ...offers, studyCode: '' };
  }

  if (token.s) return { ...(await strongsResults(token.s)), query: '', ...offers };
  return referenceResults(verseAddress);
}

const KIND_LABEL = { person: 'Person', place: 'Place', group: 'Group', event: 'Event' };
const CHRONOLOGY = "Dates follow Floyd Nolen Jones's chronology, in the tradition of Ussher. Other chronologies differ.";

/**
 * An entity, with its relations named, as the search panel shows it.
 *
 * @param {string} id
 * @returns {Promise<EntityView | null>}
 */
export async function entityView(id) {
  if (id.startsWith('world:')) return worldView(id);
  const all = await entities();
  const found = all[id];
  if (!found) return null;

  /** @param {string | null | undefined} other */
  const named = (other) => (other && all[other] ? [{ id: other, name: all[other].title }] : []);
  /** @param {string[] | undefined} list */
  const many = (list) => (list ?? []).flatMap((other) => named(other));
  /** @type {[string, { id: string, name: string }[]][]} */
  let relations = [];
  /** @type {string[]} */
  const facts = [KIND_LABEL[/** @type {keyof typeof KIND_LABEL} */ (found.kind)] ?? found.kind];

  if (found.kind === 'person') {
    if (found.born !== null || found.died !== null) {
      facts.push([found.born !== null ? `born ${formatYear(found.born)}` : '', found.died !== null ? `died ${formatYear(found.died)}` : ''].filter(Boolean).join(', '));
    }
    relations = [
      ['Father', named(found.father)],
      ['Mother', named(found.mother)],
      ['Spouses', many(found.partners)],
      ['Children', many(found.children)],
      ['Siblings', many(found.siblings)],
      ['Born in', named(found.birthPlace)],
      ['Died in', named(found.deathPlace)],
      ['Groups', many(found.groups)],
      ['Events', many(found.events)],
    ];
  }
  if (found.kind === 'place') {
    if (found.type) facts.push(found.type);
    if (found.lat !== null && found.lon !== null) facts.push(`${found.lat.toFixed(3)}, ${found.lon.toFixed(3)}`);
    if (found.start !== null) facts.push(`${formatYear(found.start)} to ${formatYear(found.end)}`);
    if (found.comment) facts.push(found.comment);
    relations = [
      ['Same place as', named(found.sameAs)],
      ['Part of', many(found.partOf)],
    ];
  }
  if (found.kind === 'event') {
    facts.push(`${found.approx ? 'about ' : ''}${formatYear(found.start)}${found.duration ? `, lasting ${duration(found.duration)}` : ''}`);
    relations = [
      ['Part of', named(found.partOf)],
      ['People', many(found.participants)],
      ['Places', many(found.locations)],
    ];
  }
  if (found.kind === 'group') relations = [['Members', many(found.members)]];

  const dated = found.kind === 'event' || (found.kind === 'person' && (found.born !== null || found.died !== null));
  const credit = `From Theographic (CC BY-SA)${found.summary ? " and Easton's Bible Dictionary" : ''}.${dated ? ` ${CHRONOLOGY}` : ''}`;
  return {
    id,
    kind: found.kind,
    title: found.title,
    facts,
    summary: found.summary ?? '',
    relations: relations.filter(([, items]) => items.length).map(([label, items]) => ({ label, items })),
    credit,
    mapped: found.kind === 'place' && found.lat !== null && onMap(found.lon, found.lat),
  };
}

/**
 * A polity or period on the world-history track, as the search panel shows it.
 *
 * @param {string} id such as world:Q10914393
 * @returns {EntityView | null}
 */
function worldView(id) {
  const found = world.find((each) => `world:${each.id}` === id);
  if (!found) return null;
  return {
    id,
    kind: 'world',
    title: found.name,
    facts: ['World history', `${formatYear(found.start)} to ${formatYear(found.end)}`, found.region],
    summary: '',
    relations: [],
    credit: `Dates from Wikidata, ${found.id} (CC0): conventional scholarly dates. The biblical events below follow Floyd Nolen Jones's chronology, so the two can disagree.`,
    mapped: false,
  };
}

/**
 * A world-history span and the biblical events that fall inside it, by
 * Jones's dates. This is where the two chronologies meet.
 *
 * @param {string} id such as world:Q10914393
 * @returns {Promise<Results>}
 */
export async function worldResults(id) {
  const view = worldView(id);
  const found = world.find((each) => `world:${each.id}` === id);
  if (!view || !found) return answer({ summary: 'Nothing has that address.' });
  const inside = timeline.filter((event) => event.start >= found.start && event.start <= found.end);
  const all = await entities();
  /** @type {Result[]} */
  const results = [];
  for (const event of inside.slice(0, 50)) {
    const first = all[event.id]?.verses[0];
    const ref = first ? parseAddress(first, books) : null;
    if (!ref) continue;
    const { verses } = await passage(ref);
    results.push({
      address: first,
      title: `${event.title}, ${event.approx ? 'about ' : ''}${formatYear(event.start)}`,
      parts: [{ text: preview(verses, 160), hit: false }],
    });
  }
  const summary = inside.length
    ? `${inside.length === 1 ? '1 biblical event falls' : `${inside.length} biblical events fall`} in these years, by Jones's dates.`
    : "No biblical event falls in these years, by Jones's dates.";
  return answer({ summary, results, entity: view });
}

/** @param {string} text such as 40Y or 7D */
function duration(text) {
  const match = /^(\d+)([DWMY])$/.exec(text);
  if (!match) return text;
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[/** @type {'D' | 'W' | 'M' | 'Y'} */ (match[2])];
  return `${match[1]} ${unit}${match[1] === '1' ? '' : 's'}`;
}

/**
 * An entity and the verses that name it, with its names marked.
 *
 * @param {string} id
 * @param {number} [limit]
 * @returns {Promise<Results>}
 */
export async function entityResults(id, limit = 50) {
  const view = await entityView(id);
  const found = await entity(id);
  if (!view || !found) return answer({ summary: 'Nothing has that address.' });

  const names = [found.name, ...String(found.alsoCalled ?? '').split(',')].map((name) => name.trim()).filter(Boolean);
  const marker = names.length ? new RegExp(`\\b(?:${names.map(escapeRegExp).join('|')})(?:[’']s)?\\b`, 'gi') : null;

  /** @type {Result[]} */
  const results = [];
  for (const address of found.verses.slice(0, limit)) {
    const ref = parseAddress(address, books);
    if (!ref) continue;
    const { title, verses } = await passage(ref);
    const text = plainText(verses[0]);
    results.push({ address, title, parts: marker && found.kind !== 'event' ? mark(text, marker) : [{ text, hit: false }] });
  }
  const total = found.verses.length;
  const summary = total === 0
    ? 'No verses are linked yet.'
    : `${found.kind === 'event' ? 'Told in' : 'Named in'} ${verseCount(total)}${results.length < total ? `. The first ${results.length}, in canon order.` : '.'}`;
  return answer({ summary, results, entity: view });
}

/**
 * The words of a verse, with no markup.
 *
 * @param {Verse} verse
 */
export function plainText(verse) {
  return verse.blocks
    .map((block) => block.runs.map((run) => run.text).join(''))
    .filter(Boolean)
    .join(' ');
}

/**
 * The opening words of a passage, cut at a word near `limit` characters.
 *
 * @param {Verse[]} verses
 * @param {number} [limit]
 */
export function preview(verses, limit = 90) {
  const text = verses.map(plainText).join(' ').replace(/¶\s*/g, '');
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(' ', limit);
  return `${text.slice(0, cut > 0 ? cut : limit).replace(/[,;:]$/, '')} …`;
}

/** @param {number} count */
export function verseCount(count) {
  return count === 1 ? '1 verse' : `${count} verses`;
}

/** @typedef {[string, number]} CrossReference a target address and its votes */

/** @type {Map<string, Promise<Record<string, CrossReference[]>>>} */
const referenceBooks = new Map();

/** @param {string} id */
function referenceBook(id) {
  let promise = referenceBooks.get(id);
  if (!promise) {
    const load = referenceLoaders[/** @type {keyof typeof referenceLoaders} */ (id)];
    promise = load
      ? load().then((module) => /** @type {Record<string, CrossReference[]>} */ (module.default))
      : Promise.resolve({});
    referenceBooks.set(id, promise);
  }
  return promise;
}

/**
 * The cross-references of each verse in a passage, best first, from
 * OpenBible.info (CC BY). Verses with none are left out.
 *
 * @param {Reference} ref
 * @returns {Promise<Record<string, CrossReference[]>>}
 */
export async function referencesIn(ref) {
  const all = await referenceBook(ref.book);
  const { verses } = await passage(ref);
  /** @type {Record<string, CrossReference[]>} */
  const found = {};
  for (const verse of verses) if (all[verse.id]) found[verse.id] = all[verse.id];
  return found;
}

/**
 * The cross-references of one verse as search results, so the search panel
 * can list them and they can be pulled onto the table.
 *
 * @param {string} address a verse address, such as JHN.3.16
 * @param {number} [limit]
 * @returns {Promise<Results>}
 */
export async function referenceResults(address, limit = 50) {
  const ref = parseAddress(address, books);
  if (!ref || !ref.from || ref.to) return answer({ summary: 'That is not one verse.' });

  const list = (await referenceBook(ref.book))[address] ?? [];
  const title = formatReference(ref, books);
  /** @type {Result[]} */
  const results = [];
  for (const [target] of list.slice(0, limit)) {
    const found = parseAddress(target, books);
    if (!found) continue;
    const { title: heading, verses } = await passage(found);
    results.push({ address: target, title: heading, parts: [{ text: preview(verses, 200), hit: false }] });
  }

  const count = list.length === 1 ? '1 cross-reference' : `${list.length} cross-references`;
  const summary = list.length
    ? `${title}: ${count}, most voted first. From OpenBible.info.`
    : `${title} has no cross-references.`;
  return answer({ summary, results });
}

/** @type {Promise<{ address: string, title: string, text: string }[]> | null} */
let corpus = null;

function allVerses() {
  corpus ??= Promise.all(books.map((entry) => book(entry.id))).then((all) =>
    all.flatMap((each) =>
      each.chapters.flatMap((chapter) =>
        chapter.verses.map((verse) => ({
          address: verse.id,
          title: formatReference({ book: each.id, chapter: chapter.n, from: verse.n }, books),
          text: plainText(verse),
        })),
      ),
    ),
  );
  return corpus;
}

/**
 * A reference finds its passage. Anything else finds the verses that hold
 * every word. A word of four letters or more also matches the start of a
 * longer word, so "begin" finds "beginning"; a shorter one matches only
 * itself, so "the" does not find "they". Verses that hold the words as one
 * phrase come first. Text in double quotes must be that phrase.
 *
 * @param {string} query
 * @param {number} [limit]
 * @returns {Promise<Results>}
 */
export async function search(query, limit = 50) {
  const text = query.trim();
  if (!text) return answer({});

  // A Strong's number, such as H2617 or g25, finds the verses that use it.
  const strongs = /^([HG])0*(\d+)$/i.exec(text);
  if (strongs) return strongsResults(`${strongs[1].toUpperCase()}${strongs[2]}`, limit);

  const ref = parseReference(text, books);
  if (ref) return referenceResult(text, ref);

  const quoted = /^".+"$/.test(text);
  const terms = quoted ? [text.slice(1, -1)] : text.split(/\s+/);
  const patterns = terms.map(wordPattern);
  const tests = patterns.map((pattern) => new RegExp(pattern, 'i'));
  const marker = new RegExp(patterns.join('|'), 'gi');
  const phrase = new RegExp(`\\b${terms.map(escapeRegExp).join('\\s+')}\\b`, 'i');

  const first = [];
  const rest = [];
  for (const verse of await allVerses()) {
    if (!tests.every((test) => test.test(verse.text))) continue;
    (phrase.test(verse.text) ? first : rest).push(verse);
  }
  const total = first.length + rest.length;

  /** @type {Result[]} */
  const results = [...first, ...rest]
    .slice(0, limit)
    .map((verse) => ({ address: verse.address, title: verse.title, parts: mark(verse.text, marker) }));

  return answer({ query: text, summary: summarize(total, results.length), results });
}

/**
 * @param {string} query
 * @param {Reference} ref
 */
async function referenceResult(query, ref) {
  const { title, verses } = await passage(ref);
  const parts = [{ text: preview(verses, 200), hit: false }];
  return answer({ query, summary: `Passage, ${verseCount(verses.length)}`, results: [{ address: toAddress(ref), title, parts }] });
}

/**
 * @param {number} total
 * @param {number} shown
 */
function summarize(total, shown) {
  if (total === 0) return 'No verses match.';
  const count = total.toLocaleString('en');
  if (shown < total) return `The first ${shown} of ${count} verses`;
  return total === 1 ? '1 verse' : `${count} verses`;
}

/**
 * Splits the text into the parts the marker matches and the parts between.
 *
 * @param {string} text
 * @param {RegExp} marker a global pattern
 * @returns {Part[]}
 */
function mark(text, marker) {
  /** @type {Part[]} */
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(marker)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at), hit: false });
    const end = at + match[0].length;
    parts.push({ text: text.slice(at, end), hit: true });
    last = end;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}

/**
 * The pattern for one search term. A long term takes the rest of the word it
 * starts, so the mark covers "beginning" and not only "begin".
 *
 * @param {string} term
 */
function wordPattern(term) {
  const escaped = escapeRegExp(term);
  return term.length >= 4 ? `\\b${escaped}\\w*` : `\\b${escaped}\\b`;
}

/** @param {string} text */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
