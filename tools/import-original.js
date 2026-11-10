#!/usr/bin/env node
// Builds the Hebrew and Greek text, word by word, from STEPBible's
// Translators Amalgamated texts.
//
//   node tools/import-original.js <directory with the TAHOT, TAGNT, TEHMC and TEGMC files> [output directory]
//
// Source: STEPBible.org, from Tyndale House, Cambridge (CC BY 4.0):
// https://github.com/STEPBible/STEPBible-Data, the folders "Translators
// Amalgamated OT+NT" (TAHOT Gen-Deu, Jos-Est, Job-Sng, Isa-Mal; TAGNT
// Mat-Jhn, Act-Rev) and "Morphology codes" (TEHMC, TEGMC).
//
// The output defaults to app/data/original:
//   <BOOK>.json   { "GEN.1.1": [word, ...] }, each word
//                 [text, transliteration, gloss, Strong's, grammar code, flag]
//   grammar.json  { code: "Verb · Qal · Perfect · ..." }, each grammar code
//                 that the words use, in words
//   source.json   where it came from, and its licence
//
// Choices:
//   - Verses are numbered as in English Bibles (STEPBible gives another
//     numbering after it, as Gen.31.55(32.1)), so they match the KJV's.
//   - Hebrew: the Leningrad text, with the Qere where the margin corrects
//     the text, and the restored verses of Joshua 21 and Nehemiah 7. The
//     words that come only from the Septuagint (type X) are left out.
//   - Greek: the text the KJV translated, the Textus Receptus (words of type
//     K or k). A word that the critical text (Nestle-Aland) does not have has
//     the flag 1, so a card can say so.
//   - Strong's numbers are written as the KJV data writes them, H430 not
//     H0430G, so the original word and the English words that render it
//     match. A Hebrew word is often several parts (and/ the/ earth); its
//     number is the main part's, the one in braces.
//   - The gloss is STEPBible's English for the word in its place, with the
//     slashes between the parts taken out.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [source, out = 'app/data/original'] = process.argv.slice(2);
if (!source) {
  console.error('Usage: node tools/import-original.js <directory with the STEPBible files> [output directory]');
  process.exit(1);
}

const files = await readdir(source);
/** @param {string} prefix */
const named = (prefix) => files.filter((name) => name.startsWith(prefix)).map((name) => path.join(source, name));

/** @param {string} code such as H0430G or G0976 */
function strongs(code) {
  const match = /^([HG])0*(\d+)/.exec(code);
  return match ? `${match[1]}${match[2]}` : '';
}

/** @type {Map<string, Record<string, (string | number)[][]>>} */
const books = new Map();

// Verses the KJV does not number: their words are in the verse the KJV
// prints them in. The Greek of 3 John 1:15 ends 3 John 1:14 in the KJV, and
// Revelation 12:18 begins Revelation 13:1.
/** @type {Record<string, string>} */
const JOINED = { '3JN.1.15': '3JN.1.14', 'REV.12.18': 'REV.13.1' };
/** @type {Set<string>} */
const codesUsed = new Set();

/**
 * @param {string} ref such as Gen.1.1, or with another numbering after it:
 *   Gen.31.55(32.1), Jhn.7.53{8.1}, Php.1.16[1.17]
 * @returns {{ book: string, verse: string }}
 */
