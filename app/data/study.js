// Study tools, for the server: the passage guide and the landscape.
//
// The passage guide gathers what the data has on one passage: its parallel
// passages, its cross-references, the people, places, groups and events it
// names, and where those are on the map and the timeline. The notes on it are
// in the browser, so the search panel adds those itself.
//
// The landscape is the whole Bible at once, one cell per chapter: either the
// books compared by length, kind and traditional author, or the chapters
// marked by how often a Strong's number, an entity or some words occur in
// them.

import parallelList from './parallels.json' with { type: 'json' };
import { AUTHORS, CANON_CREDIT, GROUPS } from './canon.js';
import { answer, books, entityView, entryFor, grammarFind, grammarQuery, matching, passage, preview, referenceBook, strongsBook, verseCount } from './bible.js';
import { entities, entity, formatYear, namedIn } from './entities.js';
import { onMap } from '../lib/map.js';
import { formatReference, parseAddress, shortTitle, toAddress, versesIn } from '../lib/reference.js';
import { parseSpanAddress } from '../lib/words.js';
import { versesOf } from '../lib/links.js';
import { MOST, NOTE, counted, listed, planOf } from '../lib/study.js';
import { sensesOf, versesOfSense } from './senses.js';
import { journeysFor } from './journeys.js';
import { imagesOf } from './images.js';
import { videosFor } from './videos.js';
import { CREDIT as QUOTATIONS, quotationsOf } from './quotations.js';
import { CREDIT as TOPICS, topic, topicsOf } from './topics.js';

/** @typedef {import('./bible.js').Result} Result */
/** @typedef {import('./bible.js').Results} Results */
/** @typedef {import('../lib/reference.js').Reference} Reference */
/** @typedef {{ id: string, name: string }} Named */
/**
 * Everything the guide shows for one passage.
 *
 * @typedef {{
 *   address: string, title: string,
 *   parallels: Result[], beside: string,
 *   quotations: Result[], quotationHeading: string,
 *   references: Result[], referenceSummary: string,
 *   people: Named[], places: Named[], groups: Named[],
 *   events: { id: string, title: string, label: string }[],
 *   mapIds: string, credit: string, topics: { key: string, name: string }[]
 * }} Guide
 */

const MAX_PARALLELS = 12;
const MAX_REFERENCES = 15;
const MAX_NAMED = 24;

/**
 * A verse address's chapter and verse as one number that sorts them.
 *
 * @param {number} chapter
 * @param {number} verse
 */
const keyOf = (chapter, verse) => chapter * 1000 + verse;

/**
 * The book and the first and last verse keys of a reference.
 *
 * @param {Reference} ref
 */
function extent(ref) {
  const verses = versesIn(ref, books);
  const [firstChapter, firstVerse] = verses[0];
  const [lastChapter, lastVerse] = verses[verses.length - 1];
  return { book: ref.book, from: keyOf(firstChapter, firstVerse), to: keyOf(lastChapter, lastVerse) };
}

/** @typedef {{ book: string, from: number, to: number, address: string }} Side */

/** @type {Map<string, { side: Side, other: Side, pairs: number }[]> | null} */
let parallelIndex = null;

/** The parallels by book, each one under both of its books. */
function parallelsByBook() {
  if (parallelIndex) return parallelIndex;
  /** @type {Map<string, { side: Side, other: Side, pairs: number }[]>} */
  const index = new Map();
  for (const [a, b, pairs] of /** @type {[string, string, number][]} */ (parallelList)) {
    const refA = parseAddress(a, books);
    const refB = parseAddress(b, books);
    if (!refA || !refB) continue;
    const sideA = { ...extent(refA), address: a };
    const sideB = { ...extent(refB), address: b };
    for (const [side, other] of [[sideA, sideB], [sideB, sideA]]) {
      const list = index.get(side.book) ?? [];
      list.push({ side, other, pairs });
      index.set(side.book, list);
    }
  }
  parallelIndex = index;
  return index;
}

/**
 * The passages parallel to a reference, the surest first: each is a run of
 * cross-references (tools/import-parallels.js).
 *
 * @param {Reference} ref
 * @returns {{ address: string, pairs: number }[]}
 */
export function parallelsOf(ref) {
  const here = extent(ref);
  /** @type {Map<string, number>} */
  const found = new Map();
  for (const { side, other, pairs } of parallelsByBook().get(ref.book) ?? []) {
    if (side.from > here.to || side.to < here.from) continue;
    // The passage's own verses are not a parallel to it.
    if (other.book === here.book && other.from <= here.to && other.to >= here.from) continue;
    found.set(other.address, (found.get(other.address) ?? 0) + pairs);
  }
  return [...found].map(([address, pairs]) => ({ address, pairs })).sort((x, y) => y.pairs - x.pairs);
}

