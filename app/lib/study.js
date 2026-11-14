// A study laid out on the table (bible-table startStudy): a subject and what
// the app's data finds on it (data/study.js studyPlan), in columns side by
// side, every card linked to the subject's card, so that the whole study
// moves as one group and one Undo takes it away. No DOM.
//
// The middle column holds the subject's card, the study note under it, and
// any cards that belong with it (the people a passage names). Columns go on
// either side of it, at most MOST cards each:
//
//   a passage  [quotations]  [passage, note, people]  [parallels]  [cross-references]
//   a word     [word's landscape, note]  [a verse for each sense, or each book]
//   a topic    [note]  [a passage for each part of the topic]
//   a person   [person, note, family]  [the chapters that name them most]
//
// The Old Testament stands on the left of the New: a New Testament passage
// has the Old Testament it quotes on its left; an Old Testament passage has
// the New Testament passages that quote it on its right. A topic has no card
// of its own: its note is the middle. The map, when the study has places and
// the map is not on the table yet, is the last column.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ width: number, height: number }} Size */
/** @typedef {{ cards: string[], type?: string, toward?: boolean }} Side `toward`: the links run from the cards to the middle */
/** @typedef {{ a: string, b: string, type?: string }} Join a link, by addresses; NOTE for the note */
/** @typedef {{ kind: string, value: string, label: string }} Mark a mark on every card (lib/rules.js) */
/**
 * @typedef {{
 *   kind: string, address: string, title: string, short: string,
 *   columns: string[][], joins: Join[], lines: string[],
 *   mapIds: string, journey: any, rule: Mark | null
 * }} Plan `address` is the middle card's, or NOTE for a topic; `lines` open the note
 */
/** @typedef {import('./links.js').Link} Link */

/** The study note's place in a plan, until the note is made. */
export const NOTE = 'note';

/** The most cards in a column: a longer side goes on in the next. */
export const MOST = 5;

/** The least scale a study is put down at: below it the cards are small tiles. */
export const LEAST = 0.6;

/**
 * A list in a column at most MOST long, and on in the next.
 *
 * @param {string[]} cards
 * @returns {string[][]}
 */
function columnsFor(cards) {
  /** @type {string[][]} */
  const columns = [];
  for (let at = 0; at < cards.length; at += MOST) columns.push(cards.slice(at, at + MOST));
  return columns;
}

/**
 * A study's plan from its parts: the middle card, the cards under it, and
 * the sides to its left and right, each linked to the middle.
 *
 * @param {{
 *   kind: string, address: string, title: string, short: string,
 *   left?: Side[], under?: string[], right?: Side[], lines?: string[],
 *   mapIds?: string, journey?: any, rule?: Mark | null
 * }} parts
 * @returns {Plan}
 */
export function planOf({ kind, address, title, short, left = [], under = [], right = [], lines = [], mapIds = '', journey = null, rule = null }) {
  const middle = address === NOTE ? [NOTE, ...under] : [address, NOTE, ...under];
  const columns = [...left.flatMap((side) => columnsFor(side.cards)), middle, ...right.flatMap((side) => columnsFor(side.cards))];
  /** @type {Join[]} */
  const joins = [...left, ...right].flatMap(({ cards, type, toward }) =>
    cards.map((card) => ({ ...(toward ? { a: card, b: address } : { a: address, b: card }), ...(type ? { type } : {}) })),
  );
  for (const card of [...(address === NOTE ? [] : [NOTE]), ...under]) joins.push({ a: card, b: address });
  return { kind, address, title, short, columns, joins, lines, mapIds, journey, rule };
}

/**
 * @param {string} card
 * @param {string} note the note's address
 */
const named = (card, note) => (card === NOTE ? note : card);

/**
 * The addresses of a study's cards, column by column, with its note's.
 *
 * @param {Plan} plan
 * @param {string} note the note's address
 * @returns {string[][]}
 */
export function columnsOf(plan, note) {
  return plan.columns.map((column) => column.map((card) => named(card, note)));
}

/**
 * The study's links, as whole-card links (lib/links.js).
 *
 * @param {Plan} plan
 * @param {string} note the note's address
 * @returns {Link[]}
 */
export function linksOf(plan, note) {
  return plan.joins.map(({ a, b, type }) => ({ a: { address: named(a, note) }, b: { address: named(b, note) }, ...(type ? { type } : {}) }));
}

/**
 * "1 cross-reference", "5 cross-references".
 *
 * @param {number} count
 * @param {string} one
 * @param {string} [many]
 */
export const counted = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * "a", "a and b", "a, b and c"; `none` for nothing.
 *
 * @param {string[]} parts
 * @param {string} none
 */
export function listed(parts, none) {
  const kept = parts.filter(Boolean);
  if (kept.length < 2) return kept[0] ?? none;
  return `${kept.slice(0, -1).join(', ')} and ${kept[kept.length - 1]}`;
}

/**
 * The study's note, as a document (lib/note-doc.js): its opening lines, and
 * headings for the reader to write under.
 *
 * @param {Plan} plan
 * @returns {any}
 */
export function studyDoc(plan) {
  /** @param {string} text */
  const paragraph = (text) => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });
  /** @param {string} text */
  const heading = (text) => ({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] });
  return {
    type: 'doc',
    content: [...plan.lines.map(paragraph), heading('Observations'), paragraph(''), heading('Questions'), paragraph(''), heading('Application'), paragraph('')],
  };
}

/**
 * Where each card goes, on the screen: the columns side by side from
 * `corner`, each a stack, with `gap` between, at the scale that fits them
 * into `room` across (never above full size, nor below LEAST).
 *
 * @param {Size[][]} columns each card's size at full size
 * @param {Point} corner
 * @param {number} room
 * @param {number} gap
 * @returns {{ scale: number, at: Point[][] }}
 */
export function layOut(columns, corner, room, gap) {
  const widths = columns.map((column) => Math.max(0, ...column.map((size) => size.width)));
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, columns.length - 1);
  const scale = Math.min(1, Math.max(LEAST, total > 0 ? room / total : 1));
  let x = corner.x;
  const at = columns.map((column, index) => {
    let y = corner.y;
    const placed = column.map((size) => {
      const point = { x, y };
      y += (size.height + gap) * scale;
      return point;
    });
    x += (widths[index] + gap) * scale;
    return placed;
  });
  return { scale, at };
}
