#!/usr/bin/env node
// Builds the world-history track of the timeline from Wikidata.
//
//   node tools/import-world.js [output file]
//
// The list below names the polities and periods on the track, each with its
// Wikidata item. The script asks Wikidata's query service for their dates and
// writes app/data/world/polities.json by default. Wikidata is CC0.
//
// Dates: a start and end time (P580, P582) where the item has them, else its
// inception and dissolution (P571, P576). Where an item holds several values,
// the earliest start and the latest end are kept. These are conventional
// scholarly dates, as Wikidata records them; the biblical events beside them
// follow Floyd Nolen Jones. The app shows both and names both sources.
//
// This script makes network requests. It sends the item list and nothing else.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = process.argv[2] ?? 'app/data/world/polities.json';

/** [Wikidata item, the name the track shows, region] */
const POLITIES = [
  ['Q187979', 'Early Dynastic Egypt', 'Egypt'],
  ['Q177819', 'Old Kingdom', 'Egypt'],
  ['Q191324', 'Middle Kingdom', 'Egypt'],
  ['Q206715', 'Second Intermediate Period', 'Egypt'],
  ['Q180568', 'New Kingdom', 'Egypt'],
  ['Q212728', 'Third Intermediate Period', 'Egypt'],
  ['Q621917', 'Late Period', 'Egypt'],
  ['Q2320005', 'Ptolemaic Kingdom', 'Egypt'],

  ['Q4461035', 'Akkadian Empire', 'Mesopotamia'],
  ['Q723587', 'Third Dynasty of Ur', 'Mesopotamia'],
  ['Q733897', 'Old Babylonian Empire', 'Mesopotamia'],
  ['Q12642600', 'Middle Assyrian Empire', 'Mesopotamia'],
  ['Q10914393', 'Neo-Assyrian Empire', 'Mesopotamia'],
  ['Q624887', 'Neo-Babylonian Empire', 'Mesopotamia'],

  ['Q5406', 'Hittites', 'Levant and Anatolia'],
  ['Q178665', 'Mitanni', 'Levant and Anatolia'],
  ['Q7185566', 'Philistia', 'Levant and Anatolia'],
  ['Q625649', 'Aram-Damascus', 'Levant and Anatolia'],
  ['Q230407', 'Kingdom of Israel', 'Levant and Anatolia'],
  ['Q48685', 'Kingdom of Judah', 'Levant and Anatolia'],
  ['Q208475', 'Edom', 'Levant and Anatolia'],
  ['Q326304', 'Moab', 'Levant and Anatolia'],
  ['Q473353', 'Ammon', 'Levant and Anatolia'],
  ['Q185068', 'Urartu', 'Levant and Anatolia'],
  ['Q620765', 'Lydia', 'Levant and Anatolia'],
  ['Q10359001', 'Hasmonean Judea', 'Levant and Anatolia'],
  ['Q16000109', 'Herodian Kingdom of Judea', 'Levant and Anatolia'],

  ['Q128904', 'Elam', 'Persia'],
  ['Q20437507', 'Median Kingdom', 'Persia'],
  ['Q389688', 'Achaemenid Empire', 'Persia'],
  ['Q93180', 'Seleucid Empire', 'Persia'],
  ['Q1986139', 'Parthian Empire', 'Persia'],

  ['Q134178', 'Minoan civilization', 'Greece and Rome'],
  ['Q181264', 'Mycenaean Greece', 'Greece and Rome'],
  ['Q271834', 'Archaic Greece', 'Greece and Rome'],
  ['Q843745', 'Classical Greece', 'Greece and Rome'],
  ['Q83958', 'Macedonia', 'Greece and Rome'],
  ['Q428995', 'Hellenistic period', 'Greece and Rome'],
  ['Q17167', 'Roman Republic', 'Greece and Rome'],
  ['Q2277', 'Roman Empire', 'Greece and Rome'],
  ['Q2429397', 'Carthage', 'Greece and Rome'],

  ['Q42534', 'Indus Valley Civilization', 'Africa and Asia'],
  ['Q241790', 'Kingdom of Kush', 'Africa and Asia'],
  ['Q128938', 'Shang dynasty', 'Africa and Asia'],
  ['Q35216', 'Zhou dynasty', 'Africa and Asia'],
  ['Q62943', 'Maurya Empire', 'Africa and Asia'],
  ['Q7183', 'Qin dynasty', 'Africa and Asia'],
  ['Q7209', 'Han dynasty', 'Africa and Asia'],
];

const query = `
SELECT ?item ?itemLabel ?inception ?dissolved ?start ?end WHERE {
  VALUES ?item { ${POLITIES.map(([id]) => `wd:${id}`).join(' ')} }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P576 ?dissolved . }
  OPTIONAL { ?item wdt:P580 ?start . }
  OPTIONAL { ?item wdt:P582 ?end . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const response = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
  headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'bible-table-research/0.1 (local research app)' },
});
if (!response.ok) throw new Error(`Wikidata answered ${response.status}`);
const rows = (await response.json()).results.bindings;

/** An xsd:dateTime from Wikidata to an astronomical year: "-0549-01-01T…" is -549. */
const year = (/** @type {any} */ value) => (value ? Number.parseInt(value.value, 10) : null);

/** @type {Map<string, { label: string, starts: number[], ends: number[], fallbackStarts: number[], fallbackEnds: number[] }>} */
const found = new Map();
for (const row of rows) {
  const id = row.item.value.split('/').at(-1);
  let entry = found.get(id);
  if (!entry) found.set(id, (entry = { label: row.itemLabel?.value ?? id, starts: [], ends: [], fallbackStarts: [], fallbackEnds: [] }));
  for (const [key, list] of [['start', entry.starts], ['end', entry.ends], ['inception', entry.fallbackStarts], ['dissolved', entry.fallbackEnds]]) {
    const value = year(row[key]);
    if (value !== null) list.push(value);
  }
}

const polities = [];
const missing = [];
for (const [id, name, region] of POLITIES) {
  const entry = found.get(id);
  const starts = entry?.starts.length ? entry.starts : (entry?.fallbackStarts ?? []);
  const ends = entry?.ends.length ? entry.ends : (entry?.fallbackEnds ?? []);
  if (!entry || !starts.length || !ends.length) {
    missing.push(`${name} (${id})`);
    continue;
  }
  polities.push({ id, name, label: entry.label, region, start: Math.min(...starts), end: Math.max(...ends) });
}

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(polities, null, 1) + '\n');
await writeFile(
  path.join(path.dirname(out), 'source.json'),
  JSON.stringify(
    {
      name: 'World history track',
      source: 'Wikidata (https://www.wikidata.org), queried by tools/import-world.js',
      license: 'CC0',
      dates: 'Conventional scholarly dates as Wikidata records them: P580/P582, else P571/P576. Astronomical years.',
      queried: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ) + '\n',
);

console.log(`${polities.length} polities written to ${out}.${missing.length ? ` No dates for: ${missing.join(', ')}.` : ''}`);
