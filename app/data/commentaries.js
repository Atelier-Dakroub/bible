// The commentaries (tools/import-commentaries.js): Matthew Henry's Concise,
// Jamieson-Fausset-Brown, Wesley's Notes, the Geneva notes, and Aquinas's
// Catena Aurea on the Gospels. All public domain, from CrossWire's SWORD
// modules.
//
// A commentary card's address names the commentary and a passage, and a page
// when the comment is long: commentary:mhcc:JHN.3.16, commentary:jfb:GEN.1.1~2.
// The card shows the comments on the passage's verses. Where none starts in
// the passage, it shows the one before it in the chapter, which a comment on
// a section of verses (Matthew Henry's) covers.
//
// Cards do not scroll, so a long comment comes a page at a time, and the
// card's ‹ and › step through the pages, then the comments.

import { readJson } from './load.js';
import { books } from './bible.js';
import { formatReference, parseAddress, toAddress } from '../lib/reference.js';

export { passageOf } from '../lib/commentary-address.js';

/** @typedef {{ id: string, name: string, short: string, year: string, source: string, license: string, books: string[] }} Commentary */
/** @typedef {import('../../tools/lib/commentary-markup.js').Block} Block */
/** @typedef {{ from: string, to?: string, blocks: Block[] }} Entry */
/** @typedef {{ kind: 'text' | 'b' | 'i' | 'ref' | 'note', text: string, ref: string }} Run */
/** @typedef {{ heading: string, label: string, runs: Run[] }} Shown a heading, an entry's verses (label), or a paragraph */
/**
 * @typedef {{
 *   commentary: Commentary, title: string, passage: string,
 *   shown: Shown[], back: string, next: string, page: number, pages: number
 * }} CommentaryView
 */

const ADDRESS = /^commentary:([a-z]+):([^~]+)(?:~(\d+))?$/;
/** About this many characters of comment make a page. */
const PAGE = 4000;

/** @returns {Promise<Commentary[]>} */
export function commentaries() {
  return readJson('commentaries/source.json');
}

/**
 * Whether an address is a commentary card's.
 *
 * @param {string} address
 */
export const isCommentary = (address) => ADDRESS.test(address);

/**
 * A verse address's chapter and verse as one number that sorts them.
 *
 * @param {string} address such as JHN.3.16
 */
function keyOf(address) {
  const [, chapter, verse] = address.split('.');
  return Number(chapter) * 1000 + Number(verse);
}

/**
 * The address of an entry's verses: JHN.3.1-8, or JHN.3.36-4.2 across a
 * chapter.
 *
 * @param {Entry} entry
 */
export function entryAddress(entry) {
  const [book, chapter, verse] = entry.from.split('.');
  if (!entry.to) return entry.from;
  const [, toChapter, toVerse] = entry.to.split('.');
  return toChapter === chapter ? `${book}.${chapter}.${verse}-${toVerse}` : `${book}.${chapter}.${verse}-${toChapter}.${toVerse}`;
}

/**
 * The entries on a passage: those that start or end in it, else the one
 * before it in the same chapter. Their place in the book's list too.
 *
 * @param {Entry[]} entries the book's, in order
 * @param {import('../lib/reference.js').Reference} ref
 * @returns {{ first: number, last: number }} -1 for none
 */
export function entriesOn(entries, ref) {
  const low = ref.chapter * 1000 + (ref.from ?? 1);
  const high = (ref.toChapter ?? ref.chapter) * 1000 + (ref.to ?? ref.from ?? 999);
  const inside = entries.map((entry, i) => ({ entry, i })).filter(({ entry }) => keyOf(entry.from) <= high && keyOf(entry.to ?? entry.from) >= low);
  if (inside.length) return { first: inside[0].i, last: /** @type {{ i: number }} */ (inside.at(-1)).i };
  const before = entries.findLastIndex((entry) => keyOf(entry.from) < low && Math.floor(keyOf(entry.from) / 1000) === ref.chapter);
  return { first: before, last: before };
}

/**
 * A block's runs as the card shows them: each with its kind.
 *
 * @param {Block} block
 * @returns {Run[]}
 */
function runsOf(block) {
  if (!('p' in block)) return [];
  return block.p.map((run) => {
    if (typeof run === 'string') return { kind: 'text', text: run, ref: '' };
    if ('ref' in run) return { kind: 'ref', text: run.t, ref: run.ref };
    if ('b' in run) return { kind: 'b', text: run.b, ref: '' };
    if ('i' in run) return { kind: 'i', text: run.i, ref: '' };
    return { kind: 'note', text: run.note, ref: '' };
  });
}

/**
 * The words of what a card shows, counted for its pages.
 *
 * @param {Shown} shown
 */
const sizeOf = (shown) => shown.heading.length + shown.label.length + shown.runs.reduce((sum, run) => sum + run.text.length, 0);

