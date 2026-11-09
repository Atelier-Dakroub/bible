import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entityResults, parallel, passage, worldResults, plainText, preview, referenceResults, referencesIn, search, wordResults } from '../app/data/bible.js';
import { eastonFor, formatYear, mapOf, timeline } from '../app/data/entities.js';
import { HEIGHT, WIDTH, project } from '../app/lib/map.js';
import { ERAS, packLanes, positionOf } from '../app/lib/timeline.js';
import { pan } from '../app/lib/gesture.js';
import { parse } from '../app/lib/workspace.js';
import { covers, span, tokenize, toggle, wordKey } from '../app/lib/words.js';
import { dropLinksTo, firstCovered, removed, toggleLink, versesOf } from '../app/lib/links.js';

test('a passage holds the verses of its range', async () => {
  const { title, verses } = await passage({ book: 'JHN', chapter: 3, from: 16, to: 18 });
  assert.equal(title, 'John 3:16–18');
  assert.deepEqual(verses.map((verse) => verse.id), ['JHN.3.16', 'JHN.3.17', 'JHN.3.18']);
});

test('a whole chapter has every verse', async () => {
  const { verses } = await passage({ book: 'PSA', chapter: 117 });
  assert.equal(verses.length, 2);
  assert.match(plainText(verses[0]), /^O praise the LORD/);
});

test('a reference query gives the passage', async () => {
  const found = await search('jn 3:16');
  assert.equal(found.results.length, 1);
  assert.equal(found.results[0].address, 'JHN.3.16');
  assert.equal(found.summary, 'Passage, 1 verse');
});

test('words find verses that hold all of them, and mark whole words', async () => {
  const found = await search('beginning word');
  assert.ok(found.results.some((result) => result.address === 'JHN.1.1'));
  const john = found.results.find((result) => result.address === 'JHN.1.1');
  const marked = john?.parts.filter((part) => part.hit).map((part) => part.text);
  assert.deepEqual(marked, ['beginning', 'Word', 'Word', 'Word']);
});

test('a word matches the start of a word', async () => {
  const found = await search('begin');
  assert.ok(found.results.some((result) => result.address === 'GEN.1.1'));
});

test('a short word matches only itself, and the phrase comes first', async () => {
  const found = await search('in the beginning');
  assert.equal(found.results[0].address, 'GEN.1.1');
  const marked = found.results.flatMap((result) => result.parts.filter((part) => part.hit).map((part) => part.text.toLowerCase()));
  assert.ok(!marked.includes('they'));
  assert.ok(!marked.includes('into'));
});

test('a quoted phrase must appear as written', async () => {
  const found = await search('"Jesus wept"');
  assert.deepEqual(found.results.map((result) => result.address), ['JHN.11.35']);
});

test('a common word is cut to the limit and says so', async () => {
  const found = await search('the');
  assert.equal(found.results.length, 50);
  assert.match(found.summary, /^The first 50 of [\d,]+ verses$/);
});

test('the table pans by the mean move of the fingers in both frames', () => {
  const before = new Map([[1, { x: 0, y: 0 }], [2, { x: 10, y: 0 }]]);
  const after = new Map([[1, { x: 4, y: 2 }], [2, { x: 16, y: 2 }], [3, { x: 99, y: 99 }]]);
  assert.deepEqual(pan(before, after), { x: 5, y: 2 });
});

test('a broken or old workspace reads as an empty table', () => {
  assert.deepEqual(parse(null), { offset: { x: 0, y: 0 }, cards: [], highlights: [], links: [], notes: [] });
  assert.deepEqual(parse('not json'), { offset: { x: 0, y: 0 }, cards: [], highlights: [], links: [], notes: [] });
  const kept = parse(
    JSON.stringify({
      offset: { x: 5, y: 6 },
      cards: [{ address: 'JHN.3.16', matrix: { a: 1, b: 0, c: 0, d: 1, e: 2, f: 3 } }, { address: 'BAD' }],
    }),
  );
  assert.deepEqual(kept.offset, { x: 5, y: 6 });
  assert.deepEqual(kept.cards.map((card) => card.address), ['JHN.3.16']);
});