/**
 * The reference a guide is for: a passage, or the verses a phrase is in.
 *
 * @param {string} address
 * @returns {Reference | null}
 */
function guideReference(address) {
  const range = parseSpanAddress(address);
  if (range) {
    const [book, c1, v1] = range.from.split('.');
    const [, c2, v2] = range.to.split('.');
    const span = c1 === c2 ? (v1 === v2 ? `${book}.${c1}.${v1}` : `${book}.${c1}.${v1}-${v2}`) : `${book}.${c1}.${v1}-${c2}.${v2}`;
    return parseAddress(span, books);
  }
  return parseAddress(address, books);
}

/**
 * A result for a passage: its reference and its opening words.
 *
 * @param {string} address
 * @param {number} limit
 * @returns {Promise<Result | null>}
 */
async function passageResult(address, limit) {
  const ref = parseAddress(address, books);
  if (!ref) return null;
  const { title, verses } = await passage(ref);
  return { address, title, parts: [{ text: preview(verses, limit), hit: false }] };
}

/**
 * The passage guide, as the search panel shows it. An entity's address shows
 * the entity instead.
 *
 * @param {string} address a passage, such as JHN.3.16-18, or a phrase
 * @returns {Promise<Results>}
 */
export async function guideResults(address) {
  if (/^(?:person|place|group|event):/.test(address)) {
    const view = await entityView(address);
    return view ? answer({ entity: view, summary: view.facts.join(' · ') }) : answer({ summary: 'Nothing has that address.' });
  }
  const ref = guideReference(address);
  if (!ref) return answer({ summary: 'There is no guide for this card.' });

  const verses = versesIn(ref, books);
  const ids = verses.map(([chapter, verse]) => `${ref.book}.${chapter}.${verse}`);
  const inside = new Set(ids);
  const title = formatReference(ref, books);

  // Parallel passages.
  const parallelFound = parallelsOf(ref).slice(0, MAX_PARALLELS);
  const parallels = (await Promise.all(parallelFound.map(({ address: each }) => passageResult(each, 140)))).flatMap((each) => each ?? []);

  // The Old Testament in the New: what a New Testament passage quotes, or
  // where the New Testament quotes an Old Testament one (data/quotations.js).
  const quoted = quotationsOf(toAddress(ref));
  const quotations = (await Promise.all(quoted.addresses.slice(0, MAX_REFERENCES).map((each) => passageResult(each, 140)))).flatMap((each) => each ?? []);
  const quotationHeading = quoted.quoting ? 'The Old Testament it quotes' : 'Quoted in the New Testament';

  // Cross-references of every verse, joined: a passage that several verses
  // refer to counts the votes of each.
  const refs = await referenceBook(ref.book);
  /** @type {Map<string, number>} */
  const votes = new Map();
  for (const id of ids) {
    for (const [target, count] of refs[id] ?? []) {
      if (inside.has(target.split('-')[0])) continue;
      votes.set(target, (votes.get(target) ?? 0) + count);
    }
  }
  const sorted = [...votes].sort((x, y) => y[1] - x[1]);
  const references = (await Promise.all(sorted.slice(0, MAX_REFERENCES).map(([target]) => passageResult(target, 140)))).flatMap((each) => each ?? []);
  const referenceSummary = sorted.length
    ? `${sorted.length === 1 ? '1 passage' : `${sorted.length} passages`}${sorted.length > references.length ? `; the ${references.length} with the most votes` : ''}. From OpenBible.info.`
    : 'None.';

  // What the verses name.
  const [named, all] = await Promise.all([namedIn(ref.book), entities()]);
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const id of ids) for (const each of named[id] ?? []) counts.set(each, (counts.get(each) ?? 0) + 1);
  const ranked = [...counts].sort((x, y) => y[1] - x[1] || (all[x[0]]?.title ?? '').localeCompare(all[y[0]]?.title ?? ''));
  /** @param {string} kind */
  const ofKind = (kind) =>
    ranked
      .filter(([id]) => all[id]?.kind === kind)
      .slice(0, MAX_NAMED)
      .map(([id]) => ({ id, name: all[id].title }));
  const events = ranked
    .map(([id]) => ({ id, found: all[id] }))
    .filter(({ found }) => found?.kind === 'event' && typeof found.start === 'number')
    .sort((x, y) => x.found.start - y.found.start)
    .slice(0, MAX_NAMED)
    .map(({ id, found }) => ({ id, title: found.title, label: `${found.approx ? 'about ' : ''}${formatYear(found.start)}` }));
  const places = ofKind('place');
  const mapIds = ranked
    .filter(([id]) => all[id]?.kind === 'place' && all[id].lat !== null && onMap(all[id].lon, all[id].lat))
    .map(([id]) => id)
    .slice(0, MAX_NAMED)
    .join(',');

  const credit = [
    'Parallels are runs of cross-references, verse after verse in the same order; quotations of one verse are not found this way.',
    "Cross-references: OpenBible.info (CC BY). People, places and events: Theographic (CC BY-SA); dates follow Floyd Nolen Jones's chronology.",
    QUOTATIONS,
    TOPICS,
  ].join(' ');

  /** @type {Guide} */
  const guide = {
    address: toAddress(ref),
    title,
    parallels,
    beside: parallels.map((each) => each.address).join(','),
    quotations,
    quotationHeading,
    references,
    referenceSummary,
    people: ofKind('person'),
    places,
    groups: ofKind('group'),
    events,
    mapIds,
    credit,
    topics: await topicsOf(toAddress(ref)),
  };
  return answer({
    summary: `Guide to ${title}: ${verseCount(ids.length)}.`,
    guide,
    journeys: await journeysFor({ address }),
    // Pictures of the places and people the passage names, places first.
    images: imagesOf([...guide.places, ...guide.people].map((item) => item.id), 4),
    // Videos of the passage: a scene of a film first, a book's overview after.
    videos: videosFor(guide.address),
  });
}

