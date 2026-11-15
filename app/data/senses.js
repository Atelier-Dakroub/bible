// Word senses (tools/import-senses.js): for a Strong's number, the senses the
// word has, each with the verses that use it so, from the United Bible
// Societies' dictionaries (CC BY-SA 4.0): the Greek after Louw and Nida's
// semantic domains, and the Semantic Dictionary of Biblical Hebrew.

import { json } from './load.js';

export const CREDIT =
  "Senses: the UBS Dictionary of the Greek New Testament and the Semantic Dictionary of Biblical Hebrew (© United Bible Societies, CC BY-SA 4.0).";

/** @typedef {{ lemma: string, gloss: string, def: string, domain: string, verses: string[] }} StoredSense */
/**
 * A sense as the word study shows it: its number in the list (from 1), its
 * glosses, definition and domain, and how many verses use the word so.
 *
 * @typedef {{ n: number, lemma: string, gloss: string, def: string, domain: string, count: number, search: string }} Sense
 */

/** @type {Promise<Record<string, StoredSense[]>> | null} */
let all = null;

/** @returns {Promise<Record<string, StoredSense[]>>} */
function senses() {
  all ??= json('senses.json').then((module) => module.default.senses);
  return all;
}

/**
 * The senses of a Strong's number, as the dictionary orders them.
 *
 * @param {string} code such as G4151
 * @returns {Promise<Sense[]>}
 */
export async function sensesOf(code) {
  const found = (await senses())[code] ?? [];
  return found.map((each, i) => ({
    n: i + 1,
    lemma: each.lemma,
    gloss: each.gloss,
    def: each.def,
    domain: each.domain,
    count: each.verses.length,
    search: `${code} sense ${i + 1}`,
  }));
}

/**
 * The verses that use a Strong's number in one sense.
 *
 * @param {string} code
 * @param {number} n the sense's number, from 1
 * @returns {Promise<Set<string>>}
 */
export async function versesOfSense(code, n) {
  return new Set((await senses())[code]?.[n - 1]?.verses ?? []);
}
