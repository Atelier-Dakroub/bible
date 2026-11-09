// Undo and redo, as a list of snapshots (workspace.js snapshot()).
//
// Each change to the table records the snapshot after it. Undo steps back to
// the one before, and redo forward again. A snapshot that is the same as the
// present one is not a change, so a tap that moves nothing adds no step.
// A new change after an undo drops the steps that were undone.

/**
 * @param {number} [limit] how many steps back are kept
 */
export function createHistory(limit = 100) {
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
      if (past.length > limit) past = past.slice(past.length - limit);
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
