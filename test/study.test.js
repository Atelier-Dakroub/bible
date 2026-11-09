import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { books, parallel, strongsResults, search } from '../app/data/bible.js';
import { guideResults, landscape, parallelsOf } from '../app/data/study.js';
import { AUTHORS, GROUPS } from '../app/data/canon.js';
import { differences, plain } from '../app/lib/compare.js';
import { matches, nextStyle, RULE_STYLES, stylesFor, toggleRule, toRule } from '../app/lib/rules.js';
import { parseAddress } from '../app/lib/reference.js';
import { parse, snapshot } from '../app/lib/workspace.js';

const parallels = JSON.parse(readFileSync(new URL('../app/data/parallels.json', import.meta.url), 'utf8'));

test('every book is in one group and has a traditional author', () => {
  const grouped = GROUPS.flatMap((group) => group.books);
  assert.deepEqual(grouped, books.map((book) => book.id));
  for (const book of books) assert.ok(AUTHORS[book.id], book.id);
});

test('the parallels hold the well-known ones, each once and in canon order', () => {
  const has = (/** @type {RegExp} */ a, /** @type {RegExp} */ b) => parallels.some(([x, y]) => a.test(x) && b.test(y));
  assert.ok(has(/^2SA\.22\./, /^PSA\.18\./), '2 Samuel 22 and Psalm 18');
  assert.ok(has(/^2KI\.18\./, /^ISA\.36\./), '2 Kings 18 and Isaiah 36');
  assert.ok(has(/^1KI\.8\./, /^2CH\.[56]\./), "Solomon's prayer in Kings and Chronicles");
  assert.ok(has(/^MAT\.3\./, /^MRK\.1\./), 'the baptism in Matthew and Mark');
  for (const [a, b, pairs] of parallels) {
    assert.ok(parseAddress(a, books) && parseAddress(b, books), `${a} ${b}`);
    assert.ok(pairs >= 3);
  }
});

test('a passage finds its parallels, the surest first, and not itself', () => {
  const found = parallelsOf(/** @type {any} */ (parseAddress('PSA.18', books)));
  assert.match(found[0].address, /^2SA\.22\./);
  assert.ok(found.every((each) => !each.address.startsWith('PSA.18.')));
});

test('the guide gathers parallels, cross-references and what the passage names', async () => {
  const { guide, summary } = await guideResults('2KI.18');
  assert.ok(guide);
  assert.equal(summary, 'Guide to 2 Kings 18: 37 verses.');
  assert.ok(guide.parallels.some((each) => each.address.startsWith('ISA.36')));
  assert.equal(guide.beside.split(',').length, guide.parallels.length);
  assert.ok(guide.references.length > 0);
  assert.ok(guide.references.every((each) => !each.address.startsWith('2KI.18.')), 'not the passage itself');
  assert.ok(guide.people.some((each) => each.name === 'Hezekiah'));
  assert.ok(guide.places.length > 0 && guide.mapIds.length > 0);
  assert.ok(guide.events.some((each) => /Hezekiah/.test(each.title)));
});

test('a phrase has the guide of its verses, and an entity shows itself', async () => {
  const phrase = await guideResults('JHN.3.16.w3-JHN.3.16.w9');
  assert.equal(phrase.guide?.title, 'John 3:16');
  const person = await guideResults('person:david_994');
  assert.equal(person.entity?.title, 'David');
  assert.equal((await guideResults('map:near-east')).guide, null);
});

