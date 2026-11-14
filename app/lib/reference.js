// Bible references, in two spellings.
//
// The address is what the app stores and puts in URLs: `JHN.3.16-18`, the
// OSIS book id, the chapter, and an optional verse or verse range. A range
// can run into a later chapter of the same book: `GEN.1.1-2.3`. The text is
// what a person types: "John 3:16-18", "jn 3:16", "1 cor 13", "Ps 23",
// "Gen 1:1-2:3".
//
// Both are parsed against the book list in app/data/kjv/books.json, so a
// chapter or verse that does not exist is refused here, not later.

/**
 * @typedef {{ id: string, name: string, abbreviation: string, verses: number[] }} BookEntry
 * @typedef {{ book: string, chapter: number, from?: number, to?: number, toChapter?: number }} Reference
 *   `toChapter` is there only when the range ends in a later chapter; `to` is
 *   then a verse of that chapter.
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

const TYPED = /^\s*((?:[1-3]|iii|ii|i)?\s*[a-z][a-z.\s]*?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(?:(\d+)\s*[:.]\s*)?(\d+))?|\s*[-–—]\s*(\d+))?\s*$/i;
const ADDRESS = /^([1-3]?[A-Z]{2,3})\.(\d+)(?:\.(\d+)(?:-(?:(\d+)\.)?(\d+))?)?$/;

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
  const [, bookText, chapter, from, toChapter, to, toNumber] = match;
  const book = findBook(bookText, books);
  if (!book) return null;
  // "Jude 3-5": in a book of one chapter, a range of verses. Elsewhere a
  // range of chapters, which is not a reference here.
  if (toNumber !== undefined) return book.verses.length === 1 ? checked(book, 1, chapter, toNumber) : null;
  return checked(book, Number(chapter), from, to, toChapter);
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
  const [, id, chapter, from, toChapter, to] = match;
  const book = books.find((entry) => entry.id === id);
  if (!book) return null;
  return checked(book, Number(chapter), from, to, toChapter);
}

/**
 * @param {Reference} ref
 * @returns {string} such as `JHN.3.16-18`
 */
export function toAddress(ref) {
  let address = `${ref.book}.${ref.chapter}`;
  if (ref.from) address += `.${ref.from}`;
  if (ref.from && ref.toChapter && ref.to) address += `-${ref.toChapter}.${ref.to}`;
  else if (ref.from && ref.to && ref.to !== ref.from) address += `-${ref.to}`;
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
  if (ref.from && ref.toChapter && ref.to) text += `–${ref.toChapter}:${ref.to}`;
  else if (ref.from && ref.to && ref.to !== ref.from) text += `–${ref.to}`;
  return text;
}

// The short names of the books for a reader, as the SBL style has them:
// "1 Cor 13", "Song 2:1". A card in its short form shows its title so.
const SHORT_NAMES = {
  GEN: 'Gen', EXO: 'Exod', LEV: 'Lev', NUM: 'Num', DEU: 'Deut', JOS: 'Josh', JDG: 'Judg', RUT: 'Ruth',
  '1SA': '1 Sam', '2SA': '2 Sam', '1KI': '1 Kgs', '2KI': '2 Kgs', '1CH': '1 Chr', '2CH': '2 Chr', EZR: 'Ezra', NEH: 'Neh',
  EST: 'Esth', JOB: 'Job', PSA: 'Ps', PRO: 'Prov', ECC: 'Eccl', SNG: 'Song', ISA: 'Isa', JER: 'Jer', LAM: 'Lam',
  EZK: 'Ezek', DAN: 'Dan', HOS: 'Hos', JOL: 'Joel', AMO: 'Amos', OBA: 'Obad', JON: 'Jonah', MIC: 'Mic', NAM: 'Nah',
  HAB: 'Hab', ZEP: 'Zeph', HAG: 'Hag', ZEC: 'Zech', MAL: 'Mal', MAT: 'Matt', MRK: 'Mark', LUK: 'Luke', JHN: 'John',
  ACT: 'Acts', ROM: 'Rom', '1CO': '1 Cor', '2CO': '2 Cor', GAL: 'Gal', EPH: 'Eph', PHP: 'Phil', COL: 'Col',
  '1TH': '1 Thess', '2TH': '2 Thess', '1TI': '1 Tim', '2TI': '2 Tim', TIT: 'Titus', PHM: 'Phlm', HEB: 'Heb', JAS: 'Jas',
  '1PE': '1 Pet', '2PE': '2 Pet', '1JN': '1 John', '2JN': '2 John', '3JN': '3 John', JUD: 'Jude', REV: 'Rev',
};

/**
 * A title with its book's name made short: "1 Corinthians 13" is
 * "1 Cor 13", "Psalm 23" is "Ps 23", "John 3:16, BSB" is "John 3:16,
 * BSB". A title that does not begin with a book's name is as it was.
 *
 * @param {string} title
 * @param {BookEntry[]} books
 */
export function shortTitle(title, books) {
  const names = books.flatMap((book) => [book.name, ...(book.id === 'PSA' ? ['Psalm'] : [])].map((name) => ({ name, id: book.id })));
  // The longest name first: "1 John" before "John".
  const found = names.sort((x, y) => y.name.length - x.name.length).find(({ name }) => title.startsWith(`${name} `));
  const short = found && /** @type {Record<string, string>} */ (SHORT_NAMES)[found.id];
  return found && short ? short + title.slice(found.name.length) : title;
}

