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
//   point   in place of `place`, a site Theographic does not have, such as
//           a proposed Mount Sinai: its name, its longitude and latitude
//           (approximate: the map says so), and `named`, the word the verse
//           uses for it
// Places Acts names only in passing, or that have no coordinates (Chios,
// Salmone, Clauda, Lasea), are left out; the route goes straight past them.
// A leg is a straight line, as an atlas draws a route at this scale: the
// real roads and sea lanes curve.
//
// A journey that scholars trace in more than one way has `routes`: every
// route proposed, each with its name and what it rests on, in place of one
// list of stops. The panel offers each, and the map draws the one chosen.

/** @typedef {{ name: string, lon: number, lat: number, named: string }} Point */
/** @typedef {{ place?: string, point?: Point, ref: string, by?: 'land' | 'sea', reading?: boolean }} Stop */
/** @typedef {{ id: string, name: string, basis: string, stops: Stop[] }} Route */
/** @typedef {{ id: string, title: string, person: string, passage: string, event?: string, startOnly?: boolean, stops?: Stop[], routes?: Route[] }} Journey `event` is Theographic's event for it, which gives its date by Jones's chronology, as the timeline does */

/** The Exodus as far as Etham: the same on every route. @type {Stop[]} */
const OUT_OF_EGYPT = [
  { place: 'place:rameses_980', ref: 'EXO.12.37' },
  { place: 'place:succoth_1114', ref: 'EXO.12.37', by: 'land' },
  { place: 'place:etham_417', ref: 'EXO.13.20', by: 'land' },
];

/** From Kadesh to the plains of Moab, round Edom: the same on most routes. @type {Stop[]} */
const TO_MOAB = [
  { place: 'place:kadesh-barnea_663', ref: 'NUM.32.8', by: 'land' },
  { place: 'place:mount_hor_842', ref: 'NUM.20.22', by: 'land' },
  { place: 'place:arnon_92', ref: 'NUM.21.13', by: 'land' },
  { place: 'place:shittim_1086', ref: 'NUM.25.1', by: 'land' },
  { place: 'place:mount_nebo_849', ref: 'DEU.34.1', by: 'land' },
];

