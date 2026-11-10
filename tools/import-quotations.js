#!/usr/bin/env node
// The Old Testament in the New: the quotations Nestle's Greek New Testament
// (1904) prints in bold, each with the passages it quotes.
//
//   node tools/import-quotations.js <directory with the Nestle1904 TEI files> [output]
//
// Source: MACULA Greek (https://github.com/Clear-Bible/macula-greek), the
// folder Nestle1904/tei, © Biblica, under CC BY 4.0; the Nestle 1904 text
// itself is in the public domain. Each quotation is a <q ref="…"> around
// the Greek words that quote, and its ref is Nestle's margin: such as
// "Hab.2,4." or "Ps.14,1—3;53,2—4. Is.59,7—8.".
//
// Nestle marks quotations, not allusions: this is the Old Testament quoted,
// as one edition saw it. The markup does not cover every book yet: the
// output lists the books it covers (`covered`), so the app can say where
// it has no data. A pair that is plainly wrong in the markup is left out
// (WRONG, below). A reference to a book the KJV does not have (the
// Wisdom of Solomon, 1 Maccabees) is left out, and so is one to a verse
// the KJV does not number.
//
// The output defaults to app/data/quotations.json:
//   { source, license, quotations: [{ nt: address, ot: [address], greek: string }] }
// with addresses as the app writes them: ROM.1.17, PSA.14.1-3.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [source, out = 'app/data/quotations.json'] = process.argv.slice(2);
if (!source) {
  console.error('Usage: node tools/import-quotations.js <directory with the Nestle1904 TEI files> [output]');
  process.exit(1);
}

const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));
/** @type {Map<string, number[]>} */
const counts = new Map(books.map((/** @type {{ id: string, verses: number[] }} */ book) => [book.id, book.verses]));

// Nestle's abbreviations of the books of the Old Testament.
/** @type {Record<string, string>} */
const BOOKS = {
  Gn: 'GEN', G: 'GEN', Ex: 'EXO', Lv: 'LEV', Nu: 'NUM', Dt: 'DEU', Jos: 'JOS', Jg: 'JDG', Rt: 'RUT',
  '1S': '1SA', '2S': '2SA', '1K': '1KI', '2K': '2KI', '2k': '2KI', '1Ch': '1CH', '2Ch': '2CH', Esr: 'EZR', Neh: 'NEH', Est: 'EST',
  Job: 'JOB', Ps: 'PSA', Pr: 'PRO', Ec: 'ECC', Ct: 'SNG', Is: 'ISA', Jer: 'JER', Lam: 'LAM', Ezk: 'EZK', Dn: 'DAN',
  Hos: 'HOS', Jl: 'JOL', Am: 'AMO', Ob: 'OBA', Jon: 'JON', Mic: 'MIC', Nah: 'NAM', Hab: 'HAB', Zeph: 'ZEP', Hg: 'HAG',
  Zec: 'ZEC', Mal: 'MAL',
};
// Pairs the markup has plainly wrong: a New Testament verse, and the
// reference that does not belong to it. Romans 1:23 does not quote
// Habakkuk 2:4 (two of its words carry Romans 1:17's reference).
/** @type {[string, string][]} */
const WRONG = [['ROM.1.23', 'HAB.2.4']];

// Books the KJV does not have.
const APOCRYPHA = new Set(['Sap', '1Mc', '2Mc', 'Sir', 'Tob', 'Jdt', 'Bar']);

/** @type {Set<string>} */
const unknown = new Set();
let dropped = 0;

/**
 * Nestle's margin to addresses: "Ps.132,17;18,2. Is.59,7—8." to PSA.132.17,
 * PSA.18.2 and ISA.59.7-8. "ss" (and following) and "(LXX)" are dropped.
 *
 * @param {string} ref
 * @returns {string[]}
 */
