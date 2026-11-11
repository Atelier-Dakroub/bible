// The text, for the server: passages by reference, and search.
//
// A book is loaded the first time something asks for it and kept. Search asks
// for all 66, so the first search takes longer than the rest.

import { videosFor } from './videos.js';
import index from './kjv/books.json' with { type: 'json' };
import { loaders } from './kjv/index.js';
import { loaders as referenceLoaders } from './xrefs/index.js';
import { loaders as strongsLoaders } from './strongs/index.js';
import { loaders as bsbLoaders } from './bsb/index.js';
import { loaders as originalLoaders } from './original/index.js';
import { journeysFor } from './journeys.js';
import { imagesFor } from './images.js';
import { findBook, formatReference, parseAddress, parseReference, toAddress, versesIn } from '../lib/reference.js';
import { codeTest, describe, parseGrammar, vocabularyOf } from '../lib/grammar.js';
import { SAID, lemmaIndex, plain } from '../lib/lemma.js';
import { GROUPS } from './canon.js';
import { onMap } from '../lib/map.js';
import { tokenize } from '../lib/words.js';
import { differences } from '../lib/compare.js';
import { citations } from '../lib/citations.js';
import { syllablesOf } from '../lib/syllables.js';
import { topic, topicFor } from './topics.js';
import { sensesOf, versesOfSense } from './senses.js';

/** @typedef {import('../lib/words.js').Highlight} Span */
import { eastonFor, entities, entity, formatYear, nameKey, namedIn, namesFor, timeline, world } from './entities.js';
import kings from './chronology/kings.json' with { type: 'json' };

/** @typedef {import('../lib/reference.js').Reference} Reference */
/** @typedef {{ text: string, marks: string[] }} Run */
/** @typedef {{ style: string, numbered?: boolean, runs: Run[] }} Block */
/** @typedef {{ n: number, id: string, blocks: Block[] }} Verse */
/** @typedef {{ id: string, name: string, chapters: { n: number, verses: Verse[] }[] }} Book */
/** @typedef {{ text: string, w: number, s: string | null, e: string | null, d: boolean }} Token `s` is the word's Strong's number, `e` the entity it names, `d` true where a parallel translation does not share the word */
/** @typedef {Run & { tokens: Token[] }} WordRun */
/** @typedef {{ style: string, numbered?: boolean, runs: WordRun[] }} WordBlock */
/** @typedef {{ n: number, id: string, blocks: WordBlock[], label?: string, paragraph?: boolean, events?: import('./entities.js').EventMark[], quotes?: string }} WordVerse `label` is the number to print: `2:1` for the first verse of a later chapter; `paragraph` is true where the KJV starts a paragraph (¶); `events` are the dated events whose passages begin here (entities.js eventMarks); `quotes` is where a quotation begins here (quotations.js quoteMark) */
/** @typedef {{ text: string, hit: boolean }} Part */
/** @typedef {{ text: string, translit: string, gloss: string }} FoundWord */
/** @typedef {{ address: string, title: string, parts: Part[], original?: FoundWord[], lang?: string, dir?: string }} Result `original` is the Hebrew or Greek words a search by grammar found in the verse, in `lang` and `dir` */
/** @typedef {{ code: string, lemma: string, xlit: string, pron: string, def: string, kjv: string, lang: string, dir: string, count: string }} Entry */
/**
 * How the KJV renders a Strong's number, and where, book by book. `bars` is a
 * small chart: one bar per book, in a 660 by 64 box.
 *
 * @typedef {{
 *   summary: string, renderings: { text: string, count: number, search?: string }[], more: string,
 *   bars: { id: string, title: string, x: number, y: number, height: number }[],
 *   most: string, landscape: string
 * }} WordStats `renderings` are words with their counts: how the KJV renders a Strong's number, or for a search by grammar, the words it found, each with a search that narrows to it
 */
