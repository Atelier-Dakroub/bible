// The sources of the app's data, for the Credits page (routes/credits.html).
// Each has its creator, what it gives the app, its license with a link, a
// link to the source, and what the app changed: what CC BY and CC BY-SA ask
// for. DATA-LICENSES.md gives the same sources by file.

/**
 * @typedef {{
 *   name: string, by: string, gives: string,
 *   license: string, licenseUrl?: string, url?: string, changes?: string
 * }} Credit
 * @typedef {{ title: string, sources: Credit[] }} CreditGroup
 */

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
const CC_BY_SA = 'https://creativecommons.org/licenses/by-sa/4.0/';
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';

/** @type {CreditGroup[]} */
export const CREDITS = [
  {
    title: 'Texts',
    sources: [
      {
        name: 'King James Version',
        by: 'eBible.org (eng-kjv2006)',
        gives: 'The KJV text.',
        license: 'Public domain (in the United Kingdom, the Crown holds the rights by letters patent)',
        url: 'https://ebible.org/find/details.php?id=eng-kjv2006',
      },
      {
        name: 'Berean Standard Bible',
        by: 'Berean Bible, from eBible.org',
        gives: 'The BSB text.',
        license: 'Public domain',
        url: 'https://berean.bible/',
      },
      {
        name: 'STEPBible Hebrew and Greek',
        by: 'STEPBible.org, based on work at Tyndale House, Cambridge',
        gives: 'The Hebrew and the Greek, word by word, with their grammar, transliteration and English.',
        license: 'CC BY 4.0',
        licenseUrl: CC_BY,
        url: 'https://github.com/STEPBible/STEPBible-Data',
        changes: 'Reshaped into one file a book, and lined up with the KJV.',
      },
      {
        name: "Strong's numbers on the KJV",
        by: 'eBible.org',
        gives: "The Strong's number of each word of the KJV.",
        license: 'Public domain',
        url: 'https://ebible.org/',
      },
      {
        name: "Strong's dictionaries",
        by: 'Open Scriptures',
        gives: "The dictionary entry of each Strong's number.",
        license: 'CC BY-SA',
        licenseUrl: CC_BY_SA,
        url: 'https://github.com/openscriptures/strongs',
        changes: 'Reshaped into one file.',
      },
      {
        name: 'Semantic Dictionaries of Biblical Hebrew and Greek',
        by: 'Adapted from Semantic Dictionary of Biblical Hebrew © 2000-2026 United Bible Societies, and from Semantic Dictionary of Biblical Greek: © United Bible Societies 2018-2023',
        gives: 'The senses of a word, and which verses use each.',
        license: 'CC BY-SA 4.0',
        licenseUrl: CC_BY_SA,
        url: 'https://github.com/ubsicap/ubs-open-license',
        changes: 'Each sense joined to the verses that use it.',
      },
      {
        name: 'MACULA Greek and Hebrew',
        by: '© Biblica',
        gives: "The syntax of each sentence, and the quotations that Nestle's Greek New Testament (1904) marks.",
        license: 'CC BY 4.0',
        licenseUrl: CC_BY,
        url: 'https://github.com/Clear-Bible',
        changes: 'Reshaped for the app; the UBS senses and domains in MACULA are left out.',
      },
      {
        name: 'UBS Parallel Passages Database',
        by: 'United Bible Societies',
        gives: 'The Old Testament quoted in the New, where Nestle marks none.',
        license: 'CC BY-SA 4.0',
        licenseUrl: CC_BY_SA,
        url: 'https://github.com/ubsicap/ubs-open-license',
        changes: 'Only the quotations, joined with those of Nestle.',
      },
      {
        name: 'Cross-references',
        by: 'OpenBible.info, from the Treasury of Scripture Knowledge',
        gives: 'The cross-references of each verse, best first.',
        license: 'CC BY',
        licenseUrl: CC_BY,
        url: 'https://www.openbible.info/labs/cross-references/',
        changes: 'Those with no votes are left out.',
      },
      {
        name: "Nave's Topical Bible (1896)",
        by: "Orville J. Nave; the data from Brady Stephenson's bible-data",
        gives: 'The topics, their headings, and the verses for each.',
        license: 'CC BY 4.0 (the text itself is in the public domain)',
        licenseUrl: CC_BY,
        url: 'https://github.com/BradyStephenson/bible-data',
        changes: 'Reshaped into one file, with each reference read as an address.',
      },
    ],
  },
  {
    title: 'People, places, events and dates',
    sources: [
      {
        name: 'Theographic Bible Metadata',
        by: 'Robert Rouse and contributors, with the dates of Floyd Nolen Jones and the text of Easton\'s Bible Dictionary (1897)',
        gives: 'The people, places, groups and events, the verses that name them, and their dates.',
        license: 'CC BY-SA 4.0',
        licenseUrl: CC_BY_SA,
        url: 'https://github.com/robertrouse/theographic-bible-metadata',
        changes: 'Reshaped for the app. Theographic credits its own sources in its bibliography.',
      },
      {
        name: 'The kings of Israel and Judah',
        by: 'Wikipedia contributors, "Kings of Israel and Judah"',
        gives: 'The reigns by Albright, Thiele, Galil and Kitchen.',
        license: 'CC BY-SA 4.0',
        licenseUrl: CC_BY_SA,
        url: 'https://en.wikipedia.org/wiki/Kings_of_Israel_and_Judah',
        changes: 'The dates of each reign, joined to its event.',
      },
      {
        name: 'World history',
        by: 'Wikidata',
        gives: 'The empires, rulers and events of the world beside the Bible.',
        license: 'CC0',
        licenseUrl: CC0,
        url: 'https://www.wikidata.org/',
      },
    ],
  },
  {
    title: 'The map',
    sources: [
      {
        name: 'Natural Earth',
        by: 'Natural Earth',
        gives: 'The land and the rivers of the whole map.',
        license: 'Public domain',
        url: 'https://www.naturalearthdata.com/',
        changes: 'Clipped to the map, and simplified.',
      },
      {
        name: 'GSHHG 2.3.7',
        by: 'Paul Wessel and Walter H. F. Smith',
        gives: 'The coast and the lakes.',
        license: 'LGPL 3.0 or later',
        licenseUrl: 'https://www.gnu.org/licenses/lgpl-3.0.html',
        url: 'https://www.soest.hawaii.edu/pwessel/gshhg/',
        changes: 'Clipped to the map, and simplified for the whole map.',
      },
      {
        name: 'HydroRIVERS 1.0',
        by: 'Lehner and Grill (2013). Incorporates data from the HydroSHEDS database, © World Wildlife Fund, Inc. (2006-2013), used under license. WWF has not evaluated the data as altered here, and gives no warranty for it.',
        gives: 'The rivers of the close view.',
        license: 'HydroSHEDS license (free with attribution)',
        url: 'https://www.hydrosheds.org/products/hydrorivers',
        changes: 'Clipped to the map, and simplified.',
      },
      {
        name: 'ETOPO 2022',
        by: 'NOAA National Centers for Environmental Information (doi:10.25921/fd45-gt74)',
        gives: 'The relief and the hill shade.',
        license: 'Public domain',
        url: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model',
        changes: 'Made into bands of height and a shaded picture.',
      },
      {
        name: 'AWMC geodata',
        by: 'Ancient World Mapping Center. Contains information from AWMC geodata, which is made available under the ODbL.',
        gives: 'The extents of the ancient empires, the Roman provinces, and the shores of four ages.',
        license: 'ODbL 1.0',
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
        url: 'https://github.com/AWMC/geodata',
        changes: 'Clipped to the map, and simplified.',
      },
    ],
  },
  {
    title: 'Pictures, video and sound',
    sources: [
      {
        name: 'The Matson Photograph Collection',
        by: 'Library of Congress',
        gives: 'Photographs of the places, about 1898 to 1946.',
        license: 'No known restrictions on publication',
        url: 'https://www.loc.gov/collections/matson-photographs/',
      },
      {
        name: 'The Met Open Access',
        by: 'The Metropolitan Museum of Art',
        gives: 'Works of art that show the people and events.',
        license: 'CC0',
        licenseUrl: CC0,
        url: 'https://www.metmuseum.org/about-the-met/policies-and-documents/open-access',
      },
      {
        name: 'BibleProject',
        by: 'BibleProject',
        gives: 'The book overviews, played in YouTube\'s player.',
        license: 'Free to share; not for sale',
        url: 'https://bibleproject.com/',
      },
      {
        name: 'JESUS (1979)',
        by: '© Jesus Film Project',
        gives: 'The film, scene by scene.',
        license: 'Free to show',
        url: 'https://www.jesusfilm.org/',
      },
      {
        name: 'The Chosen',
        by: '© 5&2 Studios / The Chosen, LLC',
        gives: 'Links to the episodes, which play on its own site.',
        license: 'Links only',
        url: 'https://watch.thechosen.tv/',
      },
      {
        name: 'The King James Version, read for LibriVox',
        by: 'Michael Armenta, for LibriVox',
        gives: 'The KJV read aloud.',
        license: 'Public domain',
        url: 'https://librivox.org/',
        changes: 'Each chapter cut from the readings, with the time of each verse.',
      },
      {
        name: "The app's own reading",
        by: 'Made for the app with Qwen3-TTS (Apache 2.0), in a voice designed for it: a synthetic voice, not a recording of a person',
        gives: 'The KJV and the BSB read aloud.',
        license: 'CC0',
        licenseUrl: CC0,
      },
    ],
  },
  {
    title: 'Fonts and code',
    sources: [
      {
        name: 'Literata, Atkinson Hyperlegible Next, Gentium Plus, Ezra SIL',
        by: 'TypeTogether for Google; the Braille Institute; SIL International',
        gives: 'The type of the text, of the controls, of the Greek and of the Hebrew.',
        license: 'SIL Open Font License 1.1',
        licenseUrl: 'https://openfontlicense.org/',
      },
      {
        name: 'ProseMirror',
        by: 'Marijn Haverbeke and contributors',
        gives: 'The editor of the notes.',
        license: 'MIT',
        url: 'https://prosemirror.net/',
      },
      {
        name: 'hls.js',
        by: 'Dailymotion and contributors',
        gives: 'The video player\'s streams.',
        license: 'Apache 2.0',
        licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
        url: 'https://github.com/video-dev/hls.js',
      },
    ],
  },
];
