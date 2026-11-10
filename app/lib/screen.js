// The kinds of screen the table lays itself out for.

// A phone, or a screen as short as a phone on its side. On one, the panels
// are sheets the width of the screen, and one is open at a time. The same
// media query is in the styles that lay them out (global.css, and the
// panels' own styles).
export const PHONE = '(max-width: 700px), (max-height: 500px)';

/** True on a phone (see PHONE). */
export function isPhone() {
  return typeof matchMedia === 'function' && matchMedia(PHONE).matches;
}
