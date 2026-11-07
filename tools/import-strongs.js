#!/usr/bin/env node
// Puts a Strong's number on the words of the KJV data, and writes the
// Strong's dictionaries beside them.
//
//   node tools/import-strongs.js <usfm directory> <hebrew dictionary .js> <greek dictionary .js> [output directory]
//
// Sources:
//   - eBible.org eng-kjv2006_usfm.zip: the KJV with a Strong's number on most
//     words, in USFM (\w word|strong="H7225"\w*). Public domain.
//   - github.com/openscriptures/strongs, hebrew/strongs-hebrew-dictionary.js and
//     greek/strongs-greek-dictionary.js. CC BY-SA: credit Open Scriptures, and
//     share the dictionary data under the same license.
//
// The output directory defaults to app/data/strongs:
//   <BOOK>.json     { "GEN.1.1": "- H7225 H430 H1254 - H8064 H853 - H776", ... }
//                   one entry per word of the verse, in word order (words.js
//                   numbering); "-" is a word with no number
//   lexicon.json    { "H7225": { lemma, xlit, pron, def, kjv }, ... }
//
// The eBible text and the KJV data are two editions of the same text, so the
// words are matched by spelling, verse by verse. A word that does not match
// within a few words either way gets no number. The import reports how many
// words matched.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tokenize } from '../app/lib/words.js';

const [usfmDir, hebrewFile, greekFile, out = 'app/data/strongs'] = process.argv.slice(2);

if (!usfmDir || !hebrewFile || !greekFile) {
  console.error('Usage: node tools/import-strongs.js <usfm directory> <hebrew .js> <greek .js> [output directory]');
  process.exit(1);
}

// How far the matcher looks ahead, in words, to find its place again.
const WINDOW = 4;

/** @param {string} word */
function normalize(word) {
  return word.toLowerCase().replace(/[^\p{L}]/gu, '');
}

/** @param {string} code such as G0025 */
function cleanCode(code) {
  return code[0] + String(Number(code.slice(1)));
}

/**
 * The words of one book's USFM, by verse address, each with its number or
 * null. A psalm title (\d) comes before \v 1 in the USFM and inside verse 1
 * in the KJV data, so text before the first verse joins verse 1.
 *
 * @param {string} text
 * @param {string} book
 * @returns {Map<string, { norm: string, code: string | null }[]>}
 */
function readUsfm(text, book) {
  const clean = text.replace(/\\f .*?\\f\*/gs, '');
  /** @type {Map<string, { norm: string, code: string | null }[]>} */
  const verses = new Map();
  let chapter = 0;
  /** @type {{ norm: string, code: string | null }[]} */
  let current = [];
  /** @type {{ norm: string, code: string | null }[]} */
  let beforeFirst = [];

  for (const line of clean.split('\n')) {
    const chapterMatch = /^\\c\s+(\d+)/.exec(line);
    if (chapterMatch) {
      chapter = Number(chapterMatch[1]);
      current = beforeFirst = [];
      continue;
    }
    if (/^\\(id|h|toc\d|mt\d?)\b/.test(line)) continue;

    // A line can hold several verses; split it at each \v.
    const pieces = line.split(/(\\v\s+\d+\s)/);
    for (const piece of pieces) {
      const verseMatch = /^\\v\s+(\d+)\s$/.exec(piece);
      if (verseMatch) {
        current = verseMatch[1] === '1' ? beforeFirst : [];
        if (verseMatch[1] !== '1') beforeFirst = [];
        verses.set(`${book}.${chapter}.${verseMatch[1]}`, current);
        continue;
      }
      if (chapter === 0) continue;
      current.push(...wordsOf(piece));
    }
  }
  return verses;
}

/**
 * @param {string} text USFM inside a verse
 * @returns {{ norm: string, code: string | null }[]}
 */
function wordsOf(text) {
  const found = [];
  const tag = /\\\+?w\s+([^|\\]*?)\|strong="([HG]\d+)"\\\+?w\*/g;
  let last = 0;
  for (const match of text.matchAll(tag)) {
    found.push(...plain(text.slice(last, match.index)));
    for (const word of match[1].split(/\s+/)) {
      const norm = normalize(word);
      if (norm) found.push({ norm, code: cleanCode(match[2]) });
    }
    last = (match.index ?? 0) + match[0].length;
  }
  found.push(...plain(text.slice(last)));
  return found;
}

/** @param {string} text */
function plain(text) {
  return text
    .replace(/\\\+?[a-z]+\d?\*?/g, ' ')
    .split(/\s+/)
    .map(normalize)
    .filter(Boolean)
    .map((norm) => ({ norm, code: null }));
}

/**
 * Matches the KJV data's words to the USFM's words and returns one number or
 * "-" per KJV word, and how many matched.
 *
 * @param {string[]} ours normalized words of the KJV data
 * @param {{ norm: string, code: string | null }[]} theirs
 */
