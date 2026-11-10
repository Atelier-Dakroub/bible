// "Did you know?": facts about the Bible, worked out from this app's own data,
// each with a way to see it for yourself. The search panel shows one when it
// has nothing else to show, and on its ✦ button (routes/search.html).
//
// Every fact is computed, not written by hand, so it is as true as the data,
// and it names its source. They are worked out once, when first asked for.

import { allVerses, books, original, strongsResults } from './bible.js';
import { entities } from './entities.js';
import { journeysFor } from './journeys.js';
import { formatReference, parseAddress } from '../lib/reference.js';

/**
 * A fact. Its way to see it is one of: an entity to show, a passage to put on
 * the table (in a version), a search to run, or a journey to draw.
 *
 * @typedef {{
 *   text: string, source: string,
 *   entity: string, address: string, version: string, search: string, journey: string
 * }} Fact
 */

/** @param {Partial<Fact> & { text: string, source: string }} fields @returns {Fact} */
const fact = (fields) => ({ entity: '', address: '', version: '', search: '', journey: '', ...fields });

/** @param {number} n */
const count = (n) => n.toLocaleString('en');

/** @param {string} address */
const titleOf = (address) => {
  const ref = parseAddress(address, books);
  return ref ? formatReference(ref, books) : address;
};

const KJV = 'Worked out from the King James Version (public domain).';
const THEOGRAPHIC = 'Worked out from Theographic (CC BY-SA).';
const STEP = 'Worked out from STEPBible.org, from Tyndale House, Cambridge (CC BY 4.0).';

/** @type {Promise<Fact[]> | null} */
let all = null;

/** Every fact, worked out once. */
export function facts() {
  all ??= workOut();
  return all;
}

