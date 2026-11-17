// What is on the table, kept in this browser between visits.
//
// A card is stored as its id, its address and its matrix, a highlight as two
// word addresses and a style, a note as its own text and the spans it
// quotes, a rule mark as what it marks (app/lib/rules.js), and the search
// panel's research trail as the addresses of its views (app/lib/trail.js). Never the text of the Bible: that comes back from the server by
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
/** @typedef {{ id: string, address: string, matrix: Matrix, version?: string, sync?: boolean, compare?: boolean, short?: boolean, view?: { x: number, y: number, w: number } }} StoredCard `matrix` is a move only: a card is upright at its own size; `version` is kjv, bsb or both; `compare` marks the differences in both; `short` shows its short form; `view` is the part of the map in the map card's frame (lib/map.js) */
/** @typedef {import('./links.js').Link} Link */
/** @typedef {{ id: string, text: string, doc?: any, quotes: Span[], kind?: import('./note-kinds.js').Kind, answered?: boolean, title?: string }} Note `doc` is its words as a document (lib/note-doc.js); `text` the same as plain text; `kind` its kind (lib/note-kinds.js), none for a plain note; `answered` a question's box; `title` the reader's own, else the kind's name shows */
/** @typedef {import('./rules.js').Rule} Rule */
/** @typedef {StoredCard & { title: string, text: string }} ListItem a card gathered into a list: as it was kept on the table, with its title and first words for the list's row */
/** @typedef {{ id: string, title?: string, items: ListItem[] }} List a list card's cards (bible-table, lists); its card is list:<id> */
/** @typedef {{ offset: Point, zoom: number, cards: StoredCard[], highlights: Highlight[], links: Link[], notes: Note[], rules: Rule[], lists: List[], trail: import('./trail.js').Trail }} Workspace `zoom` is the table's (lib/zoom.js); `trail` is the search panel's research trail (lib/trail.js); like the offset and the zoom, it is not a step to undo */

import { isKind } from './note-kinds.js';
import { isWordAddress, STYLES } from './words.js';
import { sameRule, toRule } from './rules.js';
import { TYPES } from './links.js';
import { emptyTrail, toTrail } from './trail.js';
import { clampZoom } from './zoom.js';

const KEY = 'bible.table.v1';
const NAMED_KEY = 'bible.workspaces.v1';
const VERSIONS = ['kjv', 'bsb', 'both', 'original', 'interlinear', 'reverse', 'syntax'];
/** The scale under which a card kept from before the zoom showed its short form. */
const SHORT_BELOW = 0.55;

/** @returns {Workspace} */
export function empty() {
  return { offset: { x: 0, y: 0 }, zoom: 1, cards: [], highlights: [], links: [], notes: [], rules: [], lists: [], trail: emptyTrail() };
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
  const kept = Array.isArray(value.cards) ? value.cards.filter(isCard) : [];
  // A table kept before the table zoomed had cards at their own scales. The
  // table takes their usual scale as its zoom, and their places are on a
  // table that size, so the table looks as it did.
  const shrink = clampZoom(keptScale(kept));
  const zoom = shrink !== 1 ? shrink : clampZoom(Number(value.zoom ?? 1));
  /** @type {Set<string>} */
  const ids = new Set();
  const cards = kept.map((/** @type {any} */ card, /** @type {number} */ i) => {
    let id = typeof card.id === 'string' && card.id && !ids.has(card.id) ? card.id : `card${i}`;
    while (ids.has(id)) id = `${id}x`;
    ids.add(id);
    return toStored(card, id, shrink);
  });
  const highlights = Array.isArray(value.highlights) ? value.highlights.filter(isSpan).map(toHighlight) : [];
  const links = Array.isArray(value.links)
    ? value.links
        .filter((/** @type {any} */ link) => isEnd(link?.a) && isEnd(link?.b))
        .map((/** @type {any} */ link) => {
          /** @type {Link} */
          const kept = { a: toEnd(link.a), b: toEnd(link.b) };
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
          ...(note.doc && typeof note.doc === 'object' && note.doc.type === 'doc' ? { doc: note.doc } : {}),
          ...(isKind(note.kind) ? { kind: note.kind } : {}),
          ...(note.answered === true ? { answered: true } : {}),
          ...(typeof note.title === 'string' && note.title.trim() ? { title: note.title.trim().slice(0, 120) } : {}),
          quotes: Array.isArray(note.quotes) ? note.quotes.filter(isSpan).map(toSpan) : [],
        }))
    : [];
  /** @type {Rule[]} */
  const rules = [];
  for (const each of Array.isArray(value.rules) ? value.rules : []) {
    const rule = toRule(each);
    if (rule && !rules.some((kept) => sameRule(kept, rule))) rules.push(rule);
  }
  return { offset, zoom, cards, highlights, links, notes, rules, lists: toLists(value.lists), trail: toTrail(value.trail) };
}

/**
 * The scale of most of the cards of a table kept before the table zoomed:
 * the middle one. 1 when every card is upright at its own size, as every
 * card is since.
 *
 * @param {any[]} cards values that isCard
 */
function keptScale(cards) {
  const old = cards.some(({ matrix: m }) => m.a !== 1 || m.b !== 0 || m.c !== 0 || m.d !== 1);
  if (!old) return 1;
  const scales = cards.map(({ matrix: m }) => Math.hypot(m.a, m.b)).sort((x, y) => x - y);
  return scales[Math.floor(scales.length / 2)] || 1;
}