test('a word study counts how the KJV renders the word, and where', async () => {
  const { stats, rule, landscape: address } = await strongsResults('H2617');
  assert.ok(stats);
  assert.match(stats.summary, /^247 times in 241 verses, in 28 books\.$/);
  assert.deepEqual(stats.renderings.slice(0, 3).map((each) => each.text), ['mercy', 'kindness', 'lovingkindness']);
  assert.ok(stats.renderings.every((each) => !/[’']$/.test(each.text)), 'no marks left on a rendering');
  assert.equal(stats.bars.length, 66);
  assert.match(stats.most, /^Most in Psalms \(127\)/);
  assert.equal(rule?.kind, 'strongs');
  assert.equal(address, 'landscape:H2617');
});

test('the landscape marks each chapter by how often the subject occurs', async () => {
  const found = await landscape('H2617');
  assert.ok(found);
  const rows = found.groups.flatMap((group) => group.rows);
  assert.equal(rows.flatMap((row) => row.cells).length, 1189, 'one cell per chapter');
  assert.deepEqual(rows.filter((row) => row.name.startsWith('Psalms')).map((row) => row.name), ['Psalms 1–75', 'Psalms 76–150']);
  const marks = rows.flatMap((row) => row.marks);
  assert.equal(marks.length, 144);
  assert.ok(marks.every((mark) => mark.size >= 2 && mark.size <= 12));
  assert.equal((await landscape('text:love one another'))?.summary.split(',')[0], '19 verses');
  assert.equal(await landscape('H999999'), null);
  assert.equal(await landscape('person:nobody'), null);
});

test('the books landscape gives each book a bar as long as its verses', async () => {
  const found = await landscape('books');
  assert.ok(found);
  const rows = found.groups.flatMap((group) => group.rows);
  assert.equal(rows.length, 66);
  const psalms = rows.find((row) => row.name === 'Psalms');
  const jude = rows.find((row) => row.name === 'Jude');
  assert.ok(psalms && jude && psalms.end > jude.end);
  assert.match(String(rows[0].total), /50 chapters, 1,533 verses · Moses/);
});

test('a text search offers its landscape', async () => {
  assert.equal((await search('love one another')).landscape, 'landscape:text:love one another');
  assert.equal((await search('John 3:16')).landscape, '');
});

test('the comparison reads older forms and endings as the same word', () => {
  assert.equal(plain('Believeth'), plain('believes'));
  assert.equal(plain('thee'), plain('you'));
  assert.equal(plain('hath'), plain('has'));
  assert.equal(plain('is'), 'is');
  const { a, b } = differences(['For', 'God', 'so', 'loved'], ['For', 'God', 'loved', 'so', 'much']);
  assert.deepEqual(a, [false, false, true, false]);
  assert.deepEqual(b, [false, false, false, true, true]);
});

test('the parallel view marks the words each translation has alone', async () => {
  const { rows } = await parallel(/** @type {any} */ (parseAddress('JHN.3.16', books)));
  const kjv = rows[0].verse.blocks.flatMap((block) => block.runs.flatMap((run) => run.tokens)).filter((token) => token.d);
  assert.deepEqual(kjv.map((token) => token.text.trim()), ['begotten', 'whosoever', 'should', 'everlasting']);
  const bsb = rows[0].bsb.flatMap((block) => block.parts).filter((part) => part.d).map((part) => part.text.trim());
  assert.deepEqual(bsb, ['one and', 'everyone who', 'shall', 'eternal']);
  assert.equal(rows[0].bsb.map((block) => block.parts.map((part) => part.text).join('')).join(''), rows[0].bsb.map((block) => block.text).join(''));
});

test('a rule marks words by number, entity, kind of name or mark', () => {
  const word = { s: 'H2617', e: 'person:david_994', marks: ['wj'] };
  assert.ok(matches({ kind: 'strongs', value: 'H2617', label: '', style: 'over' }, word));
  assert.ok(matches({ kind: 'entity', value: 'person:david_994', label: '', style: 'over' }, word));
  assert.ok(matches({ kind: 'names', value: 'person', label: '', style: 'over' }, word));
  assert.ok(!matches({ kind: 'names', value: 'place', label: '', style: 'over' }, word));
  assert.ok(matches({ kind: 'text', value: 'wj', label: '', style: 'over' }, word));
  assert.ok(!matches({ kind: 'text', value: 'add', label: '', style: 'over' }, { marks: [] }));
});

test('each new rule takes a style no rule has, and a second add removes it', () => {
  let rules = toggleRule([], { kind: 'text', value: 'wj', label: 'Words of Christ' });
  rules = toggleRule(rules, { kind: 'strongs', value: 'G25', label: 'G25' });
  assert.deepEqual(rules.map((rule) => rule.style), RULE_STYLES.slice(0, 2));
  assert.deepEqual(stylesFor(rules, { s: 'G25', marks: ['wj'] }), RULE_STYLES.slice(0, 2));
  rules = nextStyle(rules, 0);
  assert.equal(rules[0].style, RULE_STYLES[1]);
  assert.deepEqual(stylesFor(rules, { s: 'G25', marks: ['wj'] }), [RULE_STYLES[1]], 'one style once');
  rules = toggleRule(rules, { kind: 'text', value: 'wj', label: '' });
  assert.deepEqual(rules.map((rule) => rule.value), ['G25']);
  assert.equal(toggleRule([], { kind: 'strongs', value: 'love', label: '' }).length, 0, 'not a Strong number');
});

test('a workspace keeps its rules and the compare of a card, and drops bad ones', () => {
  const kept = parse(
    JSON.stringify({
      cards: [{ id: 'a', address: 'JHN.3', matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, version: 'both', compare: true }],
      rules: [
        { kind: 'strongs', value: 'H2617', label: 'H2617', style: 'dots' },
        { kind: 'strongs', value: 'H2617', label: 'again', style: 'over' },
        { kind: 'text', value: 'script', label: 'bad' },
        { kind: 'names', value: 'place', label: 'Every place', style: 'unknown' },
      ],
    }),
  );
  assert.equal(kept.cards[0].compare, true);
  assert.deepEqual(kept.rules.map((rule) => [rule.value, rule.style]), [['H2617', 'dots'], ['place', 'over']]);
  assert.equal(toRule({ kind: 'entity', value: 'person:david_994' })?.label, 'person:david_994');
  assert.match(snapshot(kept), /"rules":\[/);
});
