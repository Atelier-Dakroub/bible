// The panels' motion: a short slide and fade as one opens or closes. Only
// translate and opacity move, which the browser does as a picture, and
// there is none for a reader who asks for less motion.

const DURATION = 180;
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

/** True when the reader asks for less motion. */
export function lessMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Slides an element in from a little way off, as it opens.
 *
 * @param {Element} element
 * @param {{ x?: number, y?: number }} from where it comes from, in pixels
 */
export function slideIn(element, { x = 0, y = 0 } = {}) {
  if (lessMotion()) return;
  element.animate([{ opacity: 0, translate: `${x}px ${y}px` }, { opacity: 1, translate: '0 0' }], { duration: DURATION, easing: EASE });
}

/**
 * Slides an element out a little way, as it closes, and resolves when it
 * has gone (at once, for less motion).
 *
 * @param {Element} element
 * @param {{ x?: number, y?: number }} to where it goes, in pixels
 * @returns {Promise<void>}
 */
export async function slideOut(element, { x = 0, y = 0 } = {}) {
  if (lessMotion()) return;
  const motion = element.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: `${x}px ${y}px` }], {
    duration: DURATION * 0.75,
    easing: 'ease-in',
    fill: 'forwards',
  });
  try {
    await motion.finished;
  } catch {
    // Cancelled: the element opened again before it had gone.
  }
  // The end state is the closed one's own; the fill would hold the element
  // clear.
  queueMicrotask(() => motion.cancel());
}
