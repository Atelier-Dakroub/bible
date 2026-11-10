#!/usr/bin/env node
// Syntax: every sentence of the Hebrew and the Greek as its clauses, and each
// clause as its parts (subject, verb, object, and the rest), for the Syntax
// version of a card and the search by syntax (data/syntax.js).
//
//   node tools/import-syntax.js <macula-greek folder> <macula-hebrew folder> <directory with STEPBible's TAHOT files> [output directory]
//
// Source: MACULA Greek and MACULA Hebrew (https://github.com/Clear-Bible),
// © Biblica, under CC BY 4.0: the syntax trees in their "lowfat" form
// (Nestle1904/lowfat, WLC/lowfat). The Greek is Nestle's text of 1904, which
// differs in places from the Textus Receptus that the KJV translated; the
// Hebrew is the Westminster Leningrad Codex, the manuscript the app's Hebrew
// also follows. Only the trees, the words, their glosses and Strong's numbers
// are taken: MACULA's senses and domains are UBS data used by permission, not
// under CC BY.
//
// A tree is <sentence>, with word groups (<wg>) and words (<w>). A group or a
// word can have a role in its clause: s (subject), v (verb), vc (a verb that
// joins, such as "is"), o and o2 (objects), io (indirect object), p
// (predicate), adv or pp (an adverbial: when, where, how), aux. A group of
// class "cl" is a clause. Here each clause is a list of parts, each part a
// role, its words, and the clauses inside it (a relative clause in a noun
// phrase, say).
//
// The Hebrew numbers its verses as the Hebrew Bible does; STEPBible's Hebrew
// gives both numbers where they differ, as Psa.45.1(45.2), so the import
// writes the KJV's.
//
// The output is one file for each book, by default in app/data/syntax:
//   { sentences: [{ v: [address], c: [clause] }] }
// with clause = { p: [part] }, part = [role, [word], [clause]] and
// word = [text with what follows it, gloss, Strong's number]. Empty lists are
// left out at the end of a part.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hebrewToKjv } from './lib/versification.js';

const [greek, hebrew, tahot, out = 'app/data/syntax'] = process.argv.slice(2);
if (!greek || !hebrew || !tahot) {
  console.error('Usage: node tools/import-syntax.js <macula-greek folder> <macula-hebrew folder> <directory with STEPBible\'s TAHOT files> [output directory]');
  process.exit(1);
}

/** @type {{ id: string, verses: number[] }[]} */
const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));
const known = new Map(books.map((book) => [book.id, book.verses]));

// The Hebrew Bible's verse numbers to the KJV's, word by word.
const kjv = await hebrewToKjv(tahot);

/** @typedef {{ name: string, attrs: Record<string, string>, children: Node[], text: string }} Node */

