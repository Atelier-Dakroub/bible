import assert from 'node:assert/strict';
import test from 'node:test';
import { guidePage, inline, render, slug } from '../app/lib/markdown.js';

test('headings get ids, and paragraphs join their lines', () => {
  assert.equal(render('# The table\n\nCards go\non it.'), '<h1 id="the-table">The table</h1>\n<p>Cards go on it.</p>');
  assert.equal(slug('Notes: kinds & *titles*'), 'notes-kinds-titles');
});

test('the inline marks: bold, italic, code, links and keys', () => {
  assert.equal(inline('**Search**, *then* `John 3:16`'), '<strong>Search</strong>, <em>then</em> <code>John 3:16</code>');
  assert.equal(inline('See [the map](/guide/map).'), 'See <a href="/guide/map">the map</a>.');
  assert.equal(inline('Press <kbd>Esc</kbd>.'), 'Press <kbd>Esc</kbd>.');
  // In code, no marks.
  assert.equal(inline('`**not bold**`'), '<code>**not bold**</code>');
});

test('lists, lists in lists, and numbered lists', () => {
  assert.equal(render('- one\n- two\n  - two a\n- three'), '<ul><li>one</li><li>two<ul><li>two a</li></ul></li><li>three</li></ul>');
  assert.equal(render('1. first\n2. second\n   goes on'), '<ol><li>first</li><li>second goes on</li></ol>');
});

test('notes and tables', () => {
  assert.equal(render('> A tip.'), '<aside class="guide__note"><p>A tip.</p></aside>');
  assert.equal(
    render('| Key | Does |\n| --- | --- |\n| <kbd>Esc</kbd> | Closes |'),
    '<table><thead><tr><th scope="col">Key</th><th scope="col">Does</th></tr></thead><tbody><tr><td><kbd>Esc</kbd></td><td>Closes</td></tr></tbody></table>',
  );
});

test('a page cannot carry a script, a template expression or a script link', () => {
  assert.equal(render('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(render('Costs ${price}.'), '<p>Costs &#36;{price}.</p>');
  assert.equal(inline('[click](javascript:alert(1))'), 'click)');
  assert.equal(inline('[x](" onclick="y)'), '[x](&quot; onclick=&quot;y)');
});

test('a guide page has its title and the way back', () => {
  const page = guidePage('# Notes\n\nWrite.');
  assert.match(page, /^<title>Notes<\/title>/);
  assert.match(page, /<a href="\/guide">The guide<\/a>/);
  assert.match(page, /<p>Write\.<\/p>/);
});
