// What is on the table, kept in this browser between visits.
//
// A card is stored as its id, its address and its matrix, a highlight as two
// word addresses and a style, a note as its own text and the spans it
// quotes, and a rule mark as what it marks (app/lib/rules.js). Never the text of the Bible: that comes back from the server by
// address. That keeps the stored state small, and it is the shape a shared or
// linked workspace will need later.
//
// The table in use is kept under one key. Named workspaces are kept apart,
// under another, and a workspace can also go out to a file and come back.
//
// localStorage can be missing or full, and a stored value can be old or
// broken. Every one of those cases gives an empty table, not an error.

/** @typedef {import('./affine.js').Matrix} Matrix */
/** @typedef {import('./affine.js').Point} Point */
/** @typedef {import('./words.js').Highlight} Highlight */
/** @typedef {import('./links.js').Span} Span */
/** @typedef {{ id: string, address: string, matrix: Matrix, version?: string, sync?: boolean, compare?: boolean, view?: { x: number, y: number, w: number } }} StoredCard `version` is kjv, bsb or both; `compare` marks the differences in both; `view` is the part of the map in the map card's frame (lib/map.js) */
/** @typedef {import('./links.js').Link} Link */
/** @typedef {{ id: string, text: string, quotes: Span[] }} Note */
/** @typedef {import('./rules.js').Rule} Rule */
/** @typedef {{ offset: Point, cards: StoredCard[], highlights: Highlight[], links: Link[], notes: Note[], rules: Rule[] }} Workspace */

import { isWordAddress, STYLES } from './words.js';
import { sameRule, toRule } from './rules.js';
import { TYPES } from './links.js';

const KEY = 'bible.table.v1';
const NAMED_KEY = 'bible.workspaces.v1';
const VERSIONS = ['kjv', 'bsb', 'both'];

/** @returns {Workspace} */
export function empty() {
  return { offset: { x: 0, y: 0 }, cards: [], highlights: [], links: [], notes: [], rules: [] };
}

/**
 * A new id for a card or a note. Short, and unique enough for one table.
 * Not crypto.randomUUID: the panel opens the app over plain http on the
 * network, where that is not there.
 *
 * @param {string} prefix
 */
export function newId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
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
  return fromValue(value);
}

/**
 * @param {any} value
 * @returns {Workspace}
 */