// The persons named all through the Bible: a card of one adds little to a
// study.
const EVERYWHERE = new Set(['person:god_1324', 'person:jesus_904', 'person:jesus_905', 'person:holy_spirit_7400']);

/**
 * Picks addresses in order, up to `most`, leaving out any that shares a
 * verse with one picked before (1 Peter 2:24 beside 1 Peter 2:24-25), or
 * with the verses in `seen`, which it adds to.
 *
 * @param {string[]} addresses
 * @param {number} most
 * @param {Set<string>} seen verse ids
 */
function freshOf(addresses, most, seen) {
  /** @type {string[]} */
  const kept = [];
  for (const address of addresses) {
    const verses = versesOf(address);
    if (kept.length >= most || verses.some((verse) => seen.has(verse))) continue;
    for (const verse of verses) seen.add(verse);
    kept.push(address);
  }
  return kept;
}

/** @param {string} address its reference, as "John 3:16" */
function referenceOf(address) {
  const ref = parseAddress(address, books);
  return ref ? formatReference(ref, books) : address;
}

/**
 * A study, to lay out on the table (lib/study.js): of a passage, of a word
 * of the original (H2617), of a topic (topic:PRAYER), or of a person, a
 * place, an event or a group (person:paul_2479, place:jerusalem_636,
 * event:125, group:apostles). Null when there is none.
 *
 * @param {string} subject
 * @returns {Promise<import('../lib/study.js').Plan | null>}
 */
export async function studyPlan(subject) {
  if (/^[HG]\d+$/.test(subject)) return wordPlan(subject);
  if (subject.startsWith('topic:')) return topicPlan(subject.slice('topic:'.length));
  const ofEntity = ENTITY_PLANS[/** @type {keyof typeof ENTITY_PLANS} */ (subject.split(':')[0])];
  return ofEntity ? ofEntity(subject) : passagePlan(subject);
}

/** The study of each kind of entity, by the start of its id. */
const ENTITY_PLANS = { person: personPlan, place: placePlan, event: eventPlan, group: groupPlan };

/**
 * A study of a passage: the Old Testament it quotes (or the New Testament
 * passages that quote it), its parallels, the cross-references with the
 * most votes, the people it names most, and its places for the map.
 *
 * @param {string} address
 */
