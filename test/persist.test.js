// app/lib/persist.js: asking the browser to keep the saved tables.

import test from 'node:test';
import assert from 'node:assert/strict';

import { keepStorage } from '../app/lib/persist.js';

test('the browser keeps the storage, or refuses', async () => {
  assert.equal(await keepStorage({ persist: async () => true }), 'kept');
  assert.equal(await keepStorage({ persist: async () => false }), 'refused');
});

test('no Storage API, or one that fails, is not an error', async () => {
  assert.equal(await keepStorage({}), 'unsupported');
  assert.equal(
    await keepStorage({
      persist: async () => {
        throw new Error('no');
      },
    }),
    'unsupported',
  );
});
