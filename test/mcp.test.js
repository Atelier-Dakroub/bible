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
        if (answers.size === wanted) {
          server.kill();
          resolve(answers);
        }
      }
    });
    server.on('error', reject);
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
      'search', 'passage', 'word_study', 'entity', 'cross_references', 'quotations', 'journeys', 'passage_guide',
    ],
  );
  const quoted = answers.get(3).result;
  assert.equal(quoted.isError, false);
  assert.match(quoted.content[0].text, /Romans 1:17 \(ROM\.1\.17\)/);
  assert.equal(answers.get(4).result.isError, true);
  assert.equal(answers.get(5).error.code, -32601);
});