function align(ours, theirs) {
  /** @type {string[]} */
  const codes = ours.map(() => '-');
  let matched = 0;
  let i = 0;
  let j = 0;
  while (i < ours.length && j < theirs.length) {
    if (ours[i] === theirs[j].norm) {
      if (theirs[j].code) codes[i] = /** @type {string} */ (theirs[j].code);
      matched += 1;
      i += 1;
      j += 1;
      continue;
    }
    let k = 0;
    for (let step = 1; step <= WINDOW && j + step < theirs.length; step += 1) {
      if (theirs[j + step].norm === ours[i]) {
        k = step;
        break;
      }
    }
    let l = 0;
    for (let step = 1; step <= WINDOW && i + step < ours.length; step += 1) {
      if (ours[i + step] === theirs[j].norm) {
        l = step;
        break;
      }
    }
    if (k && (!l || k <= l)) j += k;
    else if (l) i += l;
    else {
      i += 1;
      j += 1;
    }
  }
  return { codes, matched };
}

/**
 * The object literal in a dictionary file, without running the file.
 *
 * @param {string} file
 */
async function readDictionary(file) {
  const text = await readFile(file, 'utf8');
  return JSON.parse(text.slice(text.indexOf('{', text.indexOf('*/')), text.lastIndexOf('}') + 1));
}

const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));
const usfmFiles = await readdir(usfmDir);
await mkdir(out, { recursive: true });

let words = 0;
let matched = 0;
let tagged = 0;
const loaderLines = [];

for (const { id } of books) {
  const file = usfmFiles.find((name) => name.slice(3, 6) === id && name.endsWith('.usfm'));
  if (!file) throw new Error(`No USFM file for ${id}`);
  const theirs = readUsfm(await readFile(path.join(usfmDir, file), 'utf8'), id);
  const ours = JSON.parse(await readFile(`app/data/kjv/${id}.json`, 'utf8'));

  /** @type {Record<string, string>} */
  const result = {};
  for (const chapter of ours.chapters) {
    for (const verse of chapter.verses) {
      let next = 1;
      const list = [];
      for (const block of verse.blocks) {
        for (const run of block.runs) {
          const split = tokenize(run.text, next);
          next = split.next;
          for (const token of split.tokens) if (token.w) list.push(normalize(token.text));
        }
      }
      const aligned = align(list, theirs.get(verse.id) ?? []);
      words += list.length;
      matched += aligned.matched;
      tagged += aligned.codes.filter((code) => code !== '-').length;
      result[verse.id] = aligned.codes.join(' ');
    }
  }
  await writeFile(path.join(out, `${id}.json`), JSON.stringify(result));
  loaderLines.push(`  '${id}': () => import('./${id}.json', { with: { type: 'json' } }),`);
}

const hebrew = await readDictionary(hebrewFile);
const greek = await readDictionary(greekFile);
/** @type {Record<string, { lemma: string, xlit: string, pron: string, def: string, kjv: string }>} */
const lexicon = {};
for (const [code, entry] of Object.entries(hebrew)) {
  lexicon[code] = {
    lemma: entry.lemma ?? '',
    xlit: entry.xlit ?? '',
    pron: entry.pron ?? '',
    def: (entry.strongs_def ?? '').trim(),
    kjv: (entry.kjv_def ?? '').trim(),
  };
}
for (const [code, entry] of Object.entries(greek)) {
  lexicon[code] = {
    lemma: entry.lemma ?? '',
    xlit: entry.translit ?? '',
    pron: entry.pron ?? '',
    def: (entry.strongs_def ?? '').trim(),
    kjv: (entry.kjv_def ?? '').trim(),
  };
}
await writeFile(path.join(out, 'lexicon.json'), JSON.stringify(lexicon));
await writeFile(
  path.join(out, 'index.js'),
  ['// Written by tools/import-strongs.js. Do not edit.', '', 'export const loaders = {', ...loaderLines, '};', ''].join('\n'),
);
await writeFile(
  path.join(out, 'source.json'),
  JSON.stringify(
    {
      numbers: {
        source: 'https://eBible.org/Scriptures/eng-kjv2006_usfm.zip',
        license: 'Public domain. Old Testament numbers from The Bible Foundation, New Testament from the KJV2003 Project.',
      },
      lexicon: {
        source: 'https://github.com/openscriptures/strongs',
        license: "CC BY-SA. Credit Open Scriptures, and share this dictionary data under the same license. Strong's 1890 and 1894 dictionaries are in the public domain.",
      },
    },
    null,
    2,
  ) + '\n',
);

const percent = (part) => `${((100 * part) / words).toFixed(1)}%`;
console.log(
  `${words} words: ${matched} matched to the eBible text (${percent(matched)}), ${tagged} with a Strong's number (${percent(tagged)}). ${Object.keys(lexicon).length} dictionary entries. Written to ${out}.`,
);
