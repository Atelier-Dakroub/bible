// Reads a SWORD commentary module (zCom or zCom4), as CrossWire publishes
// them, with nothing but Node's zlib. Used by tools/import-commentaries.js.
//
// A module keeps each testament in three files:
//
//   <t>.bzs  the blocks: for each, its offset and size in .bzz, and its size
//            unpacked (three 32-bit numbers)
//   <t>.bzv  the verses: for each, its block, its offset in the unpacked
//            block, and its size (32 + 32 + 16 bits; zCom4 has 32 for the size)
//   <t>.bzz  the blocks, each packed with zlib
//
// A module whose blocks are chapters (BlockType=CHAPTER) names them .czs,
// .czv and .czz. The verses are in the order of the module's versification,
// with a heading entry before each book and each chapter, and two before the
// first book: the module's and the testament's. Every module here is in the
// KJV's versification, the one app/data/kjv/books.json counts.
//
// A comment on a range of verses is written once: the verses after the first
// point at the same place.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

/** The books of each testament in the KJV versification, by app id. */
export const NT_FIRST = 'MAT';

/**
 * Where each verse of a testament is in its verse index.
 *
 * @param {{ id: string, verses: number[] }[]} books the testament's, in order
 * @returns {Map<string, number>} JHN.3.16 to its entry
 */
export function verseIndex(books) {
  const index = new Map();
  let at = 2; // the module's heading, then the testament's
  for (const book of books) {
    at += 1; // the book's heading
    book.verses.forEach((count, i) => {
      at += 1; // the chapter's heading
      for (let verse = 1; verse <= count; verse += 1) index.set(`${book.id}.${i + 1}.${verse}`, at++);
    });
  }
  return index;
}

/**
 * One testament of a module: the text of each verse's entry, and where it is,
 * so that a range written once can be found.
 *
 * @param {string} dir the module's data folder
 * @param {'ot' | 'nt'} testament
 * @param {boolean} wide whether a verse's size is 32 bits (zCom4)
 * @returns {{ entry: (n: number) => { key: string, text: string } | null } | null}
 */
export function openTestament(dir, testament, wide) {
  // The verse index decides: a chapter module may carry a stray .bzs too.
  const letter = existsSync(path.join(dir, `${testament}.bzv`)) ? 'b' : 'c';
  const file = (ext) => path.join(dir, `${testament}.${letter}${ext}`);
  if (!existsSync(file('zs'))) return null;
  const blocks = readFileSync(file('zs'));
  const verses = readFileSync(file('zv'));
  const packed = readFileSync(file('zz'));
  const width = wide ? 12 : 10;
  /** @type {Map<number, Buffer>} */
  const unpacked = new Map();

  /** @param {number} n */
  const block = (n) => {
    let found = unpacked.get(n);
    if (!found) {
      const offset = blocks.readUInt32LE(n * 12);
      const size = blocks.readUInt32LE(n * 12 + 4);
      found = inflateSync(packed.subarray(offset, offset + size));
      unpacked.set(n, found);
    }
    return found;
  };

  return {
    entry(n) {
      if ((n + 1) * width > verses.length) return null;
      const number = verses.readUInt32LE(n * width);
      const offset = verses.readUInt32LE(n * width + 4);
      const size = wide ? verses.readUInt32LE(n * width + 8) : verses.readUInt16LE(n * width + 8);
      if (!size) return null;
      return { key: `${number}:${offset}:${size}`, text: block(number).subarray(offset, offset + size).toString('utf8') };
    },
  };
}
