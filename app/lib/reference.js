// Bible references, in two spellings.
//
// The address is what the app stores and puts in URLs: `JHN.3.16-18`, the
// OSIS book id, the chapter, and an optional verse or verse range. The text
// is what a person types: "John 3:16-18", "jn 3:16", "1 cor 13", "Ps 23".
//
// Both are parsed against the book list in app/data/kjv/books.json, so a
// chapter or verse that does not exist is refused here, not later.

/**
 * @typedef {{ id: string, name: string, abbreviation: string, verses: number[] }} BookEntry
 * @typedef {{ book: string, chapter: number, from?: number, to?: number }} Reference
 */

// Common short forms that are not a prefix of the book's name. A prefix needs
// no entry: "gen", "matt" and "1 cor" are found without one.
const ALIASES = {
  jn: 'JHN',
  mk: 'MRK',
  mr: 'MRK',
  lk: 'LUK',
  mt: 'MAT',
  ps: 'PSA',
  psalm: 'PSA',
  pss: 'PSA',
  song: 'SNG',
  songofsongs: 'SNG',
  sos: 'SNG',
  canticles: 'SNG',
  jas: 'JAS',
  phm: 'PHM',
  php: 'PHP',
  revelations: 'REV',
};

const TYPED = /^\s*((?:[1-3]|iii|ii|i)?\s*[a-z][a-z.\s]*?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/i;
const ADDRESS = /^([1-3]?[A-Z]{2,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/;

/**
 * "John 3:16-18" to a reference, or null when the text is not one.
 *
 * @param {string} text
 * @param {BookEntry[]} books
 * @returns {Reference | null}
 */
export function parseReference(text, books) {
  const match = TYPED.exec(text);
  if (!match) return null;
  const [, bookText, chapter, from, to] = match;
  const book = findBook(bookText, books);
  if (!book) return null;
  return checked(book, Number(chapter), from, to);
}

/**
 * `JHN.3.16-18` to a reference, or null when it is not a valid address.
 *
 * @param {string} address
 * @param {BookEntry[]} books
 * @returns {Reference | null}
 */
export function parseAddress(address, books) {
  const match = ADDRESS.exec(address);
  if (!match) return null;
  const [, id, chapter, from, to] = match;
  const book = books.find((entry) => entry.id === id);
  if (!book) return null;
  return checked(book, Number(chapter), from, to);
}

/**
 * @param {Reference} ref
 * @returns {string} such as `JHN.3.16-18`
 */
export function toAddress(ref) {
  let address = `${ref.book}.${ref.chapter}`;
  if (ref.from) address += `.${ref.from}`;
  if (ref.from && ref.to && ref.to !== ref.from) address += `-${ref.to}`;
  return address;
}

/**
 * @param {Reference} ref
 * @param {BookEntry[]} books
 * @returns {string} such as "John 3:16–18"
 */
export function formatReference(ref, books) {
  const book = books.find((entry) => entry.id === ref.book);
  // The book is "Psalms", but one of them is "Psalm 23".
  const name = ref.book === 'PSA' ? 'Psalm' : (book?.name ?? ref.book);
  let text = `${name} ${ref.chapter}`;
  if (ref.from) text += `:${ref.from}`;
  if (ref.from && ref.to && ref.to !== ref.from) text += `–${ref.to}`;
  return text;
}

/**
 * Exact matches first, then the first book in canon order whose name starts
 * with the text. So "jo" is Joshua, and "joh" is John.
 *
 * @param {string} text
 * @param {BookEntry[]} books
 */
function findBook(text, books) {
  const key = normalize(text.replace(/^(iii|ii|i)\s+/i, (numeral) => String(numeral.trim().length)));
  if (key.length < 2) return null;

  const exact = books.find(
    (book) => normalize(book.id) === key || normalize(book.abbreviation) === key || normalize(book.name) === key,
  );
  if (exact) return exact;

  const alias = ALIASES[/** @type {keyof typeof ALIASES} */ (key)];
  if (alias) return books.find((book) => book.id === alias) ?? null;

  return books.find((book) => normalize(book.name).startsWith(key)) ?? null;
}

/** @param {string} text */
function normalize(text) {
  return text.toLowerCase().replace(/[\s.]/g, '');
}

/**
 * A reference only when the chapter and verses exist. A range that runs past
 * the end of the chapter stops at the last verse.
 *
 * @param {BookEntry} book
 * @param {number} chapter
 * @param {string | undefined} fromText
 * @param {string | undefined} toText
 * @returns {Reference | null}
 */
function checked(book, chapter, fromText, toText) {
  const count = book.verses[chapter - 1];
  if (!count) return null;

  /** @type {Reference} */
  const ref = { book: book.id, chapter };
  if (fromText === undefined) return ref;

  const from = Number(fromText);
  if (from < 1 || from > count) return null;
  ref.from = from;

  if (toText !== undefined) {
    const to = Math.min(Number(toText), count);
    if (to < from) return null;
    if (to !== from) ref.to = to;
  }
  return ref;
}