/** The elements of a tree file that matter: sentence, wg and w. @param {string} xml */
function parse(xml) {
  /** @type {Node} */
  const root = { name: 'root', attrs: {}, children: [], text: '' };
  /** @type {Node[]} */
  const stack = [root];
  for (const match of xml.matchAll(/<(\/?)([\w:]+)((?:\s+[\w:]+="[^"]*")*)\s*(\/?)>|([^<]+)/g)) {
    const [, closing, name, attrText, selfClosing, text] = match;
    const top = stack[stack.length - 1];
    if (text !== undefined) {
      if (top.name === 'w') top.text += text;
      continue;
    }
    if (!['sentence', 'wg', 'w'].includes(name)) continue;
    if (closing) {
      stack.pop();
      continue;
    }
    /** @type {Record<string, string>} */
    const attrs = {};
    for (const [, key, value] of attrText.matchAll(/([\w:]+)="([^"]*)"/g)) attrs[key] = value;
    const node = { name, attrs, children: [], text: '' };
    top.children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

/** "JHN 3:16!2" to JHN.3.16, in the KJV's numbers. @param {string} ref @param {boolean} hebrew */
function verseOf(ref, hebrew) {
  const match = /^(\w+) (\d+):(\d+)(?:!(\d+))?/.exec(ref);
  if (!match) return '';
  const address = `${match[1]}.${match[2]}.${match[3]}`;
  const found = hebrew ? (match[4] ? kjv.word(address, Number(match[4])) : kjv.verse(address)) : address;
  const [book, chapter, verse] = found.split('.');
  const count = known.get(book)?.[Number(chapter) - 1] ?? 0;
  return Number(verse) >= 1 && Number(verse) <= count ? found : '';
}

const ROLES = new Set(['s', 'v', 'vc', 'o', 'o2', 'io', 'p', 'adv', 'aux']);

/** @param {Node} node */
const roleOf = (node) => {
  const role = node.attrs.role ?? '';
  if (role === 'pp') return 'adv';
  return ROLES.has(role) ? role : '';
};

/**
 * @param {Node} w
 * @param {boolean} hebrew
 * @returns {string[]} [text, gloss, Strong's number]
 */
function wordOf(w, hebrew) {
  const strong = hebrew ? w.attrs.strongnumberx : w.attrs.strong;
  const number = /^0*(\d+)/.exec(strong ?? '')?.[1];
  // The word with what follows it: a space, a comma, or nothing where a
  // Hebrew prefix joins the next word.
  // The Greek has a space after every word; the Hebrew where the source has
  // one. A stop or a maqqef the word has already is not added again.
  const base = (w.attrs.unicode ?? w.text).trim();
  const after = w.attrs.after ?? '';
  const mark = after.trim();
  const text = `${mark && !base.endsWith(mark) ? base + mark : base}${!hebrew || after.endsWith(' ') ? ' ' : ''}`;
  const gloss = (w.attrs.gloss ?? w.attrs.english ?? '').replace(/\./g, ' ').trim();
  return [text, gloss === '-' ? '' : gloss, number ? `${hebrew ? 'H' : 'G'}${number}` : ''];
}

/** @typedef {{ p: any[] }} Clause */

/**
 * The words of a group in order, and the clauses inside it.
 *
 * @param {Node} node
 * @param {boolean} hebrew
 * @param {string[][]} words
 * @param {Clause[]} clauses
 */
function flatten(node, hebrew, words, clauses) {
  for (const child of node.children) {
    if (child.name === 'w') words.push(wordOf(child, hebrew));
    else if (child.attrs.class === 'cl') clauses.push(clauseOf(child, hebrew));
    else flatten(child, hebrew, words, clauses);
  }
}

/**
 * A clause as its parts.
 *
 * @param {Node} node
 * @param {boolean} hebrew
 * @returns {Clause}
 */
function clauseOf(node, hebrew) {
  /** @type {any[]} */
  const parts = [];
  for (const child of node.children) {
    if (child.name === 'w') {
      parts.push([roleOf(child), [wordOf(child, hebrew)]]);
    } else if (child.attrs.class === 'cl') {
      parts.push([roleOf(child), [], [clauseOf(child, hebrew)]]);
    } else {
      /** @type {string[][]} */
      const words = [];
      /** @type {Clause[]} */
      const clauses = [];
      flatten(child, hebrew, words, clauses);
      parts.push(clauses.length ? [roleOf(child), words, clauses] : [roleOf(child), words]);
    }
  }
  // Words with no role next to each other are one part: "and the".
  /** @type {any[]} */
  const joined = [];
  for (const part of parts) {
    const last = joined[joined.length - 1];
    if (last && !last[0] && !part[0] && last.length === 2 && part.length === 2) last[1].push(...part[1]);
    else joined.push(part);
  }
  return { p: joined };
}

/** Every word under a node. @param {Node} node @returns {Node[]} */
const wordsUnder = (node) => (node.name === 'w' ? [node] : node.children.flatMap(wordsUnder));

/** @type {Map<string, { v: string[], c: Clause[] }[]>} */
const byBook = new Map();
let sentenceCount = 0;

/** @param {string} file @param {boolean} hebrew */
async function readTree(file, hebrew) {
  const root = parse(await readFile(file, 'utf8'));
  for (const sentence of root.children.flatMap((child) => (child.name === 'sentence' ? [child] : child.children.filter((each) => each.name === 'sentence')))) {
    const verses = [...new Set(wordsUnder(sentence).map((w) => verseOf(w.attrs.ref ?? '', hebrew)).filter(Boolean))];
    if (!verses.length) continue;
    const clauses = sentence.children.filter((child) => child.name === 'wg').map((child) => (child.attrs.class === 'cl' ? clauseOf(child, hebrew) : { p: [['', ...(() => {
      /** @type {string[][]} */
      const words = [];
      /** @type {Clause[]} */
      const inner = [];
      flatten(child, hebrew, words, inner);
      return inner.length ? [words, inner] : [words];
    })()]] }));
    const book = verses[0].split('.')[0];
    if (!byBook.has(book)) byBook.set(book, []);
    /** @type {{ v: string[], c: Clause[] }[]} */ (byBook.get(book)).push({ v: verses, c: clauses });
    sentenceCount += 1;
  }
}

for (const name of (await readdir(path.join(greek, 'Nestle1904/lowfat'))).filter((each) => each.endsWith('.xml')).sort()) {
  await readTree(path.join(greek, 'Nestle1904/lowfat', name), false);
}
for (const name of (await readdir(path.join(hebrew, 'WLC/lowfat'))).filter((each) => each.endsWith('.xml')).sort()) {
  await readTree(path.join(hebrew, 'WLC/lowfat', name), true);
}

await mkdir(out, { recursive: true });
let bytes = 0;
for (const [book, sentences] of byBook) {
  const text = JSON.stringify({ sentences });
  bytes += text.length;
  await writeFile(path.join(out, `${book}.json`), `${text}\n`);
}
await writeFile(
  path.join(out, 'source.json'),
  `${JSON.stringify(
    {
      name: 'MACULA Greek and MACULA Hebrew Linguistic Datasets: the syntax trees (lowfat)',
      source: 'https://github.com/Clear-Bible/macula-greek, https://github.com/Clear-Bible/macula-hebrew',
      license: 'CC BY 4.0, © Biblica. The Greek is Nestle 1904 (public domain); the Hebrew is the Westminster Leningrad Codex (public domain) with the Westminster Hebrew Syntax (Groves Center, CC BY 4.0).',
    },
    null,
    1,
  )}\n`,
);
console.log(`${sentenceCount} sentences in ${byBook.size} books written to ${out} (${Math.round(bytes / 1e6)} MB).`);
