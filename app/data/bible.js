// The text, for the server: passages by reference, and search.
//
// A book is loaded the first time something asks for it and kept. Search asks
// for all 66, so the first search takes longer than the rest.

import index from './kjv/books.json' with { type: 'json' };
import { loaders } from './kjv/index.js';
import { loaders as referenceLoaders } from './xrefs/index.js';
import { loaders as strongsLoaders } from './strongs/index.js';
import { loaders as bsbLoaders } from './bsb/index.js';
import { loaders as originalLoaders } from './original/index.js';
import { formatReference, parseAddress, parseReference, toAddress, versesIn } from '../lib/reference.js';
import { onMap } from '../lib/map.js';
import { tokenize } from '../lib/words.js';
import { differences } from '../lib/compare.js';

/** @typedef {import('../lib/words.js').Highlight} Span */
import { eastonFor, entities, entity, formatYear, nameKey, namedIn, namesFor, timeline, world } from './entities.js';

/** @typedef {import('../lib/reference.js').Reference} Reference */
/** @typedef {{ text: string, marks: string[] }} Run */
/** @typedef {{ style: string, numbered?: boolean, runs: Run[] }} Block */
/** @typedef {{ n: number, id: string, blocks: Block[] }} Verse */
/** @typedef {{ id: string, name: string, chapters: { n: number, verses: Verse[] }[] }} Book */
/** @typedef {{ text: string, w: number, s: string | null, e: string | null, d: boolean }} Token `s` is the word's Strong's number, `e` the entity it names, `d` true where a parallel translation does not share the word */
/** @typedef {Run & { tokens: Token[] }} WordRun */
/** @typedef {{ style: string, numbered?: boolean, runs: WordRun[] }} WordBlock */
/** @typedef {{ n: number, id: string, blocks: WordBlock[], label?: string, paragraph?: boolean }} WordVerse `label` is the number to print: `2:1` for the first verse of a later chapter; `paragraph` is true where the KJV starts a paragraph (¶) */
/** @typedef {{ text: string, hit: boolean }} Part */
/** @typedef {{ address: string, title: string, parts: Part[] }} Result */
/** @typedef {{ code: string, lemma: string, xlit: string, pron: string, def: string, kjv: string, lang: string, dir: string, count: string }} Entry */
/**
 * How the KJV renders a Strong's number, and where, book by book. `bars` is a
 * small chart: one bar per book, in a 660 by 64 box.
 *
 * @typedef {{
 *   summary: string, renderings: { text: string, count: number }[], more: string,
 *   bars: { id: string, title: string, x: number, y: number, height: number }[],
 *   most: string, landscape: string
 * }} WordStats
 */
/** @typedef {{ kind: string, value: string, label: string }} RuleOffer a rule the panel offers to mark on every card */
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
 *   stats       how the KJV renders that entry's word, and where
 *   entity      a person, place, group or event (Theographic)
 *   dictionary  an Easton's dictionary entry for a word that names no entity
 *   refsFor     a verse whose cross-references the panel can switch to
 *   studyCode   a Strong's number the panel can switch to
 *   guide       everything the data has on one passage (data/study.js)
 *   landscape   the address of a landscape card for what is on show, or ""
 *   rule        what the panel can mark on every card, or null
 *
 * @typedef {{
 *   query: string, summary: string, results: Result[], entry: Entry | null,
 *   stats: WordStats | null, entity: EntityView | null,
 *   dictionary: { term: string, text: string } | null,
 *   refsFor: string, refsTitle: string, studyCode: string,
 *   guide: import('./study.js').Guide | null, landscape: string, rule: RuleOffer | null
 * }} Results
 */

/**
 * A full answer from the fields that are set; the rest are empty.
 *
 * @param {Partial<Results>} fields
 * @returns {Results}
 */
export function answer(fields) {
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
    stats: null,
    guide: null,
    landscape: '',
    rule: null,
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
  const covered = versesIn(ref, books);
  const chosen = covered.map(([chapter, n]) => chapters[chapter - 1]?.verses[n - 1]).filter(Boolean);
  const names = await Promise.all(chosen.map((verse) => namesFor(named[verse.id] ?? [])));
  return {
    title: formatReference(ref, books),
    verses: chosen.map((verse, i) => {
      const chapter = covered[i][0];
      const label = chapter !== ref.chapter && verse.n === 1 ? `${chapter}:1` : String(verse.n);
      return { ...withWords(verse, codes[verse.id], names[i]), label };
    }),
  };
}

