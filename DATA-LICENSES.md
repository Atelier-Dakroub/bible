# Data licenses

The app's code is under the MIT License (LICENSE). The data that the app
shows comes from many sources, each under its own license. This file gives
the license of each file or folder. The app's Credits page (/credits) gives
the same sources to the reader, with links.

The import tools in `tools/` made each data file from its source. Each
tool's header names the source, the version and what the tool changed. The
data is filtered and reshaped for the app (for example, cross-references with
no votes are left out); none of it is the source as published.

If you share the data, keep each license: a share-alike license (CC BY-SA,
ODbL, LGPL) applies to the files under it, not to the rest of the app.

## Texts

| Files | Source | License |
| --- | --- | --- |
| `app/data/kjv/` | King James Version, eBible.org `eng-kjv2006` | Public domain (outside the United Kingdom, where the Crown's letters patent apply) |
| `app/data/bsb/` | Berean Standard Bible, eBible.org `engbsb` | Public domain |
| `app/data/original/` | STEPBible TAHOT and TAGNT, with their morphology: "STEPBible.org based on work at Tyndale House, Cambridge" | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `app/data/strongs/<BOOK>.json` | Strong's numbers on the KJV, eBible.org | Public domain |
| `app/data/strongs/lexicon.json` | Strong's dictionaries, Open Scriptures ([github.com/openscriptures/strongs](https://github.com/openscriptures/strongs)) | [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/) |
| `app/data/senses.json` | "Adapted from Semantic Dictionary of Biblical Hebrew © 2000-2026 United Bible Societies" and "Adapted from Semantic Dictionary of Biblical Greek: © United Bible Societies 2018-2023" ([ubs-open-license](https://github.com/ubsicap/ubs-open-license)) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `app/data/syntax/` | MACULA Greek and Hebrew syntax trees, © Biblica ([github.com/Clear-Bible](https://github.com/Clear-Bible)); MACULA's UBS senses and domains are left out | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `app/data/quotations.json` | Nestle 1904 quotations as marked in MACULA Greek (© Biblica, CC BY 4.0; the Nestle text is public domain), and the UBS Parallel Passages Database (CC BY-SA 4.0). The two are in one file, so the file is under the share-alike license. | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `app/data/xrefs/`, `app/data/parallels.json` | Cross-references from OpenBible.info ([openbible.info/labs/cross-references](https://www.openbible.info/labs/cross-references/)), from the Treasury of Scripture Knowledge | [CC BY](https://creativecommons.org/licenses/by/4.0/) |
| `app/data/topics.json` | Nave's Topical Bible (1896, public domain), from Brady Stephenson's bible-data ([github.com/BradyStephenson/bible-data](https://github.com/BradyStephenson/bible-data)) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

## People, places, events and dates

| Files | Source | License |
| --- | --- | --- |
| `app/data/entities/` | Theographic Bible Metadata ([github.com/robertrouse/theographic-bible-metadata](https://github.com/robertrouse/theographic-bible-metadata)), with its dates by Floyd Nolen Jones and Easton's Bible Dictionary (1897). Theographic asks that its own sources be credited too: see its bibliography. | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `app/data/chronology/kings.json` | Wikipedia, "Kings of Israel and Judah" | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `app/data/world/` | Wikidata | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

## The map

| Files | Source | License |
| --- | --- | --- |
| `app/data/map/near-east.json`: land and rivers | Natural Earth 1:10m | Public domain |
| `app/data/map/near-east.json`: coast and lakes | GSHHG 2.3.7, by Paul Wessel and Walter H. F. Smith | LGPL 3.0 or later: `app/data/map/GSHHG-LICENSE.txt`, `COPYING.LESSERv3` and `COPYINGv3` |
| `app/data/map/near-east.json`: the close view's rivers | HydroRIVERS 1.0 (Lehner and Grill 2013, [hydrosheds.org](https://www.hydrosheds.org/products/hydrorivers)). This data incorporates data from the HydroSHEDS database, which is © World Wildlife Fund, Inc. (2006-2013) and has been used herein under license. WWF has not evaluated the data as altered and incorporated within this app, and therefore gives no warranty regarding its accuracy, completeness, currency or suitability for any particular purpose. | HydroSHEDS license: free use with attribution; passed on only within a derived product |
| `app/data/map/relief.json`, `app/public/map/hillshade*.png` | NOAA ETOPO 2022 (doi:10.25921/fd45-gt74) | Public domain (a work of the US Government) |
| `app/data/map/ancient.json` | AWMC geodata, Ancient World Mapping Center ([github.com/AWMC/geodata](https://github.com/AWMC/geodata)). Contains information from AWMC geodata, which is made available under the ODbL. | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| `app/data/map/ranges.js`, `app/data/map/waters.js` | Written for the app | MIT (LICENSE) |

## Pictures, video and sound

| Files | Source | License |
| --- | --- | --- |
| `app/public/images/` (from the Library of Congress) | The Matson Photograph Collection, Library of Congress | No known restrictions on publication; each picture's credit line is in `app/data/images.json` |
| `app/public/images/` (from The Met) | The Metropolitan Museum of Art, Open Access | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `app/data/videos.json`: BibleProject | YouTube ids of BibleProject's videos, played in YouTube's player | BibleProject permits the embed on a not-for-profit page; the videos are theirs |
| `app/data/videos.json`: JESUS (1979) | Stream and still addresses of the Jesus Film Project's film | © Jesus Film Project. Their permission for this use is being asked; until it is given, do not show this source on a public site. |
| `app/data/videos.json`: The Chosen | Links and titles of episodes | © 5&2 Studios / The Chosen, LLC: links only |
| `app/data/audio/kjv.json` (the times of each verse) | LibriVox's King James Version, read by Michael Armenta | Public domain; the recordings themselves are not in git |
| `app/data/audio/plain-male-*.json`, the app's own recordings, `tools/voice/reference/` | The app's own reading, made with Qwen3-TTS (Apache 2.0) in a voice designed for it, not cloned from a person | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

## Fonts

| Files | License |
| --- | --- |
| `app/public/fonts/`: Literata, Atkinson Hyperlegible Next, Gentium Plus, Ezra SIL | SIL Open Font License 1.1: each font's license is beside it |

## Written for the app

These are under the MIT License with the code: `app/data/journeys.js` (the
journeys' routes, written by hand from the text; their places are
Theographic's), `app/data/canon.js` (the books by kind, and their
traditional authors), the icons in `app/icons/` and `app/public/icons/`, and
the guide in `docs/guide/`. `app/data/facts.js` is code: it works out each
"Did you know?" from the data above, and names its source.
