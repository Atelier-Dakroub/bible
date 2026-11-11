import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docOf, fromText, schema, toText } from '../app/lib/note-doc.js';
import { parse } from '../app/lib/workspace.js';

test('a note from before documents reads as a paragraph a line', () => {
  const doc = docOf({ text: 'Grace\n\nand truth' });
  assert.equal(doc.childCount, 3);
  assert.equal(toText(doc), 'Grace\n\nand truth');
});

test('a document keeps its headings, lists and marks, and gives its text', () => {
  const json = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Light' }] },
      { type: 'bullet_list', content: [
        { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'John 1:5', marks: [{ type: 'strong' }] }] }] },
        { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Genesis 1:3', marks: [{ type: 'highlight', attrs: { pigment: 'lapis' } }] }] }] },
      ] },
    ],
  };
  const doc = docOf({ doc: json, text: '' });
  assert.deepEqual(JSON.parse(JSON.stringify(doc.toJSON())), json);
  assert.equal(toText(doc), 'Light\nJohn 1:5\nGenesis 1:3');
});

test('a document that does not fit the schema falls back to the text', () => {
  const doc = docOf({ doc: { type: 'doc', content: [{ type: 'table' }] }, text: 'kept' });
  assert.equal(toText(doc), 'kept');
  assert.ok(schema.nodes.paragraph);
  assert.deepEqual(fromText(''), { type: 'doc', content: [{ type: 'paragraph' }] });
});

test('a stored workspace keeps a note\'s document', () => {
  const doc = fromText('Selah');
  const kept = parse(JSON.stringify({ notes: [{ id: 'n1', text: 'Selah', doc, quotes: [] }, { id: 'n2', text: 'old', quotes: [] }] }));
  assert.deepEqual(kept.notes[0].doc, doc);
  assert.equal(kept.notes[1].doc, undefined);
});

test('a reference in a note reads as its label in the text', () => {
  const doc = docOf({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'See ' },
    { type: 'ref', attrs: { address: 'JHN.3.16', label: 'John 3:16', kind: 'passage' } },
    { type: 'text', text: ' and ' },
    { type: 'ref', attrs: { address: 'person:abraham_58', label: 'Abraham', kind: 'person' } },
  ] }] }, text: '' });
  assert.equal(toText(doc), 'See John 3:16 and Abraham');
});

test('a note keeps its kind and a question its Answered box', async () => {
  const { nextKind, labelOf } = await import('../app/lib/note-kinds.js');
  const kept = parse(JSON.stringify({ notes: [
    { id: 'n1', text: 'Why?', kind: 'question', answered: true, quotes: [] },
    { id: 'n2', text: 'x', kind: 'gossip', answered: 'yes', quotes: [] },
  ] }));
  assert.equal(kept.notes[0].kind, 'question');
  assert.equal(kept.notes[0].answered, true);
  assert.equal(kept.notes[1].kind, undefined);
  assert.equal(kept.notes[1].answered, undefined);
  const cycle = [];
  let kind;
  do {
    kind = nextKind(kind);
    cycle.push(labelOf(kind));
  } while (kind);
  assert.deepEqual(cycle, ['Observation', 'Question', 'Interpretation', 'Application', 'Prayer', 'Note']);
});

test('a note keeps its own title, trimmed, and none when empty', () => {
  const kept = parse(JSON.stringify({ notes: [
    { id: 'n1', text: '', title: '  Who is the Word?  ', quotes: [] },
    { id: 'n2', text: '', title: '   ', quotes: [] },
  ] }));
  assert.equal(kept.notes[0].title, 'Who is the Word?');
  assert.equal(kept.notes[1].title, undefined);
});

test('a mark the schema does not know goes, and the rest of the note stays', () => {
  const doc = docOf({
    doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'grace', marks: [{ type: 'strong' }, { type: 'sparkle' }] }] }] },
    text: 'grace',
  });
  assert.equal(toText(doc), 'grace');
  assert.deepEqual(doc.firstChild?.firstChild?.marks.map((mark) => mark.type.name), ['strong']);
});
