// Topics, from Nave's Topical Bible (tools/import-topics.js): a topic by its
// name, the topic a search names, and the topics that cite a passage.
//
// Nave's Topical Bible (1896) is in the public domain; the CSV file it comes
// from is Brady Stephenson's, under CC BY 4.0.

import books from './kjv/books.json' with { type: 'json' };
import { versesIn, parseAddress } from '../lib/reference.js';

export const CREDIT = "Nave's Topical Bible (1896), public domain; from Brady Stephenson's bible-data (CC BY 4.0).";

/** @typedef {{ d: number, t: string, p?: string[][], s?: string }} StoredLine */
/** @typedef {{ name: string, lines: StoredLine[] }} StoredTopic */
/** @typedef {import('../lib/citations.js').Part} Part */
/**
 * A heading of a topic, as the panel shows it: its depth, its words, its
 * references as parts (lib/citations.js), and the topic it sends the reader
 * to, if any.
 *
 * @typedef {{ depth: number, label: string, parts: Part[], see: string, seeName: string }} Line
 */
/** @typedef {{ key: string, name: string, lines: Line[], count: number }} TopicView `count` is how many references the topic has */

/** @type {Promise<Record<string, StoredTopic>> | null} */
let all = null;

/** @returns {Promise<Record<string, StoredTopic>>} */
function topics() {
  all ??= import('./topics.json', { with: { type: 'json' } }).then((module) => module.default.topics);
  return all;
}

/**
 * The key of the topic a name sends the reader to: the name itself, else the
 * topic before its comma ("SIN, FORGIVENESS OF" is under SIN), else a topic
 * whose name begins with it. '' when there is none.
 *
 * @param {Record<string, StoredTopic>} known
 * @param {string} name
 */
function resolve(known, name) {
  const key = name.trim().toUpperCase();
  if (known[key]) return key;
  const head = key.split(',')[0].trim();
  if (known[head]) return head;
  return Object.keys(known).find((each) => each.startsWith(`${key},`) || each.startsWith(`${head},`)) ?? '';
}

/**
 * A topic by its key, such as PRAYER, or null.
 *
 * @param {string} key
 * @returns {Promise<TopicView | null>}
 */
export async function topic(key) {
  const known = await topics();
  const found = known[key];
  if (!found) return null;
  let count = 0;
  const lines = found.lines.map((line) => {
    const parts = (line.p ?? []).map(([text, address]) => (address ? { text, address } : { text }));
    count += parts.filter((part) => part.address).length;
    const see = line.s ? resolve(known, line.s) : '';
    return { depth: line.d, label: line.t, parts, see, seeName: line.s ? (see ? known[see].name : line.s) : '' };
  });
  return { key, name: found.name, lines, count };
}

/**
 * The key of the topic a search names, such as "prayer" or "prayers", or ''.
 *
 * @param {string} text
 */
export async function topicFor(text) {
  const known = await topics();
  const key = text.trim().toUpperCase();
  if (!/^[A-Z][A-Z ,'’-]*$/.test(key)) return '';
  for (const each of [key, key.replace(/S$/, ''), `${key}S`, key.replace(/IES$/, 'Y')]) if (known[each]) return each;
  return '';
}

/** @type {Promise<Map<string, Map<string, number>>> | null} */
let index = null;

/**
 * For each verse, the topics that cite it, and how often. A reference to a
 * whole chapter is kept under the chapter (GEN.12).
 *
 * @returns {Promise<Map<string, Map<string, number>>>}
 */
function topicIndex() {
  index ??= topics().then((known) => {
    /** @type {Map<string, Map<string, number>>} */
    const map = new Map();
    /** @param {string} at @param {string} key */
    const add = (at, key) => {
      let counts = map.get(at);
      if (!counts) map.set(at, (counts = new Map()));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };
    for (const [key, found] of Object.entries(known)) {
      for (const line of found.lines) {
        for (const [, address] of line.p ?? []) {
          if (!address) continue;
          const ref = parseAddress(address, books);
          if (!ref) continue;
          if (!ref.from) add(`${ref.book}.${ref.chapter}`, key);
          else for (const [chapter, verse] of versesIn(ref, books)) add(`${ref.book}.${chapter}.${verse}`, key);
        }
      }
    }
    return map;
  });
  return index;
}

/**
 * The topics that cite a passage, those that cite it most first.
 *
 * @param {string} address
 * @param {number} [limit]
 * @returns {Promise<{ key: string, name: string }[]>}
 */
export async function topicsOf(address, limit = 12) {
  const ref = parseAddress(address, books);
  if (!ref) return [];
  const [map, known] = await Promise.all([topicIndex(), topics()]);
  /** @type {Map<string, number>} */
  const counts = new Map();
  const at = ref.from ? versesIn(ref, books).map(([chapter, verse]) => `${ref.book}.${chapter}.${verse}`) : [];
  const chapters = new Set([`${ref.book}.${ref.chapter}`, ...at.map((each) => each.split('.').slice(0, 2).join('.'))]);
  for (const each of [...at, ...chapters]) {
    for (const [key, count] of map.get(each) ?? []) counts.set(key, (counts.get(key) ?? 0) + count);
  }
  return [...counts]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, limit)
    .map(([key]) => ({ key, name: known[key].name }));
}