function addresses(ref) {
  const found = [];
  const text = ref.replace(/\(LXX\)/g, '').replace(/ss\b/g, '').replace(/–/g, '—');
  // One part for each book: its name, then its chapters and verses. A part
  // begins where a name begins, such as the 1 of 1S.
  for (const chunk of text.trim().split(/\s+(?=[1-4]?[A-Za-z])/)) {
    const match = /^([1-4]?[A-Za-z]+)[.,]?\s*([\d,.;—\s]*)/.exec(chunk);
    if (!match) continue;
    const [, name, rest] = match;
    if (APOCRYPHA.has(name)) continue;
    const book = BOOKS[name];
    if (!book) {
      unknown.add(name);
      continue;
    }
    for (const part of rest.split(';')) {
      const [chapterText, versesText = ''] = part.trim().split(',');
      const chapter = Number(chapterText);
      const last = counts.get(book)?.[chapter - 1];
      if (!chapter || !last) {
        if (part.trim()) dropped += 1;
        continue;
      }
      for (const piece of versesText.split('.').map((each) => each.trim()).filter(Boolean)) {
        const [from, to] = piece.split('—').map(Number);
        if (!from || from > last) {
          dropped += 1;
          continue;
        }
        const end = to && to > from ? Math.min(to, last) : 0;
        found.push(end ? `${book}.${chapter}.${from}-${end}` : `${book}.${chapter}.${from}`);
      }
    }
  }
  return [...new Set(found)];
}

/** "ROM 1:17!13" to ROM.1.17. @param {string} ref */
const verseOf = (ref) => {
  const match = /^(\w+) (\d+):(\d+)/.exec(ref);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : '';
};

/** The NT verses a quotation runs over, as one address. @param {string[]} verses */
function span(verses) {
  const first = verses[0];
  const last = verses[verses.length - 1];
  if (first === last) return first;
  const [book, chapter, verse] = first.split('.');
  const [, endChapter, endVerse] = last.split('.');
  return endChapter === chapter ? `${book}.${chapter}.${verse}-${endVerse}` : `${book}.${chapter}.${verse}-${endChapter}.${endVerse}`;
}

/** @type {Map<string, { nt: string, ot: string[], greek: string }>} */
const quotations = new Map();
/** @type {Set<string>} the books the markup marks quotations in */
const covered = new Set();
const files = (await readdir(source)).filter((name) => /^\d\d-.*\.xml$/.test(name)).sort();
for (const file of files) {
  const xml = await readFile(path.join(source, file), 'utf8');
  for (const match of xml.matchAll(/<q ref="([^"]*)"[^>]*>([\s\S]*?)<\/q>/g)) {
    const [, ref, inside] = match;
    const words = [...inside.matchAll(/<w [^>]*ref="([^"]+)"[^>]*>([^<]*)<\/w>/g)];
    if (!words.length) continue;
    const verses = [...new Set(words.map(([, wordRef]) => verseOf(wordRef)).filter(Boolean))];
    const ot = addresses(ref).filter((each) => !WRONG.some(([nt, wrong]) => verses.includes(nt) && each === wrong));
    if (!ot.length || !verses.length) continue;
    const nt = span(verses);
    covered.add(nt.split('.')[0]);
    const greek = words.map(([, , word]) => word).join(' ');
    // A quotation broken by a word of the writer's is one quotation.
    const key = `${verses[0]}|${ot.join(' ')}`;
    const before = quotations.get(key);
    if (before) {
      before.greek += ` … ${greek}`;
      before.nt = span([before.nt.split('-')[0], verses[verses.length - 1]]);
    } else quotations.set(key, { nt, ot, greek });
  }
}

await writeFile(
  out,
  `${JSON.stringify(
    {
      source: "Nestle's Greek New Testament (1904): the quotations it prints in bold, with its margin's references; as marked up in MACULA Greek (https://github.com/Clear-Bible/macula-greek)",
      license: 'MACULA Greek © Biblica, CC BY 4.0; the Nestle 1904 text is in the public domain',
      covered: books.map((/** @type {{ id: string }} */ book) => book.id).filter((/** @type {string} */ id) => covered.has(id)),
      quotations: [...quotations.values()],
    },
    null,
    1,
  )}\n`,
);
console.log(`${quotations.size} quotations written to ${out}; ${dropped} references to verses the KJV does not number left out${unknown.size ? `; unknown books: ${[...unknown].join(', ')}` : ''}.`);