/** @typedef {{ kind: string, value: string, label: string }} RuleOffer a rule the panel offers to mark on every card */
/** @typedef {{ label: string, items: { id: string, name: string }[] }} Relation */
/**
 * An entity as the search panel shows it.
 *
 * `mapped` is true for a place that is on the map. `moreParts` is the rest of
 * a summary cut short, as parts, for Read more. `summaryParts` is the
 * summary with each Bible reference in it as a link (lib/citations.js).
 *
 * @typedef {{ id: string, kind: string, title: string, facts: string[], summary: string, summaryParts: import('../lib/citations.js').Part[], moreParts: import('../lib/citations.js').Part[], relations: Relation[], credit: string, mapped: boolean }} EntityView
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
 *   journeys    journeys on the map: a person's, or the ones a passage tells
 *               part of (data/journeys.js)
 *   seeAlso     the people, places, groups and events named most often in
 *               the same verses as the entity: its "See also"
 *   also        other words a search by a word's name could mean, such as
 *               H2618 beside H2617 for "chesed", each with its search
 *   images      pictures of the entity, or of the people and places of a
 *               guide's passage (data/images.js)
 *
 * @typedef {{
 *   query: string, summary: string, results: Result[], entry: Entry | null,
 *   stats: WordStats | null, entity: EntityView | null,
 *   dictionary: { term: string, text: string, parts: import('../lib/citations.js').Part[] } | null,
 *   topic: import('./topics.js').TopicView | null, topicOpen: boolean,
 *   senses: import('./senses.js').Sense[], sense: number,
 *   refsFor: string, refsTitle: string, studyCode: string,
 *   guide: import('./study.js').Guide | null, landscape: string, rule: RuleOffer | null,
 *   journeys: import('./journeys.js').JourneyView[], seeAlso: { id: string, title: string, kind: string }[],
 *   images: import('./images.js').Image[], videos: import('./videos.js').VideoView[], also: { code: string, label: string }[]
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
    topic: null,
    topicOpen: false,
    senses: [],
    sense: 0,
    refsFor: '',
    refsTitle: '',
    studyCode: '',
    stats: null,
    guide: null,
    landscape: '',
    rule: null,
    journeys: [],
    seeAlso: [],
    images: [],
    videos: [],
    also: [],
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
 *   code: string, grammar: string, search: string, tr: boolean,
 *   sylls?: import('../lib/syllables.js').Syllable[]
 * }} OriginalWord `s` is the Strong's number, written as the KJV data writes it, so the KJV words that render it can be found; `code` is STEPBible's grammar code and `grammar` the same in words; `search` is the code a tap on the grammar searches for; `tr` is true for a Greek word of the Textus Receptus that the Nestle-Aland text does not have
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
 * A book of the Hebrew or the Greek, word by word: each verse's words as
 * [text, transliteration, gloss, Strong's, grammar code, flag].
 *
 * @param {string} id
 * @returns {Promise<Record<string, (string | number)[][]>>}
 */
function originalBook(id) {
  let book = originalBooks.get(id);
  if (!book) {
    const load = originalLoaders[/** @type {keyof typeof originalLoaders} */ (id)];
    book = load ? load().then((module) => /** @type {Record<string, (string | number)[][]>} */ (module.default)) : Promise.resolve({});
    originalBooks.set(id, book);
  }
  return book;
}

/** @returns {Promise<Record<string, string>>} the grammar codes in words */
function grammarOf() {
  grammarCodes ??= import('./original/grammar.json', { with: { type: 'json' } }).then((module) => module.default);
  return grammarCodes;
}

/**
 * The code a tap on a word's grammar searches for: a Greek word's code, or
 * the main part of a Hebrew or Aramaic one, with its language (HVqw3ms for
 * HC/Vqw3ms, "and he said"). The main part is the longest: the verb or
 * noun, not the prefix or the suffix.
 *
 * @param {string} code
 */
function searchCodeOf(code) {
  if (!/^[HA]/.test(code) || !code.includes('/')) return code;
  const main = code.slice(1).split('/').reduce((a, b) => (b.length > a.length ? b : a), '');
  return `${code[0]}${main}`;
}

/** @type {{ phrases: Set<string>, longest: number } | null} */
let vocabulary = null;

/**
 * What a search by grammar asks for (lib/grammar.js), or null when the text
 * is not one.
 *
 * @param {string} text
 */
