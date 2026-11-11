import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

process.env.TABLE_TOKEN = 'secret-for-test';
const { default: mount } = await import('../app/server.js');
const app = new Hono();
mount(app);
const auth = { authorization: 'Bearer secret-for-test', 'content-type': 'application/json' };

/** The next server-sent event of a stream, as { event, data }. */
async function nextEvent(reader, decoder, buffer) {
  while (true) {
    const end = buffer.text.indexOf('\n\n');
    if (end >= 0) {
      const block = buffer.text.slice(0, end);
      buffer.text = buffer.text.slice(end + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1] ?? '';
      if (event) return { event, data };
      continue;
    }
    const { value, done } = await reader.read();
    if (done) throw new Error('stream ended');
    buffer.text += decoder.decode(value, { stream: true });
  }
}

test('a command needs the secret, and a reply needs its stream key', async () => {
  assert.equal((await app.request('/api/table/command', { method: 'POST', body: '{}' })).status, 403);

  const listening = await app.request('/api/table/events');
  const reader = listening.body.getReader();
  const decoder = new TextDecoder();
  const buffer = { text: '' };
  assert.equal((await nextEvent(reader, decoder, buffer)).event, 'ready');

  const answer = app.request('/api/table/command', { method: 'POST', headers: auth, body: JSON.stringify({ tool: 'state' }) });
  const command = JSON.parse((await nextEvent(reader, decoder, buffer)).data);
  assert.equal(command.tool, 'state');
  assert.match(command.id, /^[0-9a-f-]{36}$/);

  // Someone who is not listening knows no key: refused.
  const forged = await app.request('/api/table/reply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: command.id, ok: true, result: 'forged' }) });
  assert.equal(forged.status, 404);
  // The table that heard it answers.
  const real = await app.request('/api/table/reply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: command.id, key: command.key, ok: true, result: 'cards: 0' }) });
  assert.equal(real.status, 200);
  assert.deepEqual(await (await answer).json(), { id: command.id, ok: true, result: 'cards: 0' });
  await reader.cancel();
});
