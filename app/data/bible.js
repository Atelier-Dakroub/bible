// The text, for the server: passages by reference, and search.
//
// A book is loaded the first time something asks for it and kept. Search asks
// for all 66, so the first search takes longer than the rest.

import index from './kjv/books.json' with { type: 'json' };
import { loaders } from './kjv/index.js';
import { formatReference, parseReference, toAddress } from '../lib/reference.js';
import { tokenize } from '../lib/words.js';

/** @typedef {import('../lib/reference.js').Reference} Reference */
/** @typedef {{ text: string, marks: string[] }} Run */
/** @typedef {{ style: string, numbered?: boolean, runs: Run[] }} Block */
/** @typedef {{ n: number, id: string, org?: string, blocks: Block[] }} Verse */
/** @typedef {{ id: string, name: string, chapters: { n: number, verses: Verse[] }[] }} Book */
/** @typedef {Run & { tokens: { text: string, w: number }[] }} WordRun */
/** @typedef {{ style: string, numbered?: boolean, runs: WordRun[] }} WordBlock */
/** @typedef {{ n: number, id: string, org?: string, blocks: WordBlock[] }} WordVerse */
/** @typedef {{ text: string, hit: boolean }} Part */
/** @typedef {{ address: string, title: string, parts: Part[] }} Result */

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
  const { chapters } = await book(ref.book);
  const verses = chapters[ref.chapter - 1].verses;
  const from = ref.from ?? 1;
  const to = ref.to ?? ref.from ?? verses.length;
  return { title: formatReference(ref, books), verses: verses.slice(from - 1, to).map(withWords) };
}

/**
 * The verse with each run split into numbered words (app/lib/words.js), so a
 * card can address a single word. A new object: the loaded book is shared.
 *
 * @param {Verse} verse
 * @returns {WordVerse}
 */
export function withWords(verse) {
  let next = 1;
  const blocks = verse.blocks.map((block) => ({
    ...block,
    runs: block.runs.map((run) => {
      const split = tokenize(run.text, next);
      next = split.next;
      return { ...run, tokens: split.tokens };
    }),
  }));
  return { ...verse, blocks };
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
 * @returns {Promise<{ query: string, summary: string, results: Result[] }>}
 */
export async function search(query, limit = 50) {
  const text = query.trim();
  if (!text) return { query: text, summary: '', results: [] };

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

  return { query: text, summary: summarize(total, results.length), results };
}

/**
 * @param {string} query
 * @param {Reference} ref
 */
async function referenceResult(query, ref) {
  const { title, verses } = await passage(ref);
  const parts = [{ text: preview(verses, 200), hit: false }];
  return { query, summary: `Passage, ${verseCount(verses.length)}`, results: [{ address: toAddress(ref), title, parts }] };
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
