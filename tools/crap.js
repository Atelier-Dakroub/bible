#!/usr/bin/env node
// The CRAP score of every function in the app and its tools, against a
// limit: complexity² × (1 − test coverage)³ + complexity. A complex function
// with no tests scores high; split it, or move its decisions into tested
// functions in app/lib.
//
//   node tools/crap.js            runs the tests with coverage, then checks
//   node tools/crap.js --update   writes the list of functions now over the
//                                 limit (tools/crap-baseline.json)
//   node tools/crap.js --report   lists every function over the limit
//
// Complexity is cyclomatic: 1, plus one for each if, ?:, loop, case, catch,
// &&, || and ??. Coverage is the share of a function's characters that some
// test ran (V8's coverage of `node --test`, merged over its processes). A
// function in a file the tests never load, such as an element's script, has
// none: there the limit means a complexity of 5 at most.
//
// The baseline holds the functions that were over the limit when the check
// began (2026-11-11), each with its score. The check fails when a function
// not in it goes over the limit, or one in it scores higher than it did. So
// the list can only get shorter: after splitting functions, run --update.
// A function is known by its file and name; functions of one name in one
// file (callbacks) are matched highest score to highest score.

import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as acorn from 'acorn';

const LIMIT = 30;
const ROOT = process.cwd();
const BASELINE = join(ROOT, 'tools', 'crap-baseline.json');
const update = process.argv.includes('--update');
const report = process.argv.includes('--report');

// ---- Coverage --------------------------------------------------------------

