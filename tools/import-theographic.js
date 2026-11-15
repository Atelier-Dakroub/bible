#!/usr/bin/env node
// Converts Theographic Bible Metadata into the entity layer: people, places,
// groups and events, the verses that name them, and Easton's dictionary.
//
//   node tools/import-theographic.js <directory with Theographic's json files> [output directory]
//
// Source: github.com/robertrouse/theographic-bible-metadata, json/ folder:
// verses, people, places, peopleGroups, events and easton. CC BY-SA 4.0: credit
// Theographic, and share this data under the same license.
//
// The output directory defaults to app/data/entities:
//   entities.json        { "person:david_994": { kind, name, ... }, ... }
//   timeline.json        the events in time order: [{ id, title, start, approx }]
//   easton.json          Easton's dictionary by term: { "hittites": { term, text } }
//   verses/<BOOK>.json   { "GEN.23.10": ["person:ephron_1196", ...], ... }
//
// An entity id is its kind and Theographic's slug: person:david_994,
// place:hebron_1, group:tribe-of-levi, event:12.
//
// Dates: Theographic's events and people follow Floyd Nolen Jones's
// chronology, in astronomical years (-4003 is 4004 BC). They are kept as they
// are; the app labels their source wherever it shows one.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { OSIS, toAddress } from './lib/osis.js';

const [source, out = 'app/data/entities'] = process.argv.slice(2);

if (!source) {
  console.error('Usage: node tools/import-theographic.js <directory with the json files> [output directory]');
  process.exit(1);
}

/** @param {string} name */
async function table(name) {
  return JSON.parse(await readFile(path.join(source, `${name}.json`), 'utf8'));
}

const [verses, people, places, groups, events, easton] = await Promise.all(
  ['verses', 'people', 'places', 'peopleGroups', 'events', 'easton'].map(table),
);