async function passagePlan(address) {
  const { guide } = await guideResults(address);
  if (!guide) return null;
  const seen = new Set(versesOf(guide.address));
  const quoting = quotationsOf(guide.address).quoting;
  const quotations = freshOf(guide.quotations.map((each) => each.address), 4, seen);
  const parallels = freshOf(guide.parallels.map((each) => each.address), 3, seen);
  const references = freshOf(guide.references.map((each) => each.address), MOST, seen);
  const people = guide.people.filter((each) => !EVERYWHERE.has(each.id)).slice(0, 3).map((each) => each.id);
  const quoted = { cards: quotations, type: 'quotes', toward: !quoting };
  const parts = [
    quotations.length ? counted(quotations.length, quoting ? 'passage it quotes' : 'passage that quotes it', quoting ? 'passages it quotes' : 'passages that quote it') : '',
    parallels.length ? counted(parallels.length, 'parallel') : '',
    references.length ? counted(references.length, 'cross-reference') : '',
    people.length ? counted(people.length, 'person', 'people') : '',
    guide.mapIds ? 'its places on the map' : '',
  ];
  return planOf({
    kind: 'passage',
    address: guide.address,
    title: guide.title,
    short: shortTitle(guide.title, books),
    left: quoting ? [quoted] : [],
    under: people,
    right: [...(quoting ? [] : [quoted]), { cards: parallels, toward: true }, { cards: references, toward: true }],
    lines: [`From the guide: ${listed(parts, 'no more than the passage')}.`],
    mapIds: guide.mapIds,
  });
}

/**
 * Every verse that uses a Strong's number, in canon order.
 *
 * @param {string} code
 */
async function versesWith(code) {
  const all = await Promise.all(books.map((entry) => strongsBook(entry.id)));
  return all.flatMap((each) => Object.entries(each).flatMap(([address, codes]) => (codes.split(' ').includes(code) ? [address] : [])));
}

/**
 * A study of a word of the original: where it is used (its landscape), and
 * a verse for each of its senses, the first in the Bible that uses it so;
 * a word with no senses has the first verse of each book that uses it most.
 * Every card marks the word.
 *
 * @param {string} code such as G26
 */
async function wordPlan(code) {
  const found = await versesWith(code);
  const entry = await entryFor(code, found.length);
  if (!entry || !found.length) return null;
  const senses = (await sensesOf(code)).filter((each) => each.count > 0).sort((x, y) => y.count - x.count);
  /** @type {{ address: string, label: string }[]} */
  const picked = [];
  const has = (/** @type {string} */ address) => picked.some((one) => one.address === address);
  if (senses.length > 1) {
    for (const sense of senses.slice(0, MOST)) {
      const inSense = await versesOfSense(code, sense.n);
      const first = found.find((each) => inSense.has(each) && !has(each));
      if (first) picked.push({ address: first, label: `In the sense “${sense.gloss.split(',')[0]}”` });
    }
  }
  // The books that use it most fill the column: the first verse of each.
  /** @type {Map<string, string[]>} */
  const byBook = new Map();
  for (const each of found) byBook.set(each.split('.')[0], [...(byBook.get(each.split('.')[0]) ?? []), each]);
  for (const [book, verses] of [...byBook].sort((x, y) => y[1].length - x[1].length)) {
    if (picked.length >= MOST) break;
    if (!has(verses[0])) picked.push({ address: verses[0], label: `${books.find((each) => each.id === book)?.name ?? book}, which uses it in ${verseCount(verses.length)}` });
  }
  const verses = picked.sort((x, y) => found.indexOf(x.address) - found.indexOf(y.address));
  const title = `${entry.xlit} (${code})`;
  return planOf({
    kind: 'word',
    address: `landscape:${code}`,
    title,
    short: title,
    right: [{ cards: verses.map((each) => each.address), toward: true }],
    lines: [
      `${entry.lemma}, ${entry.xlit}: ${entry.count}. Every card marks it.`,
      senses.length > 1 ? 'The first verse for each sense, then the first in each book that uses it most:' : 'The first verse in each book that uses it most:',
      ...verses.map((each) => `${each.label}: ${referenceOf(each.address)}`),
    ],
    rule: { kind: 'strongs', value: code, label: `${code} ${entry.xlit}` },
  });
}

/**
 * A study of a topic of Nave's: a passage for each part of the topic, the
 * first it cites. The topic has no card: the note is the middle.
 *
 * @param {string} key such as PRAYER
 */
async function topicPlan(key) {
  const found = await topic(key);
  if (!found) return null;
  const seen = new Set();
  /** @type {{ address: string, label: string }[]} */
  const picked = [];
  for (const line of found.lines) {
    const first = line.parts.find((part) => part.address)?.address;
    if (!first || picked.length >= 2 * MOST) continue;
    const [kept] = freshOf([first], 1, seen);
    if (kept) picked.push({ address: kept, label: line.label });
  }
  if (!picked.length) return null;
  return planOf({
    kind: 'topic',
    address: NOTE,
    title: found.name,
    short: found.name,
    right: [{ cards: picked.map((each) => each.address), toward: true }],
    lines: [
      `From Nave's Topical Bible: a passage for each part of the topic, the first it cites, of its ${found.count.toLocaleString('en')} references.`,
      ...picked.map((each) => `${each.label ? `${each.label}: ` : ''}${referenceOf(each.address)}`),
    ],
  });
}

