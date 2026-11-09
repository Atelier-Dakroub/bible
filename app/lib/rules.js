// Rule marks: words marked on every card by what they are, not by where they
// are. A highlight is a span the reader chose; a rule is a question the reader
// asks of every word, live, so a card put down later shows the marks too.
//
// The kinds of rule, and the value each one takes:
//   strongs  a Strong's number, such as H2617: the words that render it
//   entity   an entity id, such as person:david_994: the words that name it
//   names    person, place or group: every word that names one of those
//   text     wj, add or nd: the words of Christ, the words the translators
//            supplied, the divine name
//
// A rule has one of RULE_STYLES. The styles differ in shape from the three
// highlight styles and from each other, so marks of several rules on one word
// all show.

/** @typedef {{ kind: string, value: string, label: string, style: string }} Rule */
/** @typedef {{ s?: string, e?: string, marks: string[] }} Word what a word is: its Strong's number, the entity it names, the marks of its run */

export const RULE_STYLES = ['over', 'dots', 'ring', 'wavy'];

const KINDS = {
  strongs: /^[HG]\d{1,5}$/,
  entity: /^(?:person|place|group):[\w.-]{1,80}$/,
  names: /^(?:person|place|group)$/,
  text: /^(?:wj|add|nd)$/,
};

// The rules the menu offers without a word study.
export const PRESETS = [
  { kind: 'text', value: 'wj', label: 'Words of Christ' },
  { kind: 'text', value: 'add', label: 'Words the translators supplied' },
  { kind: 'text', value: 'nd', label: 'The divine name' },
  { kind: 'names', value: 'person', label: 'Every person' },
  { kind: 'names', value: 'place', label: 'Every place' },
  { kind: 'names', value: 'group', label: 'Every group' },
];

/**
 * A stored rule, checked, or null.
 *
 * @param {any} value
 * @returns {Rule | null}
 */
export function toRule(value) {
  const kind = String(value?.kind ?? '');
  const pattern = KINDS[/** @type {keyof typeof KINDS} */ (kind)];
  if (!pattern || !pattern.test(String(value?.value ?? ''))) return null;
  const label = typeof value.label === 'string' && value.label ? value.label.slice(0, 80) : value.value;
  const style = RULE_STYLES.includes(value.style) ? value.style : RULE_STYLES[0];
  return { kind, value: value.value, label, style };
}

/**
 * @param {Rule} rule
 * @param {{ kind: string, value: string }} other
 */
export function sameRule(rule, other) {
  return rule.kind === other.kind && rule.value === other.value;
}

/**
 * Adds a rule in the first style no rule has yet, or removes it when it is
 * there already.
 *
 * @param {Rule[]} rules
 * @param {{ kind: string, value: string, label: string }} rule
 * @returns {Rule[]}
 */
export function toggleRule(rules, rule) {
  if (rules.some((each) => sameRule(each, rule))) return rules.filter((each) => !sameRule(each, rule));
  const free = RULE_STYLES.find((style) => !rules.some((each) => each.style === style));
  const style = free ?? RULE_STYLES[rules.length % RULE_STYLES.length];
  const added = toRule({ ...rule, style });
  return added ? [...rules, added] : rules;
}

/**
 * The rule at `index` in the next style.
 *
 * @param {Rule[]} rules
 * @param {number} index
 * @returns {Rule[]}
 */
export function nextStyle(rules, index) {
  return rules.map((rule, i) =>
    i === index ? { ...rule, style: RULE_STYLES[(RULE_STYLES.indexOf(rule.style) + 1) % RULE_STYLES.length] } : rule,
  );
}

/**
 * @param {Rule} rule
 * @param {Word} word
 */
export function matches(rule, word) {
  if (rule.kind === 'strongs') return word.s === rule.value;
  if (rule.kind === 'entity') return word.e === rule.value;
  if (rule.kind === 'names') return Boolean(word.e?.startsWith(`${rule.value}:`));
  if (rule.kind === 'text') return word.marks.includes(rule.value);
  return false;
}

/**
 * The styles of every rule that marks the word, each once, in rule order.
 *
 * @param {Rule[]} rules
 * @param {Word} word
 */
export function stylesFor(rules, word) {
  /** @type {string[]} */
  const styles = [];
  for (const rule of rules) if (matches(rule, word) && !styles.includes(rule.style)) styles.push(rule.style);
  return styles;
}
