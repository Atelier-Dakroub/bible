import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

/**
 * Sends messages to the MCP server and collects its answers, by id.
 *
 * @param {object[]} messages
 * @returns {Promise<Map<number, any>>}
 */
function talk(messages) {
  return new Promise((resolve, reject) => {
    const server = spawn(process.execPath, ['tools/mcp-server.js'], { stdio: ['pipe', 'pipe', 'ignore'] });
    let output = '';
    /** @type {Map<number, any>} */
    const answers = new Map();
    const wanted = messages.filter((message) => 'id' in message).length;
    server.stdout.on('data', (chunk) => {
      output += chunk;
      let end;
      while ((end = output.indexOf('\n')) >= 0) {
        const message = JSON.parse(output.slice(0, end));
        output = output.slice(end + 1);
        answers.set(message.id, message);
        // All answered: the input ends, and the server exits as it does
        // for a client, which writes its test coverage.
        if (answers.size === wanted) server.stdin.end();
      }
    });
    server.on('error', reject);
    server.on('close', () => resolve(answers));
    for (const message of messages) server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  });
}

test('the MCP server lists its tools and answers from the data', async () => {
  const answers = await talk([
    { id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
    { method: 'notifications/initialized' },
    { id: 2, method: 'tools/list' },
    { id: 3, method: 'tools/call', params: { name: 'quotations', arguments: { verse: 'Habakkuk 2:4' } } },
    { id: 4, method: 'tools/call', params: { name: 'passage', arguments: { reference: 'Narnia 1:1' } } },
    { id: 5, method: 'nothing' },
  ]);
  assert.equal(answers.get(1).result.protocolVersion, '2025-06-18');
  assert.deepEqual(
    answers.get(2).result.tools.map((/** @type {{ name: string }} */ tool) => tool.name),
    [
      'table_state', 'table_place', 'table_guide', 'table_search', 'table_show_entity', 'table_show_places', 'table_show_journey', 'table_mark', 'table_clear', 'table_undo',
      'search', 'passage', 'word_study', 'entity', 'cross_references', 'quotations', 'journeys', 'topic', 'passage_guide',
    ],
  );
  const quoted = answers.get(3).result;
  assert.equal(quoted.isError, false);
  assert.match(quoted.content[0].text, /Romans 1:17 \(ROM\.1\.17\)/);
  assert.equal(answers.get(4).result.isError, true);
  assert.equal(answers.get(5).error.code, -32601);
});

/**
 * Calls the server's tools and gives each answer's text, by tool and
 * arguments.
 *
 * @param {[string, object][]} calls
 */
async function call(calls) {
  const answers = await talk([
    { id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
    ...calls.map(([name, args], i) => ({ id: i + 1, method: 'tools/call', params: { name, arguments: args } })),
  ]);
  return calls.map((_, i) => /** @type {{ isError: boolean, content: { text: string }[] }} */ (answers.get(i + 1).result));
}

test('each tool that reads answers from the data, with its sources', async () => {
  const [words, phrase, kjv, bsb, hebrew, interlinear, reverse, study, sense, chesed, david, several, xrefs, paul, exodus, prayer, cited, guide] = await call([
    ['search', { query: 'G26', limit: 3 }],
    ['search', { query: 'love one another', limit: 2 }],
    ['passage', { reference: 'John 3:16' }],
    ['passage', { reference: 'John 3:16', version: 'bsb' }],
    ['passage', { reference: 'Genesis 1:1', version: 'original' }],
    ['passage', { reference: 'John 1:1', version: 'interlinear' }],
    ['passage', { reference: 'John 1:1', version: 'reverse' }],
    ['word_study', { word: 'G26' }],
    ['word_study', { word: 'G4151 sense 7' }],
    ['word_study', { word: 'chesed' }],
    ['entity', { name: 'person:david_994' }],
    ['entity', { name: 'John' }],
    ['cross_references', { verse: 'John 3:16' }],
    ['journeys', { person: 'person:paul_2479' }],
    ['journeys', { person: 'Exodus 13:20' }],
    ['topic', { name: 'prayer' }],
    ['topic', { name: 'Romans 4:3' }],
    ['passage_guide', { reference: 'Mark 2:1-12' }],
  ]);
  for (const answer of [words, phrase, kjv, bsb, hebrew, interlinear, reverse, study, sense, chesed, david, several, xrefs, paul, exodus, prayer, cited, guide]) assert.equal(answer.isError, false, answer.content[0].text);
  assert.match(words.content[0].text, /Word: G26 /);
  assert.match(phrase.content[0].text, /\(JHN\.\d+\.\d+\)/);
  assert.match(kjv.content[0].text, /^John 3:16 \(JHN\.3\.16\), KJV\n\n16 For God so loved the world/);
  assert.match(bsb.content[0].text, /^John 3:16 \(JHN\.3\.16\), BSB/);
  assert.match(hebrew.content[0].text, /^Genesis 1:1 \(GEN\.1\.1\), Hebrew/);
  assert.match(interlinear.content[0].text, /\| G3056/);
  assert.match(reverse.content[0].text, /with the original under each word/);
  assert.match(study.content[0].text, /^G26 /);
  assert.match(sense.content[0].text, /The verses below are those of sense 7/);
  assert.match(chesed.content[0].text, /^H2617 /);
  assert.match(david.content[0].text, /^David \(person:david_994\)/);
  assert.match(several.content[0].text, /^Several have that name/);
  assert.match(xrefs.content[0].text, /^Cross-references of John 3:16/);
  assert.match(paul.content[0].text, /Paul/);
  assert.match(exodus.content[0].text, /Exodus|No journey/);
  assert.match(prayer.content[0].text, /^Prayer \(\d+ references\)/);
  assert.match(cited.content[0].text, /Topics that cite Romans 4:3|No topic cites/);
  assert.match(guide.content[0].text, /Parallel passages:/);
});

test('a tool asked for nothing it knows says so', async () => {
  const [word, entity, topic] = await call([
    ['word_study', { word: 'zzzz' }],
    ['entity', { name: 'Narnia' }],
    ['topic', { name: '12345' }],
  ]);
  assert.equal(word.isError, true);
  assert.equal(entity.isError, true);
  assert.match(topic.content[0].text, /has no topic/);
});