/**
 * Only the words of a span, as verses: a phrase card, or a quote in a note.
 * Each verse keeps the words from the span's first word to its last, and
 * the punctuation between them. A verse that starts inside the span keeps
 * its number.
 *
 * @param {Span} range
 * @returns {Promise<{ title: string, address: string, verses: WordVerse[] } | null>}
 */
export async function phrase(range) {
  const [book, c1, v1, w1] = range.from.split('.');
  const [, c2, v2, w2] = range.to.split('.');
  const ref = parseAddress(`${book}.${c1}.${v1}-${c2}.${v2}`, books) ?? parseAddress(`${book}.${c1}.${v1}`, books);
  if (!ref) return null;
  const { title, verses } = await passage(ref);
  const firstWord = Number(w1.slice(1));
  const lastWord = Number(w2.slice(1));
  const trimmed = verses.map((verse, i) => {
    const low = i === 0 ? firstWord : 1;
    const high = i === verses.length - 1 ? lastWord : Infinity;
    const tokens = verse.blocks.flatMap((block) => block.runs.flatMap((run) => run.tokens));
    const start = tokens.findIndex((token) => token.w >= low);
    let end = -1;
    tokens.forEach((token, at) => {
      if (token.w && token.w <= high) end = at;
    });
    let at = 0;
    const blocks = verse.blocks
      .map((block, b) => ({
        ...block,
        numbered: Boolean(block.numbered) && low === 1 && b === 0,
        runs: block.runs
          .map((run) => {
            const kept = run.tokens.filter(() => {
              const here = at;
              at += 1;
              return here >= start && here <= end;
            });
            return { ...run, tokens: kept, text: kept.map((token) => token.text).join('') };
          })
          .filter((run) => run.tokens.length),
      }))
      .filter((block) => block.runs.length);
    return { ...verse, blocks };
  });
  return { title, address: `${range.from}-${range.to}`, verses: trimmed };
}

/** @typedef {{ style: string, text: string, numbered: boolean, parts: { text: string, d: boolean }[] }} PlainBlock a block of the BSB; `parts` mark the words the KJV does not share */
/** @typedef {{ verse: WordVerse, bsb: PlainBlock[] }} Row */

/** @type {Map<string, Promise<Record<string, { style: string, text: string }[]>>>} */
const bsbBooks = new Map();

// ---- The original languages (tools/import-original.js) ----

/**
 * A word of the Hebrew or Greek text, as a card shows it.
 *
 * @typedef {{
 *   text: string, translit: string, gloss: string, s: string,
 *   code: string, grammar: string, tr: boolean
 * }} OriginalWord `s` is the Strong's number, written as the KJV data writes it, so the KJV words that render it can be found; `code` is STEPBible's grammar code and `grammar` the same in words; `tr` is true for a Greek word of the Textus Receptus that the Nestle-Aland text does not have
 */
/** @typedef {{ id: string, label: string, words: OriginalWord[] }} OriginalVerse */

/** @type {Map<string, Promise<Record<string, (string | number)[][]>>>} */
const originalBooks = new Map();
/** @type {Promise<Record<string, string>> | null} */
let grammarCodes = null;

/**
 * A grammar code in words. A Hebrew word can be several parts (and/ the/
 * earth: HC/Td/Ncfsa): each part is named, with the language once.
 *
 * @param {string} code
 * @param {Record<string, string>} codes
 */
function grammarIn(code, codes) {
  if (codes[code]) return codes[code];
  const language = /^[HA]/.test(code) ? code[0] : '';
  if (!language) return '';
  return code
    .slice(1)
    .split('/')
    .filter(Boolean)
    .map((part) => codes[`${language}${part}`] ?? part)
    .join(' + ');
}

/**
 * A passage in its original language: the Hebrew (with Aramaic in Daniel and
 * Ezra) for the Old Testament, the Greek the KJV translated for the New.
 * Verses are numbered as the KJV numbers them.
 *
 * @param {Reference} ref
 * @returns {Promise<{ title: string, language: 'hebrew' | 'greek', verses: OriginalVerse[] }>}
 */
