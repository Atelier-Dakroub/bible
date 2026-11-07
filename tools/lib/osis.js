// OSIS book names, in canon order, beside the ids the KJV data uses. The
// OpenBible.info and Theographic data both name books the OSIS way.

export const OSIS = [
  ['Gen', 'GEN'], ['Exod', 'EXO'], ['Lev', 'LEV'], ['Num', 'NUM'], ['Deut', 'DEU'], ['Josh', 'JOS'],
  ['Judg', 'JDG'], ['Ruth', 'RUT'], ['1Sam', '1SA'], ['2Sam', '2SA'], ['1Kgs', '1KI'], ['2Kgs', '2KI'],
  ['1Chr', '1CH'], ['2Chr', '2CH'], ['Ezra', 'EZR'], ['Neh', 'NEH'], ['Esth', 'EST'], ['Job', 'JOB'],
  ['Ps', 'PSA'], ['Prov', 'PRO'], ['Eccl', 'ECC'], ['Song', 'SNG'], ['Isa', 'ISA'], ['Jer', 'JER'],
  ['Lam', 'LAM'], ['Ezek', 'EZK'], ['Dan', 'DAN'], ['Hos', 'HOS'], ['Joel', 'JOL'], ['Amos', 'AMO'],
  ['Obad', 'OBA'], ['Jonah', 'JON'], ['Mic', 'MIC'], ['Nah', 'NAM'], ['Hab', 'HAB'], ['Zeph', 'ZEP'],
  ['Hag', 'HAG'], ['Zech', 'ZEC'], ['Mal', 'MAL'], ['Matt', 'MAT'], ['Mark', 'MRK'], ['Luke', 'LUK'],
  ['John', 'JHN'], ['Acts', 'ACT'], ['Rom', 'ROM'], ['1Cor', '1CO'], ['2Cor', '2CO'], ['Gal', 'GAL'],
  ['Eph', 'EPH'], ['Phil', 'PHP'], ['Col', 'COL'], ['1Thess', '1TH'], ['2Thess', '2TH'], ['1Tim', '1TI'],
  ['2Tim', '2TI'], ['Titus', 'TIT'], ['Phlm', 'PHM'], ['Heb', 'HEB'], ['Jas', 'JAS'], ['1Pet', '1PE'],
  ['2Pet', '2PE'], ['1John', '1JN'], ['2John', '2JN'], ['3John', '3JN'], ['Jude', 'JUD'], ['Rev', 'REV'],
];

export const ids = new Map(OSIS);

/**
 * `Gen.1.1` to `GEN.1.1`, or null for a book name that is not in the table.
 *
 * @param {string} osis
 */
export function toAddress(osis) {
  const [name, ...rest] = osis.split('.');
  const id = ids.get(name);
  return id ? [id, ...rest].join('.') : null;
}
