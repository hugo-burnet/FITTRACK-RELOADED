// Normalisation lexicale du français de salle vers le vocabulaire du corpus.
//
// Le corpus est un texte académique ; les questions posées ne le sont pas. Un
// pratiquant écrit « pecs », « deadlift », « mon tendon tire » là où le corpus
// écrit « grand pectoral », « soulevé de terre », « tendinopathie ». Sans ce
// repli, chacune de ces paires est deux tokens sans rapport et la recherche
// rate une réponse qui est pourtant dans le corpus.
//
// La normalisation s'applique aux DEUX côtés — questions et affirmations
// indexées. C'est ce qui la rend sûre : elle ne gonfle pas artificiellement le
// nombre de termes appariés, elle replie les deux côtés sur la même forme.

// Repli des pluriels français les plus fréquents. L'ordre compte : « faisceaux »
// satisfait aussi la règle en -aux, qui le transformerait en « faisceal ».
const PLURAL_RULES: readonly (readonly [RegExp, string])[] = [
  [/eaux$/u, 'eau'],
  [/aux$/u, 'al'],
  [/([^s])s$/u, '$1'],
];

// Le repli en -e (« unilatérale » -> « unilatéral ») n'est volontairement pas
// appliqué : il transforme « amplitude » en « amplitud » et « presse » en
// « press », ce qui rend les termes appariés illisibles dans l'interface pour
// un gain que la mesure ne montrait pas.

// Alias écrits à la main. La cible est toujours la forme DÉJÀ dépluralisée,
// puisque les alias s'appliquent après les règles ci-dessus : viser
// « quadriceps » quand le corpus s'indexe sous « quadricep » ferait pointer
// l'alias à côté de son propre corpus.
// N'y figure que ce que les règles ci-dessus ne produisent pas déjà :
// « pectoraux », « abdominaux » et « dorsaux » tombent seuls sur leur singulier
// par la règle en -aux, et « deltoïdes » par celle en -s. Les inscrire ici
// serait du code mort, et une table écrite à la main pourrit par ses entrées
// mortes avant de pourrir par ses entrées fausses.
const ALIASES: Readonly<Record<string, string>> = {
  // Argot de salle vers anatomie du corpus.
  pec: 'pectoral',
  abdo: 'abdominal',
  quad: 'quadricep',
  quadri: 'quadricep',
  delt: 'deltoide',
  lat: 'dorsal',
  trap: 'trapeze',
  muscu: 'musculation',
  rep: 'repetition',
  // Noms d'exercices anglais absents du corpus francophone.
  deadlift: 'souleve',
  // La famille tendineuse est déclinée en quatre formes que le corpus mélange,
  // alors qu'une question dit simplement « mon tendon tire ».
  tendineux: 'tendon',
  tendineuse: 'tendon',
  tendinopathie: 'tendon',
  tendinite: 'tendon',
  // Le corpus dit « sensation subjective » et « sensation perçue » ; personne
  // n'écrit ça dans une barre de recherche. « sens » passe d'abord par la règle
  // du pluriel, d'où la clé « sen ».
  sen: 'sensation',
  sent: 'sensation',
  sentir: 'sensation',
  ressenti: 'sensation',
  // Vocabulaire de programmation. Le document F1 écrit « excentrique » et
  // « concentrique » là où on demande « la descente » et « la montée » — sans ce
  // repli, « combien de secondes sur la descente » ne trouvait pas la section
  // Tempo, alors qu'elle répond exactement à la question.
  descente: 'excentrique',
  descendre: 'excentrique',
  negative: 'excentrique',
  monte: 'concentrique',
  montee: 'concentrique',
  decharge: 'deload',
  seche: 'deload',
};

/**
 * Replie un terme déjà minusculisé et désaccentué sur la forme sous laquelle le
 * corpus l'indexe. Idempotent : normaliser deux fois donne le même résultat.
 */
export function normalizeGymTerm(word: string): string {
  let normalized = word;
  if (normalized.length > 3) {
    for (const [pattern, replacement] of PLURAL_RULES) {
      if (!pattern.test(normalized)) continue;
      const stemmed = normalized.replace(pattern, replacement);
      if (stemmed.length >= 3) normalized = stemmed;
      break;
    }
  }
  return ALIASES[normalized] ?? normalized;
}