test('a preview cuts at a word and drops the paragraph marks', async () => {
  const { verses } = await passage({ book: 'GEN', chapter: 1 });
  const text = preview(verses, 40);
  assert.equal(text, 'In the beginning God created the heaven …');
  const { verses: esther } = await passage({ book: 'EST', chapter: 7, from: 7 });
  assert.ok(!preview(esther).includes('¶'));
});

test('words are numbered across runs, and punctuation alone is not a word', () => {
  const first = tokenize('LORD', 1);
  const second = tokenize(', how are they increased ', first.next);
  assert.deepEqual(first.tokens, [{ text: 'LORD', w: 1 }]);
  assert.deepEqual(second.tokens.map((token) => token.w), [0, 2, 3, 4, 5]);
  assert.deepEqual(tokenize('¶ And', 1).tokens, [{ text: '¶ ', w: 0 }, { text: 'And', w: 1 }]);
});

test('a passage carries its numbered words', async () => {
  const { verses } = await passage({ book: 'JHN', chapter: 11, from: 35 });
  const words = verses[0].blocks.flatMap((block) => block.runs.flatMap((run) => run.tokens ?? []));
  assert.deepEqual(words.filter((token) => token.w).map((token) => [token.text, token.w]), [['Jesus ', 1], ['wept.', 2]]);
});

test('word addresses sort in canon order across verses, chapters and books', () => {
  const order = ['GEN.1.1.w2', 'GEN.1.1.w10', 'GEN.1.2.w1', 'GEN.2.1.w1', 'EXO.1.1.w1', 'REV.22.21.w1'];
  assert.deepEqual([...order].sort((a, b) => wordKey(a) - wordKey(b)), order);
  assert.deepEqual(span('JHN.3.17.w2', 'JHN.3.16.w5'), { from: 'JHN.3.16.w5', to: 'JHN.3.17.w2' });
  assert.ok(covers({ from: 'JHN.3.16.w5', to: 'JHN.3.17.w2' }, 'JHN.3.16.w30'));
  assert.ok(!covers({ from: 'JHN.3.16.w5', to: 'JHN.3.17.w2' }, 'JHN.3.17.w3'));
});

test('marking adds a span, marking it again removes it, and a tap removes what is under it', () => {
  let list = toggle([], 'JHN.3.16.w7', 'JHN.3.16.w3');
  assert.deepEqual(list, [{ from: 'JHN.3.16.w3', to: 'JHN.3.16.w7' }]);
  list = toggle(list, 'GEN.1.1.w1', 'GEN.1.1.w4');
  assert.equal(list.length, 2);
  assert.deepEqual(toggle(list, 'JHN.3.16.w3', 'JHN.3.16.w7'), [{ from: 'GEN.1.1.w1', to: 'GEN.1.1.w4' }]);
  assert.deepEqual(toggle(list, 'JHN.3.16.w5', 'JHN.3.16.w5'), [{ from: 'GEN.1.1.w1', to: 'GEN.1.1.w4' }]);
  assert.equal(toggle(list, 'ROM.8.28.w2', 'ROM.8.28.w2').length, 3);
});

test('a stored highlight with a bad address is dropped', () => {
  const kept = parse(JSON.stringify({ highlights: [{ from: 'JHN.3.16.w1', to: 'JHN.3.16.w4' }, { from: 'x', to: 'y' }] }));
  assert.deepEqual(kept.highlights, [{ from: 'JHN.3.16.w1', to: 'JHN.3.16.w4' }]);
});

const love = { from: 'JHN.3.16.w2', to: 'JHN.3.16.w6' };
const light = { from: 'GEN.1.3.w1', to: 'GEN.1.3.w9' };

test('a link has no direction, and drawing it again removes it', () => {
  const one = toggleLink([], love, light);
  assert.equal(one.length, 1);
  assert.deepEqual(toggleLink(one, light, love), []);
  assert.deepEqual(toggleLink([], love, love), []);
});

test('removing a highlight removes the links to it', () => {
  const links = toggleLink(toggleLink([], love, light), light, { from: 'ROM.8.28.w1', to: 'ROM.8.28.w5' });
  const gone = removed([love, light], [light]);
  assert.deepEqual(gone, [love]);
  assert.equal(dropLinksTo(links, gone).length, 1);
});

