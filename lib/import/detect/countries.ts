/**
 * Enough country words to recognise a country column.
 *
 * Not a complete gazetteer, and not meant to be — this only has to answer "does
 * this column hold countries?", which a European locations file settles within
 * its first few rows. The list covers the two-letter codes for everywhere plus
 * the English and local names of the markets our customers actually operate in.
 * A country we don't list costs nothing: the header still matches, and the user
 * still confirms.
 */

const ISO_CODES = [
  "ad","ae","af","ag","ai","al","am","ao","ar","at","au","aw","az","ba","bb",
  "bd","be","bf","bg","bh","bi","bj","bm","bn","bo","br","bs","bt","bw","by",
  "bz","ca","cd","cf","cg","ch","ci","cl","cm","cn","co","cr","cu","cv","cy",
  "cz","de","dj","dk","dm","do","dz","ec","ee","eg","er","es","et","fi","fj",
  "fo","fr","ga","gb","gd","ge","gg","gh","gi","gl","gm","gn","gq","gr","gt",
  "gu","gw","gy","hk","hn","hr","ht","hu","id","ie","il","im","in","iq","ir",
  "is","it","je","jm","jo","jp","ke","kg","kh","ki","km","kn","kp","kr","kw",
  "ky","kz","la","lb","lc","li","lk","lr","ls","lt","lu","lv","ly","ma","mc",
  "md","me","mg","mk","ml","mm","mn","mo","mr","mt","mu","mv","mw","mx","my",
  "mz","na","ne","ng","ni","nl","no","np","nz","om","pa","pe","pf","pg","ph",
  "pk","pl","pr","ps","pt","py","qa","ro","rs","ru","rw","sa","sb","sc","sd",
  "se","sg","si","sk","sl","sm","sn","so","sr","ss","sv","sy","sz","td","tg",
  "th","tj","tm","tn","to","tr","tt","tw","tz","ua","ug","us","uy","uz","va",
  "vc","ve","vn","vu","ws","ye","za","zm","zw",
];

const NAMES = [
  // English
  "afghanistan","albania","algeria","andorra","angola","argentina","armenia",
  "australia","austria","azerbaijan","bahrain","bangladesh","barbados","belarus",
  "belgium","belize","benin","bhutan","bolivia","bosnia and herzegovina","botswana",
  "brazil","brunei","bulgaria","burkina faso","burundi","cambodia","cameroon",
  "canada","chad","chile","china","colombia","costa rica","croatia","cuba",
  "cyprus","czechia","czech republic","denmark","dominican republic","ecuador",
  "egypt","el salvador","estonia","ethiopia","finland","france","georgia",
  "germany","ghana","greece","guatemala","honduras","hong kong","hungary",
  "iceland","india","indonesia","iran","iraq","ireland","israel","italy",
  "jamaica","japan","jordan","kazakhstan","kenya","kuwait","latvia","lebanon",
  "libya","liechtenstein","lithuania","luxembourg","malaysia","malta","mexico",
  "moldova","monaco","mongolia","montenegro","morocco","mozambique","myanmar",
  "namibia","nepal","netherlands","new zealand","nicaragua","nigeria",
  "north macedonia","norway","oman","pakistan","panama","paraguay","peru",
  "philippines","poland","portugal","qatar","romania","russia","saudi arabia",
  "senegal","serbia","singapore","slovakia","slovenia","south africa",
  "south korea","spain","sri lanka","sweden","switzerland","taiwan","tanzania",
  "thailand","tunisia","turkey","türkiye","uganda","ukraine","united arab emirates",
  "united kingdom","united states","united states of america","uruguay",
  "uzbekistan","venezuela","vietnam","zambia","zimbabwe",
  // The abbreviations that appear in real files
  "uk","usa","u.s.","u.s.a.","great britain","england","scotland","wales",
  "northern ireland","holland",
  // The local spellings of our own markets
  "deutschland","österreich","osterreich","schweiz","belgien","frankreich",
  "italien","spanien","niederlande","polen","dänemark","danemark","schweden",
  "norwegen","finnland","tschechien","ungarn",
  "allemagne","autriche","suisse","belgique","espagne","italie","pays-bas",
  "royaume-uni","états-unis","etats-unis","pologne","danemark","suède","suede",
  "alemania","francia","suiza","bélgica","belgica","países bajos","paises bajos",
  "reino unido","estados unidos","italia","polonia","portugal",
  "germania","svizzera","belgio","paesi bassi","regno unito","stati uniti",
  "spagna","francia","polonia",
  "duitsland","frankrijk","zwitserland","belgië","belgie","nederland",
  "verenigd koninkrijk","verenigde staten","spanje","italië","italie","polen",
  "niemcy","francja","szwajcaria","belgia","holandia","wielka brytania",
  "stany zjednoczone","hiszpania","włochy","wlochy","polska","czechy",
];

export const COUNTRY_WORDS: ReadonlySet<string> = new Set([
  ...ISO_CODES,
  ...NAMES,
]);