/**
 * A study of a person: their card and family, the chapters that name them
 * most, and their journey on the map, or where they were born and died.
 *
 * @param {string} id such as person:paul_2479
 */
async function personPlan(id) {
  const [found, all] = await Promise.all([entity(id), entities()]);
  if (!found || found.kind !== 'person') return null;
  const chapters = chaptersNaming(found.verses ?? []);
  const family = [found.father, found.mother, ...(found.partners ?? []), ...(found.siblings ?? []), ...(found.children ?? [])]
    .filter((each) => typeof each === 'string' && all[each])
    .slice(0, 4);
  const [journey] = await journeysFor({ person: id });
  const mapped = (/** @type {string | null} */ place) => (place && all[place]?.lat != null && onMap(all[place].lon, all[place].lat) ? place : '');
  const born = mapped(found.birthPlace);
  const died = mapped(found.deathPlace);
  const places = [...new Set([born, died].filter(Boolean))];
  const name = found.title;
  return planOf({
    kind: 'person',
    address: id,
    title: name,
    short: name,
    under: family,
    right: [{ cards: chapters, toward: true }],
    lines: [
      `From Theographic: ${name} is named in ${verseCount((found.verses ?? []).length)}.`,
      chapters.length ? `The passages that name ${name} most: ${listed(chapters.map(referenceOf), '')}.` : '',
      family.length ? `Family: ${listed(family.map((each) => all[each].title), '')}.` : '',
      journey
        ? `On the map: ${journey.title}${journey.route ? `, ${journey.route}` : ''}.`
        : places.length
          ? `On the map: ${listed([born ? `${all[born].title}, where ${name} was born` : '', died ? `${all[died].title}, where ${name} died` : ''], '')}.`
          : '',
    ].filter(Boolean),
    mapIds: journey ? '' : places.join(','),
    journey: journey ?? null,
  });
}

/** @typedef {import('./entities.js').Entity} Entity */

/**
 * Entities that exist, the one named in the most verses first.
 *
 * @param {string[]} ids
 * @param {Record<string, Entity>} all
 */
const byMention = (ids, all) => [...new Set(ids)].filter((id) => all[id]).sort((a, b) => (all[b].verses?.length ?? 0) - (all[a].verses?.length ?? 0));

/**
 * The places of a list that the map can show.
 *
 * @param {string[]} ids
 * @param {Record<string, Entity>} all
 */
const mappedOf = (ids, all) => ids.filter((id) => all[id]?.lat != null && onMap(all[id].lon, all[id].lat));

/**
 * The events that match a test, the earliest first.
 *
 * @param {Record<string, Entity>} all
 * @param {(event: Entity) => boolean} test
 */
const eventsWhere = (all, test) =>
  Object.keys(all)
    .filter((id) => all[id].kind === 'event' && test(all[id]))
    .sort((a, b) => (all[a].start ?? 0) - (all[b].start ?? 0));

/**
 * "Moses, Aaron and Eleazar"; with more than `most`, the first and how many
 * more.
 *
 * @param {string[]} ids
 * @param {Record<string, Entity>} all
 * @param {number} [most]
 */
function titlesOf(ids, all, most = 8) {
  const titles = ids.slice(0, most).map((id) => all[id].title);
  return ids.length > most ? `${titles.join(', ')} and ${ids.length - most} more` : listed(titles, '');
}

/**
 * A study of a place: its card, the events there and the people born or
 * buried there, the chapters that name it most, and the place on the map.
 *
 * @param {string} id such as place:bethel_222
 */
async function placePlan(id) {
  const [found, all] = await Promise.all([entity(id), entities()]);
  if (!found || found.kind !== 'place') return null;
  const name = found.title;
  const chapters = chaptersNaming(found.verses ?? []);
  const events = eventsWhere(all, (event) => Boolean(event.locations?.includes(id)));
  const born = byMention(Object.keys(all).filter((key) => all[key].birthPlace === id), all);
  const died = byMention(Object.keys(all).filter((key) => all[key].deathPlace === id), all);
  if (!chapters.length && !events.length) return null;
  return planOf({
    kind: 'place',
    address: id,
    title: name,
    short: name,
    under: [...new Set([...events.slice(0, 2), ...born, ...died])].slice(0, 3),
    right: [{ cards: chapters, toward: true }],
    lines: [
      `From Theographic: ${name} is named in ${verseCount((found.verses ?? []).length)}.`,
      chapters.length ? `The passages that name it most: ${listed(chapters.map(referenceOf), '')}.` : '',
      events.length ? `${counted(events.length, 'event')} here: ${titlesOf(events, all)}.` : '',
      born.length ? `Born here: ${titlesOf(born, all)}.` : '',
      died.length ? `Died here: ${titlesOf(died, all)}.` : '',
    ].filter(Boolean),
    mapIds: mappedOf([id], all).join(','),
  });
}

