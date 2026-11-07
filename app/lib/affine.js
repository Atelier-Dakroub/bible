// A 2D affine matrix, in the order CSS `matrix(a, b, c, d, e, f)` uses:
//
//   x' = a·x + c·y + e
//   y' = b·x + d·y + f
//
// Plain objects and no DOMMatrix, so the same code runs in a test under Node.

/** @typedef {{ a: number, b: number, c: number, d: number, e: number, f: number }} Matrix */
/** @typedef {{ x: number, y: number }} Point */

/** @returns {Matrix} */
export function identity() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

/**
 * @param {number} dx
 * @param {number} dy
 * @returns {Matrix}
 */
export function translation(dx, dy) {
  return { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy };
}

/**
 * A turn about the origin.
 *
 * @param {number} radians
 * @returns {Matrix}
 */
export function rotation(radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

/**
 * A uniform scale that leaves `about` where it is.
 *
 * @param {number} k
 * @param {Point} about
 * @returns {Matrix}
 */
export function scaleAbout(k, about) {
  return { a: k, b: 0, c: 0, d: k, e: about.x * (1 - k), f: about.y * (1 - k) };
}

/**
 * `m` after `n`: the point goes through `n` first.
 *
 * @param {Matrix} m
 * @param {Matrix} n
 * @returns {Matrix}
 */
export function multiply(m, n) {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

/**
 * @param {Matrix} m
 * @param {Point} p
 * @returns {Point}
 */
export function apply(m, p) {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/**
 * The turn, the uniform scale and the move that send p1 to q1 and p2 to q2.
 * This is what two fingers on a card ask for.
 *
 * Read the two vectors as complex numbers: the ratio q/p is the scale and the
 * turn together, and the translation is whatever puts p1 on q1 after that.
 *
 * @param {Point} p1
 * @param {Point} p2
 * @param {Point} q1
 * @param {Point} q2
 * @returns {Matrix}
 */
export function similarity(p1, p2, q1, q2) {
  const px = p2.x - p1.x;
  const py = p2.y - p1.y;
  const qx = q2.x - q1.x;
  const qy = q2.y - q1.y;
  const length = px * px + py * py;

  // Two fingers on one spot have no direction. Follow the first one.
  if (length === 0) return translation(q1.x - p1.x, q1.y - p1.y);

  const a = (qx * px + qy * py) / length;
  const b = (qy * px - qx * py) / length;
  return {
    a,
    b,
    c: -b,
    d: a,
    e: q1.x - (a * p1.x - b * p1.y),
    f: q1.y - (b * p1.x + a * p1.y),
  };
}

/** @param {Matrix} m */
export function scaleOf(m) {
  return Math.hypot(m.a, m.b);
}

/** @param {Matrix} m */
export function angleOf(m) {
  return Math.atan2(m.b, m.a);
}

/**
 * Holds the scale of `m` between `min` and `max`, and keeps `about` still while
 * it does, so a pinch past the limit stops growing without the card jumping.
 *
 * @param {Matrix} m
 * @param {number} min
 * @param {number} max
 * @param {Point} about
 * @returns {Matrix}
 */
export function clampScale(m, min, max, about) {
  const scale = scaleOf(m);
  if (scale >= min && scale <= max) return m;
  const target = Math.min(max, Math.max(min, scale));
  return multiply(scaleAbout(target / scale, about), m);
}

/** @param {Matrix} m */
export function toCSS(m) {
  return `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`;
}
