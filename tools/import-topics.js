#!/usr/bin/env node
// Topics: Nave's Topical Bible, each topic with its headings and the verses
// under each.
//
//   node tools/import-topics.js <NavesTopicalDictionary.csv> [output]
//
// Source: Orville J. Nave, Nave's Topical Bible (1896), in the public domain;
// as a CSV file in Brady Stephenson's bible-data
// (https://github.com/BradyStephenson/bible-data), under CC BY 4.0. Each row is
// a topic: its letter, its name in capitals, and its entry, one heading to a
// line: "-Marriage of EXO 6:23", indented five spaces under the heading above
// it. A line can also send the reader to another topic: "-See PRIEST, HIGH".
//
// The references are Paratext book codes, as the app's addresses use:
// "EXO 6:16-20; JOS 21:4,10; 1CH 6:2,3; 23:13; NUM 17". After a semicolon a
// number is a chapter, unless it has a verse; after a comma it is a verse of
// the same chapter, when the reference before it had one. Each reference
// becomes its own link, as in lib/citations.js. A reference to a verse the KJV
// does not number stays text.
//
// The names and headings are in capitals in the source ("OF ENEMIES"). They
// are written in small letters here, and a word keeps its capital when the
// entries write it with one somewhere else ("Jesus", "Moses").
//
// The output defaults to app/data/topics.json:
//   { source, license, topics: { KEY: { name, lines: [{ d, t, p, s? }] } } }
// with KEY the name in capitals, `d` the depth, `t` the heading, `p` the
// references as parts ([text] or [text, address]), and `s` the topic a "See"
// line sends the reader to.

import { readFile, writeFile } from 'node:fs/promises';
import { parseAddress, toAddress } from '../app/lib/reference.js';

const [source, out = 'app/data/topics.json'] = process.argv.slice(2);
if (!source) {
  console.error('Usage: node tools/import-topics.js <NavesTopicalDictionary.csv> [output]');
  process.exit(1);
}

const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));
/** @type {Map<string, string>} the codes as written, in capitals, to the app's ids */
const CODES = new Map(books.map((/** @type {{ id: string }} */ book) => [book.id, book.id]));
CODES.set('1JHN', '1JN');
CODES.set('2JHN', '2JN');
CODES.set('3JHN', '3JN');
/** @type {Map<string, string>} */
const ABBREVIATION = new Map(books.map((/** @type {{ id: string, abbreviation: string }} */ book) => [book.id, book.abbreviation]));

