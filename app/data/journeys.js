// Journeys on the map: the route of each, as stops in order, each with the
// verse that names it, so every stop can be checked against the text.
//
// These are written by hand from the text of Acts, not taken from a dataset:
// Theographic's events name their places, but not in the order of travel.
// The places are Theographic's (CC BY-SA), and need coordinates to show.
//
// A stop has:
//   place   a place id (data/entities.js)
//   ref     the verse that names it
//   by      how Paul came to it: 'land' or 'sea' (the first stop has none)
//   reading true where Acts names only a region and the city is the usual
//           reading of it, such as Macedonia for Philippi; the map says so
// Places Acts names only in passing, or that have no coordinates (Chios,
// Salmone, Clauda, Lasea), are left out; the route goes straight past them.
// A leg is a straight line, as an atlas draws a route at this scale: the
// real roads and sea lanes curve.

/** @typedef {{ place: string, ref: string, by?: 'land' | 'sea', reading?: boolean }} Stop */
/** @typedef {{ id: string, title: string, person: string, passage: string, event: string, startOnly?: boolean, stops: Stop[] }} Journey `event` is Theographic's event for it, which gives its date by Jones's chronology, as the timeline does */

/** @type {Journey[]} */
export const journeys = [
  {
    id: 'paul-1',
    title: "Paul's first journey",
    person: 'person:paul_2479',
    passage: 'ACT.13.1-14.28',
    event: 'event:338',
    stops: [
      { place: 'place:antioch_68', ref: 'ACT.13.1' },
      { place: 'place:seleucia_1045', ref: 'ACT.13.4', by: 'land' },
      { place: 'place:salamis_1016', ref: 'ACT.13.5', by: 'sea' },
      { place: 'place:paphos_919', ref: 'ACT.13.6', by: 'land' },
      { place: 'place:perga_936', ref: 'ACT.13.13', by: 'sea' },
      { place: 'place:antioch_69', ref: 'ACT.13.14', by: 'land' },
      { place: 'place:iconium_590', ref: 'ACT.13.51', by: 'land' },
      { place: 'place:lystra_742', ref: 'ACT.14.6', by: 'land' },
      { place: 'place:derbe_330', ref: 'ACT.14.20', by: 'land' },
      { place: 'place:lystra_742', ref: 'ACT.14.21', by: 'land' },
      { place: 'place:iconium_590', ref: 'ACT.14.21', by: 'land' },
      { place: 'place:antioch_69', ref: 'ACT.14.21', by: 'land' },
      { place: 'place:perga_936', ref: 'ACT.14.25', by: 'land' },
      { place: 'place:attalia_120', ref: 'ACT.14.25', by: 'land' },
      { place: 'place:antioch_68', ref: 'ACT.14.26', by: 'sea' },
    ],
  },
  {
    id: 'paul-2',
    title: "Paul's second journey",
    person: 'person:paul_2479',
    passage: 'ACT.15.36-18.22',
    event: 'event:345',
    stops: [
      { place: 'place:antioch_68', ref: 'ACT.15.35' },
      { place: 'place:derbe_330', ref: 'ACT.16.1', by: 'land' },
      { place: 'place:lystra_742', ref: 'ACT.16.1', by: 'land' },
      { place: 'place:troas_1182', ref: 'ACT.16.8', by: 'land' },
      { place: 'place:samothrace_1025', ref: 'ACT.16.11', by: 'sea' },
      { place: 'place:neapolis_880', ref: 'ACT.16.11', by: 'sea' },
      { place: 'place:philippi_942', ref: 'ACT.16.12', by: 'land' },
      { place: 'place:amphipolis_59', ref: 'ACT.17.1', by: 'land' },
      { place: 'place:apollonia_76', ref: 'ACT.17.1', by: 'land' },
      { place: 'place:thessalonica_1158', ref: 'ACT.17.1', by: 'land' },
      { place: 'place:berea_177', ref: 'ACT.17.10', by: 'land' },
      { place: 'place:athens_118', ref: 'ACT.17.15', by: 'sea' },
      { place: 'place:corinth_306', ref: 'ACT.18.1', by: 'land' },
      { place: 'place:cenchreae_281', ref: 'ACT.18.18', by: 'land' },
      { place: 'place:ephesus_400', ref: 'ACT.18.19', by: 'sea' },
      { place: 'place:caesarea_266', ref: 'ACT.18.22', by: 'sea' },
      // "gone up, and saluted the church": Jerusalem, as it is usually read.
      { place: 'place:jerusalem_636', ref: 'ACT.18.22', by: 'land', reading: true },
      { place: 'place:antioch_68', ref: 'ACT.18.22', by: 'land' },
    ],
  },
  {
    id: 'paul-3',
    title: "Paul's third journey",
    person: 'person:paul_2479',
    passage: 'ACT.18.23-21.17',
    event: 'event:363',
    stops: [
      { place: 'place:antioch_68', ref: 'ACT.18.22' },
      { place: 'place:ephesus_400', ref: 'ACT.19.1', by: 'land' },
      // Acts names Macedonia and Greece; Philippi and Corinth are the usual
      // reading.
      { place: 'place:philippi_942', ref: 'ACT.20.1', by: 'sea', reading: true },
      { place: 'place:corinth_306', ref: 'ACT.20.2', by: 'land', reading: true },
      { place: 'place:philippi_942', ref: 'ACT.20.6', by: 'land' },
      { place: 'place:troas_1182', ref: 'ACT.20.6', by: 'sea' },
      { place: 'place:assos_110', ref: 'ACT.20.13', by: 'land' },
      { place: 'place:mitylene_808', ref: 'ACT.20.14', by: 'sea' },
      { place: 'place:samos_1024', ref: 'ACT.20.15', by: 'sea' },
      { place: 'place:trogyllium_1278', ref: 'ACT.20.15', by: 'sea' },
      { place: 'place:miletus_801', ref: 'ACT.20.15', by: 'sea' },
      { place: 'place:coos_308', ref: 'ACT.21.1', by: 'sea' },
      { place: 'place:rhodes_1000', ref: 'ACT.21.1', by: 'sea' },
      { place: 'place:patara_924', ref: 'ACT.21.1', by: 'sea' },
      { place: 'place:tyre_1184', ref: 'ACT.21.3', by: 'sea' },
      { place: 'place:ptolemais_959', ref: 'ACT.21.7', by: 'sea' },
      { place: 'place:caesarea_266', ref: 'ACT.21.8', by: 'land' },
      { place: 'place:jerusalem_636', ref: 'ACT.21.15', by: 'land' },
    ],
  },
  {
    id: 'paul-rome',
    title: "Paul's voyage to Rome",
    person: 'person:paul_2479',
    passage: 'ACT.27.1-28.16',
    event: 'event:381',
    // Theographic's event runs on into the imprisonment in Rome; the voyage
    // is its start.
    startOnly: true,
    stops: [
      // Paul is kept at Caesarea (Acts 25:4), and sails from there in 27:1.
      { place: 'place:caesarea_266', ref: 'ACT.25.4' },
      { place: 'place:sidon_1093', ref: 'ACT.27.3', by: 'sea' },
      { place: 'place:myra_864', ref: 'ACT.27.5', by: 'sea' },
      { place: 'place:cnidus_304', ref: 'ACT.27.7', by: 'sea' },
      { place: 'place:fair_havens_424', ref: 'ACT.27.8', by: 'sea' },
      { place: 'place:melita_761', ref: 'ACT.28.1', by: 'sea' },
      { place: 'place:syracuse_1121', ref: 'ACT.28.12', by: 'sea' },
      { place: 'place:rhegium_999', ref: 'ACT.28.13', by: 'sea' },
      { place: 'place:puteoli_963', ref: 'ACT.28.13', by: 'sea' },
      { place: 'place:appii_forum_427', ref: 'ACT.28.15', by: 'land' },
      { place: 'place:three_taverns_1159', ref: 'ACT.28.15', by: 'land' },
      { place: 'place:rome_1013', ref: 'ACT.28.16', by: 'land' },
    ],
  },
];