/** Theographic's units of a duration, as words. */
const UNITS = /** @type {Record<string, string>} */ ({ Y: 'year', M: 'month', W: 'week', D: 'day' });

/**
 * An event's date and how long it lasted: "about 1446 BC, 40 years".
 *
 * @param {Entity} event
 */
function whenOf(event) {
  if (event.start === null || event.start === undefined) return '';
  const [, amount, unit] = /^(\d+)([YMWD])$/.exec(event.duration ?? '') ?? [];
  const span = amount && Number(amount) > 1 ? `, ${counted(Number(amount), UNITS[unit])}` : '';
  return `${event.approx ? 'about ' : ''}${formatYear(event.start)}${span}`;
}

/**
 * A study of an event: its card, the people in it, the passages that tell
 * it, and its places on the map; the note says when it was, what it is part
 * of, and what it holds.
 *
 * @param {string} id such as event:125
 */
async function eventPlan(id) {
  const [found, all] = await Promise.all([entity(id), entities()]);
  if (!found || found.kind !== 'event') return null;
  const passages = chaptersNaming(found.verses ?? []);
  if (!passages.length) return null;
  const people = byMention(found.participants ?? [], all);
  const places = (found.locations ?? []).filter((place) => all[place]);
  const within = eventsWhere(all, (event) => event.partOf === id);
  const when = whenOf(found);
  return planOf({
    kind: 'event',
    address: id,
    title: found.title,
    short: found.title,
    under: people.filter((each) => !EVERYWHERE.has(each)).slice(0, 3),
    right: [{ cards: passages, toward: true }],
    lines: [
      `From Theographic${when ? `, dated by Jones: ${when}` : ''}.`,
      `The passages that tell it: ${listed(passages.map(referenceOf), '')}.`,
      found.partOf && all[found.partOf] ? `Part of ${all[found.partOf].title}.` : '',
      within.length ? `Within it: ${titlesOf(within, all)}.` : '',
      people.length ? `People: ${titlesOf(people, all)}.` : '',
      places.length ? `Places: ${titlesOf(places, all)}.` : '',
    ].filter(Boolean),
    mapIds: mappedOf(places, all).join(','),
  });
}

/**
 * A study of a group: its card, its members named most, and the chapters
 * that name the group, where any do.
 *
 * @param {string} id such as group:apostles
 */
async function groupPlan(id) {
  const [found, all] = await Promise.all([entity(id), entities()]);
  if (!found || found.kind !== 'group') return null;
  const members = byMention(found.members ?? [], all);
  const chapters = chaptersNaming(found.verses ?? []);
  if (!members.length && !chapters.length) return null;
  const shown = members.slice(0, 2 * MOST);
  return planOf({
    kind: 'group',
    address: id,
    title: found.title,
    short: found.title,
    right: [{ cards: shown }, { cards: chapters, toward: true }],
    lines: [
      `From Theographic: ${found.title}, ${listed([members.length ? counted(members.length, 'member') : '', found.verses?.length ? `named in ${verseCount(found.verses.length)}` : ''], '')}.`,
      shown.length ? `The members named most, beside the note: ${titlesOf(shown, all, shown.length)}.` : '',
      chapters.length ? `The passages that name the group: ${listed(chapters.map(referenceOf), '')}.` : '',
    ].filter(Boolean),
  });
}

/**
 * A chapter's place in the canon, as one number that sorts the chapters: an
 * event's verses are not always in canon order.
 *
 * @param {string} key such as EXO.12
 */
function canonKey(key) {
  const [book, chapter] = key.split('.');
  return books.findIndex((each) => each.id === book) * 1000 + Number(chapter);
}

/**
 * The chapters that name a person, place, group or event most (at most
 * MOST, in canon order), each as the verses from the first that names them
 * to the last, ten at most.
 *
 * @param {string[]} verses the verses that name them, in canon order
 */
