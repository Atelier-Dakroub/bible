// The shape of a link between two cards, on the screen (bible-table's
// linkLines). A link leaves each card at a port: the side that faces the
// other card, at the height of the linked words (the middle, for a link to
// the whole card). From there it curves out sideways, so it runs in the gaps
// between the cards, and it is drawn under them: it never covers their text.
// Its label stands beside a port, or along the curve, where no card is.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {Point & { side: 1 | -1 }} Port a point on a card's edge, and the way out: 1 right, -1 left */
/** @typedef {{ left: number, top: number, right: number, bottom: number, width: number, height: number }} Box */

/** How far in from a card's corners a port stays. */
const CORNER = 6;
/** The least a curve reaches out sideways from a port. */
const REACH = 40;
/** The gap between a port and a label beside it. */
const BESIDE = 10;
/** Where along the curve a label may stand, the middle first. */
const ALONG = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];

/** @param {Box} box */
function centreX(box) {
  return box.left + box.width / 2;
}

/**
 * @param {number} value
 * @param {number} low
 * @param {number} high
 */
function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

/**
 * Where a link leaves a card: the side that faces the other card, at the
 * height of the linked words.
 *
 * @param {Box} card
 * @param {Box} words the linked words' box (the card's own, for the whole card)
 * @param {Box} other the other card
 * @returns {Port}
 */
export function port(card, words, other) {
  const side = centreX(other) >= centreX(card) ? 1 : -1;
  const y = clamp(words.top + words.height / 2, card.top + CORNER, card.bottom - CORNER);
  return { x: side > 0 ? card.right : card.left, y, side };
}

/**
 * The two control points of the curve: each straight out from its port.
 *
 * @param {Port} a
 * @param {Port} b
 */
function controls(a, b) {
  const reach = Math.max(REACH, Math.abs(b.x - a.x) / 2);
  return [
    { x: a.x + a.side * reach, y: a.y },
    { x: b.x + b.side * reach, y: b.y },
  ];
}

/**
 * The curve from port to port, as an SVG path.
 *
 * @param {Port} a
 * @param {Port} b
 */
export function curvePath(a, b) {
  const [c1, c2] = controls(a, b);
  return `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
}

/**
 * The point at t (0 to 1) along the curve.
 *
 * @param {Port} a
 * @param {Port} b
 * @param {number} t
 * @returns {Point}
 */
export function pointOn(a, b, t) {
  const [c1, c2] = controls(a, b);
  const u = 1 - t;
  const along = (/** @type {'x' | 'y'} */ k) => u * u * u * a[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * b[k];
  return { x: along('x'), y: along('y') };
}

/**
 * About the box a label takes at a point: the chip is 2.2rem high and as wide
 * as its word.
 *
 * @param {Point} at
 * @param {string} text
 */
export function labelBox(at, text) {
  const width = Math.max(44, text.length * 7 + 24);
  return { left: at.x - width / 2, right: at.x + width / 2, top: at.y - 18, bottom: at.y + 18 };
}

/**
 * @param {{ left: number, top: number, right: number, bottom: number }} a
 * @param {{ left: number, top: number, right: number, bottom: number }} b
 */
function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * The point beside a port, just outside the card, where a label stands.
 *
 * @param {Port} end
 * @param {string} text
 */
export function besidePort(end, text) {
  const half = labelBox({ x: 0, y: 0 }, text).right;
  return { x: end.x + end.side * (half + BESIDE), y: end.y };
}

/**
 * Where a link's label stands: beside one of its ports, or along its curve,
 * wherever no card is; null where every place is under a card.
 *
 * @param {Port} a where the link starts
 * @param {Port} b where it ends
 * @param {string} text
 * @param {Box[]} cards the cards on the screen
 * @returns {Point | null}
 */
export function labelSpot(a, b, text, cards) {
  const places = [besidePort(a, text), besidePort(b, text), ...ALONG.map((t) => pointOn(a, b, t))];
  return places.find((at) => !cards.some((card) => overlaps(labelBox(at, text), card))) ?? null;
}

/**
 * Whether a link is to the whole card: its words' box is the card's.
 *
 * @param {Box} words
 * @param {Box} card
 */
export function wholeCard(words, card) {
  return words.height >= card.height - 1;
}

/**
 * The mark in the card's margin beside the linked words: a thin bar on the
 * side of the port, as high as the words.
 *
 * @param {Port} at
 * @param {Box} card
 * @param {Box} words
 */
export function marginBar(at, card, words) {
  const top = clamp(words.top, card.top + 2, card.bottom - 4);
  const height = clamp(words.height, 4, card.bottom - top - 2);
  return { x: at.side > 0 ? card.right - 6 : card.left + 3, y: top, width: 3, height };
}
