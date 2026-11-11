#!/usr/bin/env node
// Writes THIRD-PARTY-NOTICES.md: the license of each library that the app
// sends to the browser, from its license file in node_modules. Run it after
// a library is added or updated:
//
//   node tools/notices.js

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

// The libraries in the browser build. The build tools (Vite, TypeScript,
// Lightning CSS) do not go to the browser.
const BROWSER = [
  '@transclude/core',
  'hls.js',
  'orderedmap',
  'prosemirror-commands',
  'prosemirror-history',
  'prosemirror-inputrules',
  'prosemirror-keymap',
  'prosemirror-model',
  'prosemirror-schema-list',
  'prosemirror-state',
  'prosemirror-transform',
  'prosemirror-view',
  'rope-sequence',
  'w3c-keyname',
];

/** @param {string} name the section of one library: its version, license name, and license text */
function section(name) {
  const dir = `node_modules/${name}`;
  const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
  const file = readdirSync(dir).find((each) => /^licen[cs]e/i.test(each));
  const text = file ? `\`\`\`\n${readFileSync(`${dir}/${file}`, 'utf8').trim()}\n\`\`\`` : `No license file in the package; its package.json says ${pkg.license}.`;
  return `## ${name} ${pkg.version} (${pkg.license})\n\n${text}\n`;
}

const intro = `# Third-party notices

The app sends these libraries to the browser, in its own build. Each keeps
its license, given here in full. The build tools (Vite, TypeScript,
Lightning CSS and others) do not go to the browser, and are not listed.

Written by \`node tools/notices.js\` from the license files in node_modules.
`;
writeFileSync('THIRD-PARTY-NOTICES.md', [intro, ...BROWSER.map(section)].join('\n'));
console.log(`THIRD-PARTY-NOTICES.md: ${BROWSER.length} libraries.`);