/** The rows of a CSV file with quoted fields that hold line breaks. @param {string} text */
function csv(text) {
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

/** @param {string} id @param {number} chapter @param {string} [from] @param {string} [to] @param {number} [toChapter] */
function addressOf(id, chapter, from, to, toChapter) {
  let text = `${id}.${chapter}`;
  if (from) text += `.${from}`;
  if (from && to) text += toChapter ? `-${toChapter}.${to}` : `-${to}`;
  const ref = parseAddress(text, books);
  return ref ? toAddress(ref) : '';
}

const BOOK = /^([1-3]?[A-Za-z]{2,4})$/;
// A book code, a chapter and verses, punctuation, or a word.
const TOKEN = /([1-3]?[A-Za-z]{2,4})(?= \d)|(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?|[^\dA-Za-z]+|[A-Za-z]+/g;

let dropped = 0;

/**
 * The references after a heading, as parts.
 *
 * @param {string} tail
 * @returns {string[][]}
 */
function refParts(tail) {
  /** @type {string[][]} */
  const parts = [];
  /** @param {string} text */
  const plain = (text) => {
    const last = parts[parts.length - 1];
    if (last && last.length === 1) last[0] += text;
    else parts.push([text]);
  };
  let book = '';
  let chapter = 0;
  let verses = false;
  let mark = ';';
  for (const match of tail.matchAll(TOKEN)) {
    const [whole, code, first, second, third, fourth] = match;
    if (code && BOOK.test(code) && CODES.has(code.toUpperCase())) {
      book = /** @type {string} */ (CODES.get(code.toUpperCase()));
      verses = false;
      mark = ';';
      plain(ABBREVIATION.get(book) ?? code);
      continue;
    }
    if (first && book) {
      /** @type {string} */
      let address;
      if (second) {
        // 6:16, 6:16-20, or 6:16-7:3.
        chapter = Number(first);
        address = fourth ? addressOf(book, chapter, second, fourth, Number(third)) : addressOf(book, chapter, second, third);
        verses = true;
      } else if (mark === ',' && verses) {
        // A verse, or verses, of the chapter before.
        address = addressOf(book, chapter, first, third);
      } else {
        // A chapter; of a range of chapters, the first.
        chapter = Number(first);
        address = addressOf(book, chapter);
        verses = false;
      }
      if (address) parts.push([whole.replace(/-/g, '–'), address]);
      else {
        dropped += 1;
        plain(whole);
      }
      continue;
    }
    if (/[;,]/.test(whole)) mark = whole.includes(';') ? ';' : ',';
    plain(whole);
  }
  return parts;
}

const rows = csv((await readFile(source, 'utf8')).replace(/^﻿/, '')).slice(1);

// The words the entries' own text writes with a capital more often than
// without, inside a sentence: names, such as Jesus.
/** @type {Map<string, number>} */
const capitals = new Map();
/** @type {Map<string, number>} */
const smalls = new Map();
for (const [, , entry] of rows) {
  for (const line of entry.split('\n')) {
    const text = line.replace(/^\s*-/, '');
    if (text === text.toUpperCase()) continue;
    for (const match of text.slice(1).matchAll(/(?<=[\s(“"'-])([A-Za-z][a-z]+)/g)) {
      const word = match[1];
      const counts = word[0] === word[0].toUpperCase() ? capitals : smalls;
      counts.set(word.toLowerCase(), (counts.get(word.toLowerCase()) ?? 0) + 1);
    }
  }
}
/** @type {Set<string>} */
const proper = new Set([...capitals].filter(([word, count]) => count > (smalls.get(word) ?? 0)).map(([word]) => word));
// A word of a name that is also a plain word: Asia Minor, but "minor sub-topics".
proper.delete('minor');
for (const word of ['god', 'lord', 'christ', 'jesus', 'israel', 'jews', 'gentiles', 'holy', 'spirit', 'ghost', 'messiah']) proper.add(word);

/**
 * Text in capitals in small letters, the first with a capital, and the
 * names with theirs.
 *
 * @param {string} text
 */
function caseOf(text) {
  if (text !== text.toUpperCase()) return text;
  const small = text.toLowerCase().replace(/[a-z]+/g, (word) => (proper.has(word) ? word[0].toUpperCase() + word.slice(1) : word));
  return small.replace(/^([^a-zA-Z]*)([a-z])/, (_, before, letter) => before + letter.toUpperCase());
}

/** @type {Record<string, { name: string, lines: { d: number, t: string, p?: string[][], s?: string }[] }>} */
const topics = {};
let lineCount = 0;
let linkCount = 0;
for (const [, subject, entry] of rows) {
  const key = subject.trim();
  if (!key) continue;
  const lines = [];
  for (const raw of entry.split('\n')) {
    if (!raw.trim()) continue;
    const depth = Math.floor((/^ */.exec(raw)?.[0].length ?? 0) / 5);
    const line = raw
      .trim()
      .replace(/^-/, '')
      .replace(/&gt;|&lt;|&amp;/g, (entity) => ({ '&gt;': '', '&lt;': '', '&amp;': '&' })[entity] ?? '')
      .replace(/^0F\b/, 'OF')
      .trim();
    // "See PRIEST, HIGH", or "2. See ADONIRAM": a topic to go to.
    const see = /^(.*?)\bSee ([A-Z][A-Z0-9 ,'’-]*)$/.exec(line);
    // "OF [2601]GOD, LOVE OF": the source's mark of a topic to go to.
    const marked = /^([^[]*)\[\d+\]([A-Z][A-Z0-9 ,'’-]*)$/.exec(line);
    const goTo = see ?? marked;
    if (goTo && !/[1-3]?[A-Z]{2,3} \d/.test(goTo[1])) {
      lines.push({ d: depth, t: caseOf(goTo[1].trim()), s: goTo[2].trim() });
      continue;
    }
    const text = line.replace(/\[\d+\]/g, '');
    // The heading runs to the first book code that has a chapter after it.
    const first = [...text.matchAll(/(?:^|[\s(])([1-3]?[A-Za-z]{2,4})(?= +\d)/g)].find((match) => CODES.has(match[1].toUpperCase()));
    const at = first ? (first.index ?? 0) + (first[0].startsWith(first[1]) ? 0 : 1) : text.length;
    const heading = text.slice(0, at).trim();
    const parts = first ? refParts(text.slice(at).replace(/ {2,}/g, ' ')) : [];
    linkCount += parts.filter((part) => part.length === 2).length;
    lines.push(parts.length ? { d: depth, t: caseOf(heading), p: parts } : { d: depth, t: caseOf(heading) });
    lineCount += 1;
  }
  topics[key] = { name: caseOf(key), lines };
}

await writeFile(
  out,
  `${JSON.stringify({
    source: "Nave's Topical Bible (Orville J. Nave, 1896), as a CSV file in Brady Stephenson's bible-data (https://github.com/BradyStephenson/bible-data)",
    license: "Nave's Topical Bible is in the public domain; the CSV file is under CC BY 4.0",
    topics,
  })}\n`,
);
console.log(`${Object.keys(topics).length} topics, ${lineCount} headings, ${linkCount} references written to ${out}; ${dropped} references to verses the KJV does not number left as text.`);
