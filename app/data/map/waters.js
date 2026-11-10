// The names of the seas, gulfs and great lakes, set on the map as an atlas
// sets them: on the water, in spaced italic capitals, in lapis. Under the
// modern name, where the Bible gives the water a name of its own, that name
// in the KJV's words, with the verse that names it ("the great sea",
// Numbers 34:6). The positions are placed by hand, for the name to sit on the
// water and read well.
//
// The map has no ocean: its south edge is at 18°N, so of the Indian Ocean only
// the Arabian Sea is on it.
//
// `place` is the Theographic place the name stands for: a tap on the name
// shows it, as a tap on a place's dot does. Its dot, and those of the other
// names the data gives the same water (`also`), show only while a card names
// them or the panel shows them (map-view).
//
// `levels` are the levels of zoom (map-view's data-level: 0 for the whole map
// to 4) at which the name shows. A large sea is named far out; a small lake or
// a narrow gulf only close in, where it has room. The Mediterranean is named
// three times, so that it keeps a name as the view closes on the Aegean or the
// Levant.
// `angle` turns the name, in degrees clockwise, to run with the water.

/**
 * @typedef {{
 *   name: string, lon: number, lat: number, angle: number, levels: [number, number],
 *   bible?: string, ref?: string, place?: string, also?: string[], small?: boolean
 * }} Water
 */

/** @type {Water[]} */
export const waters = [
  // The seas.
  { name: 'Mediterranean Sea', bible: 'the Great Sea', ref: 'NUM.34.6', place: 'place:great_sea_493', also: ['place:sea_of_the_philistines_1036'], lon: 18.6, lat: 34.2, angle: 0, levels: [0, 2] },
  { name: 'Mediterranean Sea', bible: 'the Great Sea', ref: 'NUM.34.6', place: 'place:great_sea_493', lon: 30.6, lat: 33.4, angle: 0, levels: [1, 2] },
  { name: 'the Great Sea', ref: 'NUM.34.6', place: 'place:great_sea_493', lon: 34.42, lat: 32.45, angle: -78, levels: [3, 4] },
  { name: 'Black Sea', lon: 34.6, lat: 43.3, angle: 0, levels: [0, 3] },
  { name: 'Caspian Sea', lon: 51.0, lat: 39.4, angle: -72, levels: [0, 3] },
  { name: 'Red Sea', ref: 'EXO.15.4', place: 'place:red_sea_986', lon: 38.25, lat: 21.7, angle: 60, levels: [0, 3] },
  { name: 'Persian Gulf', lon: 51.2, lat: 27.1, angle: 30, levels: [0, 3] },
  { name: 'Arabian Sea', lon: 60.9, lat: 22.0, angle: -90, levels: [0, 2] },
  { name: 'Aegean Sea', lon: 24.95, lat: 38.1, angle: -76, levels: [1, 3] },
  { name: 'Adriatic Sea', lon: 16.4, lat: 42.6, angle: 42, levels: [1, 3] },
  { name: 'Ionian Sea', bible: 'Adria', ref: 'ACT.27.27', place: 'place:adria_30', lon: 18.7, lat: 37.7, angle: 0, levels: [1, 3] },
  { name: 'Tyrrhenian Sea', lon: 12.2, lat: 39.9, angle: 0, levels: [1, 3] },
  { name: 'Gulf of Sidra', place: 'place:syrtis_1123', lon: 18.6, lat: 31.7, angle: 0, levels: [1, 3] },
  { name: 'Sea of Marmara', lon: 28.2, lat: 40.78, angle: 0, levels: [2, 4], small: true },
  // The gulfs of the Red Sea, narrow: named close in.
  { name: 'Gulf of Suez', bible: 'the Egyptian Sea', ref: 'ISA.11.15', place: 'place:egyptian_sea_1031', lon: 33.02, lat: 28.85, angle: 62, levels: [2, 4], small: true },
  { name: 'Gulf of Aqaba', lon: 34.73, lat: 28.75, angle: -74, levels: [2, 4], small: true },
  // The lakes.
  { name: 'Dead Sea', bible: 'the Salt Sea', ref: 'GEN.14.3', place: 'place:salt_sea_1021', also: ['place:sea_of_the_plain_1035'], lon: 35.47, lat: 31.31, angle: -90, levels: [4, 4], small: true },
  {
    name: 'Sea of Galilee',
    bible: 'Chinnereth',
    ref: 'NUM.34.11',
    place: 'place:sea_of_galilee_1032',
    also: ['place:sea_of_chinnereth_1029', 'place:sea_of_chinneroth_1030', 'place:sea_of_tiberias_1034'],
    lon: 35.585,
    lat: 32.79,
    angle: -90,
    levels: [4, 4],
    small: true,
  },
  { name: 'Lake Van', lon: 42.95, lat: 38.62, angle: 0, levels: [2, 4], small: true },
  { name: 'Lake Urmia', lon: 45.42, lat: 37.7, angle: -80, levels: [2, 4], small: true },
];