function chaptersNaming(verses) {
  /** @type {Map<string, number[]>} */
  const byChapter = new Map();
  for (const verse of verses) {
    const [book, chapter, number] = verse.split('.');
    const key = `${book}.${chapter}`;
    byChapter.set(key, [...(byChapter.get(key) ?? []), Number(number)]);
  }
  const most = [...byChapter].sort((x, y) => y[1].length - x[1].length).slice(0, MOST);
  return most
    .sort((x, y) => canonKey(x[0]) - canonKey(y[0]))
    .map(([key, numbers]) => {
      const first = Math.min(...numbers);
      const last = Math.min(Math.max(...numbers), first + 9);
      return last > first ? `${key}.${first}-${last}` : `${key}.${first}`;
    });
}

// The landscape.

/**
 * @typedef {{ address: string, title: string, x: number, w: number }} Cell
 * @typedef {{ x: number, y: number, size: number }} Mark
 * @typedef {{ name: string, y: number, cells: Cell[], marks: Mark[], end: number, total: string }} Row
 * @typedef {{ label: string, y: number, rows: Row[] }} Group
 * @typedef {{
 *   title: string, summary: string, subject: string, mode: string,
 *   width: number, height: number, groups: Group[], credit: string
 * }} Landscape
 */

// The drawing, in the SVG's own units. Psalms has 150 chapters, so in the
// grid of chapters it takes two rows, and the widest row is Isaiah's 66.
const LABEL = 160;
const ROW = 18;
const HEADER = 28;
const CELL = 12;
const PITCH = 13;
const WIDEST = 75;
const BAR = WIDEST * PITCH;
const LONGEST = Math.max(...books.map((each) => each.verses.reduce((sum, n) => sum + n, 0)));

/**
 * How many times a code is used in a verse's codes. Words in a row with the
 * same code are one use, as "in the beginning" is.
 *
 * @param {string} codes
 * @param {string} code
 */
function usesIn(codes, code) {
  let count = 0;
  let before = '';
  for (const each of codes.split(' ')) {
    if (each === code && before !== code) count += 1;
    before = each;
  }
  return count;
}

/**
 * How often the subject occurs in each chapter, as `BOOK.chapter` to a count,
 * with words for the summary. Null for a subject the data does not have.
 *
 * @param {string} subject a Strong's number, an entity id, text:<words>, or
 *   grammar:<a search by grammar>
 */
async function countsFor(subject) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  /** @param {string} address */
  const add = (address, n = 1) => {
    const [book, chapter] = address.split('.');
    const key = `${book}.${chapter}`;
    counts.set(key, (counts.get(key) ?? 0) + n);
  };

  if (/^[HG]\d{1,5}$/.test(subject)) {
    const all = await Promise.all(books.map((each) => strongsBook(each.id)));
    for (const each of all) {
      for (const [address, codes] of Object.entries(each)) {
        const n = usesIn(codes, subject);
        if (n) add(address, n);
      }
    }
    if (!counts.size) return null;
    return { counts, title: `Where ${subject} occurs`, unit: 'times' };
  }
  if (subject.startsWith('grammar:')) {
    const text = subject.slice(8).trim();
    const query = text ? await grammarQuery(text) : null;
    if (!query) return null;
    for (const hit of await grammarFind(query)) add(hit.address, hit.found.length);
    return { counts, title: `Where: ${text[0].toUpperCase()}${text.slice(1)}`, unit: 'times' };
  }
  if (subject.startsWith('text:')) {
    const text = subject.slice(5).trim();
    if (!text) return null;
    const { first, rest } = await matching(text);
    for (const verse of [...first, ...rest]) add(verse.address);
    return { counts, title: `Where “${text.replace(/^"|"$/g, '')}” occurs`, unit: 'verses' };
  }
  const found = await entity(subject);
  if (!found) return null;
  for (const address of found.verses) add(address);
  const verb = found.kind === 'event' ? 'is told' : 'is named';
  return { counts, title: `Where ${found.title} ${verb}`, unit: 'verses' };
}

/**
 * A landscape card: `books` compares the books; anything else is a subject
 * whose chapters are marked.
 *
 * @param {string} subject
 * @returns {Promise<Landscape | null>}
 */