/**
 * A journey, ready for the map and the panel: each stop with its place's
 * name and position in map units, and the length of the route in km.
 *
 * @typedef {{
 *   id: string, title: string, passage: string, passageTitle: string, years: string, km: number,
 *   stops: { place: string, name: string, x: number, y: number, ref: string, refTitle: string, by: string, reading: boolean }[]
 * }} JourneyView
 */

/**
 * @param {Journey} journey
 * @returns {Promise<JourneyView>}
 */
async function view(journey) {
  const [{ entities }, { project, KM_PER_UNIT }, { books }, { formatReference, parseAddress }] = await Promise.all([
    import('./entities.js'),
    import('../lib/map.js'),
    import('./bible.js'),
    import('../lib/reference.js'),
  ]);
  const known = await entities();
  // The date, from the journey's event: by Jones's chronology, as the
  // timeline shows it. A duration is such as 1Y or 4Y.
  const event = known[journey.event];
  const start = typeof event?.start === 'number' ? event.start : null;
  const length = Number(/^(\d+)Y$/.exec(String(event?.duration ?? ''))?.[1] ?? 0);
  const years = start === null ? '' : `AD ${start}${length && !journey.startOnly ? `–${start + length}` : ''}, by Jones`;
  /** @param {string} address */
  const title = (address) => {
    const ref = parseAddress(address, books);
    return ref ? formatReference(ref, books) : address;
  };
  const stops = journey.stops.flatMap((stop) => {
    const place = known[stop.place];
    if (!place || place.lat === null || place.lon === null) return [];
    const { x, y } = project(place.lon, place.lat);
    return [{ place: stop.place, name: place.title, x, y, ref: stop.ref, refTitle: title(stop.ref), by: stop.by ?? '', reading: Boolean(stop.reading) }];
  });
  let km = 0;
  for (let i = 1; i < stops.length; i += 1) km += Math.hypot(stops[i].x - stops[i - 1].x, stops[i].y - stops[i - 1].y) * KM_PER_UNIT;
  return { id: journey.id, title: journey.title, passage: journey.passage, passageTitle: title(journey.passage), years, km: Math.round(km / 10) * 10, stops };
}

/**
 * The journeys of a person, or the journeys a passage tells part of.
 *
 * @param {{ person?: string, address?: string }} about
 * @returns {Promise<JourneyView[]>}
 */
export async function journeysFor({ person, address }) {
  const { books } = await import('./bible.js');
  const { parseAddress, versesIn } = await import('../lib/reference.js');
  /** @param {string} text */
  const verses = (text) => {
    const ref = parseAddress(text, books);
    return ref ? new Set(versesIn(ref, books).map(([chapter, n]) => `${ref.book}.${chapter}.${n}`)) : new Set();
  };
  const asked = address ? verses(address) : null;
  const found = journeys.filter((journey) => {
    if (person) return journey.person === person;
    if (!asked) return false;
    const told = verses(journey.passage);
    return [...asked].some((verse) => told.has(verse));
  });
  return Promise.all(found.map(view));
}