test('the first word a span covers is found in a sorted index', () => {
  const index = ['JHN.3.15.w1', 'JHN.3.16.w1', 'JHN.3.16.w2', 'JHN.3.16.w3', 'JHN.3.17.w1'].map((address) => ({ key: wordKey(address), item: address }));
  assert.equal(firstCovered(index, love), 'JHN.3.16.w2');
  assert.equal(firstCovered(index, { from: 'JHN.3.16.w9', to: 'JHN.3.16.w12' }), null);
  assert.equal(firstCovered(index, { from: 'JHN.3.14.w1', to: 'JHN.3.15.w4' }), 'JHN.3.15.w1');
});

test('a stored link with a bad end is dropped', () => {
  const kept = parse(JSON.stringify({ links: [{ a: love, b: light }, { a: love, b: { from: 'x', to: 'y' } }] }));
  assert.deepEqual(kept.links, [{ a: love, b: light }]);
});

test('a passage has the cross-references of its verses, best first', async () => {
  const refs = await referencesIn({ book: 'JHN', chapter: 3, from: 16, to: 17 });
  assert.deepEqual(Object.keys(refs), ['JHN.3.16', 'JHN.3.17']);
  assert.equal(refs['JHN.3.16'][0][0], 'ROM.5.8');
  const votes = refs['JHN.3.16'].map(([, count]) => count);
  assert.deepEqual(votes, [...votes].sort((a, b) => b - a));
});

test('the cross-references of a verse read as search results, with credit', async () => {
  const found = await referenceResults('JHN.3.16');
  assert.equal(found.results[0].title, 'Romans 5:8');
  assert.match(found.summary, /^John 3:16: \d+ cross-references, most voted first\. From OpenBible\.info\.$/);
  assert.equal((await referenceResults('JHN.3')).summary, 'That is not one verse.');
});

test('a target address names its verses', () => {
  assert.deepEqual(versesOf('ROM.5.8'), ['ROM.5.8']);
  assert.deepEqual(versesOf('1JN.4.9-10'), ['1JN.4.9', '1JN.4.10']);
});

test('the words of a passage carry their Strong\'s numbers', async () => {
  const { verses } = await passage({ book: 'GEN', chapter: 1, from: 1 });
  const tokens = verses[0].blocks.flatMap((block) => block.runs.flatMap((run) => run.tokens)).filter((token) => token.w);
  assert.deepEqual(tokens.slice(0, 4).map((token) => [token.text.trim(), token.s]), [['In', null], ['the', null], ['beginning', 'H7225'], ['God', 'H430']]);
});

test('a Strong\'s number finds the verses that use it, with its entry', async () => {
  const found = await search('g0025');
  assert.equal(found.entry?.code, 'G25');
  assert.equal(found.entry?.lemma, 'ἀγαπάω');
  assert.ok(found.results.some((result) => result.address === 'JHN.3.16'));
  const john = found.results.find((result) => result.address === 'JHN.3.16');
  assert.deepEqual(john?.parts.filter((part) => part.hit).map((part) => part.text.trim()), ['loved']);
});

test('a tap on a word studies its number, or lists the cross-references', async () => {
  const study = await wordResults('JHN.3.16.w4');
  assert.equal(study.entry?.code, 'G25');
  assert.equal(study.refsFor, 'JHN.3.16');
  assert.equal(study.refsTitle, 'John 3:16');
  const plainWord = await wordResults('GEN.1.1.w1');
  assert.equal(plainWord.entry, null);
  assert.match(plainWord.summary, /^Genesis 1:1: \d+ cross-references/);
});

test('a word that names a person shows the person first, with both other views offered', async () => {
  const { verses } = await passage({ book: 'GEN', chapter: 23, from: 10 });
  const ephron = verses[0].blocks.flatMap((block) => block.runs.flatMap((run) => run.tokens)).find((token) => token.e?.startsWith('person:ephron'));
  assert.ok(ephron);
  const shown = await wordResults(`GEN.23.10.w${ephron.w}`);
  assert.equal(shown.entity?.title, 'Ephron');
  assert.equal(shown.refsFor, 'GEN.23.10');
  assert.match(shown.studyCode, /^H\d+$/);
});

test("a people's name with no linked entity finds its Easton entry", async () => {
  assert.equal((await eastonFor('Hittite'))?.term, 'Hittites');
  assert.equal((await eastonFor('Amorites'))?.term, 'Amorites');
  assert.equal(await eastonFor('of'), null);
});

