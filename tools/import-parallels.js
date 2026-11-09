#!/usr/bin/env node
// Finds parallel passages in the cross-references, and writes them to one file.
//
//   node tools/import-parallels.js [output file]
//
// The input is app/data/xrefs (tools/import-xrefs.js), so nothing is
// downloaded. The output defaults to app/data/parallels.json.
//
// A cross-reference joins one verse to another. A parallel passage shows as a
// run of them: verse after verse of one passage refers to verse after verse
// of another, in the same order. That is how Kings and Chronicles, the
// Synoptic Gospels, 2 Samuel 22 and Psalm 18 show. One verse that quotes
// another is not a run, so quotations are not found here; that needs a
// dataset that classifies them.
//
// The rules, in order:
//   1. Every reference is a pair of verses (a range gives one pair per verse
//      of it, up to RANGE verses).
//   2. A chain is a list of pairs between two books where each next pair is a
//      step forward on both sides: at most STEP_FROM verses on the first
//      side, at most STEP_TO verses on the second.
//   3. A chain of at least MIN_PAIRS pairs that covers at least MIN_VERSES
//      verses on each side is a parallel.
//   4. Parallels between the same two books that overlap, or nearly meet,
//      join into one.
//   5. Two passages of one book must be at least APART verses apart: closer
//      than that, a run is mostly a passage that repeats its own words.
// Each parallel is kept once, as [a, b, pairs] with a before b in canon order.
// `pairs` is how many references the run holds: the more, the surer.

import { readFile, readdir, writeFile } from 'node:fs/promises';

const [out = 'app/data/parallels.json'] = process.argv.slice(2);

const RANGE = 6;
const STEP_FROM = 2;
const STEP_TO = 3;
const MIN_PAIRS = 3;
const MIN_VERSES = 3;
const JOIN = 3;
const APART = 10;

/** @type {{ id: string, verses: number[] }[]} */
const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));

// Every verse has a number in canon order, so a step forward is a sum.
/** @type {Map<string, number>} */
const ordinal = new Map();
/** @type {{ book: string, chapter: number, verse: number }[]} */
const byOrdinal = [];
for (const book of books) {
  book.verses.forEach((count, c) => {
    for (let v = 1; v <= count; v += 1) {
      ordinal.set(`${book.id}.${c + 1}.${v}`, byOrdinal.length);
      byOrdinal.push({ book: book.id, chapter: c + 1, verse: v });
    }
  });
}

/**
 * The verses of a target address, such as `PRO.8.22-30` or `GEN.1.1`.
 *
 * @param {string} address
 */
function versesOf(address) {
  const [base, end] = address.split('-');
  const first = ordinal.get(base);
  if (first === undefined) return [];
  if (!end) return [first];
  const [book, chapter] = base.split('.');
  const last = ordinal.get(end.includes('.') ? `${book}.${end}` : `${book}.${chapter}.${end}`);
  if (last === undefined || last < first) return [first];
  const found = [];
  for (let at = first; at <= Math.min(last, first + RANGE - 1); at += 1) found.push(at);
  return found;
}

// 1. Pairs, grouped by the two books, both ways round: each reference is
// read from its source.
/** @type {Map<string, [number, number][]>} */
const pairs = new Map();
for (const file of await readdir('app/data/xrefs')) {
  if (!/^[1-3]?[A-Z]{2,3}\.json$/.test(file)) continue;
  /** @type {Record<string, [string, number][]>} */
  const refs = JSON.parse(await readFile(`app/data/xrefs/${file}`, 'utf8'));
  for (const [source, list] of Object.entries(refs)) {
    const from = ordinal.get(source);
    if (from === undefined) continue;
    for (const [target] of list) {
      for (const to of versesOf(target)) {
        if (Math.abs(to - from) < MIN_VERSES * 2) continue;
        const key = `${byOrdinal[from].book}|${byOrdinal[to].book}`;
        const list2 = pairs.get(key) ?? [];
        list2.push([from, to]);
        pairs.set(key, list2);
      }
    }
  }
}

// 2 and 3. Chains.
/** @type {{ a: [number, number], b: [number, number], n: number }[]} */
const found = [];
for (const list of pairs.values()) {
  list.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const used = new Set();
  for (let i = 0; i < list.length; i += 1) {
    if (used.has(i)) continue;
    const chain = [i];
    let [from, to] = list[i];
    for (let j = i + 1; j < list.length && list[j][0] <= from + STEP_FROM; j += 1) {
      const [nextFrom, nextTo] = list[j];
      if (used.has(j) || nextFrom <= from || nextTo <= to || nextTo > to + STEP_TO) continue;
      chain.push(j);
      from = nextFrom;
      to = nextTo;
    }
    if (chain.length < MIN_PAIRS) continue;
    const first = list[chain[0]];
    const last = list[chain[chain.length - 1]];
    if (last[0] - first[0] + 1 < MIN_VERSES || last[1] - first[1] + 1 < MIN_VERSES) continue;
    for (const k of chain) used.add(k);
    found.push({ a: [first[0], last[0]], b: [first[1], last[1]], n: chain.length });
  }
}

// Each parallel once, the earlier passage first.
const ordered = found.map(({ a, b, n }) => (a[0] <= b[0] ? { a, b, n } : { a: b, b: a, n }));

// 4. Join the ones between the same passages that overlap or nearly meet.
ordered.sort((x, y) => x.a[0] - y.a[0] || x.b[0] - y.b[0]);
/** @type {{ a: [number, number], b: [number, number], n: number }[]} */
const joined = [];
for (const each of ordered) {
  const near = joined.find(
    (kept) =>
      byOrdinal[kept.a[0]].book === byOrdinal[each.a[0]].book &&
      byOrdinal[kept.b[0]].book === byOrdinal[each.b[0]].book &&
      each.a[0] <= kept.a[1] + JOIN &&
      each.a[1] >= kept.a[0] - JOIN &&
      each.b[0] <= kept.b[1] + JOIN &&
      each.b[1] >= kept.b[0] - JOIN,
  );
  if (near) {
    near.a = [Math.min(near.a[0], each.a[0]), Math.max(near.a[1], each.a[1])];
    near.b = [Math.min(near.b[0], each.b[0]), Math.max(near.b[1], each.b[1])];
    near.n += each.n;
  } else {
    joined.push({ a: [...each.a], b: [...each.b], n: each.n });
  }
}

/**
 * Two verse ordinals to an address, such as `MAT.3.1-17` or `GEN.1.1-2.3`.
 * A range that would run into another book stops at the end of the first.
 *
 * @param {[number, number]} range
 */
function address([first, last]) {
  const start = byOrdinal[first];
  let end = byOrdinal[last];
  if (end.book !== start.book) {
    let at = last;
    while (byOrdinal[at].book !== start.book) at -= 1;
    end = byOrdinal[at];
  }
  const base = `${start.book}.${start.chapter}.${start.verse}`;
  if (first === last) return base;
  return end.chapter === start.chapter ? `${base}-${end.verse}` : `${base}-${end.chapter}.${end.verse}`;
}

// 5. A passage and its own echo a few verses on are left out.
const apart = joined.filter(({ a, b }) => byOrdinal[a[0]].book !== byOrdinal[b[0]].book || b[0] - a[1] >= APART);

const result = apart
  .sort((x, y) => x.a[0] - y.a[0] || x.b[0] - y.b[0])
  .map(({ a, b, n }) => [address(a), address(b), n]);

await writeFile(out, `${JSON.stringify(result)}\n`);
console.log(`${result.length} parallels written to ${out}`);