export async function original(ref) {
  let book = originalBooks.get(ref.book);
  if (!book) {
    const load = originalLoaders[/** @type {keyof typeof originalLoaders} */ (ref.book)];
    book = load().then((module) => /** @type {Record<string, (string | number)[][]>} */ (module.default));
    originalBooks.set(ref.book, book);
  }
  grammarCodes ??= import('./original/grammar.json', { with: { type: 'json' } }).then((module) => module.default);
  const [words, codes] = await Promise.all([book, grammarCodes]);
  const covered = versesIn(ref, books);
  const language = index.findIndex((entry) => entry.id === 'MAT') <= index.findIndex((entry) => entry.id === ref.book) ? 'greek' : 'hebrew';
  return {
    title: formatReference(ref, books),
    language,
    verses: covered.map(([chapter, n]) => {
      const id = `${ref.book}.${chapter}.${n}`;
      return {
        id,
        label: chapter !== ref.chapter && n === 1 ? `${chapter}:1` : String(n),
        words: (words[id] ?? []).map(([text, translit, gloss, s, code, tr]) => ({
          text: String(text),
          translit: String(translit),
          gloss: String(gloss),
          s: String(s),
          code: String(code),
          grammar: grammarIn(String(code), codes),
          tr: tr === 1,
        })),
      };
    }),
  };
}

/**
 * The passage in two translations, verse by verse: the KJV verse and the
 * Berean Standard Bible's blocks for the same address. A verse the BSB leaves
 * out has no blocks. The verse number goes on the first block that is not a
 * psalm title. The words that one translation has and the other does not are
 * marked on both (app/lib/compare.js): `d` on a KJV token, a part of a BSB
 * block.
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
    const split = blocks.map((block) => tokenize(block.text, 1).tokens);
    const kjvWords = verse.blocks.flatMap((block) => block.runs.flatMap((run) => run.tokens.filter((token) => token.w)));
    const bsbWords = split.flat().filter((token) => token.w);
    const diff = blocks.length ? differences(kjvWords.map((token) => token.text), bsbWords.map((token) => token.text)) : null;
    /** @type {Map<object, boolean>} */
    const kjvDiff = new Map(kjvWords.map((token, i) => [token, diff ? diff.a[i] : false]));
    /** @type {Map<object, boolean>} */
    const bsbDiff = new Map(bsbWords.map((token, i) => [token, diff ? diff.b[i] : false]));
    const marked = {
      ...verse,
      blocks: verse.blocks.map((block) => ({
        ...block,
        runs: block.runs.map((run) => ({ ...run, tokens: run.tokens.map((token) => ({ ...token, d: kjvDiff.get(token) ?? false })) })),
      })),
    };
    return {
      verse: marked,
      bsb: blocks.map((block, i) => ({ ...block, numbered: i === first, parts: partsOf(split[i], bsbDiff) })),
    };
  });
  return { title, rows };
}

/**
 * A block's tokens as runs of text that differ or do not. A space or a mark
 * between two words goes with the word before it.
 *
 * @param {{ text: string, w: number }[]} tokens
 * @param {Map<object, boolean>} diff
 * @returns {{ text: string, d: boolean }[]}
 */
function partsOf(tokens, diff) {
  /** @type {{ text: string, d: boolean }[]} */
  const parts = [];
  for (const token of tokens) {
    const last = parts.at(-1);
    const d = token.w ? (diff.get(token) ?? false) : (last?.d ?? false);
    if (last && last.d === d) last.text += token.text;
    else parts.push({ text: token.text, d });
  }
  return parts;
}

/** @type {Map<string, Promise<Record<string, string>>>} */
const strongsBooks = new Map();

/**
 * Each verse's Strong's numbers, one per word, "-" for none (tools/import-strongs.js).
 *
 * @param {string} id
 */
export function strongsBook(id) {
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
        return { ...token, s: code && code !== '-' ? code : null, e: named ?? null, d: false };
      });
      return { ...run, tokens };
    }),
  }));
  // The KJV starts a paragraph with ¶. The verse says so instead, and the
  // mark itself is left out of the words: the page shows the paragraph.
  const first = blocks[0]?.runs[0]?.tokens;
  const paragraph = Boolean(first?.length && first[0].w === 0 && first[0].text.trim() === '¶');
  if (paragraph && first) first.shift();
  return { ...verse, blocks, paragraph };
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
  const stats = entry ? await wordStats(code, found) : null;
  const rule = entry ? { kind: 'strongs', value: code, label: `${code} ${entry.xlit}` } : null;
  return answer({ query: code, summary, results, entry, stats, rule, landscape: stats ? stats.landscape : '' });
}

/** @type {Map<string, WordStats>} the last few studied, as the panel goes back and forth */
const statsCache = new Map();

