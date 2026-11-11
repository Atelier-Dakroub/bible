// Links between spans of text.
//
// A link joins two spans of word addresses (app/lib/words.js). It runs from
// `a`, where the finger started, to `b`, where it lifted. A link can have a
// type (TYPES), and a typed link is drawn with its direction. Drawing the same
// two spans again, either way round, removes the link. An end is usually a
// highlight; an end dropped on a passage with no highlight under the finger
// is the whole passage, as the span from its first word to its last.

import { wordKey } from './words.js';

/** @typedef {import('./words.js').Highlight} Span */
/** @typedef {{ a: Span, b: Span, type?: string }} Link `type` is one of TYPES; none is "" */

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
 * @param {Link} link
 * @param {Span} x
 * @param {Span} y
 */
function joins(link, x, y) {
  return (sameSpan(link.a, x) && sameSpan(link.b, y)) || (sameSpan(link.a, y) && sameSpan(link.b, x));
}

/**
 * Adds the link, or removes it when it is there already. A span linked to
 * itself is not a link.
 *
 * @param {Link[]} links
 * @param {Span} a
 * @param {Span} b
 * @returns {Link[]}
 */
export function toggleLink(links, a, b) {
  if (sameSpan(a, b)) return links;
  const found = links.find((link) => joins(link, a, b));
  if (found) return links.filter((link) => link !== found);
  return [...links, { a, b }];
}

/**
 * The links that still have both ends, after some spans went away.
 *
 * @param {Link[]} links
 * @param {Span[]} gone
 * @returns {Link[]}
 */
export function dropLinksTo(links, gone) {
  return links.filter((link) => !gone.some((span) => sameSpan(span, link.a) || sameSpan(span, link.b)));
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
