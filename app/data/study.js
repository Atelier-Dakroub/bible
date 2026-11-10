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
import { answer, books, entityView, grammarFind, grammarQuery, matching, passage, preview, referenceBook, strongsBook, verseCount } from './bible.js';
import { entities, entity, formatYear, namedIn } from './entities.js';
import { onMap } from '../lib/map.js';
import { formatReference, parseAddress, toAddress, versesIn } from '../lib/reference.js';
import { parseSpanAddress } from '../lib/words.js';
import { journeysFor } from './journeys.js';
import { imagesOf } from './images.js';
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