test('an event shows its date with the chronology named, and the verses that tell it', async () => {
  const event = timeline.find((each) => each.title === 'Exodus from Egypt');
  const exodus = await entityResults(event?.id ?? '');
  assert.match(exodus.entity?.facts.join(' ') ?? '', /1491 BC/);
  assert.match(exodus.entity?.credit ?? '', /Floyd Nolen Jones/);
  assert.ok(exodus.results.length > 0);
});

test('years read as BC and AD, from astronomical numbering', () => {
  assert.equal(formatYear(-4003), '4004 BC');
  assert.equal(formatYear(0), '1 BC');
  assert.equal(formatYear(30), 'AD 30');
});

test('the time axis gives each era the same width, and is linear inside one', () => {
  assert.equal(positionOf(ERAS[0].from), 0);
  assert.equal(positionOf(ERAS[1].from), 1 / ERAS.length);
  const middle = (ERAS[6].from + ERAS[6].to) / 2;
  assert.ok(Math.abs(positionOf(middle) - 6.5 / ERAS.length) < 1e-9);
  assert.equal(positionOf(500), 1);
});

test('the BSB sits beside the KJV verse by verse, and a verse it leaves out is empty', async () => {
  const { rows } = await parallel({ book: 'MAT', chapter: 17, from: 20, to: 22 });
  assert.deepEqual(rows.map((row) => row.verse.id), ['MAT.17.20', 'MAT.17.21', 'MAT.17.22']);
  assert.equal(rows[1].bsb.length, 0);
  assert.ok(rows[0].bsb.length > 0);
  const psalm = await parallel({ book: 'PSA', chapter: 23, from: 1 });
  assert.deepEqual(psalm.rows[0].bsb.map((block) => [block.style, block.numbered]), [['d', false], ['q1', true], ['q2', false]]);
});

test('a stored card keeps a known version and drops an unknown one', () => {
  const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const kept = parse(JSON.stringify({ cards: [{ address: 'JHN.3.16', matrix, version: 'both' }, { address: 'JHN.3.17', matrix, version: 'nope' }] }));
  assert.deepEqual(kept.cards.map((card) => card.version), ['both', undefined]);
});

test('world spans pack into lanes that never overlap, region by region', () => {
  const spans = [
    { id: 'a', name: 'A', label: '', region: 'Egypt', start: -1500, end: -1000 },
    { id: 'b', name: 'B', label: '', region: 'Egypt', start: -1200, end: -800 },
    { id: 'c', name: 'C', label: '', region: 'Egypt', start: -900, end: -500 },
    { id: 'd', name: 'D', label: '', region: 'Persia', start: -600, end: -300 },
  ];
  const regions = packLanes(spans);
  assert.deepEqual(regions.map((region) => region.name), ['Egypt', 'Persia']);
  assert.deepEqual(regions[0].lanes.map((lane) => lane.map((span) => span.id)), [['a', 'c'], ['b']]);
});

test('a world span lists the biblical events inside it, and names both chronologies', async () => {
  const assyria = await worldResults('world:Q10914393');
  assert.equal(assyria.entity?.title, 'Neo-Assyrian Empire');
  assert.match(assyria.entity?.credit ?? '', /Wikidata.*Jones/s);
  assert.ok(assyria.results.length > 0);
  assert.match(assyria.summary, /biblical events? falls? in these years/);
});

test('the map projects places inside its frame, with Jerusalem east of Joppa', async () => {
  const jerusalem = project(35.23, 31.78);
  const joppa = project(34.75, 32.05);
  assert.ok(jerusalem.x > joppa.x && jerusalem.y > joppa.y);
  for (const point of [jerusalem, joppa]) assert.ok(point.x > 0 && point.x < WIDTH && point.y > 0 && point.y < HEIGHT);
  const map = await mapOf();
  assert.ok(map.land.length > 0 && map.lakes.length > 0);
  assert.ok(map.places.length > 1200);
});

test('a place on the map offers it; a person does not', async () => {
  const hebron = await entityResults('place:hebron_551');
  assert.equal(hebron.entity?.mapped, true);
  const david = await entityResults('person:david_994');
  assert.equal(david.entity?.mapped, false);
});
