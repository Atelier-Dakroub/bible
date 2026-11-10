// The Old Testament in the New: the quotations Nestle's Greek New Testament
// (1904) prints in bold, with the passages they quote (data/quotations.json,
// tools/import-quotations.js). Nestle marks quotations, not allusions.

import data from './quotations.json' with { type: 'json' };
import { answer, books, passage, preview } from './bible.js';
import { formatReference, parseAddress, versesIn } from '../lib/reference.js';

/** @typedef {{ nt: string, ot: string[], greek: string }} Quotation */
/** @typedef {import('./bible.js').Result} Result */

/** The New Testament books whose quotations the markup marks. */
export const COVERED = new Set(/** @type {string[]} */ (data.covered));

export const CREDIT =
  "Quotations as Nestle's Greek New Testament (1904) prints them in bold, with its margin's references; markup from MACULA Greek (CC BY 4.0). Nestle marks quotations, not allusions. The markup covers the Gospels, Acts, Romans, and Galatians to Titus; not yet 1 and 2 Corinthians, Philemon, Hebrews, the general letters or Revelation.";

/** @param {string} address @returns {string[]} the verses of an address */
function versesOf(address) {
  const ref = parseAddress(address, books);
  return ref ? versesIn(ref, books).map(([chapter, n]) => `${ref.book}.${chapter}.${n}`) : [];
}

/** @type {{ from: Map<string, Quotation[]>, at: Map<string, Quotation[]>, marks: Map<string, string> } | null} */
let index = null;

/** Each verse to the quotations it is in, as the quoting and as the quoted. */
function built() {
  if (index) return index;
  /** @type {Map<string, Quotation[]>} */
  const from = new Map();
  /** @type {Map<string, Quotation[]>} */
  const at = new Map();
  /** @type {Map<string, string>} */
  const marks = new Map();
  /** @param {Map<string, Quotation[]>} map @param {string} verse @param {Quotation} quotation */
  const add = (map, verse, quotation) => map.set(verse, [...(map.get(verse) ?? []), quotation]);
  for (const quotation of /** @type {Quotation[]} */ (data.quotations)) {
    const nt = versesOf(quotation.nt);
    for (const verse of nt) add(from, verse, quotation);
    if (nt[0]) marks.set(nt[0], marks.get(nt[0]) === 'quoted' ? 'both' : 'quotes');
    for (const address of quotation.ot) {
      const ot = versesOf(address);
      for (const verse of ot) add(at, verse, quotation);
      if (ot[0]) marks.set(ot[0], marks.get(ot[0]) === 'quotes' ? 'both' : 'quoted');
    }
  }
  index = { from, at, marks };
  return index;
}

/**
 * The mark a verse has on a card: `quotes` where a quotation of the Old
 * Testament begins, `quoted` where a passage quoted in the New begins,
 * `both`, or ''.
 *
 * @param {string} verse such as ROM.1.17
 */
export function quoteMark(verse) {
  return built().marks.get(verse) ?? '';
}

/**
 * The other side of the quotations a passage is in: for the New Testament,
 * the passages it quotes; for the Old, the passages that quote it. Each
 * address once, in canon order of the first verse.
 *
 * @param {string} address
 * @returns {{ quoting: boolean, addresses: string[] }}
 */
export function quotationsOf(address) {
  const { from, at } = built();
  const verses = versesOf(address);
  const nt = books.findIndex((book) => book.id === 'MAT') <= books.findIndex((book) => book.id === address.split('.')[0]);
  /** @type {Set<string>} */
  const found = new Set();
  for (const verse of verses) {
    for (const quotation of (nt ? from : at).get(verse) ?? []) {
      if (nt) for (const each of quotation.ot) found.add(each);
      else found.add(quotation.nt);
    }
  }
  const order = (/** @type {string} */ each) => {
    const [book, chapter, verse] = each.split(/[.-]/);
    return books.findIndex((entry) => entry.id === book) * 1e6 + Number(chapter) * 1e3 + Number(verse);
  };
  return { quoting: nt, addresses: [...found].sort((a, b) => order(a) - order(b)) };
}

/**
 * A passage as a result, with its text.
 *
 * @param {string} address
 * @returns {Promise<Result | null>}
 */
async function result(address) {
  const ref = parseAddress(address, books);
  if (!ref) return null;
  const { title, verses } = await passage(ref);
  return { address, title, parts: [{ text: preview(verses, 200), hit: false }] };
}

/**
 * The quotations of a passage, as the search panel lists them.
 *
 * @param {string} address
 */
export async function quotationResults(address) {
  const ref = parseAddress(address, books);
  if (!ref) return answer({ summary: 'No passage has that address.' });
  const { quoting, addresses } = quotationsOf(address);
  const results = (await Promise.all(addresses.map(result))).flatMap((each) => (each ? [each] : []));
  const title = formatReference(ref, books);
  const count = results.length === 1 ? '1 passage' : `${results.length} passages`;
  const summary = quoting && !COVERED.has(ref.book)
    ? `${title}: the markup of Nestle's quotations does not cover this book yet. ${CREDIT}`
    : !results.length
    ? `${title}: no quotation, as Nestle marks them.`
    : quoting
      ? `${title} quotes the Old Testament: ${count}. ${CREDIT}`
      : `${title} is quoted in the New Testament: ${count}. ${CREDIT}`;
  return answer({ query: '', summary, results });
}