export async function grammarQuery(text) {
  const grammar = await grammarOf();
  vocabulary ??= vocabularyOf(grammar);
  return parseGrammar(text, vocabulary, {
    books,
    groups: GROUPS,
    findBook: (name) => findBook(name, books),
    parseReference: (name) => parseReference(name, books),
  });
}

/**
 * The words that answer a search by grammar, verse by verse in canon order:
 * each verse's address, its words, and which of them answer.
 *
 * @param {import('../lib/grammar.js').GrammarQuery} query
 * @returns {Promise<{ address: string, words: (string | number)[][], found: number[] }[]>}
 */
export async function grammarFind(query) {
  const grammar = await grammarOf();
  const test = codeTest(query, grammar);
  const nt = books.findIndex((entry) => entry.id === 'MAT');
  const inRef = query.ref ? new Set(versesIn(query.ref, books).map(([chapter, n]) => `${query.ref?.book}.${chapter}.${n}`)) : null;
  const hits = [];
  for (const [i, entry] of books.entries()) {
    if (query.books && !query.books.has(entry.id)) continue;
    // The language: Greek in the New Testament; in the Old, the code's
    // first letter, H or A.
    if (query.language === 'greek' && i < nt) continue;
    if (query.language && query.language !== 'greek' && i >= nt) continue;
    for (const [address, words] of Object.entries(await originalBook(entry.id))) {
      if (inRef && !inRef.has(address)) continue;
      /** @type {number[]} */
      const found = [];
      words.forEach((word, n) => {
        const code = String(word[4]);
        if (query.strongs && word[3] !== query.strongs) return;
        if (query.language === 'hebrew' && !code.startsWith('H')) return;
        if (query.language === 'aramaic' && !code.startsWith('A')) return;
        if (test(code)) found.push(n);
      });
      if (found.length) hits.push({ address, words, found });
    }
  }
  return hits;
}

/** @param {string | number} text */
function bare(text) {
  return String(text).replace(/[\s¶.,;:·;?!”’\u05C3\u05C0\u05BE]+$/u, '');
}

/**
 * A search by grammar: the verses with the words that answer it, the words
 * found most often (a tap narrows the search to one), and where, book by
 * book.
 *
 * @param {string} text the query as typed
 * @param {import('../lib/grammar.js').GrammarQuery} query
 * @param {number} [limit]
 * @returns {Promise<Results>}
 */
export async function grammarResults(text, query, limit = 50) {
  const [hits, grammar] = await Promise.all([grammarFind(query), grammarOf()]);
  const nt = books.findIndex((entry) => entry.id === 'MAT');
  const lemma = query.strongs ? (await entryFor(query.strongs, 0))?.xlit ?? '' : '';
  const asked = describe(query, grammar, lemma);

  /** @type {Result[]} */
  const results = [];
  for (const hit of hits.slice(0, limit)) {
    const ref = parseAddress(hit.address, books);
    if (!ref) continue;
    const { title, verses } = await passage(ref);
    const greek = books.findIndex((entry) => entry.id === ref.book) >= nt;
    const codes = new Set(hit.found.map((n) => String(hit.words[n][3])));
    results.push({
      address: hit.address,
      title,
      parts: verses[0] ? markCode(verses[0], codes) : [],
      // Each word as a word, without the stops and the paragraph mark of the
      // text around it.
      original: hit.found.map((n) => ({ text: bare(hit.words[n][0]), translit: String(hit.words[n][1]), gloss: bare(hit.words[n][2]) })),
      lang: greek ? 'grc' : 'hbo',
      dir: greek ? 'ltr' : 'rtl',
    });
  }

  // The words found most often, by Strong's number, and where.
  /** @type {Map<string, number>} */
  const perWord = new Map();
  /** @type {Map<string, number>} */
  const perBook = new Map();
  let total = 0;
  for (const hit of hits) {
    const id = hit.address.split('.')[0];
    for (const n of hit.found) {
      const code = String(hit.words[n][3]);
      if (code) perWord.set(code, (perWord.get(code) ?? 0) + 1);
      perBook.set(id, (perBook.get(id) ?? 0) + 1);
      total += 1;
    }
  }
  const top = [...perWord].sort((x, y) => y[1] - x[1]).slice(0, 12);
  const renderings = [];
  if (!query.strongs) {
    for (const [code, count] of top) {
      const entry = await entryFor(code, 0);
      // The narrower search: the same, with the Strong's number before the
      // scope.
      const search = text.replace(/^(.*?)(\s+in\s+.+)?$/i, (_, words, scope = '') => `${words} ${code}${scope}`);
      renderings.push({ text: entry ? `${entry.lemma} ${entry.xlit}` : code, count, search });
    }
  }
  const words = total === 1 ? '1 word' : `${total.toLocaleString('en')} words`;
  const { bars, most } = bookBars(perBook);
  const stats = total
    ? {
        summary: `${asked}: ${words} in ${verseCount(hits.length)}, in ${perBook.size === 1 ? '1 book' : `${perBook.size} books`}.`,
        renderings,
        more: perWord.size > top.length && !query.strongs ? `and ${(perWord.size - top.length).toLocaleString('en')} more words` : '',
        bars,
        most,
        landscape: `landscape:grammar:${text}`,
      }
    : null;
  const summary = !total
    ? `${asked}: no words match.`
    : results.length < hits.length
      ? `The first ${results.length} verses, in canon order.`
      : 'Every verse, in canon order.';
  return answer({ query: text, summary, results, stats, landscape: stats ? stats.landscape : '' });
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
  const [words, codes] = await Promise.all([originalBook(ref.book), grammarOf()]);
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
          // Its syllables, the stressed one marked (lib/syllables.js).
          sylls: syllablesOf(language, String(text), String(translit)),
          gloss: String(gloss),
          s: String(s),
          code: String(code),
          grammar: grammarIn(String(code), codes),
          search: searchCodeOf(String(code)),
          tr: tr === 1,
        })),
      };
    }),
  };
}

