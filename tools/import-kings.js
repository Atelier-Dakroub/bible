#!/usr/bin/env node
// The reigns of the kings of Israel and Judah by four modern chronologies,
// beside Jones's, which Theographic follows.
//
//   node tools/import-kings.js <saved API answer> [output]
//
// Source: Wikipedia, "Kings of Israel and Judah" (CC BY-SA 4.0), whose
// tables give each reign by Albright, Thiele, Galil and Kitchen. The page is
// fetched once, as wikitext, through Wikipedia's API:
//   https://en.wikipedia.org/w/api.php?action=parse&page=Kings_of_Israel_and_Judah&prop=wikitext&format=json&formatversion=2
//
// The output defaults to app/data/chronology/kings.json:
//   { source, license, chronologies: { key: name }, reigns: { event id: { key: [start, end] } } }
// in astronomical years (931 BC is -930), for Theographic's "Reign of …"
// events. A chronology that gives no date for a reign is left out of it.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [source, out = 'app/data/chronology/kings.json'] = process.argv.slice(2);
if (!source) {
  console.error('Usage: node tools/import-kings.js <saved API answer> [output]');
  process.exit(1);
}

const KEYS = ['albright', 'thiele', 'galil', 'kitchen'];
const NAMES = { albright: 'Albright', thiele: 'Thiele', galil: 'Galil', kitchen: 'Kitchen' };

// Theographic's reign events, and the kingdom and name of the same king in
// Wikipedia's tables. Written by hand: the names differ (Abijam is Abijah,
// Jeconiah is Jehoiachin), and some are in both kingdoms (Ahaziah,
// Jehoahaz, Jehoash).
/** @type {Record<string, [string, string]>} */
const EVENTS = {
  'event:159': ['united', 'David'],
  'event:161': ['united', 'Solomon'],
  'event:165': ['united', 'Rehoboam'],
  'event:167': ['israel', 'Jeroboam I'],
  'event:168': ['judah', 'Abijah'],
  'event:170': ['judah', 'Asa'],
  'event:171': ['israel', 'Nadab'],
  'event:172': ['israel', 'Baasha'],
  'event:173': ['israel', 'Elah'],
  'event:174': ['israel', 'Zimri'],
  'event:175': ['israel', 'Tibni'],
  'event:176': ['israel', 'Omri'],
  'event:178': ['israel', 'Ahab'],
  'event:181': ['judah', 'Jehoshaphat'],
  'event:184': ['israel', 'Ahaziah'],
  'event:187': ['israel', 'Joram'],
  'event:188': ['judah', 'Jehoram'],
  'event:189': ['judah', 'Ahaziah'],
  'event:190': ['israel', 'Jehu'],
  'event:191': ['judah', 'Athaliah'],
  'event:193': ['judah', 'Jehoash'],
  'event:195': ['israel', 'Jehoahaz'],
  'event:197': ['israel', 'Jehoash'],
  'event:198': ['judah', 'Amaziah'],
  'event:199': ['israel', 'Jeroboam II'],
  'event:204': ['judah', 'Uzziah'],
  'event:208': ['israel', 'Zachariah'],
  'event:209': ['israel', 'Shallum'],
  'event:212': ['israel', 'Menahem'],
  'event:214': ['israel', 'Pekahiah'],
  'event:216': ['israel', 'Pekah'],
  'event:219': ['judah', 'Jotham'],
  'event:221': ['judah', 'Ahaz'],
  'event:224': ['israel', 'Hoshea'],
  'event:226': ['judah', 'Hezekiah'],
  'event:228': ['judah', 'Manasseh'],
  'event:231': ['judah', 'Amon'],
  'event:233': ['judah', 'Josiah'],
  'event:237': ['judah', 'Jehoahaz'],
  'event:238': ['judah', 'Jehoiakim'],
  'event:241': ['judah', 'Jehoiachin'],
  'event:242': ['judah', 'Zedekiah'],
};

/** @param {string} heading */
function kingdomOf(heading) {
  if (/united monarchy/i.test(heading)) return 'united';
  if (/Kingdom of Israel/i.test(heading)) return 'israel';
  if (/Kingdom of Judah/i.test(heading)) return 'judah';
  return '';
}

/**
 * "931–913", "885", "735/31–715" or "–" to [start, end] in astronomical
 * years, or null.
 *
 * @param {string} cell
 * @returns {[number, number] | null}
 */
function reign(cell) {
  const years = [...cell.replace(/<[^>]*>|&nbsp;|BCE|\s/g, '').matchAll(/(\d+)(?:\/\d+)?/g)].map((match) => Number(match[1]));
  if (!years.length) return null;
  const [from, to = from] = years;
  return [1 - from, 1 - to];
}

const { parse } = JSON.parse(await readFile(source, 'utf8'));
/** @type {string} */
const text = parse.wikitext;
const headings = [...text.matchAll(/^==([^=].*?)==\s*$/gm)].map((match) => ({ at: match.index ?? 0, title: match[1].trim() }));

/** @type {Map<string, Record<string, [number, number]>>} kingdom and name to its reigns */
const found = new Map();
for (const table of text.matchAll(/\{\|([\s\S]*?)\n\|\}/g)) {
  if (!table[1].includes('Thiele')) continue;
  const heading = headings.filter((each) => each.at < (table.index ?? 0)).at(-1)?.title ?? '';
  const kingdom = kingdomOf(heading);
  for (const row of table[1].split('\n|-').slice(1)) {
    const cells = `\n${row.slice(row.indexOf('\n') + 1)}`.split(/\n\|(?!-)/).slice(1);
    if (cells.length < 5) continue;
    const name = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(cells[4]);
    if (!name) continue;
    /** @type {Record<string, [number, number]>} */
    const reigns = {};
    KEYS.forEach((key, i) => {
      const years = reign(cells[i]);
      if (years) reigns[key] = years;
    });
    found.set(`${kingdom}:${(name[2] ?? name[1]).trim()}`, reigns);
  }
}

/** @type {Record<string, Record<string, [number, number]>>} */
const reigns = {};
const missing = [];
for (const [id, [kingdom, name]] of Object.entries(EVENTS)) {
  const each = found.get(`${kingdom}:${name}`);
  if (each && Object.keys(each).length) reigns[id] = each;
  else missing.push(`${id} ${kingdom}:${name}`);
}

await mkdir(path.dirname(out), { recursive: true });
await writeFile(
  out,
  `${JSON.stringify(
    {
      source: 'Wikipedia, "Kings of Israel and Judah", the tables of reigns by Albright, Thiele, Galil and Kitchen',
      url: 'https://en.wikipedia.org/wiki/Kings_of_Israel_and_Judah',
      license: 'CC BY-SA 4.0',
      chronologies: NAMES,
      reigns,
    },
    null,
    1,
  )}\n`,
);
console.log(`${Object.keys(reigns).length} reigns written to ${out}${missing.length ? `; not found: ${missing.join(', ')}` : ''}.`);
