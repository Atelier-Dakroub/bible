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
// Beside the polities, the rulers the Bible names (their reigns: the start
// and end time of the office they held, a monarch's where they held one)
// and dated events of the world around it (their point in time, or start
// and end). Each entry has `kind`: polity, ruler or event.
//
// This script makes network requests. It sends the item lists and nothing
// else.

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

/** [Wikidata item, the name the track shows, region] */
const RULERS = [
  ['Q311811', 'Shishak (Shoshenq I)', 'Egypt'],
  ['Q315714', 'Tirhakah (Taharqa)', 'Egypt'],
  ['Q125102', 'Necho II', 'Egypt'],
  ['Q349291', 'Hophra (Apries)', 'Egypt'],
  ['Q211928', 'Shalmaneser III', 'Mesopotamia'],
  ['Q210074', 'Tiglath-pileser III', 'Mesopotamia'],
  ['Q310640', 'Shalmaneser V', 'Mesopotamia'],
  ['Q208336', 'Sargon II', 'Mesopotamia'],
  ['Q207140', 'Sennacherib', 'Mesopotamia'],
  ['Q193912', 'Esarhaddon', 'Mesopotamia'],
  ['Q171191', 'Ashurbanipal', 'Mesopotamia'],
  ['Q356505', 'Merodach-baladan', 'Mesopotamia'],
  ['Q12591', 'Nebuchadnezzar II', 'Mesopotamia'],
  ['Q313234', 'Evil-merodach (Amel-Marduk)', 'Mesopotamia'],
  ['Q239414', 'Nabonidus', 'Mesopotamia'],
  ['Q225198', 'Belshazzar', 'Mesopotamia'],
  ['Q127170', 'Hazael', 'Levant and Anatolia'],
  ['Q350258', 'Mesha', 'Levant and Anatolia'],
  ['Q467115', 'Hiram I', 'Levant and Anatolia'],
  ['Q51672', 'Herod the Great', 'Levant and Anatolia'],
  ['Q192950', 'Herod Antipas', 'Levant and Anatolia'],
  ['Q17131', 'Pontius Pilate', 'Levant and Anatolia'],
  ['Q8423', 'Cyrus the Great', 'Persia'],
  ['Q182483', 'Cambyses II', 'Persia'],
  ['Q44387', 'Darius I', 'Persia'],
  ['Q129165', 'Xerxes I (Ahasuerus)', 'Persia'],
  ['Q189689', 'Artaxerxes I', 'Persia'],
  ['Q3356', 'Antiochus IV Epiphanes', 'Persia'],
  ['Q8409', 'Alexander the Great', 'Greece and Rome'],
  ['Q1405', 'Augustus', 'Greece and Rome'],
  ['Q1407', 'Tiberius', 'Greece and Rome'],
  ['Q1411', 'Claudius', 'Greece and Rome'],
  ['Q1413', 'Nero', 'Greece and Rome'],
];

/** [Wikidata item, the name the track shows, region] */
const EVENTS = [
  ['Q203729', 'Battle of Kadesh', 'Levant and Anatolia'],
  ['Q1059758', 'Bronze Age collapse', 'Levant and Anatolia'],
  ['Q849474', 'Battle of Qarqar', 'Levant and Anatolia'],
  ['Q1160074', 'Siege of Lachish', 'Levant and Anatolia'],
  ['Q1267122', 'Assyrian siege of Jerusalem', 'Levant and Anatolia'],
  ['Q633560', 'Battle of Carchemish', 'Mesopotamia'],
  ['Q28169617', 'Fall of Babylon', 'Mesopotamia'],
  ['Q179670', 'Battle of Gaugamela', 'Persia'],
  ['Q7930888', 'Maccabean Revolt', 'Levant and Anatolia'],
];

// Reigns that Wikidata does not date (no start and end on an office held):
// the usual dates, entered by hand, in astronomical years, and marked as
// such in the output (`dates: 'conventional'`).
/** @type {Record<string, [number, number]>} */
const CONVENTIONAL = {
  Q311811: [-942, -921], // Shoshenq I, about 943–922 BC
  Q315714: [-689, -663], // Taharqa, 690–664 BC
  Q225198: [-552, -538], // Belshazzar, regent about 553–539 BC
  Q350258: [-849, -829], // Mesha, about 850–830 BC
  Q51672: [-36, -3], // Herod the Great, 37–4 BC
  Q192950: [-3, 39], // Herod Antipas, 4 BC to AD 39
  Q189689: [-464, -423], // Artaxerxes I, 465–424 BC
};

