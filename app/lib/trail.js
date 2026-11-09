// The research trail of the search panel: each thing the reader looked at,
// in order, so they can go back and forward through it, as in a browser, and
// see the whole path (the "trails" of Vannevar Bush's Memex).
//
// A step is the panel's address for the view (the search page's query, such
// as `entity=place:jerusalem_636`), its label and its kind, for the chip.
// The rules:
//   - Opening something new adds a step after the one on show; any steps
//     after that are dropped, as a browser drops its forward pages.
//   - Opening the step on show again adds nothing.
//   - Opening a step that is already in the trail goes to it, and adds
//     nothing: the path stays as it was.
//   - A search being typed replaces its own step until the typing stops
//     (`replace`), so the trail has one step for it, not one per letter.
//   - The trail keeps MAX_STEPS; the oldest go first.
// The trail is kept with the workspace (lib/workspace.js), and is not a step
// in the table's undo history.

/** @typedef {{ query: string, label: string, kind: string, typed?: string, scroll?: number }} Step `typed` is the text in the search field, for a typed search; `scroll`, where its list was scrolled to, is kept only while the page is open */
/** @typedef {{ steps: Step[], index: number }} Trail `index` is the step on show, or -1 */

export const KINDS = ['search', 'passage', 'refs', 'word', 'person', 'place', 'group', 'event', 'world'];
export const MAX_STEPS = 50;

/** @returns {Trail} */
export function emptyTrail() {
  return { steps: [], index: -1 };
}

/**
 * The trail after a step is opened.
 *
 * @param {Trail} trail
 * @param {Step} step
 * @param {boolean} [replace] the step takes the place of the one on show
 * @returns {Trail}
 */
export function record(trail, step, replace = false) {
  const steps = trail.steps.slice();
  if (replace && trail.index >= 0) {
    steps[trail.index] = step;
    return { steps, index: trail.index };
  }
  if (steps[trail.index]?.query === step.query) {
    steps[trail.index] = step;
    return { steps, index: trail.index };
  }
  const there = steps.findIndex((each) => each.query === step.query);
  if (there >= 0) return { steps, index: there };
  const kept = steps.slice(0, trail.index + 1);
  kept.push(step);
  const over = Math.max(0, kept.length - MAX_STEPS);
  return { steps: kept.slice(over), index: kept.length - 1 - over };
}

/**
 * The trail without the step on show: a typed search that was cleared.
 *
 * @param {Trail} trail
 * @returns {Trail}
 */
export function dropCurrent(trail) {
  if (trail.index < 0) return trail;
  const steps = trail.steps.filter((_, i) => i !== trail.index);
  return { steps, index: Math.min(trail.index, steps.length - 1) };
}

/**
 * The steps to show as chips: `size` of them around the one on show, and
 * whether there are more before or after.
 *
 * @param {Trail} trail
 * @param {number} [size]
 */
export function windowOf(trail, size = 6) {
  const count = trail.steps.length;
  const start = Math.max(0, Math.min(trail.index - Math.floor(size / 2), count - size));
  const end = Math.min(count, start + size);
  return { start, end, before: start > 0, after: end < count };
}

/**
 * A stored trail, checked, or an empty one.
 *
 * @param {any} value
 * @returns {Trail}
 */
export function toTrail(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.steps)) return emptyTrail();
  const steps = value.steps
    .filter(
      (/** @type {any} */ step) =>
        typeof step?.query === 'string' &&
        step.query.length > 0 &&
        step.query.length <= 500 &&
        typeof step.label === 'string' &&
        KINDS.includes(step.kind),
    )
    .slice(-MAX_STEPS)
    .map((/** @type {any} */ step) => {
      /** @type {Step} */
      const kept = { query: step.query, label: step.label.slice(0, 120), kind: step.kind };
      if (typeof step.typed === 'string' && step.typed) kept.typed = step.typed.slice(0, 200);
      return kept;
    });
  const index = Number.isInteger(value.index) ? Math.min(Math.max(value.index, -1), steps.length - 1) : steps.length - 1;
  return { steps, index: steps.length ? Math.max(index, 0) : -1 };
}
