// Images: photographs of places and objects from museums, each linked to the
// people, places and events it shows (tools/import-images.js). Two sources,
// both free of conditions: the Matson Photograph Collection at the Library of
// Congress (1898-1946, no known restrictions) and The Metropolitan Museum of
// Art (Open Access, CC0). Every image keeps its credit and a link to its
// record.

import record from './images.json' with { type: 'json' };

/**
 * @typedef {{
 *   id: string, file: string, width: number, height: number,
 *   caption: string, title: string, date: string, credit: string, url: string,
 *   entities: string[]
 * }} Image
 */

/** @type {Image[]} */
export const images = record;

/**
 * The images of a person, place, group or event, in the order they were
 * chosen: the first is the one to show first.
 *
 * @param {string} id
 * @returns {Image[]}
 */
export function imagesFor(id) {
  return images.filter((image) => image.entities.includes(id));
}

/**
 * One image, by its id, such as met-322585.
 *
 * @param {string} id
 * @returns {Image | null}
 */
export function imageById(id) {
  return images.find((image) => image.id === id) ?? null;
}

/**
 * The images of several entities, each image once, in the order of the
 * entities.
 *
 * @param {string[]} ids
 * @param {number} [limit]
 * @returns {Image[]}
 */
export function imagesOf(ids, limit = 6) {
  /** @type {Image[]} */
  const found = [];
  for (const id of ids) {
    for (const image of imagesFor(id)) if (!found.includes(image)) found.push(image);
  }
  return found.slice(0, limit);
}
