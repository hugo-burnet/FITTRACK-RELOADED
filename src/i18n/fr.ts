/**
 * Every string the interface shows lives here — never inside a component.
 * ADR-007: no i18n library at V1, but the strings are already centralised so
 * adding English later is mechanical.
 *
 * Voice: second person singular, factual, no filler. The app is an instrument
 * used out of breath between two sets, not a companion.
 */
const fr = {
  app: {
    name: 'FitTrack',
  },

  common: {
    yes: 'Oui',
    no: 'Non',
  },

  nav: {
    label: 'Navigation principale',
    home: 'Accueil',
    routines: 'Routines',
    history: 'Historique',
    exercises: 'Exercices',
    settings: 'Réglages',
  },

  units: {
    workouts: 'séances',
    routines: 'routines',
    exercises: 'exercices',
    sets: 'séries',
    streakDays: 'jours d’affilée',
    kg: 'kg',
    seconds: 's',
  },

  /**
   * The catalogue's three vocabularies, in the words of a French gym. Keyed by
   * the stored value, so adding a group to MUSCLE_GROUPS without its label
   * fails the typecheck instead of shipping "lower_back" to the screen.
   */
  muscle: {
    chest: 'Pectoraux',
    lats: 'Grand dorsal',
    upper_back: 'Haut du dos',
    traps: 'Trapèzes',
    shoulders: 'Épaules',
    biceps: 'Biceps',
    triceps: 'Triceps',
    forearms: 'Avant-bras',
    quads: 'Quadriceps',
    hamstrings: 'Ischio-jambiers',
    glutes: 'Fessiers',
    calves: 'Mollets',
    abs: 'Abdominaux',
    lower_back: 'Lombaires',
    neck: 'Cou',
    full_body: 'Corps entier',
    cardio: 'Cardio',
    other: 'Autre',
  },

  equipment: {
    barbell: 'Barre',
    dumbbell: 'Haltères',
    machine: 'Machine',
    cable: 'Poulie',
    smith: 'Machine Smith',
    bodyweight: 'Poids du corps',
    band: 'Élastique',
    kettlebell: 'Kettlebell',
    plate: 'Disque',
    other: 'Autre',
  },

  measurement: {
    weight_reps: 'Poids et répétitions',
    reps_only: 'Répétitions seules',
    weight_time: 'Poids et durée',
    time_only: 'Durée seule',
    distance_time: 'Distance et durée',
    assisted_weight_reps: 'Assistance et répétitions',
  },

  /** One example each: the field is unguessable without one. */
  measurementHint: {
    weight_reps: 'Développé couché, squat, curl.',
    reps_only: 'Tractions, pompes, dips au poids du corps.',
    weight_time: 'Gainage lesté, suspension avec charge.',
    time_only: 'Planche, chaise, suspension à la barre.',
    distance_time: 'Rameur, tapis, vélo.',
    assisted_weight_reps: 'Tractions assistées : la charge te soulage.',
  },

  home: {
    title: 'Accueil',
    emptyBody: 'Le compteur démarre à ta première séance terminée.',
  },

  routines: {
    title: 'Routines',
    emptyBody:
      'Une routine, c’est ta séance type : les exercices, les séries et les charges visées.',
  },

  history: {
    title: 'Historique',
    emptyBody: 'Chaque séance terminée s’ajoute ici, et y reste. Aucune limite de durée.',
  },

  exercises: {
    title: 'Exercices',
    emptyBody: 'Le catalogue et tes exercices personnels apparaîtront ici.',

    searchLabel: 'Chercher un exercice',
    searchPlaceholder: 'Développé, squat, tirage…',
    clearSearch: 'Effacer la recherche',

    filterMuscle: 'Muscle',
    filterEquipment: 'Matériel',
    allMuscles: 'Tous les muscles',
    allEquipment: 'Tout le matériel',

    /** The readout: "168 exercices", then "24 sur 168" once anything is filtered. */
    countUnit: 'exercices',
    countOf: 'sur {total}',

    create: 'Nouvel exercice',
    createNamed: 'Créer « {name} »',
    clearFilters: 'Retirer les filtres',

    /**
     * No big `0` here, unlike the other empty screens: this one already carries
     * its own readout, and a second zero would just say it twice.
     */
    noMatchTitle: 'Rien ne correspond',
    noMatchSearch: '« {search} » n’est ni au catalogue ni dans tes exercices.',
    noMatchFiltersTitle: 'Aucun exercice ne passe ces filtres',
    noMatchFilters: 'Élargis un des deux filtres.',
    emptyTitle: 'Catalogue vide',

    custom: 'perso',
    unilateral: 'unilatéral',
  },

  exercise: {
    back: 'Exercices',
    notFound: 'Cet exercice n’existe plus.',

    recordsSection: 'Records',
    recordHeaviest: 'Charge max',
    recordMostReps: 'Reps max',
    recordBestVolume: 'Meilleure série',
    recordWeightReps: '{weight} kg × {reps}',
    recordWeight: '{weight} kg',
    recordReps: '{reps} reps',

    historySection: 'Historique',
    historyEmpty: 'Aucune séance avec cet exercice. La première l’ouvrira.',
    historySetCount: '{count} séries',
    historySetCountOne: '1 série',

    /** Notes and rest belong to you; the catalogue row belongs to the app. */
    yoursSection: 'Tes réglages',
    notesLabel: 'Notes',
    notesPlaceholder: 'Siège position 4, prise serrée, cale sous les talons…',
    notesHint: 'Enregistré au fur et à mesure de la frappe.',
    restLabel: 'Repos entre les séries',
    restHint: 'Servira de durée par défaut au minuteur de repos.',

    catalogueNote:
      'Exercice du catalogue : son nom et son matériel ne se modifient pas. Tes notes et ton repos, si.',
    edit: 'Modifier',
    delete: 'Supprimer l’exercice',
    deleteHint:
      'Il quitte la bibliothèque. Tes séances passées gardent leurs séries et leurs charges.',
    deleteConfirm: 'Supprimer',
    cancel: 'Annuler',
  },

  exerciseForm: {
    createTitle: 'Nouvel exercice',
    editTitle: 'Modifier',
    back: 'Annuler',

    nameLabel: 'Nom',
    namePlaceholder: 'Presse à cuisses inclinée',
    muscleLabel: 'Muscle principal',
    equipmentLabel: 'Matériel',
    measurementLabel: 'Ce que tu saisis',
    unilateralLabel: 'Unilatéral',
    unilateralHint: 'Un côté à la fois : presse unilatérale, curl marteau alterné.',

    submitCreate: 'Créer l’exercice',
    submitSave: 'Enregistrer',
  },

  settings: {
    title: 'Réglages',

    appearanceSection: 'Apparence',
    theme: 'Thème',
    themeDark: 'Sombre',
    themeLight: 'Clair',
    themeHint:
      'Sombre par défaut : une salle est mal éclairée et l’écran reste allumé une heure et demie.',

    inputSection: 'Saisie',
    demoTitle: 'Champ de charge',
    demoHint: 'Le champ utilisé pour chaque série. La virgule passe : essaie 102,5.',
    demoLabel: 'Poids d’essai',
    demoReadingLabel: 'valeur retenue',
    demoEmpty: '—',
    demoNote: 'Démonstration : rien n’est enregistré.',

    dataSection: 'Données',
    debugLink: 'Diagnostic',
    debugHint: 'Contenu de la base, stockage utilisé, réinitialisation.',
  },

  debug: {
    title: 'Diagnostic',
    back: 'Réglages',

    storageSection: 'Stockage',
    storageUsed: 'utilisé',
    storageQuota: 'sur {quota} Mo disponibles',
    storageUnit: 'Mo',
    storageUnavailable: 'Le navigateur ne donne pas d’estimation de stockage.',

    tablesSection: 'Tables',
    rows: 'lignes',

    recentSection: 'Derniers exercices modifiés',
    recentEmpty: 'Aucun exercice en base. Relance le seed.',

    actionsSection: 'Actions',
    reseed: 'Relancer le seed',
    reseedHint: 'Insère les exercices du catalogue absents de la base. N’écrase rien.',
    reseedDone: 'Seed terminé.',
    reset: 'Réinitialiser la base',
    resetHint:
      'Efface tes séances, tes routines et tes exercices personnalisés — définitivement. Le catalogue, lui, se réinstalle seul au prochain démarrage.',
    resetDone:
      'Base vidée. Le catalogue revient au prochain chargement ; tes séances et exercices personnalisés sont perdus.',
    confirm: 'Confirmer',
    cancel: 'Annuler',
    working: 'En cours…',
    failed: 'L’opération a échoué. Détail dans la console.',
  },

  boot: {
    loading: 'préparation de la base',
    seedFailed:
      'Le catalogue d’exercices n’a pas pu être chargé. Tes données sont intactes, le reste de l’app fonctionne.',
    dismiss: 'Masquer',
  },

  error: {
    title: 'Cet écran n’a pas pu s’afficher',
    body: 'Tes données sont intactes : elles vivent sur l’appareil, pas dans l’écran.',
    reload: 'Recharger',
  },
} satisfies Dictionary;

type Dictionary = { [key: string]: string | Dictionary };

/** Every dotted path that ends on a string, e.g. `'settings.themeDark'`. */
type LeafPath<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPath<T[K]>}`;
}[keyof T & string];

export type TranslationKey = LeafPath<typeof fr>;

/**
 * `t('settings.theme')`. Placeholders are written `{name}`:
 * `t('workout.setCount', { count: 3 })`.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const found = key
    .split('.')
    .reduce<string | Dictionary | undefined>(
      (node, part) => (typeof node === 'object' ? node[part] : undefined),
      fr,
    );

  // A missing key shows itself rather than an empty space: a blank button is
  // invisible in review, `settings.theme` is not.
  if (typeof found !== 'string') return key;
  if (!params) return found;

  return found.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
}