/** Abraham in Canaan and Egypt, from Haran on. @type {Stop[]} */
const ABRAHAM_IN_CANAAN = [
  { place: 'place:haran_527', ref: 'GEN.11.31', by: 'land' },
  { place: 'place:shechem_1069', ref: 'GEN.12.6', by: 'land' },
  { place: 'place:bethel_202', ref: 'GEN.12.8', by: 'land' },
  { place: 'place:negeb_885', ref: 'GEN.12.9', by: 'land', reading: true },
  { point: { name: 'Egypt (the Delta)', lon: 31.6, lat: 30.85, named: 'Egypt' }, ref: 'GEN.12.10', by: 'land' },
  { place: 'place:bethel_202', ref: 'GEN.13.3', by: 'land' },
  { place: 'place:hebron_551', ref: 'GEN.13.18', by: 'land' },
  { place: 'place:gerar_459', ref: 'GEN.20.1', by: 'land' },
  { place: 'place:beersheba_170', ref: 'GEN.21.31', by: 'land' },
  { place: 'place:moriah_821', ref: 'GEN.22.2', by: 'land' },
];

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
  {
    id: 'abraham',
    title: "Abraham's journey",
    person: 'person:abraham_58',
    passage: 'GEN.11.31-13.18',
    event: 'event:71',
    routes: [
      {
        id: 'south',
        name: 'From Ur in the south',
        basis: 'Ur as Tell el-Muqayyar in southern Mesopotamia, as Leonard Woolley identified it, up the Euphrates to Haran.',
        stops: [{ place: 'place:ur_1189', ref: 'GEN.11.31' }, ...ABRAHAM_IN_CANAAN],
      },
      {
        id: 'north',
        name: 'From a northern Ur',
        basis: 'Ur as a northern city near Haran, at Urfa (Şanlıurfa), as Cyrus Gordon and others proposed.',
        stops: [{ point: { name: 'Ur at Urfa', lon: 38.79, lat: 37.16, named: 'Ur' }, ref: 'GEN.11.31' }, ...ABRAHAM_IN_CANAAN],
      },
    ],
  },
  {
    id: 'jacob',
    title: "Jacob's journey to Haran and back",
    person: 'person:israel_682',
    passage: 'GEN.28.10-35.27',
    stops: [
      { place: 'place:beersheba_170', ref: 'GEN.28.10' },
      { place: 'place:bethel_202', ref: 'GEN.28.19', by: 'land' },
      { place: 'place:haran_527', ref: 'GEN.29.4', by: 'land' },
      { place: 'place:gilead_475', ref: 'GEN.31.21', by: 'land' },
      { place: 'place:mahanaim_756', ref: 'GEN.32.2', by: 'land' },
      { place: 'place:penuel_931', ref: 'GEN.32.31', by: 'land' },
      { place: 'place:succoth_1113', ref: 'GEN.33.17', by: 'land' },
      { place: 'place:shechem_1069', ref: 'GEN.33.18', by: 'land' },
      { place: 'place:bethel_202', ref: 'GEN.35.6', by: 'land' },
      { place: 'place:ephrath_403', ref: 'GEN.35.19', by: 'land' },
      { place: 'place:mamre_762', ref: 'GEN.35.27', by: 'land' },
    ],
  },
  {
    id: 'exodus',
    title: 'The Exodus',
    person: 'person:moses_2108',
    passage: 'EXO.12.37-19.2',
    event: 'event:125',
    startOnly: true,
    routes: [
      {
        id: 'south',
        name: 'The southern route',
        basis: 'The route held since the fourth century: the sea crossed near the Gulf of Suez, and Mount Sinai at Jebel Musa, in the south of the peninsula.',
        stops: [
          ...OUT_OF_EGYPT,
          { place: 'place:pi-hahiroth_948', ref: 'EXO.14.2', by: 'land' },
          { place: 'place:marah_765', ref: 'EXO.15.23', by: 'sea' },
          { place: 'place:elim_369', ref: 'EXO.15.27', by: 'land' },
          { place: 'place:sin_1097', ref: 'EXO.16.1', by: 'land' },
          { place: 'place:rephidim_996', ref: 'EXO.17.1', by: 'land' },
          { point: { name: 'Mount Sinai at Jebel Musa', lon: 33.975, lat: 28.539, named: 'Sinai' }, ref: 'EXO.19.2', by: 'land' },
          { place: 'place:ezion-geber_423', ref: 'NUM.33.35', by: 'land' },
          ...TO_MOAB,
        ],
      },
      {
        id: 'north',
        name: 'The northern route',
        basis: 'The sea crossed by the coast at Lake Bardawil, the Sirbonian lake, and Mount Sinai in the north of the peninsula, at Jebel Helal.',
        stops: [
          ...OUT_OF_EGYPT,
          { place: 'place:migdol_799', ref: 'EXO.14.2', by: 'land' },
          { point: { name: 'Lake Bardawil', lon: 33.1, lat: 31.15, named: 'sea' }, ref: 'EXO.14.22', by: 'land' },
          { place: 'place:shur_1090', ref: 'EXO.15.22', by: 'sea' },
          { point: { name: 'Mount Sinai at Jebel Helal', lon: 33.95, lat: 30.67, named: 'Sinai' }, ref: 'EXO.19.2', by: 'land' },
          ...TO_MOAB,
        ],
      },
      {
        id: 'central',
        name: 'The central route',
        basis: 'The sea crossed at the Bitter Lakes, and Mount Sinai at Har Karkom in the Negev, as Emmanuel Anati proposed.',
        stops: [
          ...OUT_OF_EGYPT,
          { point: { name: 'The Bitter Lakes', lon: 32.37, lat: 30.35, named: 'sea' }, ref: 'EXO.14.22', by: 'land' },
          { place: 'place:shur_1090', ref: 'EXO.15.22', by: 'sea' },
          { point: { name: 'Mount Sinai at Har Karkom', lon: 34.74, lat: 30.29, named: 'Sinai' }, ref: 'EXO.19.2', by: 'land' },
          ...TO_MOAB,
        ],
      },
      {
        id: 'arabia',
        name: 'The Arabian route',
        basis: 'The sea crossed at the Gulf of Aqaba, from Nuweiba, and Mount Sinai in Midian, at Jebel al-Lawz, reading “mount Sinai in Arabia” (Galatians 4:25).',
        stops: [
          ...OUT_OF_EGYPT,
          { point: { name: 'Nuweiba', lon: 34.66, lat: 28.98, named: 'sea' }, ref: 'EXO.14.22', by: 'land' },
          { point: { name: 'The shore of Midian', lon: 34.83, lat: 28.93, named: 'sea' }, ref: 'EXO.14.29', by: 'sea' },
          { point: { name: 'Mount Sinai at Jebel al-Lawz', lon: 35.31, lat: 28.65, named: 'Sinai' }, ref: 'EXO.19.2', by: 'land' },
          { place: 'place:ezion-geber_423', ref: 'NUM.33.35', by: 'land' },
          ...TO_MOAB.slice(1),
        ],
      },
    ],
  },
  {
    id: 'jesus-jerusalem',
    title: "Jesus' last journey to Jerusalem",
    person: 'person:jesus_905',
    passage: 'LUK.9.51-19.28',
    event: 'event:432',
    routes: [
      {
        id: 'samaria',
        name: 'Through Samaria',
        basis: 'Through Samaria, as Luke tells it (Luke 9:51–53; 17:11), and down to Jericho.',
        stops: [
          { place: 'place:capernaum_274', ref: 'MRK.9.33' },
          { place: 'place:samaria_1022', ref: 'LUK.17.11', by: 'land' },
          { place: 'place:jericho_634', ref: 'LUK.19.1', by: 'land' },
          { place: 'place:bethany_186', ref: 'JHN.12.1', by: 'land' },
          { place: 'place:jerusalem_636', ref: 'LUK.19.28', by: 'land' },
        ],
      },
      {
        id: 'perea',
        name: 'Through Perea',
        basis: 'East of the Jordan, through Perea, as Matthew and Mark tell it (Matthew 19:1; Mark 10:1), crossing back at Jericho.',
        stops: [
          { place: 'place:capernaum_274', ref: 'MRK.9.33' },
          { point: { name: 'Perea, beyond Jordan', lon: 35.66, lat: 32.3, named: 'side of Jordan' }, ref: 'MRK.10.1', by: 'land' },
          { place: 'place:bethany_187', ref: 'JHN.10.40', by: 'land', reading: true },
          { place: 'place:jericho_634', ref: 'MRK.10.46', by: 'land' },
          { place: 'place:bethany_186', ref: 'MRK.11.1', by: 'land' },
          { place: 'place:jerusalem_636', ref: 'MRK.11.1', by: 'land' },
        ],
      },
    ],
  },
];