function verseOf(ref) {
  // A number in square brackets is the KJV's own, where the KJV numbers the
  // verse differently from the English-numbered ref before it.
  const kjv = /\[([\d.]+)\]/.exec(ref)?.[1];
  const [book, chapter, verse] = ref.replace(/[({[].*$/, '').split('.');
  const id = book.toUpperCase();
  const address = kjv ? `${id}.${kjv}` : `${id}.${chapter}.${verse}`;
  return { book: id, verse: JOINED[address] ?? address };
}

/**
 * @param {string} book
 * @param {string} verse
 * @param {(string | number)[]} word
 */
function add(book, verse, word) {
  const verses = books.get(book) ?? {};
  (verses[verse] ??= []).push(word);
  books.set(book, verses);
}

// ---- Hebrew ----
for (const file of named('TAHOT')) {
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    const cells = line.split('\t');
    const head = /^([1-3A-Z][A-Za-z0-9]{2}\.\d+\.\d+(?:[({[][\d.]+[)}\]])?)#\d+=(\S+)/.exec(cells[0]);
    if (!head || head[2].startsWith('X')) continue;
    const [, ref] = head;
    const [, hebrew, translit, gloss, dstrongs, grammar] = cells;
    const { book, verse } = verseOf(ref);
    const main = /\{([^}]+)\}/.exec(dstrongs)?.[1] ?? dstrongs.split(/[/\\]/)[0];
    // The grammar names the language once, at its start (H or A), and then
    // each part; the code list has each part with the language.
    const language = grammar[0];
    for (const part of grammar.slice(1).split('/')) if (part) codesUsed.add(`${language}${part}`);
    add(book, verse, [
      hebrew.replace(/[/\\]/g, ''),
      translit.replace(/\//g, ''),
      gloss.replace(/\/\s*/g, ' ').replace(/\s+/g, ' ').trim(),
      strongs(main),
      grammar,
      0,
    ]);
  }
}

// ---- Greek ----
for (const file of named('TAGNT')) {
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    const cells = line.split('\t');
    const head = /^([1-3A-Z][A-Za-z0-9]{2}\.\d+\.\d+(?:[({[][\d.]+[)}\]])?)#\d+=(\S+)/.exec(cells[0]);
    if (!head || !/k/i.test(head[2])) continue;
    const [, ref, type] = head;
    const [, greekCell, gloss, tagged] = cells;
    const [, greek = '', translit = ''] = /^(.*?)\s*\((.*)\)\s*$/.exec(greekCell) ?? [, greekCell, ''];
    const [code = '', grammar = ''] = tagged.split('=');
    const { book, verse } = verseOf(ref);
    codesUsed.add(grammar);
    add(book, verse, [greek, translit, gloss.trim(), strongs(code), grammar, /n/i.test(type) ? 0 : 1]);
  }
}

// ---- Grammar codes, in words ----
/** @type {Record<string, string>} */
const grammar = {};
/**
 * "Function=Verb ; Stem=Qal (hence Action=Simple; ...); Form=Perfect (...)"
 * to "Verb · Qal · Perfect · ...": the values, without the notes in
 * brackets, and without "Either gender".
 *
 * @param {string} text
 */
function words(text) {
  return text
    .replace(/\([^)]*\)/g, '')
    .split(';')
    .map((pair) => pair.split('=')[1]?.trim() ?? '')
    .filter((value) => value && !/^either gender$/i.test(value) && value !== '-')
    .join(' · ');
}
for (const file of [...named('TEHMC'), ...named('TEGMC')]) {
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    const [code, text] = line.split('\t');
    if (!code || !text || !codesUsed.has(code.trim()) || !/Function=/.test(text)) continue;
    grammar[code.trim()] ??= words(text);
  }
}

await mkdir(out, { recursive: true });
let count = 0;
for (const [book, verses] of books) {
  await writeFile(path.join(out, `${book}.json`), JSON.stringify(verses));
  count += Object.values(verses).reduce((sum, list) => sum + list.length, 0);
}
await writeFile(path.join(out, 'grammar.json'), JSON.stringify(grammar));
await writeFile(
  path.join(out, 'source.json'),
  `${JSON.stringify(
    {
      name: 'STEPBible Translators Amalgamated Hebrew OT (TAHOT) and Greek NT (TAGNT), with the morphology code expansions (TEHMC, TEGMC)',
      source: 'https://github.com/STEPBible/STEPBible-Data',
      license: 'CC BY 4.0. Data created by STEPBible.org based on work at Tyndale House, Cambridge.',
      note: 'Hebrew: the Leningrad text with the Qere. Greek: the Textus Receptus, the text the KJV translated; flag 1 marks a word the Nestle-Aland text does not have.',
    },
    null,
    2,
  )}\n`,
);
const missing = [...codesUsed].filter((code) => !grammar[code]);
console.log(`${books.size} books, ${count} words, ${Object.keys(grammar).length} grammar codes (${missing.length} without words: ${missing.slice(0, 8).join(' ')}). Written to ${out}.`);
