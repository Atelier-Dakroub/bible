import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docOf } from '../app/lib/note-doc.js';
import { linkOf, toMarkdown } from '../app/lib/note-markdown.js';

const text = (/** @type {string} */ value, /** @type {any[]} */ marks = []) => ({ type: 'text', text: value, ...(marks.length ? { marks } : {}) });
const para = (/** @type {any[]} */ ...content) => ({ type: 'paragraph', content });
const item = (/** @type {any[]} */ ...content) => ({ type: 'list_item', content });

test('a note becomes Markdown: headings, marks, links, lists and quotes', () => {
  const doc = docOf({
    text: '',
    doc: { type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [text('Light')] },
      para(text('See '), { type: 'ref', attrs: { address: 'JHN.1.5', label: 'John 1:5', kind: 'passage' } }, text(' and '), text('grace ', [{ type: 'strong' }]), text('truth', [{ type: 'highlight', attrs: { pigment: 'lapis' } }]), text(' *x*')),
      { type: 'bullet_list', content: [item(para(text('one')), { type: 'bullet_list', content: [item(para(text('inner')))] }), item(para(text('two')))] },
      { type: 'ordered_list', attrs: { order: 1 }, content: [item(para(text('first'))), item(para(text('second')))] },
      { type: 'quote', attrs: { span: 'JHN.1.1.w1-JHN.1.1.w999', title: 'John 1:1' } },
    ] },
  });
  const markdown = toMarkdown(doc, { origin: 'https://bible.example', quote: () => ({ text: 'In the beginning was the Word', title: 'John 1:1' }) });
  assert.equal(markdown, [
    '## Light',
    '',
    'See [John 1:5](https://bible.example/card/JHN.1.5) and **grace** ==truth== \\*x\\*',
    '',
    '- one',
    '  - inner',
    '- two',
    '',
    '1. first',
    '2. second',
    '',
    '> In the beginning was the Word',
    '> — John 1:1 (KJV)',
  ].join('\n'));
});

test('a word links to its study, a person to its card', () => {
  assert.equal(linkOf({ address: 'G26', kind: 'word' }, 'https://x'), 'https://x/search?q=G26');
  assert.equal(linkOf({ address: 'person:abraham_58', kind: 'person' }, 'https://x'), 'https://x/card/person:abraham_58');
  // A crafted address cannot end its link early.
  assert.equal(linkOf({ address: 'x)(evil', kind: 'passage' }, 'https://x'), 'https://x/card/x%29%28evil');
});
