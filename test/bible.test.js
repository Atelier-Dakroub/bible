import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passage, plainText, preview, referenceResults, referencesIn, search, wordResults } from '../app/data/bible.js';
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
  assert.deepEqual(parse(null), { offset: { x: 0, y: 0 }, cards: [], highlights: [], links: [] });
  assert.deepEqual(parse('not json'), { offset: { x: 0, y: 0 }, cards: [], highlights: [], links: [] });
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
