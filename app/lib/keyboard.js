// When the app's own on-screen keyboard (touch-keys) shows.
//
// The app's keyboard is for a touch screen that has no keyboard of its own:
// the kiosk panel with no keyboard near. A phone or a tablet has its own,
// which the app's would only cover; a laptop has a real one. So, unless the
// reader chooses otherwise (Tools, Table: Automatic, Always, Never), it shows
// when:
//   - a finger, not a mouse or a pen, touched the field; and
//   - the device is not a phone or a tablet; and
//   - no real key has been pressed on this visit. A real key, or a keyboard
//     the system shows on the screen, sends key events; the app's keys do
//     not.
// While it shows, the field asks the system for no keyboard of its own
// (inputmode none), so the two do not both appear.

const KEY = 'bible.keys';
export const CHOICES = /** @type {const} */ (['auto', 'always', 'never']);

/** @typedef {typeof CHOICES[number]} Choice */

/** the kind of pointer that last pressed, anywhere on the page */
let lastPointer = '';
/** whether a real key has been pressed on this visit */
let hardware = false;

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (event) => {
    lastPointer = event.pointerType;
  }, { capture: true });
  document.addEventListener('keydown', (event) => {
    // A key that types, from a keyboard: not a shortcut, and not a key the
    // page made.
    if (!event.isTrusted || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1 && event.key !== 'Backspace' && event.key !== 'Enter') return;
    if (hardware) return;
    hardware = true;
    document.documentElement.dataset.realKeys = '';
  }, { capture: true });
}

/** @returns {Choice} */
export function choice() {
  try {
    const kept = localStorage.getItem(KEY);
    return CHOICES.includes(/** @type {any} */ (kept)) ? /** @type {Choice} */ (kept) : 'auto';
  } catch {
    return 'auto';
  }
}

/** @param {Choice} value */
export function setChoice(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // No storage: the choice lasts until the page closes.
  }
  if (typeof document !== 'undefined') document.documentElement.dataset.keys = value;
}

/**
 * True on a phone or a tablet: a device with a keyboard of its own on the
 * screen. An iPad says it is a Mac, but a Mac has no touch points.
 *
 * @param {{ userAgent: string, maxTouchPoints?: number, userAgentData?: { mobile?: boolean } }} [nav]
 */
export function hasSystemKeys(nav = /** @type {any} */ (globalThis.navigator)) {
  if (!nav) return false;
  if (nav.userAgentData?.mobile) return true;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)) return true;
  return /Macintosh/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1;
}

/**
 * Whether the app's keyboard should show now, for a field just touched or
 * opened.
 *
 * @param {{ choice?: Choice, pointer?: string, systemKeys?: boolean, realKeys?: boolean }} [given]
 *   for tests: what the page would otherwise read
 */
export function wantKeys(given = {}) {
  const chosen = given.choice ?? choice();
  const pointer = given.pointer ?? lastPointer;
  if (chosen === 'never' || pointer !== 'touch') return false;
  if (chosen === 'always') return true;
  return !(given.systemKeys ?? hasSystemKeys()) && !(given.realKeys ?? hardware);
}

/**
 * Shows the app's keyboard for a field, or not, and keeps the system's own
 * keyboard away while the app's shows.
 *
 * @param {HTMLInputElement | HTMLTextAreaElement} field
 * @param {boolean} show
 */
export function keysFor(field, show) {
  if (show) field.setAttribute('inputmode', 'none');
  else field.removeAttribute('inputmode');
  return show;
}

if (typeof document !== 'undefined') document.documentElement.dataset.keys = choice();