/**
 * A journey, ready for the map and the panel: one route of it, each stop
 * with its name and position in map units, and the length of the route in
 * km. A journey with several routes is one view for each; `route` names
 * it, and `basis` says what it rests on. A stop at a proposed site that
 * Theographic does not have is `proposed`, and has no place.
 *
 * @typedef {{
 *   id: string, title: string, route: string, basis: string, passage: string, passageTitle: string, years: string, km: number,
 *   stops: { place: string, name: string, x: number, y: number, ref: string, refTitle: string, by: string, reading: boolean, proposed: boolean }[]
 * }} JourneyView
 */

/**
 * @param {Journey} journey
 * @returns {Promise<JourneyView[]>}
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
  const event = journey.event ? known[journey.event] : null;
  const start = typeof event?.start === 'number' ? event.start : null;
  const length = Number(/^(\d+)Y$/.exec(String(event?.duration ?? ''))?.[1] ?? 0);
  const year = (/** @type {number} */ at) => (at <= 0 ? `${1 - at} BC` : `AD ${at}`);
  const years = start === null ? '' : `${year(start)}${length && !journey.startOnly ? `–${year(start + length).replace(/^AD /, '')}` : ''}, by Jones`;
  /** @param {string} address */
  const title = (address) => {
    const ref = parseAddress(address, books);
    return ref ? formatReference(ref, books) : address;
  };
  const routes = journey.routes ?? [{ id: '', name: '', basis: '', stops: journey.stops ?? [] }];
  return routes.map((route) => {
    const stops = route.stops.flatMap((stop) => {
      const at = stop.point ?? known[stop.place ?? ''];
      if (!at || at.lat === null || at.lon === null) return [];
      const { x, y } = project(at.lon, at.lat);
      const name = stop.point ? stop.point.name : at.title;
      return [{ place: stop.place ?? '', name, x, y, ref: stop.ref, refTitle: title(stop.ref), by: stop.by ?? '', reading: Boolean(stop.reading), proposed: Boolean(stop.point) }];
    });
    let km = 0;
    for (let i = 1; i < stops.length; i += 1) km += Math.hypot(stops[i].x - stops[i - 1].x, stops[i].y - stops[i - 1].y) * KM_PER_UNIT;
    return {
      id: route.id ? `${journey.id}:${route.id}` : journey.id,
      title: journey.title,
      route: route.name,
      basis: route.basis,
      passage: journey.passage,
      passageTitle: title(journey.passage),
      years,
      km: Math.round(km / 10) * 10,
      stops,
    };
  });
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
  return (await Promise.all(found.map(view))).flat();
}
