// Undo and redo, as a list of snapshots (workspace.js snapshot()).
//
// Each change to the table records the snapshot after it. Undo steps back to
// the one before, and redo forward again. A snapshot that is the same as the
// present one is not a change, so a tap that moves nothing adds no step.
// A new change after an undo drops the steps that were undone.
//
// The steps back are kept up to a count and up to a size: a large table
// (long notes) keeps fewer steps, so that the history does not hold tens of
// megabytes. One step back is always kept.

/** How many characters of snapshots the steps back hold at most: about 16 MB. */
const BUDGET = 8_000_000;

/**
 * The steps back, less the oldest, until they are within the count and the
 * size; never less than one.
 *
 * @param {string[]} past
 * @param {number} limit
 * @param {number} budget
 */
export function trimmed(past, limit, budget) {
  let held = past.reduce((sum, step) => sum + step.length, 0);
  let from = Math.max(0, past.length - limit);
  for (let at = 0; at < from; at += 1) held -= past[at].length;
  while (held > budget && from < past.length - 1) {
    held -= past[from].length;
    from += 1;
  }
  return from > 0 ? past.slice(from) : past;
}

/**
 * @param {number} [limit] how many steps back are kept
 * @param {number} [budget] how many characters the steps back hold at most
 */
export function createHistory(limit = 100, budget = BUDGET) {
  /** @type {string[]} */
  let past = [];
  /** @type {string[]} */
  let future = [];
  /** @type {string | null} */
  let present = null;

  return {
    /**
     * Starts again from `snapshot`, with nothing to undo.
     *
     * @param {string} snapshot
     */
    reset(snapshot) {
      past = [];
      future = [];
      present = snapshot;
    },

    /**
     * @param {string} snapshot the state after a change
     * @returns {boolean} false when nothing changed
     */
    record(snapshot) {
      if (snapshot === present) return false;
      if (present !== null) past.push(present);
      past = trimmed(past, limit, budget);
      present = snapshot;
      future = [];
      return true;
    },

    /** @returns {string | null} the state to go back to, or null for none */
    undo() {
      const previous = past.pop();
      if (previous === undefined || present === null) return null;
      future.push(present);
      present = previous;
      return previous;
    },

    /** @returns {string | null} the state to go forward to, or null for none */
    redo() {
      const next = future.pop();
      if (next === undefined || present === null) return null;
      past.push(present);
      present = next;
      return next;
    },

    canUndo() {
      return past.length > 0;
    },

    canRedo() {
      return future.length > 0;
    },
  };
}