/**
 * The reverse interlinear: the KJV in its own order, each word or run of
 * words with the same Strong's number as one group, and under it the word
 * of the original it renders. The k-th group with a number takes the k-th
 * word of the original with that number in the verse (the last, if the
 * original has fewer). English with no number of its own (a word the
 * translators supplied, or one that renders part of a word, such as the
 * "in the" of a prefix) is a group with nothing under it.
 *
 * @typedef {{ en: string, orig: OriginalWord | null }} ReverseGroup
 * @typedef {{ id: string, label: string, groups: ReverseGroup[] }} ReverseVerse
 *
 * @param {WordVerse[]} verses the KJV, with word tokens
 * @param {{ verses: OriginalVerse[] }} source the original of the same verses
 * @returns {ReverseVerse[]}
 */
export function reverse(verses, source) {
  const originals = new Map(source.verses.map((verse) => [verse.id, verse.words]));
  return verses.map((verse) => {
    const words = originals.get(verse.id) ?? [];
    /** @type {Map<string, number>} how many groups each number has had */
    const seen = new Map();
    /** @type {(ReverseGroup & { s: string })[]} */
    const groups = [];
    for (const block of verse.blocks) {
      for (const run of block.runs) {
        for (const token of run.tokens) {
          const s = token.w ? (token.s ?? '') : null;
          const last = groups.at(-1);
          // Spaces and stops go with the group before; a word starts a new
          // group when its number differs.
          if (last && (s === null || s === last.s)) {
            last.en += token.text;
            continue;
          }
          groups.push({ en: token.text, s: s ?? '', orig: null });
        }
      }
    }
    for (const group of groups) {
      if (!group.s) continue;
      const matches = words.filter((word) => word.s === group.s);
      if (!matches.length) continue;
      const k = seen.get(group.s) ?? 0;
      seen.set(group.s, k + 1);
      const word = matches[Math.min(k, matches.length - 1)];
      // The word alone, without the stops of the verse around it.
      group.orig = { ...word, text: bare(word.text), gloss: bare(word.gloss) };
    }
    return {
      id: verse.id,
      label: verse.label ?? String(verse.n),
      groups: groups.map(({ en, orig }) => ({ en: en.trim(), orig })).filter((group) => group.en),
    };
  });
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
export async function strongsResults(code, limit = 50, sense = 0) {
  const all = await Promise.all(books.map((entry) => strongsBook(entry.id)));
  // One sense of the word (data/senses.js): only the verses that use it so.
  const inSense = sense ? await versesOfSense(code, sense) : null;
  /** @type {string[]} */
  const found = [];
  for (const each of all) {
    for (const [address, codes] of Object.entries(each)) {
      if (codes.split(' ').includes(code) && (!inSense || inSense.has(address))) found.push(address);
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
  const senses = await sensesOf(code);
  const chosen = senses[sense - 1];
  const verses = chosen ? `In the sense “${chosen.gloss}”: ` : '';
  const summary = !entry
    ? `${code} is not in the dictionary.`
    : results.length < found.length
      ? `${verses}the first ${results.length} verses, in canon order.`
      : `${verses}every verse, in canon order.`;
  const stats = entry ? await wordStats(code, found) : null;
  const rule = entry ? { kind: 'strongs', value: code, label: `${code} ${entry.xlit}` } : null;
  return answer({
    query: chosen ? `${code} sense ${sense}` : code,
    summary: summary[0].toUpperCase() + summary.slice(1),
    results,
    entry,
    stats,
    rule,
    senses,
    sense: chosen ? sense : 0,
    landscape: stats && !chosen ? stats.landscape : '',
  });
}

/** @type {Map<string, string[]> | null} */
let lemmas = null;
/** @type {Map<string, number> | null} how many verses use each Strong's number */
let used = null;

/**
 * The Strong's numbers a word of the original may be, as it is said (agape,
 * chesed), the most used first.
 *
 * @param {string} text
 * @returns {Promise<string[]>}
 */
export async function lemmaCodes(text) {
  const said = SAID[text.toLowerCase()];
  if (said) return [said];
  lexicon ??= import('./strongs/lexicon.json', { with: { type: 'json' } }).then((module) => module.default);
  lemmas ??= lemmaIndex(/** @type {Record<string, { xlit: string }>} */ (await lexicon));
  const codes = lemmas.get(plain(text)) ?? [];
  if (codes.length < 2) return codes;
  if (!used) {
    /** @type {Map<string, number>} */
    const counts = new Map();
    for (const each of await Promise.all(books.map((entry) => strongsBook(entry.id)))) {
      for (const verse of Object.values(each)) for (const code of new Set(verse.split(' '))) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    used = counts;
  }
  const count = /** @type {Map<string, number>} */ (used);
  return [...codes].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0));
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
  const { bars, most } = bookBars(perBook);
  const stats = {
    summary: `${times(total)} in ${verseCount(found.length)}, in ${perBook.size === 1 ? '1 book' : `${perBook.size} books`}.`,
    renderings: shown,
    more: rest > 0 ? `and ${rest} more` : '',
    bars,
    most,
    landscape: `landscape:${code}`,
  };
  statsCache.set(code, stats);
  if (statsCache.size > 20) statsCache.delete(statsCache.keys().next().value ?? '');
  return stats;
}

/**
 * A small chart of counts by book: one bar per book, in a 660 by 64 box, and
 * the three books with the most, in words.
 *
 * @param {Map<string, number>} perBook
 */
function bookBars(perBook) {
  const max = Math.max(1, ...perBook.values());
  const bars = books.map((entry, i) => {
    const count = perBook.get(entry.id) ?? 0;
    const height = count ? Math.max(2, Math.round((count / max) * 56)) : 0;
    return { id: entry.id, title: `${entry.name}: ${count}`, x: i * 10, y: 60 - height, height };
  });
  const top = [...perBook].sort((x, y) => y[1] - x[1]).slice(0, 3);
  const name = (/** @type {string} */ id) => books.find((entry) => entry.id === id)?.name ?? id;
  const most = top.length ? `Most in ${top.map(([id, count]) => `${name(id)} (${count})`).join(', ')}.` : '';
  return { bars, most };
}

/** @param {number} count */
function times(count) {
  return count === 1 ? 'Once' : `${count.toLocaleString('en')} times`;
}

/**
 * A verse's words as parts, with the words that render `code` marked: one
 * Strong's number, or any of several.
 *
 * @param {WordVerse} verse
 * @param {string | Set<string>} code
 * @returns {Part[]}
 */
function markCode(verse, code) {
  /** @type {Part[]} */
  const parts = [];
  for (const block of verse.blocks) {
    for (const run of block.runs) {
      for (const token of run.tokens) {
        const hit = typeof code === 'string' ? token.s === code : code.has(token.s ?? '');
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
    return { ...rest, query: '', dictionary: { ...easton, parts: citations(easton.text, books) }, ...offers, studyCode: '' };
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
    // A king's reign, by the modern chronologies too (data/chronology).
    const reign = /** @type {Record<string, Record<string, number[]>>} */ (kings.reigns)[id];
    if (reign) {
      const span = (/** @type {number[]} */ [from, to]) => (from === to ? formatYear(from) : `${1 - from}–${formatYear(to)}`);
      facts.push(Object.entries(reign).map(([key, years]) => `${/** @type {Record<string, string>} */ (kings.chronologies)[key]}: ${span(years)}`).join('; '));
    }
    relations = [
      ['Part of', named(found.partOf)],
      ['People', many(found.participants)],
      ['Places', many(found.locations)],
    ];
  }
  if (found.kind === 'group') relations = [['Members', many(found.members)]];

  const dated = found.kind === 'event' || (found.kind === 'person' && (found.born !== null || found.died !== null));
  const reigned = found.kind === 'event' && id in kings.reigns;
  const credit = `From Theographic (CC BY-SA)${found.summary ? " and Easton's Bible Dictionary" : ''}.${dated ? ` ${CHRONOLOGY}` : ''}${reigned ? ' The reign by Albright, Thiele, Galil and Kitchen: Wikipedia, "Kings of Israel and Judah" (CC BY-SA).' : ''}`;
  return {
    id,
    kind: found.kind,
    title: found.title,
    facts,
    summary: found.summary ?? '',
    // With more to read, the summary drops its ellipsis: Read more follows.
    summaryParts: citations(found.more ? (found.summary ?? '').replace(/ …$/, '') : (found.summary ?? ''), books),
    moreParts: found.more ? citations(found.more, books) : [],
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
    facts: [
      found.kind === 'ruler' ? 'Ruler' : found.kind === 'event' ? 'World event' : 'World history',
      found.start === found.end ? formatYear(found.start) : `${found.kind === 'ruler' ? 'reigned ' : ''}${formatYear(found.start)} to ${formatYear(found.end)}`,
      found.region,
    ],
    summary: '',
    summaryParts: [],
    moreParts: [],
    relations: [],
    credit: `${found.dates === 'conventional' ? `Dates: the usual scholarly dates, entered by hand, as Wikidata (${found.id}, CC0) has none` : `Dates from Wikidata, ${found.id} (CC0): conventional scholarly dates`}. The biblical events below follow Floyd Nolen Jones's chronology, so the two can disagree.`,
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
  const [journeys, seeAlso] = await Promise.all([
    found.kind === 'person' ? journeysFor({ person: id }) : [],
    seeAlsoFor(id, found.verses, view),
  ]);
  return answer({ summary, results, entity: view, rule, landscape: total ? `landscape:${id}` : '', journeys, seeAlso, images: imagesFor(id) });
}

// How many of an entity's verses "See also" reads: enough to find who is
// named with whom, quick for God or Jerusalem.
const SEE_ALSO_VERSES = 800;
const SEE_ALSO_COUNT = 8;

/**
 * The entities named most often in the same verses as one entity, leaving out
 * the ones its own relations already list: its "See also".
 *
 * @param {string} id
 * @param {string[]} addresses its verses
 * @param {EntityView} view
 */
async function seeAlsoFor(id, addresses, view) {
  const related = new Set(view.relations.flatMap((relation) => relation.items.map((item) => item.id)));
  /** @type {Map<string, number>} */
  const counts = new Map();
  const byBook = Map.groupBy(addresses.slice(0, SEE_ALSO_VERSES), (address) => address.split('.')[0]);
  for (const [book, verses] of byBook) {
    const named = await namedIn(book).catch(() => ({}));
    for (const address of verses) {
      for (const other of /** @type {Record<string, string[]>} */ (named)[address] ?? []) {
        if (other !== id && !related.has(other)) counts.set(other, (counts.get(other) ?? 0) + 1);
      }
    }
  }
  // A name shared in many verses counts, but less if it is named everywhere:
  // the count over the square root of all its verses, so Barnabas comes
  // before God for Paul.
  const all = await entities();
  /** @param {string} other @param {number} count */
  const score = (other, count) => count / Math.sqrt(Math.max(1, all[other]?.verses.length ?? 1));
  return [...counts]
    .filter(([other, count]) => count >= 2 && all[other])
    .sort((a, b) => score(b[0], b[1]) - score(a[0], a[1]))
    .slice(0, SEE_ALSO_COUNT)
    .map(([other]) => ({ id: other, title: all[other].title, kind: all[other].kind }));
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

  // A Strong's number, such as H2617 or g25, finds the verses that use it;
  // with a sense, such as "G4151 sense 7", those that use it in that sense.
  const strongs = /^([HG])0*(\d+)(?:\s+sense\s+(\d+))?$/i.exec(text);
  if (strongs) return strongsResults(`${strongs[1].toUpperCase()}${strongs[2]}`, limit, Number(strongs[3] ?? 0));

  const ref = parseReference(text, books);
  if (ref) return referenceResult(text, ref);

  // Roles of a clause, each with a word, such as "subject God verb love",
  // search the syntax of the Hebrew and the Greek (data/syntax.js).
  const syntax = await import('./syntax.js');
  const roles = await syntax.syntaxQuery(text);
  if (roles) return syntax.syntaxResults(text, roles, limit);

  // Words of the grammar, such as "aorist imperative in John", search the
  // Hebrew and Greek (lib/grammar.js). One word alone that the KJV also
  // has, such as "perfect", is a search of the text.
  const grammar = await grammarQuery(text);
  if (grammar) {
    const alone = grammar.terms.length === 1 && !grammar.code && !grammar.strongs && !grammar.language && !grammar.scope;
    if (!alone || !(await matching(text)).first.length) return grammarResults(text, grammar, limit);
  }

  // A word of the original as it is said, such as agape or chesed, that
  // the KJV does not have: its word study (lib/lemma.js).
  if (/^[\p{L}ʼʻ'’-]+$/u.test(text) && !(await matching(text)).first.length) {
    const codes = await lemmaCodes(text);
    if (codes.length) {
      const [first, ...rest] = codes;
      lexicon ??= import('./strongs/lexicon.json', { with: { type: 'json' } }).then((module) => module.default);
      const known = await lexicon;
      const also = rest.map((code) => ({ code, label: `${code} ${known[code]?.xlit ?? ''}`.trim() }));
      return { ...(await strongsResults(first, limit)), also };
    }
  }

  const { first, rest, marker } = await matching(text);
  const total = first.length + rest.length;

  /** @type {Result[]} */
  const results = [...first, ...rest]
    .slice(0, limit)
    .map((verse) => ({ address: verse.address, title: verse.title, parts: mark(verse.text, marker) }));

  // A word the KJV has that is also a word of the original as it is said,
  // such as amen, or Chesed (a name, and chesed): its word studies too.
  /** @type {{ code: string, label: string }[]} */
  let also = [];
  if (/^[\p{L}ʼʻ'’-]+$/u.test(text)) {
    const codes = await lemmaCodes(text);
    if (codes.length) {
      lexicon ??= import('./strongs/lexicon.json', { with: { type: 'json' } }).then((module) => module.default);
      const known = await lexicon;
      also = codes.map((code) => ({ code, label: `${code} ${known[code]?.xlit ?? ''}`.trim() }));
    }
  }
  // A word that names a topic of Nave's, such as prayer: the topic too,
  // closed above the verses (data/topics.js).
  const topicKey = await topicFor(text);
  const named = topicKey ? await topic(topicKey) : null;
  return answer({ query: text, summary: summarize(total, results.length), results, also, topic: named, topicOpen: Boolean(named) && !total, landscape: total ? `landscape:text:${text}` : '' });
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
  // Videos of the passage (data/videos.js), under it.
  return answer({ query, summary: `Passage, ${verseCount(verses.length)}`, results: [{ address: toAddress(ref), title, parts }], videos: videosFor(toAddress(ref)) });
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
