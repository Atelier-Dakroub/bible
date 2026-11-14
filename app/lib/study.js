// A study laid out on the table (bible-table startStudy): a passage and what
// its guide finds (data/study.js studyPlan), in columns side by side, every
// card linked to the passage, so that the whole study moves as one group and
// one Undo takes it away. No DOM.
//
//   [quotations]  [passage, note, people]  [parallels]  [cross-references]  [map]
//
// The map is the last column when it is not on the table yet.
//
// The Old Testament stands on the left of the New: a New Testament passage
// has the Old Testament it quotes on its left; an Old Testament passage has
// the New Testament passages that quote it on its right.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ width: number, height: number }} Size */
/**
 * @typedef {{
 *   address: string, title: string, short: string, quoting: boolean,
 *   quotations: string[], parallels: string[], references: string[],
 *   people: string[], mapIds: string
 * }} Plan
 */
/** @typedef {import('./links.js').Link} Link */

/** The least scale a study is put down at: below it the cards are small tiles. */
export const LEAST = 0.6;

/**
 * The addresses of a study's cards, column by column, with its note beside
 * the passage. Empty columns are left out.
 *
 * @param {Plan} plan
 * @param {string} note the note's address
 * @returns {string[][]}
 */
export function columnsOf(plan, note) {
  const middle = [plan.address, note, ...plan.people];
  const columns = plan.quoting
    ? [plan.quotations, middle, plan.parallels, plan.references]
    : [middle, plan.quotations, plan.parallels, plan.references];
  return columns.filter((column) => column.length > 0);
}

/**
 * The study's links: each card to the passage. A quotation "quotes", from
 * the New Testament passage to the Old.
 *
 * @param {Plan} plan
 * @param {string} note the note's address
 * @returns {Link[]}
 */
export function linksOf(plan, note) {
  const passage = { address: plan.address };
  const quotes = plan.quotations.map((each) =>
    plan.quoting ? { a: passage, b: { address: each }, type: 'quotes' } : { a: { address: each }, b: passage, type: 'quotes' },
  );
  const plain = [note, ...plan.parallels, ...plan.references, ...plan.people].map((each) => ({ a: { address: each }, b: passage }));
  return [...quotes, ...plain];
}

/**
 * "1 cross-reference", "5 cross-references".
 *
 * @param {number} count
 * @param {string} one
 * @param {string} [many]
 */
const counted = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * The study's note, as a document (lib/note-doc.js): what the study holds,
 * and headings for the reader to write under.
 *
 * @param {Plan} plan
 * @returns {any}
 */
export function studyDoc(plan) {
  const parts = [
    plan.quotations.length ? counted(plan.quotations.length, plan.quoting ? 'passage it quotes' : 'passage that quotes it', plan.quoting ? 'passages it quotes' : 'passages that quote it') : '',
    plan.parallels.length ? counted(plan.parallels.length, 'parallel') : '',
    plan.references.length ? counted(plan.references.length, 'cross-reference') : '',
    plan.people.length ? counted(plan.people.length, 'person', 'people') : '',
    plan.mapIds ? 'its places on the map' : '',
  ].filter(Boolean);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? 'no more than the passage');
  /** @param {string} text */
  const paragraph = (text) => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });
  /** @param {string} text */
  const heading = (text) => ({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] });
  return {
    type: 'doc',
    content: [paragraph(`From the guide: ${list}.`), heading('Observations'), paragraph(''), heading('Questions'), paragraph(''), heading('Application'), paragraph('')],
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
