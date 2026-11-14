// Links between spans of text and whole cards.
//
// A link joins two ends. It runs from `a`, where the finger started, to `b`,
// where it lifted. An end is a span of word addresses (app/lib/words.js),
// usually a highlight, or a whole card, named by its address: `JHN.3.16`,
// `note:n1`, `person:paul`, `map`. A whole passage is the passage in any
// translation, so its link shows on every card of it, as KJV, as BSB or in
// the original. A link can have a type (TYPES), and a typed link is drawn
// with its direction. Drawing the same two ends again, either way round,
// removes the link.

import { wordKey } from './words.js';

/** @typedef {import('./words.js').Highlight} Span */
/** @typedef {{ address: string }} Whole a whole card, by its address */
/** @typedef {Span | Whole} End */
/** @typedef {{ a: End, b: End, type?: string }} Link `type` is one of TYPES; none is "" */

// What a link says, read from `a` to `b`: "a quotes b", "a fulfills b",
// "a contrasts with b". The first, "", is a plain link.
export const TYPES = ['', 'quotes', 'fulfills', 'contrasts'];

/**
 * The type after `type`, round to a plain link again.
 *
 * @param {string | undefined} type
 */
export function nextType(type) {
  return TYPES[(TYPES.indexOf(type ?? '') + 1) % TYPES.length];
}

/**
 * @param {Span} x
 * @param {Span} y
 */
export function sameSpan(x, y) {
  return x.from === y.from && x.to === y.to;
}

/**
 * Whether an end is a whole card.
 *
 * @param {End} end
 * @returns {end is Whole}
 */
export const isWhole = (end) => 'address' in end;

/**
 * Whether two ends are the same: the same card, or the same words.
 *
 * @param {End} x
 * @param {End} y
 */
export function sameEnd(x, y) {
  if (isWhole(x) || isWhole(y)) return isWhole(x) && isWhole(y) && x.address === y.address;
  return sameSpan(x, y);
}

/**
 * @param {Link} link
 * @param {End} x
 * @param {End} y
 */
function joins(link, x, y) {
  return (sameEnd(link.a, x) && sameEnd(link.b, y)) || (sameEnd(link.a, y) && sameEnd(link.b, x));
}

/**
 * Adds the link, or removes it when it is there already. An end linked to
 * itself is not a link.
 *
 * @param {Link[]} links
 * @param {End} a
 * @param {End} b
 * @returns {Link[]}
 */
export function toggleLink(links, a, b) {
  if (sameEnd(a, b)) return links;
  const found = links.find((link) => joins(link, a, b));
  if (found) return links.filter((link) => link !== found);
  return [...links, { a, b }];
}

/**
 * The link from `a` to `b` with a type, in that direction: added, or put in
 * the place of the link between them that was there. An end linked to
 * itself is not a link.
 *
 * @param {Link[]} links
 * @param {End} a
 * @param {End} b
 * @param {string} [type] one of TYPES
 * @returns {Link[]}
 */
export function setLink(links, a, b, type = '') {
  if (sameEnd(a, b)) return links;
  /** @type {Link} */
  const link = type ? { a, b, type } : { a, b };
  const at = links.findIndex((each) => joins(each, a, b));
  return at < 0 ? [...links, link] : links.map((each, index) => (index === at ? link : each));
}

/**
 * The links without the one between two ends, if there was one.
 *
 * @param {Link[]} links
 * @param {End} a
 * @param {End} b
 * @returns {Link[]}
 */
export function unlink(links, a, b) {
  return links.filter((link) => !joins(link, a, b));
}

/**
 * Whether two ends are linked, either way round.
 *
 * @param {Link[]} links
 * @param {End} a
 * @param {End} b
 */
export function linked(links, a, b) {
  return links.some((link) => joins(link, a, b));
}

/**
 * The links that still have both ends, after some ends went away.
 *
 * @param {Link[]} links
 * @param {End[]} gone
 * @returns {Link[]}
 */
export function dropLinksTo(links, gone) {
  return links.filter((link) => !gone.some((end) => sameEnd(end, link.a) || sameEnd(end, link.b)));
}

/**
 * The spans in `before` that are not in `after`.
 *
 * @param {Span[]} before
 * @param {Span[]} after
 * @returns {Span[]}
 */
export function removed(before, after) {
  return before.filter((span) => !after.some((each) => sameSpan(each, span)));
}

/**
 * The first entry of a sorted word index that a span covers, or null. The
 * index is the words of one card in reading order, so a binary search finds
 * the start of the span.
 *
 * @template T
 * @param {{ key: number, item: T }[]} index sorted by key
 * @param {Span} span
 * @returns {T | null}
 */
export function firstCovered(index, span) {
  const from = wordKey(span.from);
  const to = wordKey(span.to);
  let low = 0;
  let high = index.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (index[middle].key < from) low = middle + 1;
    else high = middle;
  }
  const entry = index[low];
  return entry && entry.key <= to ? entry.item : null;
}

/** The most verses a chapter has (Psalm 119). */
const MOST_VERSES = 176;

/**
 * The verse ids an address names: `ROM.5.8` is one verse, `1JN.4.9-10` is
 * two, and `GEN.4.25-5.32` runs on into the next chapter. With no verse
 * counts at hand, a chapter left whole names its verses up to the most any
 * chapter has: the ids past its end name no verse, and match nothing.
 *
 * @param {string} address
 * @returns {string[]}
 */
export function versesOf(address) {
  const [base, end] = address.split('-');
  const [book, chapterText, verseText] = base.split('.');
  const chapter = Number(chapterText);
  const first = Number(verseText);
  const [endChapter, endVerse] = end?.includes('.') ? end.split('.').map(Number) : [chapter, end ? Number(end) : first];
  /** @type {string[]} */
  const ids = [];
  for (let at = chapter; at <= endChapter && at - chapter < 10; at += 1) {
    const from = at === chapter ? first : 1;
    const to = at === endChapter ? endVerse : MOST_VERSES;
    for (let verse = from; verse <= to; verse += 1) ids.push(`${book}.${at}.${verse}`);
  }
  return ids;
}

/**
 * The cross-references to draw between cards: each pair of verses once,
 * whichever way the reference runs, and never within one card. A verse on
 * several cards is reached on each.
 *
 * @param {{ verses: string[], refs: Record<string, [string, ...unknown[]][]> | null }[]} cards
 *   each card's verse ids, and its references by verse (the xrefs route)
 * @returns {{ from: { card: number, id: string }, to: { card: number, id: string } }[]}
 */
export function referencePairs(cards) {
  /** @type {Map<string, number[]>} which cards show each verse */
  const where = new Map();
  cards.forEach((card, index) => {
    for (const id of card.verses) where.set(id, [...(where.get(id) ?? []), index]);
  });
  const seen = new Set();
  /** @type {{ from: { card: number, id: string }, to: { card: number, id: string } }[]} */
  const pairs = [];
  cards.forEach((card, index) => {
    const own = new Set(card.verses);
    for (const [fromId, list] of Object.entries(card.refs ?? {})) {
      if (!own.has(fromId)) continue;
      for (const [target] of list) {
        for (const toId of versesOf(target)) {
          for (const other of where.get(toId) ?? []) {
            const key = fromId < toId ? `${fromId}|${toId}` : `${toId}|${fromId}`;
            if (other === index || seen.has(key)) continue;
            seen.add(key);
            pairs.push({ from: { card: index, id: fromId }, to: { card: other, id: toId } });
          }
        }
      }
    }
  });
  return pairs;
}
