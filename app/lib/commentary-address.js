// The address of a commentary card (data/commentaries.js), read in the
// browser too: commentary:<id>:<passage>, with ~<page> for a later page.

const ADDRESS = /^commentary:([a-z]+):([^~]+)(?:~(\d+))?$/;

/**
 * The passage a card's address is on: commentary:mhcc:JHN.3.1-8~2 is
 * JHN.3.1-8; any other address is its own.
 *
 * @param {string} address
 */
export function passageOf(address) {
  return ADDRESS.exec(address)?.[2] ?? address;
}

/**
 * Where a synced card goes when another steps to a passage: a commentary card
 * to the same commentary on that passage, a passage card to the passage.
 *
 * @param {string} own the synced card's address
 * @param {string} to the address the stepping card goes to
 */
export function syncedAddress(own, to) {
  const commentary = ADDRESS.exec(own)?.[1];
  const passage = passageOf(to);
  return commentary ? `commentary:${commentary}:${passage}` : passage;
}
