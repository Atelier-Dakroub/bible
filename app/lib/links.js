// Links between spans of text.
//
// A link joins two spans of word addresses (app/lib/words.js). It has no
// direction yet, so A–B and B–A are the same link. An end is usually a
// highlight; an end dropped on a passage with no highlight under the finger
// is the whole passage, as the span from its first word to its last.

import { wordKey } from './words.js';

/** @typedef {import('./words.js').Highlight} Span */
/** @typedef {{ a: Span, b: Span }} Link */

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