const coverageDir = mkdtempSync(join(tmpdir(), 'crap-'));
const run = spawnSync(process.execPath, ['--test'], { cwd: ROOT, env: { ...process.env, NODE_V8_COVERAGE: coverageDir }, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
const summary = run.stdout.split('\n').filter((line) => /^# (pass|fail)/.test(line)).join(', ');
if (run.status !== 0) {
  process.stdout.write(run.stdout);
  console.error('The tests fail: no CRAP check until they pass.');
  rmSync(coverageDir, { recursive: true, force: true });
  process.exit(1);
}

/** For each file's URL, which characters some test ran. @type {Map<string, Uint8Array>} */
const hit = new Map();
for (const name of readdirSync(coverageDir).filter((each) => each.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(coverageDir, name), 'utf8'));
  for (const script of data.result ?? []) {
    if (!script.url.startsWith('file://')) continue;
    // In one process the ranges nest (a block inside its function): the
    // inner one counts for its characters.
    const ranges = script.functions.flatMap((/** @type {any} */ fn) => fn.ranges).sort((/** @type {any} */ a, /** @type {any} */ b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
    const size = ranges.reduce((/** @type {number} */ most, /** @type {any} */ range) => Math.max(most, range.endOffset), 0);
    const counts = new Int32Array(size).fill(-1);
    for (const range of ranges) counts.fill(range.count, range.startOffset, range.endOffset);
    let map = hit.get(script.url);
    if (!map || map.length < size) {
      const grown = new Uint8Array(size);
      if (map) grown.set(map);
      map = grown;
      hit.set(script.url, map);
    }
    for (let at = 0; at < size; at += 1) if (counts[at] > 0) map[at] = 1;
  }
}
rmSync(coverageDir, { recursive: true, force: true });

/** The share of a function's characters that some test ran. */
function coverageOf(/** @type {string} */ url, /** @type {number} */ start, /** @type {number} */ end) {
  const map = hit.get(url);
  if (!map) return 0;
  let ran = 0;
  for (let at = start; at < end; at += 1) ran += map[at] ?? 0;
  return ran / Math.max(1, end - start);
}

// ---- Functions and their complexity ---------------------------------------

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** The scripts of a file: all of a .js, the script blocks of an .html. */
function scripts(/** @type {string} */ path, /** @type {string} */ text) {
  if (path.endsWith('.js')) return [{ code: text, offset: 0 }];
  return [...text.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter((match) => !/\bsrc=|type="(application\/json|importmap|application\/ld\+json)"/.test(match[1] ?? ''))
    .map((match) => ({ code: match[2], offset: /** @type {number} */ (match.index) + match[0].indexOf('>') + 1 }));
}

const BRANCHES = new Set(['IfStatement', 'ConditionalExpression', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement', 'CatchClause', 'LogicalExpression']);
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** @param {any} parent the name of a property's or a method's key */
const keyName = (parent) => parent.key?.name ?? parent.key?.value;

/** @param {any} call the name of the function called: a method's, or the function's */
const calleeName = (call) => call.callee?.property?.name ?? call.callee?.name ?? 'call';

/** @type {Record<string, (parent: any, child: any) => string | undefined>} how each kind of parent names a function in it */
const NAMERS = {
  Property: keyName,
  MethodDefinition: keyName,
  PropertyDefinition: keyName,
  VariableDeclarator: (parent) => parent.id?.name,
  AssignmentExpression: (parent) => parent.left?.property?.name ?? parent.left?.name,
  CallExpression: (parent, child) => (child === parent.callee ? undefined : `${calleeName(parent)} callback`),
};

/** The name a function is known by: its own, or the key or variable it is given to. */
function nameFor(/** @type {any} */ parent, /** @type {any} */ child) {
  return parent ? NAMERS[parent.type]?.(parent, child) : undefined;
}

/**
 * @param {string} code
 * @param {number} offset
 * @returns {{ name: string, start: number, end: number, complexity: number }[]}
 */
function functionsOf(code, offset) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true });
  /** @type {{ name: string, start: number, end: number, complexity: number }[]} */
  const list = [];
  /**
   * A function starts a new count; a branch adds one to the count of the
   * function it is in.
   *
   * @param {any} node @param {any} owner @param {string | undefined} name
   */
  const enter = (node, owner, name) => {
    if (FUNCTIONS.has(node.type)) {
      const found = { name: fnName(node, name), start: node.start + offset, end: node.end + offset, complexity: 1 };
      list.push(found);
      return found;
    }
    if (owner && isBranch(node)) owner.complexity += 1;
    return owner;
  };
  /** @param {any} node @param {any} owner @param {string | undefined} name */
  const visit = (node, owner, name) => {
    if (!node || typeof node.type !== 'string') return;
    const current = enter(node, owner, name);
    for (const child of childrenOf(node)) visit(child, current, nameFor(node, child));
  };
  visit(ast, null, undefined);
  return list;
}

/** @param {any} node @param {string | undefined} given its name: its own, or the one it is given, or (anonymous) */
const fnName = (node, given) => node.id?.name ?? given ?? '(anonymous)';

/** @param {any} node whether it adds a path: a branch, a loop, a case, a catch, or && || ?? */
const isBranch = (node) => BRANCHES.has(node.type) || (node.type === 'SwitchCase' && Boolean(node.test));

/** @param {any} node the nodes in it, in order */
const childrenOf = (node) =>
  Object.entries(node).flatMap(([key, value]) => (key === 'start' || key === 'end' ? [] : [value].flat().filter((child) => child && typeof child === 'object')));

const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'tools'))].filter((path) => /\.(js|html)$/.test(path));
/** @type {{ file: string, line: number, name: string, complexity: number, coverage: number, crap: number }[]} */
const rows = [];
for (const path of files) {
  const text = readFileSync(path, 'utf8');
  const url = pathToFileURL(path).href;
  for (const block of scripts(path, text)) {
    for (const fn of functionsOf(block.code, block.offset)) {
      const coverage = coverageOf(url, fn.start, fn.end);
      const crap = fn.complexity ** 2 * (1 - coverage) ** 3 + fn.complexity;
      rows.push({ file: relative(ROOT, path), line: text.slice(0, fn.start).split('\n').length, name: fn.name, complexity: fn.complexity, coverage, crap: Math.round(crap) });
    }
  }
}
const over = rows.filter((row) => row.crap > LIMIT).sort((a, b) => b.crap - a.crap);
const keyOf = (/** @type {{ file: string, name: string }} */ row) => `${row.file} ${row.name}`;

// ---- The check -------------------------------------------------------------

if (update) {
  /** @type {Record<string, number[]>} */
  const allowed = {};
  for (const row of over) (allowed[keyOf(row)] ??= []).push(row.crap);
  writeFileSync(BASELINE, `${JSON.stringify({ limit: LIMIT, written: new Date().toISOString().slice(0, 10), count: over.length, allowed }, null, 1)}\n`);
  console.log(`${over.length} functions over ${LIMIT}, written to ${relative(ROOT, BASELINE)}.`);
  process.exit(0);
}

/** @type {{ allowed: Record<string, number[]> }} */
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
/** @type {Map<string, number[]>} each key's allowed scores, highest first */
const left = new Map(Object.entries(baseline.allowed).map(([key, scores]) => [key, [...scores].sort((a, b) => b - a)]));
const failures = [];
for (const row of over) {
  const scores = left.get(keyOf(row)) ?? [];
  // The highest allowed score that still covers this one.
  const at = scores.findIndex((score) => score >= row.crap);
  if (scores.length && at === 0) scores.shift();
  else if (at > 0) scores.splice(at, 1);
  else failures.push(row);
}
const shrunk = Object.values(baseline.allowed).flat().length - over.length;

if (report) for (const row of over) console.log(`${String(row.crap).padStart(5)}  c${row.complexity}  ${Math.round(row.coverage * 100)}%  ${row.file}:${row.line}  ${row.name}`);
console.log(`Tests: ${summary}. CRAP: ${rows.length} functions, ${over.length} over ${LIMIT} (baseline ${Object.values(baseline.allowed).flat().length}${shrunk > 0 ? `; ${shrunk} fewer: run with --update` : ''}).`);
if (failures.length) {
  console.error(`\n${failures.length} function${failures.length === 1 ? '' : 's'} over the limit, new or worse than the baseline:`);
  for (const row of failures) console.error(`  ${row.crap}  (complexity ${row.complexity}, coverage ${Math.round(row.coverage * 100)}%)  ${row.file}:${row.line}  ${row.name}`);
  process.exit(1);
}
