// The names of mountain ranges and hill countries, set on the map as an atlas
// sets them: along the range, in spaced italic capitals, in the brown of the
// relief. The positions are placed by hand, for the name to sit over the
// range and read well; they are not the range's bounds.
//
// Each name shows at some levels of zoom only (map-view's data-level, 0 for
// the whole map to 4), so the names do not crowd the places:
//   far     the great ranges, by their usual names: levels 0 to 2
//   middle  the ranges of the Levant and Sinai: levels 1 to 3
//   near    the hill countries and mountains the Bible names, in the KJV's
//           words, with the verse that names each: level 4, the
//           closest, as the places of the Levant crowd them out before it
// `angle` turns the name, in degrees clockwise, to run with the range.

/** @typedef {{ name: string, lon: number, lat: number, angle: number, scale: 'far' | 'middle' | 'near', ref?: string }} Range */

/** @type {Range[]} */
export const ranges = [
  // The great ranges, and those of the Levant and Sinai.
  { name: 'Taurus Mountains', lon: 33.6, lat: 36.85, angle: -10, scale: 'far' },
  { name: 'Zagros Mountains', lon: 47.6, lat: 33.0, angle: 38, scale: 'far' },
  { name: 'Caucasus', lon: 44.0, lat: 42.8, angle: -22, scale: 'far' },
  { name: 'Pontic Mountains', lon: 34.3, lat: 41.25, angle: -4, scale: 'far' },
  { name: 'Alborz', lon: 52.4, lat: 36.25, angle: 4, scale: 'far' },
  { name: 'Lebanon', lon: 35.95, lat: 34.05, angle: -68, scale: 'middle', ref: 'DEU.3.25' },
  { name: 'Anti-Lebanon', lon: 36.45, lat: 33.85, angle: -62, scale: 'middle' },
  { name: 'Mountains of Sinai', lon: 34.05, lat: 28.85, angle: 56, scale: 'middle' },
  { name: 'Hejaz', lon: 39.4, lat: 24.6, angle: 62, scale: 'far' },
  { name: 'Apennines', lon: 13.4, lat: 42.3, angle: 48, scale: 'far' },
  { name: 'Pindus', lon: 21.2, lat: 39.7, angle: 70, scale: 'far' },
  // The Bible's hill countries and mountains, for a close view.
  { name: 'Mount Ephraim', lon: 35.24, lat: 32.12, angle: -82, scale: 'near', ref: 'JOS.20.7' },
  { name: 'Mountain of Judah', lon: 35.08, lat: 31.55, angle: -78, scale: 'near', ref: 'JOS.20.7' },
  { name: 'Mount Gilead', lon: 35.78, lat: 32.3, angle: -82, scale: 'near', ref: 'GEN.31.21' },
  { name: 'Mountains of Abarim', lon: 35.78, lat: 31.55, angle: -82, scale: 'near', ref: 'NUM.33.47' },
  { name: 'Mount Seir', lon: 35.55, lat: 30.45, angle: -72, scale: 'near', ref: 'GEN.36.8' },
  { name: 'Galilee hills', lon: 35.35, lat: 32.95, angle: -10, scale: 'near' },
];
