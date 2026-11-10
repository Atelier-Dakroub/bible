#!/usr/bin/env node
// Word senses: for each Strong's number, the senses the word has, and the
// verses that use it in each.
//
//   node tools/import-senses.js <UBS dictionaries folder> <directory with STEPBible's TAHOT files> [output]
//
// Source: the United Bible Societies' dictionaries, from
// https://github.com/ubsicap/ubs-open-license ("dictionaries"), under CC BY-SA
// 4.0: the UBS Dictionary of the Greek New Testament (greek/JSON/
// UBSGreekNTDic-v1.1-en.JSON), which follows Louw and Nida's semantic
// domains, and the Semantic Dictionary of Biblical Hebrew (hebrew/JSON/
// UBSHebrewDic-v0.9.4-en.JSON). Each entry is a lemma with its Strong's
// numbers; each meaning has a short definition, glosses, a semantic domain,
// and every verse that uses the word in that meaning, as a code: book,
// chapter, verse and word, such as 04000101800050 (Matthew 1:18).
//
// The Hebrew dictionary numbers the verses as the Hebrew Bible does, and
// STEPBible's Hebrew gives both numbers where they differ, as
// Psa.45.1(45.2); the import turns them into the KJV's. The Greek numbers are
// the English ones.
//
// Definitions carry the dictionary's own links: {L:word<…>} is a word, {D:12.37}
// another meaning, {S:code} a verse. A word stays a word; a verse becomes its
// reference; a link to another meaning is left out.
//
// The output defaults to app/data/senses.json:
//   { source, license, senses: { "G4151": [{ lemma, gloss, def, domain, verses }] } }
// with `verses` the addresses of the verses, in canon order.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [folder, tahot, out = 'app/data/senses.json'] = process.argv.slice(2);
if (!folder || !tahot) {
  console.error('Usage: node tools/import-senses.js <UBS dictionaries folder> <directory with STEPBible\'s TAHOT files> [output]');
  process.exit(1);
}

/** @type {{ id: string, name: string, verses: number[] }[]} */
const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));

// The Hebrew Bible's verse numbers to the KJV's, where they differ.
/** @type {Map<string, string>} */
const english = new Map();
for (const name of (await readdir(tahot)).filter((each) => /^TAHOT.*\.txt$/.test(each))) {
  const text = await readFile(path.join(tahot, name), 'utf8');
  for (const [, book, chapter, verse, hebrewChapter, hebrewVerse] of text.matchAll(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)\((\d+)\.(\d+)\)/gm)) {
    const key = `${book.toUpperCase()}.${hebrewChapter}.${hebrewVerse}`;
    if (!english.has(key)) english.set(key, `${book.toUpperCase()}.${chapter}.${verse}`);
  }
}

let dropped = 0;

/**
 * A verse code, such as 04000101800050, as an address in the KJV's numbers,
 * or ''.
 *
 * @param {string} code
 */
function addressOf(code) {
  const book = books[Number(code.slice(0, 3)) - 1];
  if (!book) return '';
  const chapter = Number(code.slice(3, 6));
  const verse = Number(code.slice(6, 9));
  const address = english.get(`${book.id}.${chapter}.${verse}`) ?? `${book.id}.${chapter}.${verse}`;
  const [, c, v] = address.split('.').map(Number);
  if (!book.verses[c - 1] || v < 1 || v > book.verses[c - 1]) {
    dropped += 1;
    return '';
  }
  return address;
}

/** A definition without the dictionary's links. @param {string} text */
function clean(text) {
  return text
    .replace(/\{L:([^<}]+)<[^>]*>\}/g, '$1')
    .replace(/\{S:(\d{9,})\}/g, (_, code) => {
      const address = addressOf(code);
      if (!address) return '';
      const [id, chapter, verse] = address.split('.');
      return `${books.find((book) => book.id === id)?.name ?? id} ${chapter}:${verse}`;
    })
    .replace(/,?\s*\{D:[^}]*\}/g, '')
    .replace(/\[[a-z]\]/g, '')
    .replace(/^=\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .trim();
}

/** @type {Record<string, { lemma: string, gloss: string, def: string, domain: string, verses: string[] }[]>} */
const senses = {};
let senseCount = 0;
let verseCount = 0;
for (const [file, language] of [
  ['greek/JSON/UBSGreekNTDic-v1.1-en.JSON', 'G'],
  ['hebrew/JSON/UBSHebrewDic-v0.9.4-en.JSON', 'H'],
]) {
  /** @type {any[]} */
  const entries = JSON.parse(await readFile(path.join(folder, file), 'utf8'));
  for (const entry of entries) {
    const codes = (entry.StrongCodes ?? [])
      .map((/** @type {string} */ code) => /^([GH])0*(\d+)/.exec(code))
      .filter(Boolean)
      .map((/** @type {RegExpExecArray} */ match) => `${match[1]}${match[2]}`)
      .filter((/** @type {string} */ code) => code.startsWith(language));
    if (!codes.length) continue;
    for (const base of entry.BaseForms ?? []) {
      for (const meaning of base.LEXMeanings ?? []) {
        const sense = meaning.LEXSenses?.find((/** @type {any} */ each) => each.LanguageCode === 'en') ?? meaning.LEXSenses?.[0];
        if (!sense) continue;
        const verses = [...new Set((meaning.LEXReferences ?? []).map(addressOf).filter(Boolean))];
        if (!verses.length) continue;
        const domain = (meaning.LEXDomains ?? []).map((/** @type {any} */ each) => each.Domain).filter(Boolean)[0] ?? '';
        const each = { lemma: entry.Lemma, gloss: (sense.Glosses ?? []).filter(Boolean).join(', '), def: clean(sense.DefinitionShort ?? ''), domain, verses };
        for (const code of codes) (senses[code] ??= []).push(each);
        senseCount += 1;
        verseCount += verses.length;
      }
    }
  }
}

await writeFile(
  out,
  `${JSON.stringify({
    source: "United Bible Societies: the UBS Dictionary of the Greek New Testament (after Louw and Nida's semantic domains) and the Semantic Dictionary of Biblical Hebrew, from https://github.com/ubsicap/ubs-open-license",
    license: '© United Bible Societies, CC BY-SA 4.0',
    senses,
  })}\n`,
);
console.log(`${Object.keys(senses).length} Strong's numbers, ${senseCount} senses, ${verseCount} verses written to ${out}; ${dropped} references to verses the KJV does not number left out.`);