/**
 * How the KJV renders a Strong's number, and where it occurs, book by book.
 * A rendering is the run of English words that carry the number in one
 * place, such as "lovingkindness" or "in the beginning", in lower case.
 *
 * @param {string} code
 * @param {string[]} found the verses that use it, in canon order
 * @returns {Promise<WordStats>}
 */
export async function wordStats(code, found) {
  const cached = statsCache.get(code);
  if (cached) return cached;

  /** @type {Map<string, number>} */
  const renderings = new Map();
  /** @type {Map<string, number>} */
  const perBook = new Map();
  let total = 0;
  const byBook = Map.groupBy(found, (address) => address.split('.')[0]);
  for (const [id, addresses] of byBook) {
    const [{ chapters }, codes] = await Promise.all([book(id), strongsBook(id)]);
    for (const address of addresses) {
      const [, chapter, verse] = address.split('.');
      const source = chapters[Number(chapter) - 1]?.verses[Number(verse) - 1];
      if (!source) continue;
      const tokens = withWords(source, codes[address]).blocks.flatMap((block) => block.runs.flatMap((run) => run.tokens));
      /** @type {string[]} */
      let run = [];
      const close = () => {
        if (!run.length) return;
        const text = run.join(' ');
        renderings.set(text, (renderings.get(text) ?? 0) + 1);
        perBook.set(id, (perBook.get(id) ?? 0) + 1);
        total += 1;
        run = [];
      };
      for (const token of tokens) {
        if (!token.w) continue;
        if (token.s === code) run.push(token.text.toLowerCase().replace(/[^\p{L}’'-]/gu, '').replace(/^[’']+|[’']+$/g, ''));
        else close();
      }
      close();
    }
  }

  const sorted = [...renderings].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  const shown = sorted.slice(0, 12).map(([text, count]) => ({ text, count }));
  const rest = sorted.length - shown.length;
  const max = Math.max(1, ...perBook.values());
  const bars = books.map((entry, i) => {
    const count = perBook.get(entry.id) ?? 0;
    const height = count ? Math.max(2, Math.round((count / max) * 56)) : 0;
    return { id: entry.id, title: `${entry.name}: ${count}`, x: i * 10, y: 60 - height, height };
  });
  const top = [...perBook].sort((x, y) => y[1] - x[1]).slice(0, 3);
  const name = (/** @type {string} */ id) => books.find((entry) => entry.id === id)?.name ?? id;
  const stats = {
    summary: `${times(total)} in ${verseCount(found.length)}, in ${perBook.size === 1 ? '1 book' : `${perBook.size} books`}.`,
    renderings: shown,
    more: rest > 0 ? `and ${rest} more` : '',
    bars,
    most: top.length ? `Most in ${top.map(([id, count]) => `${name(id)} (${count})`).join(', ')}.` : '',
    landscape: `landscape:${code}`,
  };
  statsCache.set(code, stats);
  if (statsCache.size > 20) statsCache.delete(statsCache.keys().next().value ?? '');
  return stats;
}

/** @param {number} count */
function times(count) {
  return count === 1 ? 'Once' : `${count.toLocaleString('en')} times`;
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
  const rule = ['person', 'place', 'group'].includes(found.kind) ? { kind: 'entity', value: id, label: view.title } : null;
  return answer({ summary, results, entity: view, rule, landscape: total ? `landscape:${id}` : '' });
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
    .join(' ')
    // The KJV's paragraph mark is not a word: a page shows it as a paragraph.
    .replace(/¶\s*/g, '');
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
  return count === 1 ? '1 verse' : `${count.toLocaleString('en')} verses`;
}

/** @typedef {[string, number]} CrossReference a target address and its votes */

/** @type {Map<string, Promise<Record<string, CrossReference[]>>>} */
const referenceBooks = new Map();

/** @param {string} id */
export function referenceBook(id) {
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

export function allVerses() {
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

  const { first, rest, marker } = await matching(text);
  const total = first.length + rest.length;

  /** @type {Result[]} */
  const results = [...first, ...rest]
    .slice(0, limit)
    .map((verse) => ({ address: verse.address, title: verse.title, parts: mark(verse.text, marker) }));

  return answer({ query: text, summary: summarize(total, results.length), results, landscape: total ? `landscape:text:${text}` : '' });
}

/**
 * The verses that hold every word of a search, the ones that hold them as
 * one phrase first (see search).
 *
 * @param {string} text
 */
export async function matching(text) {
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
  return { first, rest, marker };
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