function fromValue(value) {
  if (!value || typeof value !== 'object') return empty();

  const offset = isPoint(value.offset) ? { x: value.offset.x, y: value.offset.y } : { x: 0, y: 0 };
  /** @type {Set<string>} */
  const ids = new Set();
  const cards = Array.isArray(value.cards)
    ? value.cards.filter(isCard).map((/** @type {any} */ card, /** @type {number} */ i) => {
        let id = typeof card.id === 'string' && card.id && !ids.has(card.id) ? card.id : `card${i}`;
        while (ids.has(id)) id = `${id}x`;
        ids.add(id);
        /** @type {StoredCard} */
        const stored = { id, address: card.address, matrix: card.matrix };
        if (VERSIONS.includes(String(card.version))) stored.version = card.version;
        if (card.sync === true) stored.sync = true;
        if (card.compare === true) stored.compare = true;
        const view = card.view;
        if (view && [view.x, view.y, view.w].every((n) => typeof n === 'number' && Number.isFinite(n)) && view.w > 0) {
          stored.view = { x: view.x, y: view.y, w: view.w };
        }
        return stored;
      })
    : [];
  const highlights = Array.isArray(value.highlights) ? value.highlights.filter(isSpan).map(toHighlight) : [];
  const links = Array.isArray(value.links)
    ? value.links
        .filter((/** @type {any} */ link) => isSpan(link?.a) && isSpan(link?.b))
        .map((/** @type {any} */ link) => {
          /** @type {Link} */
          const kept = { a: toSpan(link.a), b: toSpan(link.b) };
          if (TYPES.includes(link.type) && link.type) kept.type = link.type;
          return kept;
        })
    : [];
  const notes = Array.isArray(value.notes)
    ? value.notes
        .filter((/** @type {any} */ note) => typeof note?.id === 'string' && note.id)
        .map((/** @type {any} */ note) => ({
          id: note.id,
          text: typeof note.text === 'string' ? note.text : '',
          quotes: Array.isArray(note.quotes) ? note.quotes.filter(isSpan).map(toSpan) : [],
        }))
    : [];
  /** @type {Rule[]} */
  const rules = [];
  for (const each of Array.isArray(value.rules) ? value.rules : []) {
    const rule = toRule(each);
    if (rule && !rules.some((kept) => sameRule(kept, rule))) rules.push(rule);
  }
  return { offset, cards, highlights, links, notes, rules };
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

/**
 * The workspace as a string that is the same whenever what is on the table is
 * the same: for the undo history. The pan offset is left out, because a pan
 * is not something to undo, and the cards are in id order, because the order
 * in which they arrive from the server is not part of the workspace.
 *
 * @param {Workspace} workspace
 */
export function snapshot(workspace) {
  const cards = [...workspace.cards].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return JSON.stringify({ cards, highlights: workspace.highlights, links: workspace.links, notes: workspace.notes, rules: workspace.rules });
}

/**
 * What has to change on the table to show `target`: cards to move, cards to
 * fetch, and cards to take away. A card with the same id but another address
 * or version is fetched again.
 *
 * @param {StoredCard[]} current
 * @param {StoredCard[]} target
 */
export function diffCards(current, target) {
  const now = new Map(current.map((card) => [card.id, card]));
  /** @type {StoredCard[]} */
  const move = [];
  /** @type {StoredCard[]} */
  const add = [];
  /** @type {Set<string>} */
  const wanted = new Set();
  for (const card of target) {
    wanted.add(card.id);
    const there = now.get(card.id);
    if (there && there.address === card.address && (there.version ?? 'kjv') === (card.version ?? 'kjv')) move.push(card);
    else add.push(card);
  }
  const remove = current
    .filter((card) => !wanted.has(card.id) || add.some((each) => each.id === card.id))
    .map((card) => card.id);
  return { move, add, remove };
}

// Named workspaces.

/** @typedef {{ name: string, saved: string, workspace: Workspace }} Named */

/** @returns {Record<string, { saved: string, workspace: any }>} */
function readNamed() {
  try {
    const value = JSON.parse(localStorage.getItem(NAMED_KEY) ?? '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, { saved: string, workspace: any }>} all */
function writeNamed(all) {
  try {
    localStorage.setItem(NAMED_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/**
 * The named workspaces, the most recently saved first.
 *
 * @returns {{ name: string, saved: string }[]}
 */
export function listNamed() {
  return Object.entries(readNamed())
    .map(([name, entry]) => ({ name, saved: String(entry?.saved ?? '') }))
    .sort((x, y) => (x.saved < y.saved ? 1 : x.saved > y.saved ? -1 : 0));
}

/**
 * @param {string} name
 * @param {Workspace} workspace
 * @returns {boolean} false when storage is off or full
 */
export function saveNamed(name, workspace) {
  const all = readNamed();
  all[name] = { saved: new Date().toISOString(), workspace };
  return writeNamed(all);
}

/**
 * @param {string} name
 * @returns {Workspace | null}
 */
export function loadNamed(name) {
  const entry = readNamed()[name];
  return entry ? fromValue(entry.workspace) : null;
}

/** @param {string} name */
export function removeNamed(name) {
  const all = readNamed();
  delete all[name];
  writeNamed(all);
}

// Files.

const FORMAT = 'bible-table';

/**
 * The text of a workspace file.
 *
 * @param {string} name
 * @param {Workspace} workspace
 */
export function toFile(name, workspace) {
  return `${JSON.stringify({ format: FORMAT, version: 1, name, saved: new Date().toISOString(), workspace }, null, 2)}\n`;
}

/**
 * A workspace file, or a bare workspace, back to a workspace and its name.
 * Null when the text is neither.
 *
 * @param {string} text
 * @returns {{ name: string, workspace: Workspace } | null}
 */
export function fromFile(text) {
  /** @type {any} */
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  if (value.format === FORMAT) {
    return { name: typeof value.name === 'string' ? value.name : '', workspace: fromValue(value.workspace) };
  }
  if (Array.isArray(value.cards)) return { name: '', workspace: fromValue(value) };
  return null;
}

/** @param {any} value */
function isSpan(value) {
  return isWordAddress(String(value?.from)) && isWordAddress(String(value?.to));
}

/**
 * @param {any} value
 * @returns {Span}
 */
function toSpan(value) {
  return { from: value.from, to: value.to };
}

/**
 * @param {any} value
 * @returns {Highlight}
 */
function toHighlight(value) {
  /** @type {Highlight} */
  const kept = toSpan(value);
  if (STYLES.includes(value.style) && value.style !== STYLES[0]) kept.style = value.style;
  return kept;
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
    value.address !== '' &&
    ['a', 'b', 'c', 'd', 'e', 'f'].every((key) => Number.isFinite(m?.[key]))
  );
}
