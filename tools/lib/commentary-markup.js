// A commentary entry's markup, OSIS or ThML as the SWORD modules have it, as
// the app's own blocks. Used by tools/import-commentaries.js.
//
// A block is a heading, { h: "Chapter 3" }, or a paragraph, { p: [...] }, a
// list of runs: plain text, or { b } bold, { i } italic, { ref, t } a
// reference with its address, { note } a note of the editor. Nothing else of
// the markup is kept, so the card renders the runs as text, with no HTML from
// the source.

import { parseReference, toAddress } from '../../app/lib/reference.js';

/** @typedef {import('../../app/lib/reference.js').BookEntry} BookEntry */
/** @typedef {string | { b: string } | { i: string } | { ref: string, t: string } | { note: string }} Run */
/** @typedef {{ h: string } | { p: Run[] }} Block */

/** The OSIS book names, in the order of app/data/kjv/books.json. */
export const OSIS = [
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job',
  'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph',
  'Hag', 'Zech', 'Mal', 'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess', '2Thess',
  '1Tim', '2Tim', 'Titus', 'Phlm', 'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev',
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** @param {string} text */
export function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') return String.fromCodePoint(name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
    return ENTITIES[/** @type {keyof typeof ENTITIES} */ (name.toLowerCase())] ?? whole;
  });
}

/**
 * An OSIS reference, such as John.3.16, John.12.32-John.12.33 or Ps.23, as an
 * app address; '' when it is not one.
 *
 * @param {string} osisRef
 * @param {BookEntry[]} books
 */
export function osisAddress(osisRef, books) {
  const [first, last] = osisRef.split('-');
  const parse = (/** @type {string} */ part) => {
    const [name, chapter, verse] = (part ?? '').split('.');
    const book = books[OSIS.indexOf(name)];
    return book ? { book: book.id, chapter: Number(chapter), verse: verse ? Number(verse) : null } : null;
  };
  const from = parse(first);
  if (!from || !from.chapter) return '';
  const to = last ? parse(last) : null;
  const text = `${books.find((book) => book.id === from.book)?.name} ${from.chapter}${from.verse ? `:${from.verse}` : ''}`;
  const sameChapter = to && to.book === from.book && to.chapter === from.chapter && to.verse;
  const ref = parseReference(sameChapter ? `${text}-${to.verse}` : text, books);
  return ref ? toAddress(ref) : '';
}

/** What a tag does to the text, by its name and type. */
const BREAKS = new Set(['br', 'p', 'row', 'lb']);
const DIV_BREAKS = new Set(['x-p', 'introduction', 'section', 'paragraph']);
const EMPHASIS = new Set(['hi', 'b', 'i', 'em', 'strong']);

/**
 * What a tag means here: a run or a heading opens or closes, a paragraph
 * breaks, a cell ends; or nothing.
 *
 * @param {string} name lower case
 * @param {string} type its type attribute
 * @returns {'title' | 'b' | 'i' | 'ref' | 'note' | 'break' | 'cell' | null}
 */
function meaningOf(name, type) {
  if (name === 'title') return 'title';
  if (EMPHASIS.has(name)) return name === 'i' || name === 'em' || type === 'italic' ? 'i' : 'b';
  if (name === 'reference' || name === 'scripref') return 'ref';
  if (name === 'note') return 'note';
  if (BREAKS.has(name) || (name === 'div' && DIV_BREAKS.has(type))) return 'break';
  return name === 'cell' ? 'cell' : null;
}

/**
 * The reference of an opening reference tag: its OSIS reference, or its
 * passage, or '' for one named only by its text.
 *
 * @param {string} attrs
 * @param {BookEntry[]} books
 */
function refOfTag(attrs, books) {
  const osisRef = /osisRef="([^"]*)"/i.exec(attrs)?.[1];
  if (osisRef) return osisAddress(osisRef, books);
  const passage = /passage="([^"]*)"/i.exec(attrs)?.[1];
  return passage ? addressOf(decode(passage), books) : '';
}

/**
 * Reads an entry's markup into blocks, one piece at a time.
 *
 * @param {BookEntry[]} books
 */
