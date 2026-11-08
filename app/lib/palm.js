// Palm rejection, for a panel that reports no contact size.
//
// The ILITEK panel gives every touch the same 50 × 50, so a palm cannot be
// told from a finger by its area. It can be told by its shape in time and
// space: a hand that rests on the glass puts several contacts down at nearly
// the same moment, close together. Fingers that mean something land one at a
// time, or far apart, as two hands do.
//
// The rule: when `count` or more contacts go down within `within` ms of each
// other, all within `radius` px of the first of them, they are a palm. Every
// contact in the group is rejected, including the ones that landed before the
// group was complete; the caller cancels those. A contact that is part of a
// palm stays rejected until it lifts.
//
// The numbers are a starting point, to be tuned with recordings from the
// panel. They are options, not constants, for that reason.

/** @typedef {{ within?: number, radius?: number, count?: number }} PalmOptions */
/** @typedef {{ id: number, x: number, y: number, t: number }} Contact */

export const DEFAULTS = { within: 120, radius: 180, count: 3 };

/**
 * @param {PalmOptions} [options]
 */
export function createPalmGuard(options = {}) {
  const { within, radius, count } = { ...DEFAULTS, ...options };
  /** @type {Contact[]} contacts that went down recently and are still down */
  let recent = [];
  /** @type {Set<number>} */
  const rejected = new Set();

  return {
    /**
     * A contact went down. Returns the ids to reject now: empty, or this one
     * and the others in its group that were not rejected yet.
     *
     * @param {Contact} contact
     * @returns {number[]}
     */
    down(contact) {
      recent = recent.filter((each) => contact.t - each.t <= within);
      recent.push(contact);
      const first = recent[0];
      const group = recent.filter((each) => Math.hypot(each.x - first.x, each.y - first.y) <= radius);
      if (group.length < count) return [];
      const fresh = group.map((each) => each.id).filter((id) => !rejected.has(id));
      for (const id of fresh) rejected.add(id);
      return fresh;
    },

    /** @param {number} id */
    isRejected(id) {
      return rejected.has(id);
    },

    /**
     * A contact lifted or was cancelled.
     *
     * @param {number} id
     */
    up(id) {
      rejected.delete(id);
      recent = recent.filter((each) => each.id !== id);
    },
  };
}