/**
 * What the entries show, cut into pages of about PAGE characters, each cut
 * between two paragraphs.
 *
 * @param {Entry[]} entries
 * @returns {Shown[][]}
 */
export function pagesOf(entries) {
  /** @type {Shown[]} */
  const all = entries.flatMap((entry) => [
    { heading: '', label: verseLabel(entry), runs: [] },
    ...entry.blocks.filter((block) => !versesLine(block)).map((block) => ('h' in block ? { heading: block.h, label: '', runs: [] } : { heading: '', label: '', runs: runsOf(block) })),
  ]);
  /** @type {Shown[][]} */
  const pages = [[]];
  let size = 0;
  for (const shown of all) {
    const page = /** @type {Shown[]} */ (pages.at(-1));
    if (size > PAGE && page.length) {
      pages.push([shown]);
      size = sizeOf(shown);
    } else {
      page.push(shown);
      size += sizeOf(shown);
    }
  }
  return pages;
}

/**
 * Whether a block is only the commentary's own "Verses 22-36", which the
 * card's label says already.
 *
 * @param {Block} block
 */
function versesLine(block) {
  if (!('p' in block) || block.p.length !== 1) return false;
  const run = block.p[0];
  return typeof run === 'object' && 'b' in run && /^\s*Verses?\s+[\d,\s–-]+\s*$/.test(run.b);
}

/**
 * "Verse 16", or "Verses 1–8", or "3:36–4:2" for an entry.
 *
 * @param {Entry} entry
 */
function verseLabel(entry) {
  const [, chapter, verse] = entry.from.split('.');
  if (!entry.to) return `Verse ${verse}`;
  const [, toChapter, toVerse] = entry.to.split('.');
  return toChapter === chapter ? `Verses ${verse}–${toVerse}` : `${chapter}:${verse}–${toChapter}:${toVerse}`;
}

/**
 * A commentary card: the comments of one commentary on a passage, a page of
 * them, and where its ‹ and › go.
 *
 * @param {string} address such as commentary:mhcc:JHN.3.16
 * @returns {Promise<CommentaryView | null>} null when the address is not one
 */
export async function commentaryView(address) {
  const match = ADDRESS.exec(address);
  if (!match) return null;
  const [, id, passage, pageText] = match;
  const commentary = (await commentaries()).find((each) => each.id === id);
  const ref = parseAddress(passage, books);
  if (!commentary || !ref) return null;
  const title = `${commentary.short} on ${formatReference(ref, books)}`;
  const empty = { commentary, title, passage, shown: [], back: '', next: '', page: 1, pages: 1 };
  if (!commentary.books.includes(ref.book)) return empty;

  /** @type {Entry[]} */
  const entries = await readJson(`commentaries/${id}/${ref.book}.json`);
  const { first, last } = entriesOn(entries, ref);
  if (first < 0) return { ...empty, next: stepAddress(id, entries.find((entry) => keyOf(entry.from) > keyOf(toAddress(ref).split('-')[0]))) };
  const pages = pagesOf(entries.slice(first, last + 1));
  const page = Math.min(Math.max(Number(pageText ?? 1), 1), pages.length);
  const here = `commentary:${id}:${passage}`;
  return {
    commentary,
    title,
    passage,
    shown: pages[page - 1],
    back: page > 1 ? `${here}${page > 2 ? `~${page - 1}` : ''}` : stepAddress(id, entries[first - 1]),
    next: page < pages.length ? `${here}~${page + 1}` : stepAddress(id, entries[last + 1]),
    page,
    pages: pages.length,
  };
}

/**
 * The address of a commentary card on an entry; '' for none.
 *
 * @param {string} id
 * @param {Entry | undefined} entry
 */
function stepAddress(id, entry) {
  return entry ? `commentary:${id}:${entryAddress(entry)}` : '';
}

/**
 * The commentaries with a comment on a passage, each with its first words,
 * for the passage guide.
 *
 * @param {import('../lib/reference.js').Reference} ref
 * @returns {Promise<{ address: string, title: string, text: string }[]>}
 */
export async function commentariesOn(ref) {
  const found = await Promise.all(
    (await commentaries()).map(async (commentary) => {
      if (!commentary.books.includes(ref.book)) return null;
      /** @type {Entry[]} */
      const entries = await readJson(`commentaries/${commentary.id}/${ref.book}.json`);
      const { first } = entriesOn(entries, ref);
      if (first < 0) return null;
      const words = entries[first].blocks.flatMap((block) => runsOf(block).map((run) => run.text)).join('').replace(/\s+/g, ' ').trim();
      return { address: `commentary:${commentary.id}:${toAddress(ref)}`, title: `${commentary.short} (${commentary.year})`, text: words.length > 160 ? `${words.slice(0, words.lastIndexOf(' ', 160))}…` : words };
    }),
  );
  return found.flatMap((each) => each ?? []);
}
