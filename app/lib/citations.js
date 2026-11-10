// The Bible references in a piece of prose, such as an entry of Easton's
// dictionary, so that each one can be a link to its verse.
//
// Easton writes references as "(Gen. 35:16, 19; 48:7; Ruth 4:11)": a book,
// a chapter and verse, then more verses of the same chapter after a comma,
// and more chapters of the same book after a semicolon. A reference with no
// book, such as "(2:1, 4; 7:7)", is in the book named last. Each part is its
// own link: "19" is Genesis 35:19.
//
// A book is found by its name ("Micah", "1 John"), or by a short form with a
// stop ("Phil.", "2 Thess."); a short form without a stop must be one the
// app knows exactly ("Ps", "Jn"), so that words such as "Is" and "Am" are not
// taken for books. A chapter without a verse ("Gen. 12") needs the stop too.
// A reference to a verse that does not exist is left as text.

import { findBook, parseAddress, toAddress } from './reference.js';

/** @typedef {import('./reference.js').BookEntry} BookEntry */
/** @typedef {{ text: string, address?: string }} Part */

// A book (its number, its name, a stop) and a chapter, with a verse range.
const CITED = /(?<![\w.])((?:[1-3] ?)?[A-Z][a-z]+(?: of [A-Z][a-z]+)?)(\.?) (\d{1,3})(?::(\d{1,3})(?:[-–](\d{1,3}))?)?(?![\w:])/g;
// A reference with no book: a chapter and verse.
const BARE = /(?<![\w.:])(\d{1,3}):(\d{1,3})(?:[-–](\d{1,3}))?(?![\w:])/g;
// What may follow a reference: more verses after a comma, more chapters after
// a semicolon; not the number of a book, as the 2 of "; 2 Thess.".
const MORE = /([,;] ?)(?:(\d{1,3}):)?(\d{1,3})(?:[-–](\d{1,3}))?(?![\w:])(?! ?[A-Z])/y;

/**
 * @param {BookEntry[]} books
 * @param {string} name as written, without the stop
 * @param {boolean} stop whether a stop follows it
 */
function bookOf(books, name, stop) {
  const key = name.toLowerCase().replace(/\s/g, '');
  // Easton's short form of the Song of Solomon (Canticles).
  if (key === 'cant') return books.find((book) => book.id === 'SNG') ?? null;
  const book = findBook(name, books);
  if (!book || stop) return book;
  const exact = [book.id, book.abbreviation, book.name].some((each) => each.toLowerCase().replace(/\s/g, '') === key);
  return exact || KNOWN.has(key) ? book : null;
}

// Short forms that are books without a stop.
const KNOWN = new Set(['ps', 'psalm', 'jn', 'mk', 'lk', 'mt', 'jas', 'song']);

/**
 * The address of a reference, or '' when it does not exist.
 *
 * @param {BookEntry[]} books
 * @param {string} book
 * @param {number} chapter
 * @param {string | undefined} from
 * @param {string | undefined} to
 */
function addressOf(books, book, chapter, from, to) {
  const text = `${book}.${chapter}${from ? `.${from}${to ? `-${to}` : ''}` : ''}`;
  const ref = parseAddress(text, books);
  return ref ? toAddress(ref) : '';
}

/**
 * The text in parts: plain text, and references with their addresses.
 *
 * @param {string} text
 * @param {BookEntry[]} books
 * @returns {Part[]}
 */
export function citations(text, books) {
  /** @type {{ at: number, end: number, book: string, chapter: number, from?: string, to?: string }[]} */
  const found = [];
  for (const match of text.matchAll(CITED)) {
    const [whole, name, stop, chapter, from, to] = match;
    if (!from && !stop) continue;
    const book = bookOf(books, name, Boolean(stop));
    if (!book) continue;
    found.push({ at: match.index ?? 0, end: (match.index ?? 0) + whole.length, book: book.id, chapter: Number(chapter), from, to });
  }
  // References with no book, where no named one covers them.
  for (const match of text.matchAll(BARE)) {
    const at = match.index ?? 0;
    if (found.some((each) => at >= each.at && at < each.end)) continue;
    found.push({ at, end: at + match[0].length, book: '', chapter: Number(match[1]), from: match[2], to: match[3] });
  }
  found.sort((a, b) => a.at - b.at);

  /** @type {Part[]} */
  const parts = [];
  let last = '';
  let done = 0;
  /** @param {string} piece */
  const plain = (piece) => {
    if (!piece) return;
    const before = parts[parts.length - 1];
    if (before && !before.address) before.text += piece;
    else parts.push({ text: piece });
  };
  for (const each of found) {
    if (each.at < done) continue;
    const book = each.book || last;
    if (!book) continue;
    const address = addressOf(books, book, each.chapter, each.from, each.to);
    if (!address) continue;
    last = book;
    plain(text.slice(done, each.at));
    parts.push({ text: text.slice(each.at, each.end), address });
    done = each.end;

    // The verses and chapters that follow it.
    let chapter = each.chapter;
    let verse = Boolean(each.from);
    MORE.lastIndex = done;
    let more;
    while ((more = MORE.exec(text))) {
      const [, mark, newChapter, first, end] = more;
      /** @type {number} */
      let nextChapter;
      /** @type {string | undefined} */
      let from;
      if (newChapter) [nextChapter, from] = [Number(newChapter), first];
      else if (mark.startsWith(',') && verse) [nextChapter, from] = [chapter, first];
      else [nextChapter, from] = [Number(first), undefined];
      const next = addressOf(books, book, nextChapter, from, from ? end : undefined);
      if (!next || (!from && end)) break;
      plain(mark);
      parts.push({ text: text.slice(more.index + mark.length, more.index + more[0].length), address: next });
      chapter = nextChapter;
      verse = Boolean(from);
      done = more.index + more[0].length;
      MORE.lastIndex = done;
    }
  }
  plain(text.slice(done));
  return parts;
}