// A ruler's reigns: each office held (P39) with its start and end, and
// whether the office is a monarch's (an instance or subclass of monarch,
// Q116), so Augustus's reign is not his consulship.
const rulerQuery = `
SELECT ?item ?start ?end ?monarch WHERE {
  VALUES ?item { ${RULERS.map(([id]) => `wd:${id}`).join(' ')} }
  ?item p:P39 ?held .
  ?held ps:P39 ?office .
  OPTIONAL { ?held pq:P580 ?start . }
  OPTIONAL { ?held pq:P582 ?end . }
  BIND(EXISTS { ?office (wdt:P31|wdt:P279)/wdt:P279* wd:Q116 } AS ?monarch)
}`;

// An event's point in time, or its start and end.
const eventQuery = `
SELECT ?item ?itemLabel ?point ?start ?end WHERE {
  VALUES ?item { ${EVENTS.map(([id]) => `wd:${id}`).join(' ')} }
  OPTIONAL { ?item wdt:P585 ?point . }
  OPTIONAL { ?item wdt:P580 ?start . }
  OPTIONAL { ?item wdt:P582 ?end . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

/** @param {string} text */
async function ask(text) {
  const answer = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(text)}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'bible-table-research/0.1 (local research app)' },
  });
  if (!answer.ok) throw new Error(`Wikidata answered ${answer.status}`);
  return (await answer.json()).results.bindings;
}

const query = `
SELECT ?item ?itemLabel ?inception ?dissolved ?start ?end WHERE {
  VALUES ?item { ${POLITIES.map(([id]) => `wd:${id}`).join(' ')} }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P576 ?dissolved . }
  OPTIONAL { ?item wdt:P580 ?start . }
  OPTIONAL { ?item wdt:P582 ?end . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const rows = await ask(query);

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
  polities.push({ id, name, label: entry.label, region, start: Math.min(...starts), end: Math.max(...ends), kind: 'polity' });
}

// The rulers: the reign as a monarch where there is one, else every office.
/** @type {Map<string, { monarch: [number, number][], any: [number, number][] }>} */
const reigns = new Map();
for (const row of await ask(rulerQuery)) {
  const id = row.item.value.split('/').at(-1);
  const start = year(row.start);
  const end = year(row.end) ?? start;
  if (start === null || end === null) continue;
  const entry = reigns.get(id) ?? { monarch: [], any: [] };
  (row.monarch?.value === 'true' ? entry.monarch : entry.any).push([start, end]);
  reigns.set(id, entry);
}
for (const [id, name, region] of RULERS) {
  const entry = reigns.get(id);
  const spans = entry?.monarch.length ? entry.monarch : (entry?.any ?? []);
  if (!spans.length) {
    const usual = CONVENTIONAL[id];
    if (usual) polities.push({ id, name, label: name, region, start: usual[0], end: usual[1], kind: 'ruler', dates: 'conventional' });
    else missing.push(`${name} (${id})`);
    continue;
  }
  polities.push({ id, name, label: name, region, start: Math.min(...spans.map(([a]) => a)), end: Math.max(...spans.map(([, b]) => b)), kind: 'ruler' });
}

// The events: a point in time, or a start and end.
/** @type {Map<string, { label: string, starts: number[], ends: number[] }>} */
const happened = new Map();
for (const row of await ask(eventQuery)) {
  const id = row.item.value.split('/').at(-1);
  const entry = happened.get(id) ?? { label: row.itemLabel?.value ?? id, starts: [], ends: [] };
  for (const key of ['point', 'start']) if (year(row[key]) !== null) entry.starts.push(/** @type {number} */ (year(row[key])));
  for (const key of ['point', 'end']) if (year(row[key]) !== null) entry.ends.push(/** @type {number} */ (year(row[key])));
  happened.set(id, entry);
}
for (const [id, name, region] of EVENTS) {
  const entry = happened.get(id);
  if (!entry?.starts.length) {
    missing.push(`${name} (${id})`);
    continue;
  }
  const start = Math.min(...entry.starts);
  polities.push({ id, name, label: entry.label, region, start, end: entry.ends.length ? Math.max(...entry.ends) : start, kind: 'event' });
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

console.log(`${polities.length} polities, rulers and events written to ${out}.${missing.length ? ` No dates for: ${missing.join(', ')}.` : ''}`);