function reader(books) {
  /** @type {Block[]} */
  const blocks = [];
  /** @type {Run[]} */
  let runs = [];
  // What the text being read goes into: a bold or italic run, a reference,
  // a note or a heading. One at a time is enough for these modules.
  /** @type {{ kind: 'b' | 'i' | 'ref' | 'note' | 'h', text: string, ref?: string } | null} */
  let open = null;

  const flush = () => {
    const trimmed = trimRuns(runs);
    if (trimmed.length) blocks.push({ p: trimmed });
    runs = [];
  };
  const close = () => {
    if (!open) return;
    const text = open.text.replace(/\s+/g, ' ');
    if (open.kind === 'h') {
      flush();
      if (text.trim()) blocks.push({ h: text.trim() });
    } else if (open.kind === 'ref') runs.push({ ref: open.ref ?? '', t: text });
    else if (text.trim()) runs.push(/** @type {Run} */ ({ [open.kind]: open.kind === 'note' ? text.trim() : text }));
    open = null;
  };
  /** @param {string} text */
  const text = (text) => {
    if (open) open.text += text;
    else pushText(runs, text);
  };
  /**
   * @param {NonNullable<ReturnType<typeof meaningOf>>} meaning
   * @param {boolean} closing
   * @param {string} attrs
   */
  const tag = (meaning, closing, attrs) => {
    if (meaning === 'break') {
      close();
      flush();
    } else if (meaning === 'cell') {
      if (closing) text(' ');
    } else if (closing) close();
    else if (!open) open = { kind: meaning === 'title' ? 'h' : meaning, text: '', ...(meaning === 'ref' ? { ref: refOfTag(attrs, books) } : {}) };
  };
  const done = () => {
    close();
    flush();
    return blocks;
  };
  return { text, tag, done };
}

/**
 * The blocks of an entry.
 *
 * @param {string} markup
 * @param {BookEntry[]} books
 * @returns {Block[]}
 */
export function blocksOf(markup, books) {
  const read = reader(books);
  for (const [, tag, text] of markup.matchAll(/(<[^>]*>)|([^<]+)/g)) {
    if (text) {
      read.text(decode(text));
      continue;
    }
    const match = /^<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>$/.exec(tag);
    const meaning = match ? meaningOf(match[2].toLowerCase(), /type="([^"]*)"/.exec(match[3])?.[1] ?? '') : null;
    // A self-closing title or note is a mark with no text.
    if (match && meaning && !(match[4] && meaning !== 'break' && meaning !== 'cell')) read.tag(meaning, Boolean(match[1]), match[3]);
  }
  return withThmlRefs(read.done(), books);
}

/**
 * A ThML reference with no passage given is named by its text: "Rom 8:30".
 *
 * @param {Block[]} blocks
 * @param {BookEntry[]} books
 */
function withThmlRefs(blocks, books) {
  return blocks.map((block) => {
    if (!('p' in block)) return block;
    return { p: block.p.map((run) => (typeof run === 'object' && 'ref' in run && !run.ref ? refOrText(run.t, books) : run)) };
  });
}

/**
 * @param {string} text
 * @param {BookEntry[]} books
 * @returns {Run}
 */
function refOrText(text, books) {
  const address = addressOf(text, books);
  return address ? { ref: address, t: text } : text;
}

/**
 * @param {string} text such as "Rom 8:30" or "Joh 3:12"
 * @param {BookEntry[]} books
 */
function addressOf(text, books) {
  const ref = parseReference(text.trim().replace(/[.,;]$/, ''), books);
  return ref ? toAddress(ref) : '';
}

/**
 * Adds text to a paragraph, joined to the plain text before it.
 *
 * @param {Run[]} runs
 * @param {string} text
 */
function pushText(runs, text) {
  const last = runs.at(-1);
  if (typeof last === 'string') runs[runs.length - 1] = spaced(last + text);
  else runs.push(spaced(text));
}

/**
 * Text with one space between words, and a space where the source ran a
 * verse number into the verse before it ("life.17. For").
 *
 * @param {string} text
 */
function spaced(text) {
  return text.replace(/\s+/g, ' ').replace(/([a-z][.;:?!’”"])(\d{1,3}\. [A-Z])/g, '$1 $2');
}

/**
 * A paragraph without the spaces at its ends, or empty when it has no words.
 *
 * @param {Run[]} runs
 * @returns {Run[]}
 */
function trimRuns(runs) {
  const kept = [...runs];
  // A stop left at the start, after a heading took the words before it.
  if (typeof kept[0] === 'string') kept[0] = kept[0].replace(/^\s*[.,;:]?\s*/, '');
  if (typeof kept.at(-1) === 'string') kept[kept.length - 1] = /** @type {string} */ (kept.at(-1)).trimEnd();
  const words = kept.filter((run) => (typeof run === 'string' ? run.trim() : true));
  return words.length ? words : [];
}