export async function landscape(subject) {
  if (subject === 'books') return booksLandscape();
  const found = await countsFor(subject);
  if (!found) return null;
  const { counts, title, unit } = found;
  const max = Math.max(1, ...counts.values());
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const bookCount = new Set([...counts.keys()].map((key) => key.split('.')[0])).size;

  let y = 0;
  /** @type {Group[]} */
  const groups = GROUPS.map((group) => {
    const groupY = y;
    y += HEADER;
    let groupTotal = 0;
    /** @type {Row[]} */
    const rows = [];
    for (const id of group.books) {
      const entry = books.find((each) => each.id === id);
      if (!entry) continue;
      const chapters = entry.verses.length;
      for (let start = 1; start <= chapters; start += WIDEST) {
        const end = Math.min(chapters, start + WIDEST - 1);
        /** @type {Cell[]} */
        const cells = [];
        /** @type {Mark[]} */
        const marks = [];
        let rowTotal = 0;
        for (let chapter = start; chapter <= end; chapter += 1) {
          const x = LABEL + (chapter - start) * PITCH;
          const n = counts.get(`${id}.${chapter}`) ?? 0;
          rowTotal += n;
          cells.push({ address: `${id}.${chapter}`, title: `${entry.name} ${chapter}: ${n}`, x, w: CELL });
          if (n) {
            const size = Math.max(2, Math.round(CELL * Math.sqrt(n / max) * 10) / 10);
            marks.push({ x: x + (CELL - size) / 2, y: (CELL - size) / 2, size });
          }
        }
        groupTotal += rowTotal;
        const name = chapters > WIDEST ? `${entry.name} ${start}–${end}` : entry.name;
        rows.push({ name, y, cells, marks, end: LABEL + (end - start + 1) * PITCH + 8, total: rowTotal ? rowTotal.toLocaleString('en') : '' });
        y += ROW;
      }
    }
    return { label: `${group.name}${groupTotal ? `: ${groupTotal.toLocaleString('en')}` : ''}`, y: groupY, rows };
  });

  const unitWord = unit === 'times' ? (total === 1 ? 'once' : `${total.toLocaleString('en')} times`) : verseCount(total);
  const summary = `${unitWord[0].toUpperCase()}${unitWord.slice(1)}, in ${bookCount === 1 ? '1 book' : `${bookCount} books`} and ${counts.size === 1 ? '1 chapter' : `${counts.size} chapters`}. A larger mark is more; a tap opens the chapter.`;
  const credit = subject.startsWith('text:')
    ? 'The KJV text (eBible.org, public domain).'
    : /^[HG]\d/.test(subject)
      ? "Strong's numbers: Open Scriptures (CC BY-SA)."
      : 'Verse links: Theographic (CC BY-SA).';
  return { title, summary, subject, mode: 'count', width: LABEL + BAR + 60, height: y, groups, credit };
}

/** The books compared: each a bar as long as its verses, cut into chapters. */
function booksLandscape() {
  const scale = BAR / LONGEST;
  let y = 0;
  /** @type {Group[]} */
  const groups = GROUPS.map((group) => {
    const groupY = y;
    y += HEADER;
    let verseTotal = 0;
    /** @type {Row[]} */
    const rows = [];
    for (const id of group.books) {
      const entry = books.find((each) => each.id === id);
      if (!entry) continue;
      let x = LABEL;
      const cells = entry.verses.map((count, i) => {
        const cell = { address: `${id}.${i + 1}`, title: `${entry.name} ${i + 1}: ${verseCount(count)}`, x, w: count * scale };
        x += count * scale;
        return cell;
      });
      const verses = entry.verses.reduce((sum, n) => sum + n, 0);
      verseTotal += verses;
      const chapters = entry.verses.length;
      const facts = `${chapters === 1 ? '1 chapter' : `${chapters} chapters`}, ${verses.toLocaleString('en')} verses · ${AUTHORS[id] ?? 'Not known'}`;
      rows.push({ name: entry.name, y, cells, marks: [], end: x + 8, total: facts });
      y += ROW;
    }
    const count = rows.length === 1 ? '1 book' : `${rows.length} books`;
    return { label: `${group.name}: ${count}, ${verseTotal.toLocaleString('en')} verses`, y: groupY, rows };
  });
  return {
    title: 'The books of the Bible',
    summary: 'Each book is a bar as long as its verses, cut into its chapters. A tap opens the chapter.',
    subject: 'books',
    mode: 'books',
    width: LABEL + BAR + 420,
    height: y,
    groups,
    credit: CANON_CREDIT,
  };
}

/**
 * A topic of Nave's Topical Bible, open, as a view of its own.
 *
 * @param {string} key such as PRAYER
 * @returns {Promise<Results>}
 */
export async function topicResults(key) {
  const found = await topic(key);
  return found ? answer({ topic: found, topicOpen: true }) : answer({ summary: 'There is no such topic.' });
}
