// APCA contrast (APCA-W3 0.0.98G-4g), the measure the design system is
// checked with. Lc is positive for dark text on a light ground and negative
// for light text on a dark ground; its size is what counts.
//
// The thresholds the design uses (Lc, by size):
//   90  preferred for body text
//   75  the minimum for body text, such as the Bible text at any size
//   60  text that is not body text but must be read: labels, notes
//   45  large headings, and text of 24px and more in bold
//   30  the floor for any text, such as a disabled button
//   15  the floor for something that is not text but must be seen

const TRC = 2.4;
const [R, G, B] = [0.2126729, 0.7151522, 0.072175];

/**
 * The red, green and blue of a color, each 0 to 1.
 *
 * @param {string} color #a1271b, #abc, or rgb(161, 39, 27) as a browser
 *   gives a computed color
 */
function channels(color) {
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((n) => Number(n) / 255);
  const value = color.trim().replace('#', '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

/** @param {string} color */
function luminance(color) {
  const [r, g, b] = channels(color);
  const y = R * r ** TRC + G * g ** TRC + B * b ** TRC;
  return y > 0.022 ? y : y + (0.022 - y) ** 1.414;
}

/**
 * The APCA lightness contrast of text on a background.
 *
 * @param {string} text a color, as hex or rgb()
 * @param {string} background a color, as hex or rgb()
 */
export function contrast(text, background) {
  const t = luminance(text);
  const b = luminance(background);
  if (Math.abs(b - t) < 0.0005) return 0;
  if (b > t) {
    const sapc = (b ** 0.56 - t ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }
  const sapc = (b ** 0.65 - t ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}