/** @returns {Promise<Fact[]>} */
async function workOut() {
  /** @type {Fact[]} */
  const found = [];
  const [verses, known] = await Promise.all([allVerses(), entities()]);

  // The verses: the shortest, the longest, how many.
  const words = (/** @type {string} */ text) => text.split(/\s+/).filter(Boolean).length;
  const sorted = [...verses].sort((a, b) => words(a.text) - words(b.text));
  const shortest = sorted[0];
  const longest = sorted[sorted.length - 1];
  found.push(
    fact({ text: `The shortest verse in the KJV is ${shortest.title}: “${shortest.text}”`, address: shortest.address, source: KJV }),
    fact({ text: `The longest verse in the KJV is ${longest.title}, at ${words(longest.text)} words.`, address: longest.address, source: KJV }),
  );

  // The chapters: the shortest, the longest, the middle one.
  /** @type {{ address: string, verses: number }[]} */
  const chapters = [];
  for (const book of books) book.verses.forEach((n, i) => chapters.push({ address: `${book.id}.${i + 1}`, verses: n }));
  const byLength = [...chapters].sort((a, b) => a.verses - b.verses);
  const short = byLength[0];
  const long = byLength[byLength.length - 1];
  const middle = chapters[Math.floor(chapters.length / 2)];
  found.push(
    fact({ text: `The shortest chapter is ${titleOf(`${short.address}.1`).replace(/:1$/, '')}, with ${short.verses} verses; the longest is ${titleOf(`${long.address}.1`).replace(/:1$/, '')}, with ${long.verses}.`, address: `${short.address}.1-${short.verses}`, source: KJV }),
    fact({ text: `The KJV has ${count(verses.length)} verses in ${count(chapters.length)} chapters. The middle chapter is ${titleOf(`${middle.address}.1`).replace(/:1$/, '')}.`, address: `${middle.address}.1-${middle.verses}`, source: KJV }),
  );

  // People and places.
  const people = Object.entries(known).filter(([, each]) => each.kind === 'person');
  const places = Object.entries(known).filter(([, each]) => each.kind === 'place');
  const lives = people
    .filter(([, each]) => typeof each.born === 'number' && typeof each.died === 'number' && each.died > each.born)
    .map(([id, each]) => ({ id, title: each.title, years: /** @type {number} */ (each.died) - /** @type {number} */ (each.born) }))
    .sort((a, b) => b.years - a.years);
  if (lives[0]) {
    found.push(fact({ text: `${lives[0].title} lived ${lives[0].years} years, by Jones's dates: the longest life the Bible records. Next is ${lives[1].title}, at ${lives[1].years}.`, entity: lives[0].id, source: THEOGRAPHIC }));
  }
  const named = (/** @type {[string, any][]} */ list) => [...list].sort((a, b) => b[1].verses.length - a[1].verses.length);
  const [topPlace] = named(places);
  found.push(fact({ text: `${topPlace[1].title} is named in ${count(topPlace[1].verses.length)} verses, more than any other place.`, entity: topPlace[0], source: THEOGRAPHIC }));
  const humans = named(people).filter(([id]) => !/^person:(god|jesus)_/.test(id));
  found.push(fact({ text: `Apart from God and Jesus, the person named in the most verses is ${humans[0][1].title}, in ${count(humans[0][1].verses.length)}; then ${humans[1][1].title}, in ${count(humans[1][1].verses.length)}.`, entity: humans[0][0], source: THEOGRAPHIC }));
  found.push(fact({ text: `This app knows ${count(people.length)} people and ${count(places.length)} places of the Bible, and the verses that name each one.`, source: THEOGRAPHIC }));

  // Words of the original languages, as the KJV renders them.
  for (const [code, name] of [['H2617', 'The Hebrew word chesed'], ['G26', 'The Greek word agapē'], ['H7965', 'The Hebrew word shalom']]) {
    const stats = (await strongsResults(code, 1)).stats;
    // "the love" is "love" again, with the article: one rendering each.
    const renderings = (stats?.renderings ?? []).filter((each) => !/^the /.test(each.text));
    if (renderings.length < 2) continue;
    const [first, second, third] = renderings;
    const times = (/** @type {number} */ n) => (n === 1 ? 'once' : `${n} times`);
    const more = third ? `, “${third.text}” ${times(third.count)}` : '';
    found.push(fact({ text: `${name} (${code}) is rendered “${first.text}” ${times(first.count)} in the KJV, “${second.text}” ${times(second.count)}${more}.`, search: code, source: `${KJV} Strong's numbers: eBible.org.` }));
  }

  // The Aramaic of the Old Testament.
  for (const [from, to] of [['DAN.2.4', 'DAN.7.28'], ['EZR.4.8', 'EZR.6.18']]) {
    const ref = parseAddress(`${from}-${to.split('.').slice(1).join('.')}`, books);
    if (!ref) continue;
    const text = await original(ref);
    const aramaic = text.verses.filter((verse) => verse.words.some((word) => word.code.startsWith('A')));
    if (aramaic.length > text.verses.length * 0.9) {
      found.push(fact({ text: `${titleOf(from)} to ${titleOf(to).replace(/^\D+ /, '')} is written in Aramaic, not Hebrew: ${count(aramaic.length)} verses.`, address: from, version: 'original', source: STEP }));
    }
  }

  // The Greek text the KJV translated, beside the critical text.
  const johannine = parseAddress('1JN.5.7-8', books);
  if (johannine) {
    const text = await original(johannine);
    const only = text.verses.flatMap((verse) => verse.words).filter((word) => word.tr).length;
    found.push(fact({ text: `The Greek the KJV translated has ${only} words in 1 John 5:7–8 that the modern critical text does not: the passage about the three that bear record in heaven.`, address: '1JN.5.7-8', version: 'interlinear', source: STEP }));
  }

  // Paul's journeys.
  for (const journey of await journeysFor({ person: 'person:paul_2479' })) {
    const names = journey.stops.map((stop) => stop.name);
    const via = [...new Set(names.slice(1, -1))].slice(0, 3).join(', ');
    found.push(fact({ text: `${journey.title} covered about ${count(journey.km)} km in straight legs, by way of ${via}, and more.`, journey: JSON.stringify(journey), source: `Acts, with the places from Theographic (CC BY-SA).` }));
  }

  // Parallel passages.
  const { default: parallels } = await import('./parallels.json', { with: { type: 'json' } });
  for (const [a, b] of /** @type {[string, string, number][]} */ ([...parallels]).sort((x, y) => y[2] - x[2]).slice(0, 4)) {
    found.push(fact({ text: `${titleOf(a)} and ${titleOf(b)} tell much the same thing: the cross-references join them verse by verse.`, address: a, source: 'Worked out from the cross-references of OpenBible.info (CC BY).' }));
  }

  return found;
}

/**
 * One fact, and the number of the next one to show after it, so "Another"
 * goes through all of them before it shows one again.
 *
 * @param {number} [n] which fact; a random one when it is not a number
 */
export async function didYouKnow(n) {
  const list = await facts();
  const index = Number.isInteger(n) && /** @type {number} */ (n) >= 0 ? /** @type {number} */ (n) % list.length : Math.floor(Math.random() * list.length);
  return { fact: list[index], next: (index + 1) % list.length };
}