/**
 * Exact matches first, then the first book in canon order whose name starts
 * with the text. So "jo" is Joshua, and "joh" is John.
 *
 * @param {string} text
 * @param {BookEntry[]} books
 */
export function findBook(text, books) {
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
 * the end of its last chapter stops at that chapter's last verse.
 *
 * @param {BookEntry} book
 * @param {number} chapter
 * @param {string | undefined} fromText
 * @param {string | undefined} toText
 * @param {string | undefined} [toChapterText] the chapter the range ends in, when it is named
 * @returns {Reference | null}
 */
function checked(book, chapter, fromText, toText, toChapterText) {
  // A book of one chapter is cited by verse alone: "Jude 5" is Jude 1:5.
  if (book.verses.length === 1 && chapter > 1 && fromText === undefined && toChapterText === undefined) {
    return checked(book, 1, String(chapter), toText);
  }
  const count = book.verses[chapter - 1];
  if (!count) return null;

  /** @type {Reference} */
  const ref = { book: book.id, chapter };
  if (fromText === undefined) return ref;

  const from = Number(fromText);
  if (from < 1 || from > count) return null;
  ref.from = from;
  if (toText === undefined) return ref;

  const toChapter = toChapterText === undefined ? chapter : Number(toChapterText);
  const last = book.verses[toChapter - 1];
  if (!last || toChapter < chapter) return null;
  const to = Math.min(Number(toText), last);
  if (toChapter === chapter) {
    if (to < from) return null;
    if (to !== from) ref.to = to;
    return ref;
  }
  if (to < 1) return null;
  ref.toChapter = toChapter;
  ref.to = to;
  return ref;
}

/**
 * Every verse a reference covers, as [chapter, verse] pairs in order.
 *
 * @param {Reference} ref
 * @param {BookEntry[]} books
 * @returns {[number, number][]}
 */
export function versesIn(ref, books) {
  const book = books.find((entry) => entry.id === ref.book);
  if (!book) return [];
  const lastChapter = ref.toChapter ?? ref.chapter;
  /** @type {[number, number][]} */
  const found = [];
  for (let chapter = ref.chapter; chapter <= lastChapter; chapter += 1) {
    const count = book.verses[chapter - 1] ?? 0;
    const first = chapter === ref.chapter ? (ref.from ?? 1) : 1;
    const last = chapter === lastChapter ? (ref.to ?? (ref.toChapter ? count : (ref.from ?? count))) : count;
    for (let verse = first; verse <= last; verse += 1) found.push([chapter, verse]);
  }
  return found;
}

/**
 * The passage before or after this one, the same size, for a card that steps
 * through the text. A chapter steps by a chapter, into the next book at the
 * end of one. A verse or a range steps by as many verses as it holds, and may
 * run into the next chapter, but stops at the end of its book; at the very
 * end of a book it goes on in the next book. Null past either end of the
 * Bible.
 *
 * @param {string} address
 * @param {number} direction 1 for the next passage, -1 for the one before
 * @param {BookEntry[]} books
 * @returns {string | null}
 */
export function stepAddress(address, direction, books) {
  const ref = parseAddress(address, books);
  if (!ref) return null;
  const at = books.findIndex((entry) => entry.id === ref.book);
  const book = books[at];

  if (!ref.from) {
    const chapter = ref.chapter + direction;
    if (chapter >= 1 && chapter <= book.verses.length) return `${book.id}.${chapter}`;
    const other = books[at + direction];
    if (!other) return null;
    return `${other.id}.${direction > 0 ? 1 : other.verses.length}`;
  }

  // Every verse of the book in one list, so a step can cross chapters.
  /** @type {[number, number][]} */
  const all = book.verses.flatMap((count, i) => Array.from({ length: count }, (_, v) => /** @type {[number, number]} */ ([i + 1, v + 1])));
  const covered = versesIn(ref, books);
  const size = covered.length;
  const first = all.findIndex(([c, v]) => c === covered[0][0] && v === covered[0][1]);
  const last = first + size - 1;

  /** @param {BookEntry} entry @param {[number, number][]} verses @param {number} start */
  const range = (entry, verses, start) => {
    const begin = Math.max(0, start);
    const end = Math.min(verses.length - 1, begin + size - 1);
    const [c1, v1] = verses[begin];
    const [c2, v2] = verses[end];
    return toAddress({ book: entry.id, chapter: c1, from: v1, ...(c2 !== c1 ? { toChapter: c2, to: v2 } : v2 !== v1 ? { to: v2 } : {}) });
  };

  if (direction > 0) {
    if (last + 1 < all.length) return range(book, all, last + 1);
    const other = books[at + 1];
    if (!other) return null;
    const verses = other.verses.flatMap((count, i) => Array.from({ length: count }, (_, v) => /** @type {[number, number]} */ ([i + 1, v + 1])));
    return range(other, verses, 0);
  }
  if (first > 0) return range(book, all, Math.max(0, first - size));
  const other = books[at - 1];
  if (!other) return null;
  const verses = other.verses.flatMap((count, i) => Array.from({ length: count }, (_, v) => /** @type {[number, number]} */ ([i + 1, v + 1])));
  return range(other, verses, verses.length - size);
}
