import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { books, parallel, strongsResults, search } from '../app/data/bible.js';
import { guideResults, landscape, parallelsOf, studyPlan } from '../app/data/study.js';
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
  const bsb = rows[0].bsb.flatMap((block) => block.tokens).filter((token) => token.d && token.w).map((token) => token.text.trim());
  assert.deepEqual(bsb, ['one', 'and', 'everyone', 'who', 'shall', 'eternal']);
  assert.equal(rows[0].bsb.map((block) => block.tokens.map((token) => token.text).join('')).join(''), rows[0].bsb.map((block) => block.text).join(''));
});

test('the BSB words are numbered through the verse, across its blocks', async () => {
  const { rows } = await parallel({ book: 'PSA', chapter: 23, from: 1 });
  const numbers = rows[0].bsb.flatMap((block) => block.tokens).filter((token) => token.w).map((token) => token.w);
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1));
  assert.ok(rows[0].bsb.length > 1, 'the verse has more than one block');
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

test('a study of a passage holds what its guide finds, each verse once', async () => {
  const plan = await studyPlan('ACT.9.1-9');
  const cards = plan?.columns.flat() ?? [];
  assert.equal(plan?.short, 'Acts 9:1–9');
  assert.ok(cards.includes('ACT.22.3-16'), 'Paul tells it again in Acts 22');
  assert.ok(cards.includes('person:paul_2479'));
  assert.ok(!cards.some((id) => id.startsWith('person:god_')), 'God is named everywhere: no card for him');
  assert.match(plan?.mapIds ?? '', /damascus/);
  // Isaiah 53: the New Testament quotes it, on its right; 1 Peter 2:24 is not beside 1 Peter 2:24-25.
  const isaiah = await studyPlan('ISA.53');
  assert.equal(isaiah?.columns[0][0], 'ISA.53');
  assert.ok(isaiah?.joins.some((join) => join.type === 'quotes' && join.b === 'ISA.53'));
  const all = isaiah?.columns.flat() ?? [];
  assert.ok(!(all.includes('1PE.2.24') && all.includes('1PE.2.24-25')));
  assert.equal(await studyPlan('NOPE.1'), null);
});

test('a study of a word: its landscape, a verse for each sense, and the word marked', async () => {
  const plan = await studyPlan('G3056');
  assert.equal(plan?.columns[0][0], 'landscape:G3056');
  assert.equal(plan?.columns[1].length, 5);
  assert.deepEqual(plan?.rule, { kind: 'strongs', value: 'G3056', label: 'G3056 lógos' });
  assert.ok(plan?.lines.some((line) => line.startsWith('In the sense “word”')));
  assert.equal(await studyPlan('G999999'), null);
});

test('a study of a topic: a passage for each part, around its note', async () => {
  const plan = await studyPlan('topic:PRAYER');
  assert.equal(plan?.address, 'note');
  assert.equal(plan?.columns[0][0], 'note');
  assert.ok(plan?.lines.some((line) => line.startsWith('Daily, in the morning: Psalm 5:3')));
  assert.equal(await studyPlan('topic:NOTHING_SUCH'), null);
});

test('a study of a person: family, the chapters that name them most, and a journey', async () => {
  const ruth = await studyPlan('person:ruth_2450');
  assert.deepEqual(ruth?.columns[0].slice(0, 3), ['person:ruth_2450', 'note', 'person:boaz_519']);
  assert.ok(ruth?.columns[1].includes('RUT.1.4-13'));
  assert.equal(ruth?.mapIds, 'place:moab_815');
  const paul = await studyPlan('person:paul_2479');
  assert.equal(paul?.journey?.title, "Paul's first journey");
  assert.ok((paul?.columns[1] ?? []).every((address) => address.startsWith('ACT.')));
});

test('a study of a place: the events there, its people, the chapters that name it, the map', async () => {
  const moab = await studyPlan('place:moab_815');
  assert.deepEqual(moab?.columns[0], ['place:moab_815', 'note', 'event:136', 'person:ruth_2450', 'person:orpah_2257']);
  assert.ok(moab?.columns[1].includes('JER.48.1-10'));
  assert.equal(moab?.mapIds, 'place:moab_815');
  assert.match(moab?.lines.join(' ') ?? '', /Born here: Ruth and Orpah/);
});

test('a study of an event: its people, the passages that tell it in canon order, its places', async () => {
  const exodus = await studyPlan('event:125');
  assert.deepEqual(exodus?.columns[1], ['EXO.7.1-10', 'EXO.8.1-10', 'EXO.9.1-10', 'EXO.10.1-10', 'EXO.12.1-10']);
  assert.ok(exodus?.columns[0].includes('person:moses_2108'));
  assert.equal(exodus?.mapIds, 'place:egypt_362');
  const crucifixion = await studyPlan('event:459');
  assert.deepEqual(crucifixion?.columns[1].map((address) => address.split('.')[0]), ['MAT', 'MRK', 'LUK', 'JHN']);
  assert.ok(!crucifixion?.columns[0].some((id) => id.startsWith('person:jesus_')), 'Jesus is in every study: no card for him');
  assert.match(crucifixion?.lines.join(' ') ?? '', /Part of Holy Week/);
});

test('a study of a group: its members named most, or the chapters that name it', async () => {
  const levi = await studyPlan('group:tribe-of-levi');
  assert.deepEqual(levi?.columns[1].slice(0, 2), ['person:moses_2108', 'person:aaron_1']);
  assert.equal(levi?.columns.flat().length, 12, 'the group, the note and ten members');
  const israel = await studyPlan('group:nation-of-israel');
  assert.ok(israel?.columns[1].every((address) => address.startsWith('PSA.')));
  assert.equal(await studyPlan('group:pharisees'), null, 'no members and no verses: no study');
});
