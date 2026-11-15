// List cards: a card that holds other cards, as rows (bible-table, lists).
//
// Gathered, a card leaves the table and becomes a row of the list, kept as
// it was on the table (its address, version, size and turn), with its title
// and first words. Spread, the rows become cards again, in a column beside
// the list. A link to a gathered card is drawn to its list card, and the list
// card moves with that link's group, so linking two piles no longer joins
// them into one: a gathered pile is one card.

/** @typedef {import('./workspace.js').List} List */
/** @typedef {import('./workspace.js').ListItem} ListItem */
/** @typedef {import('./links.js').End} End */

import { isWhole, versesOf } from './links.js';
import { parseSpanAddress } from './words.js';

/**
 * Whether a gathered card shows a link's end: the same card, by its address,
 * or the words, when they are in its passage.
 *
 * @param {ListItem} item
 * @param {End} end
 */
export function holds(item, end) {
  if (isWhole(end)) return item.address === end.address;
  const verse = end.from.split('.').slice(0, 3).join('.');
  const phrase = parseSpanAddress(item.address);
  if (phrase) return phrase.from.split('.').slice(0, 3).join('.') === verse;
  // A whole chapter (JHN.3) holds every verse of it.
  if (item.address.split('.').length === 2) return verse.startsWith(`${item.address}.`);
  return versesOf(item.address).includes(verse);
}

/**
 * The list that holds a link's end, if any.
 *
 * @param {List[]} lists
 * @param {End} end
 */
export function listHolding(lists, end) {
  return lists.find((list) => list.items.some((item) => holds(item, end))) ?? null;
}

/**
 * Whether any list holds a card of this address.
 *
 * @param {List[]} lists
 * @param {string} address
 */
export const inAList = (lists, address) => lists.some((list) => list.items.some((item) => item.address === address));

/**
 * A list with cards added to its end, each once.
 *
 * @param {List} list
 * @param {ListItem[]} items
 * @returns {List}
 */
export function withItems(list, items) {
  const ids = new Set(list.items.map((item) => item.id));
  return { ...list, items: [...list.items, ...items.filter((item) => !ids.has(item.id))] };
}

/**
 * A list with one row moved up or down; the same list at an end.
 *
 * @param {List} list
 * @param {string} id the row's
 * @param {-1 | 1} by
 * @returns {List}
 */
export function moved(list, id, by) {
  const at = list.items.findIndex((item) => item.id === id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= list.items.length) return list;
  const items = [...list.items];
  [items[at], items[to]] = [items[to], items[at]];
  return { ...list, items };
}

/**
 * A list as text, for Copy: its name, then a line for each card.
 *
 * @param {List} list
 */
export function listText(list) {
  const lines = list.items.map((item) => (item.text ? `${item.title} — ${item.text}` : item.title));
  return [list.title ?? 'List', ...lines].join('\n');
}

/**
 * The name a list card shows: its own, else "List".
 *
 * @param {List} list
 */
export function listName(list) {
  const count = list.items.length;
  return `${list.title ?? 'List'} · ${count === 1 ? '1 card' : `${count} cards`}`;
}