/**
 * A card as it is kept, from what was read.
 *
 * @param {any} card a value that isCard
 * @param {string} id
 * @param {number} [shrink] the table's usual scale before it zoomed: the card's place is on a table that size
 * @returns {StoredCard}
 */
function toStored(card, id, shrink = 1) {
  const m = card.matrix;
  /** @type {StoredCard} */
  const stored = { id, address: card.address, matrix: { a: 1, b: 0, c: 0, d: 1, e: m.e / shrink, f: m.f / shrink } };
  // A card kept from before the table zoomed could be turned and scaled: it
  // stands upright at its own size, and one under half size, which showed
  // its short form, keeps it.
  if (card.short === true || Math.hypot(m.a, m.b) < SHORT_BELOW) stored.short = true;
  if (VERSIONS.includes(String(card.version))) stored.version = card.version;
  if (card.sync === true) stored.sync = true;
  if (card.compare === true) stored.compare = true;
  const view = card.view;
  if (view && [view.x, view.y, view.w].every((n) => typeof n === 'number' && Number.isFinite(n)) && view.w > 0) {
    stored.view = { x: view.x, y: view.y, w: view.w };
  }
  return stored;
}

/**
 * The lists, from what was read: each with an id, and its cards as they
 * were kept, each with its title and first words.
 *
 * @param {any} value
 * @returns {List[]}
 */
function toLists(value) {
  if (!Array.isArray(value)) return [];
  /** @type {Set<string>} */
  const ids = new Set();
  return value
    .filter((list) => typeof list?.id === 'string' && /^[a-z0-9]{1,40}$/i.test(list.id) && !ids.has(list.id) && ids.add(list.id))
    .map((list) => ({
      id: list.id,
      ...(typeof list.title === 'string' && list.title.trim() ? { title: list.title.trim().slice(0, 120) } : {}),
      items: (Array.isArray(list.items) ? list.items : [])
        .filter(isCard)
        .slice(0, FILE_LIMITS.cards)
        .map((/** @type {any} */ item, /** @type {number} */ i) => ({
          ...toStored(item, typeof item.id === 'string' && item.id ? item.id : `${list.id}-${i}`),
          title: typeof item.title === 'string' ? item.title.slice(0, 120) : item.address,
          text: typeof item.text === 'string' ? item.text.slice(0, 200) : '',
        })),
    }));
}

/** @returns {Workspace} */
export function load() {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return empty();
  }
}

/**
 * Keeps the table in this browser.
 *
 * @param {Workspace} workspace
 * @returns {boolean} false when storage is off or full: the table still works, but it is not kept
 */
export function save(workspace) {
  try {
    localStorage.setItem(KEY, JSON.stringify(workspace));
    return true;
  } catch {
    return false;
  }
}

/**
 * The workspace as a string that is the same whenever what is on the table is
 * the same: for the undo history. The pan offset and the zoom are left out,
 * because a pan or a zoom is not something to undo, and the cards are in id
 * order, because the order
 * in which they arrive from the server is not part of the workspace.
 *
 * @param {Workspace} workspace
 */
export function snapshot(workspace) {
  const cards = [...workspace.cards].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return JSON.stringify({ cards, highlights: workspace.highlights, links: workspace.links, notes: workspace.notes, rules: workspace.rules, lists: workspace.lists });
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
  return writeNamed(all);
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
    return { name: typeof value.name === 'string' ? value.name.slice(0, 120) : '', workspace: withinLimits(fromValue(value.workspace)) };
  }
  if (Array.isArray(value.cards)) return { name: '', workspace: withinLimits(fromValue(value)) };
  return null;
}

/**
 * The most a table file may hold, far more than a table needs: a shared
 * file with thousands of cards or a note of megabytes would freeze the
 * browser that opens it, and ask the server for each card.
 */
export const FILE_LIMITS = { bytes: 5_000_000, cards: 300, notes: 1000, marks: 3000, noteText: 100_000, quotes: 200 };

/**
 * A workspace from a file, cut to the limits.
 *
 * @param {Workspace} workspace
 * @returns {Workspace}
 */
function withinLimits(workspace) {
  const limits = FILE_LIMITS;
  return {
    ...workspace,
    cards: workspace.cards.slice(0, limits.cards),
    highlights: workspace.highlights.slice(0, limits.marks),
    links: workspace.links.slice(0, limits.marks),
    notes: workspace.notes.slice(0, limits.notes).map((note) => (note.text.length > limits.noteText || note.quotes.length > limits.quotes ? cutNote(note) : note)),
    lists: workspace.lists.slice(0, limits.notes),
  };
}

/**
 * A note too long for a file: its text cut, its formatting left out (the
 * text stands for it), and its quotes cut.
 *
 * @param {Note} note
 * @returns {Note}
 */
function cutNote(note) {
  const { doc, ...rest } = note;
  return { ...rest, text: note.text.slice(0, FILE_LIMITS.noteText), quotes: note.quotes.slice(0, FILE_LIMITS.quotes) };
}

/** @param {any} value */
function isSpan(value) {
  return isWordAddress(String(value?.from)) && isWordAddress(String(value?.to));
}

/**
 * A link's end: words, or a whole card by its address.
 *
 * @param {any} value
 */
function isEnd(value) {
  return isSpan(value) || (typeof value?.address === 'string' && value.address.length > 0 && value.address.length <= 200);
}

/**
 * @param {any} value
 * @returns {import('./links.js').End}
 */
function toEnd(value) {
  return isSpan(value) ? toSpan(value) : { address: value.address };
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