// Markdown links in Easton's text point at another site's pages. Keep the words.
/** @param {string} text */
function plainText(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/**
 * The first paragraphs of a text, cut at a sentence near `limit` characters
 * and marked with an ellipsis; and the rest of the text after the cut ('' for
 * a text short enough), which an entry shows on "Read more".
 *
 * @param {string} text
 * @param {number} limit
 * @returns {{ summary: string, more?: string }}
 */
function summary(text, limit = 700) {
  const clean = plainText(text);
  if (clean.length <= limit) return { summary: clean };
  const found = clean.lastIndexOf('. ', limit);
  const cut = found > 200 ? found + 1 : limit;
  return { summary: `${clean.slice(0, cut)} …`, more: clean.slice(cut).trim() };
}

/** @param {string | undefined} value */
function year(value) {
  if (value === undefined || value === '') return null;
  const number = Number.parseInt(String(value), 10);
  return Number.isFinite(number) ? number : null;
}

/** @param {string} text */
function slugOf(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Theographic's record ids to our ids.
/** @type {Map<string, string>} */
const verseAddress = new Map();
for (const record of verses) {
  const address = toAddress(record.fields.osisRef ?? '');
  if (address) verseAddress.set(record.id, address);
}

/** @type {Map<string, string>} */
const entityId = new Map();
for (const record of people) entityId.set(record.id, `person:${record.fields.slug}`);
for (const record of places) entityId.set(record.id, `place:${record.fields.slug}`);
for (const record of groups) entityId.set(record.id, `group:${slugOf(record.fields.groupName ?? record.id)}`);
for (const record of events) entityId.set(record.id, `event:${record.fields.eventID}`);

/** @param {string[] | undefined} list */
const toIds = (list) => (list ?? []).map((id) => entityId.get(id)).filter(Boolean);
/** @param {string[] | undefined} list */
const toVerses = (list) => (list ?? []).map((id) => verseAddress.get(id)).filter(Boolean);
/** @param {string[] | undefined} list */
const one = (list) => toIds(list)[0] ?? null;

/** @type {Record<string, any>} */
const entities = {};

for (const { fields } of people) {
  entities[`person:${fields.slug}`] = {
    kind: 'person',
    name: fields.name ?? fields.displayTitle,
    title: fields.displayTitle ?? fields.name,
    alsoCalled: fields.alsoCalled ?? '',
    born: year(fields.birthYear),
    died: year(fields.deathYear),
    ...summary((fields.dictText ?? [])[0] ?? fields.dictionaryText ?? ''),
    father: one(fields.father),
    mother: one(fields.mother),
    partners: toIds(fields.partners),
    children: toIds(fields.children),
    siblings: toIds(fields.siblings),
    birthPlace: one(fields.birthPlace),
    deathPlace: one(fields.deathPlace),
    groups: toIds(fields.memberOf),
    events: toIds(fields.timeline),
    verses: toVerses(fields.verses),
  };
}

for (const { fields } of places) {
  const lat = Number.parseFloat(fields.latitude);
  const lon = Number.parseFloat(fields.longitude);
  entities[`place:${fields.slug}`] = {
    kind: 'place',
    name: fields.kjvName ?? fields.displayTitle,
    title: fields.displayTitle ?? fields.kjvName,
    type: fields.featureType ?? '',
    comment: fields.comment ?? '',
    // A place is on the map only with both: a few records carry one.
    lat: Number.isFinite(lat) && Number.isFinite(lon) ? lat : null,
    lon: Number.isFinite(lat) && Number.isFinite(lon) ? lon : null,
    ...summary((fields.dictText ?? [])[0] ?? fields.dictionaryText ?? ''),
    partOf: toIds(fields.partOf),
    sameAs: one(fields.canonicalPlace),
    start: year(fields.startYear),
    end: year(fields.endYear),
    verses: toVerses(fields.verses),
  };
}

for (const { id, fields } of groups) {
  entities[entityId.get(id)] = {
    kind: 'group',
    name: fields.groupName,
    title: fields.groupName,
    members: toIds(fields.members),
    verses: toVerses(fields.verses),
  };
}

const ordered = [...events].sort((a, b) => (a.fields.sortKey ?? 0) - (b.fields.sortKey ?? 0));
for (const { fields } of ordered) {
  const date = String(fields.startDate ?? '');
  entities[`event:${fields.eventID}`] = {
    kind: 'event',
    name: fields.title ?? `Event ${fields.eventID}`,
    title: fields.title ?? `Event ${fields.eventID}`,
    start: year(date.startsWith('-') ? date : date.slice(0, 4)),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    duration: fields.duration ?? '',
    approx: Boolean(fields.rangeFlag),
    participants: toIds(fields.participants),
    locations: toIds(fields.locations),
    partOf: one(fields.partOf),
    verses: toVerses(fields.verses),
  };
}

// Which entities each verse names, by book.
/** @type {Map<string, Record<string, string[]>>} */
const byBook = new Map();
for (const record of verses) {
  const address = verseAddress.get(record.id);
  if (!address) continue;
  const named = [
    ...toIds(record.fields.people),
    ...toIds(record.fields.places),
    ...toIds(record.fields.peopleGroups),
    ...toIds(record.fields.event),
  ];
  if (!named.length) continue;
  const book = address.split('.')[0];
  let file = byBook.get(book);
  if (!file) byBook.set(book, (file = {}));
  file[address] = [...new Set(named)];
}

// Easton's dictionary, one entry per term, its parts in their original order.
/** @type {Record<string, { term: string, text: string }>} */
const dictionary = {};
const terms = [...easton].sort((a, b) => (a.fields.index ?? 0) - (b.fields.index ?? 0));
for (const { fields } of terms) {
  const term = (fields.termLabel ?? '').trim();
  if (!term) continue;
  const key = term.toLowerCase();
  const text = plainText(fields.dictText ?? '');
  if (!text) continue;
  if (dictionary[key]) dictionary[key].text += `\n${text}`;
  else dictionary[key] = { term, text };
}

const timeline = ordered.map(({ fields }) => {
  const entity = entities[`event:${fields.eventID}`];
  return { id: `event:${fields.eventID}`, title: entity.title, start: entity.start, approx: entity.approx };
});

await mkdir(path.join(out, 'verses'), { recursive: true });
await writeFile(path.join(out, 'entities.json'), JSON.stringify(entities));
await writeFile(path.join(out, 'timeline.json'), JSON.stringify(timeline));
await writeFile(path.join(out, 'easton.json'), JSON.stringify(dictionary));
const loaderLines = [];
for (const [, id] of OSIS) {
  await writeFile(path.join(out, 'verses', `${id}.json`), JSON.stringify(byBook.get(id) ?? {}));
  loaderLines.push(`  '${id}': () => json('entities/verses/${id}.json'),`);
}
await writeFile(
  path.join(out, 'verses', 'index.js'),
  ['// Written by tools/import-theographic.js. Do not edit.', '', "import { json } from '../../load.js';", '', 'export const loaders = {', ...loaderLines, '};', ''].join('\n'),
);
await writeFile(
  path.join(out, 'source.json'),
  JSON.stringify(
    {
      name: 'Theographic Bible Metadata',
      source: 'https://github.com/robertrouse/theographic-bible-metadata',
      license: 'CC BY-SA 4.0: credit Theographic, and share this data under the same license.',
      chronology:
        "Floyd Nolen Jones, The Chronology of the Old Testament (follows Ussher for most of the Old Testament: creation 4004 BC, Exodus 1491 BC, crucifixion AD 30). Years are astronomical: -4003 is 4004 BC.",
      dictionary: "Easton's Bible Dictionary (1897), public domain, as edited in Theographic.",
    },
    null,
    2,
  ) + '\n',
);

const counts = Object.values(entities).reduce((all, entity) => ({ ...all, [entity.kind]: (all[entity.kind] ?? 0) + 1 }), {});
const linked = [...byBook.values()].reduce((sum, file) => sum + Object.keys(file).length, 0);
console.log(
  `${JSON.stringify(counts)}, ${linked} verses name at least one, ${Object.keys(dictionary).length} dictionary terms, ${timeline.length} events on the timeline. Written to ${out}.`,
);
