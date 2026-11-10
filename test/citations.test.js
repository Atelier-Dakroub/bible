import assert from 'node:assert/strict';
import test from 'node:test';
import { citations } from '../app/lib/citations.js';
import { books } from '../app/data/bible.js';

/** The parts that are links, as "text=address". @param {string} text */
const links = (text) =>
  citations(text, books)
    .filter((part) => part.address)
    .map((part) => `${part.text}=${part.address}`);

test('references in prose become links, with the text kept whole', () => {
  const text = 'It was originally called Ephrath (Gen. 35:16, 19; 48:7; Ruth 4:11), and Beth-lehem Ephratah (Micah 5:2).';
  assert.deepEqual(links(text), ['Gen. 35:16=GEN.35.16', '19=GEN.35.19', '48:7=GEN.48.7', 'Ruth 4:11=RUT.4.11', 'Micah 5:2=MIC.5.2']);
  assert.equal(citations(text, books).map((part) => part.text).join(''), text);
});

test('numbered books, ranges, chapters and references with no book', () => {
  assert.deepEqual(links('(Phil. 1:27; 2 Thess. 2:13)'), ['Phil. 1:27=PHP.1.27', '2 Thess. 2:13=2TH.2.13']);
  assert.deepEqual(links('anointed by Samuel (1 Sam. 16:4-13)'), ['1 Sam. 16:4-13=1SA.16.4-13']);
  assert.deepEqual(links('it is implied, however, in Gen. 12. While'), ['Gen. 12=GEN.12']);
  assert.deepEqual(links('the son of Amram (Ex. 6:20). He was born (2:1, 4; 7:7)'), ['Ex. 6:20=EXO.6.20', '2:1=EXO.2.1', '4=EXO.2.4', '7:7=EXO.7.7']);
  assert.deepEqual(links('For God so loved the world (John 3:16; 1 John 2:3; Cant. 2:1)'), ['John 3:16=JHN.3.16', '1 John 2:3=1JN.2.3', 'Cant. 2:1=SNG.2.1']);
});

test('words that are not books, and verses that do not exist, stay text', () => {
  assert.deepEqual(links('some 300 miles north; he Is 5 years older, and Mark 4 times'), []);
  assert.deepEqual(links('(Gen. 51:1) and at 3:30 in the afternoon'), []);
  assert.deepEqual(links('(Gen. 12, 300 miles)'), ['Gen. 12=GEN.12']);
});
