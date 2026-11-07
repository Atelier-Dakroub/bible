// What is on the table, kept in this browser between visits.
//
// A card is stored as its address and its matrix, and a highlight as two word
// addresses, never as text: the text
// comes back from the server by address. That keeps the stored state small,
// and it is the shape a shared or linked workspace will need later.
//
// localStorage can be missing or full, and a stored value can be old or
// broken. Every one of those cases gives an empty table, not an error.

/** @typedef {import('./affine.js').Matrix} Matrix */
/** @typedef {import('./affine.js').Point} Point */
/** @typedef {import('./words.js').Highlight} Highlight */
/** @typedef {{ address: string, matrix: Matrix, version?: string }} StoredCard `version` is kjv, bsb or both */
/** @typedef {import('./links.js').Link} Link */
/** @typedef {{ offset: Point, cards: StoredCard[], highlights: Highlight[], links: Link[] }} Workspace */

import { isWordAddress } from './words.js';

const KEY = 'bible.table.v1';

/** @returns {Workspace} */
export function empty() {
  return { offset: { x: 0, y: 0 }, cards: [], highlights: [], links: [] };
}

/**
 * @param {string | null} text
 * @returns {Workspace}
 */
export function parse(text) {
  /** @type {any} */
  let value;
  try {
    value = JSON.parse(text ?? '');
  } catch {
    return empty();
  }
  if (!value || typeof value !== 'object') return empty();

  const offset = isPoint(value.offset) ? value.offset : { x: 0, y: 0 };
  const cards = Array.isArray(value.cards)
    ? value.cards.filter(isCard).map((/** @type {StoredCard} */ card) =>
        ['kjv', 'bsb', 'both'].includes(String(card.version)) ? card : { address: card.address, matrix: card.matrix },
      )
    : [];
  const highlights = Array.isArray(value.highlights) ? value.highlights.filter(isHighlight) : [];
  const links = Array.isArray(value.links)
    ? value.links.filter((/** @type {any} */ link) => isHighlight(link?.a) && isHighlight(link?.b))
    : [];
  return { offset, cards, highlights, links };
}

/** @returns {Workspace} */
export function load() {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return empty();
  }
}

/** @param {Workspace} workspace */
export function save(workspace) {
  try {
    localStorage.setItem(KEY, JSON.stringify(workspace));
  } catch {
    // Storage is off or full. The table still works; it is not kept.
  }
}

/** @param {any} value */
function isHighlight(value) {
  return isWordAddress(String(value?.from)) && isWordAddress(String(value?.to));
}

/** @param {any} value */
function isPoint(value) {
  return Number.isFinite(value?.x) && Number.isFinite(value?.y);
}

/** @param {any} value */
function isCard(value) {
  const m = value?.matrix;
  return (
    typeof value?.address === 'string' &&
    ['a', 'b', 'c', 'd', 'e', 'f'].every((key) => Number.isFinite(m?.[key]))
  );
}
