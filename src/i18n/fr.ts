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
    /** Screen-reader names for the two controls that are drawn, never written. */
    back: 'Retour',
    close: 'Fermer',
    /** Le chemin du retour, après une suppression qui n'a rien demandé. */
    undo: 'Annuler',
    /**
     * Le même mot pour un lecteur d'écran, avec ce qu'il rétablit — le bandeau
     * dit sa place à l'œil, pas à l'oreille.
     */
    undoDelete: 'Annuler la suppression de {reading}',
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
    minutes: 'min',
    meters: 'm',
    kilometers: 'km',
    reps: 'reps',
  },

  /** The rest picker, shared by the exercise sheet and the routine sheet. */
  rest: {
    /** The −/+ are drawn as glyphs; these name them for the ear. */
    decrease: 'Diminuer le repos',
    increase: 'Augmenter le repos',
    /** The empty reading, and the clear chip, when there is nothing to inherit. */
    none: 'Aucun',
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
    startEmpty: 'Démarrer une séance vide',
    resumeTitle: 'Séance en cours',
    resume: 'Reprendre',
  },

  /**
   * L'écran de séance en direct. Le vocabulaire y est le plus court possible :
   * c'est le seul écran lu essoufflé, entre deux séries.
   */
  workout: {
    emptyName: 'Séance libre',
    /**
     * Le minuteur de repos n'a **aucune commande** : le filet dit où on en est,
     * et ce relevé dit combien dure la pause. Le format est celui du Lot 4
     * (`1:30 min · 20 kg`) — un seul format de durée dans l'app.
     */
    restLabel: 'Repos {duration}',
    /** Interrogeable à la demande par un lecteur d'écran, jamais annoncé à la seconde. */
    restRemaining: 'Repos, {time} restantes',
    /** Nom lisible par un lecteur d'écran ; à l'écran c'est une coche dessinée. */
    complete: 'Valider la série {number}',
    uncomplete: 'Annuler la série {number}',
    previous: 'Précédent',
    noPrevious: '—',
    addSet: 'Ajouter une série',
    addExercise: 'Ajouter un exercice',
    finish: 'Terminer la séance',
    setNumber: 'Série {number}',
    /**
     * La consigne au-dessus du champ, pour un lecteur d'écran. À l'écran c'est
     * la fourchette seule — « 8 – 12 » sous « REPS » n'a pas besoin du mot.
     */
    target: 'objectif {value}',
    warmupShort: 'Éch.',
    exerciseMenu: 'Options de {name}',
    /**
     * Le relevé au-dessus de la liste : où j'en suis, en un coup d'œil.
     *
     * À zéro c'est « 0 série sur 7 », pas « aucune » : règle du Lot 1, un état
     * vide est un relevé à zéro et pas un échec — et c'est l'état qu'on lit en
     * premier à chaque séance.
     */
    progress: '{done} séries sur {total}',
    progressOne: '1 série sur {total}',
    progressNone: '0 série sur {total}',
    deletedExercise: 'Exercice supprimé',
    notFound: 'Cette séance n’existe plus',
    /** Menu ⋯ d'un exercice de la séance. */
    addSetAction: 'Ajouter une série',
    removeExercise: 'Retirer de la séance',
    removeExerciseConfirm:
      'Ses séries seront perdues, y compris celles déjà validées. Les autres exercices ne bougent pas.',
    deleteSet: 'Supprimer la série',
    /**
     * Le mot gravé sous la ligne, découvert par le balayage — et le seuil
     * lui-même : la suppression part quand le mot est entièrement lisible.
     * Un seul mot, donc : « Supprimer la série » demanderait un geste deux fois
     * plus long que le pouce ne peut en faire d'une main.
     */
    swipeDelete: 'Supprimer',
    /** Ce que le bandeau d'annulation barre quand la série était vide. */
    emptySetReading: 'Série {number}',
    notesLabel: 'Notes de l’exercice',
    notesPlaceholder: 'Réglage, sensation, douleur…',
    /** Menu ⋯ de la séance. */
    workoutMenu: 'Options de la séance',
    rename: 'Renommer la séance',
    nameLabel: 'Nom de la séance',
    workoutNotesLabel: 'Notes de la séance',
    empty: 'Aucun exercice',
    emptyBody: 'Ajoute ton premier exercice — tu peux aussi en ajouter en cours de route.',
  },

  /** L'écran de fin : ce que la séance a produit, avant de l'enregistrer. */
  finish: {
    title: 'Fin de séance',
    duration: 'Durée',
    sets: 'Séries',
    reps: 'Reps',
    tonnage: 'Tonnage',
    time: 'Temps',
    distance: 'Distance',
    save: 'Enregistrer la séance',
    discard: 'Abandonner la séance',
    discardTitle: 'Abandonner cette séance ?',
    discardBody: '{count} séries validées seront perdues. C’est sans retour.',
    discardBodyOne: '1 série validée sera perdue. C’est sans retour.',
    discardBodyNone: 'Aucune série n’a été validée : il n’y a rien à perdre.',
    discardConfirm: 'Abandonner',
    /**
     * Le tonnage ne compte que les kilos qui sont vraiment la charge : un lest
     * ou une assistance ne disent rien du poids réellement déplacé.
     */
    tonnageHint: 'Le tonnage ne compte que les charges soulevées, ni les lests ni les assistances.',
    nothingDone: 'Aucune série validée. Rien ne sera enregistré.',
  },

  /** Set types. Warm-ups are excluded from volume and records (RF-20). */
  setType: {
    normal: 'Normale',
    warmup: 'Échauffement',
    dropset: 'Dégressive',
    failure: 'Jusqu’à l’échec',
  },

  setTypeHint: {
    normal: 'Une série de travail. Elle compte dans le volume et les records.',
    warmup: 'Ne compte ni dans le volume ni dans les records.',
    dropset: 'Enchaînée à la précédente, charge allégée, sans repos.',
    failure: 'Menée jusqu’à ne plus pouvoir enchaîner une répétition.',
  },

  routines: {
    title: 'Routines',
    emptyBody:
      'Une routine, c’est ta séance type : les exercices, les séries et les charges visées.',
    countUnit: 'routines',

    create: 'Nouvelle routine',
    createTitle: 'Créer',
    newBlank: 'Routine vide',
    newBlankHint: 'Tu la composes exercice par exercice.',
    newFromTemplate: 'Partir d’un modèle',
    newFromTemplateHint: 'Push / Pull / Legs, full-body, 5×5. Modifiable ensuite.',
    newFolder: 'Nouveau dossier',
    newFolderHint: 'Pour ranger tes routines par programme.',

    /** A routine always has a name; this is what a blank one starts with. */
    defaultName: 'Ma routine',
    copyName: '{name} (copie)',
    untitled: 'Sans nom',

    rootFolder: 'Sans dossier',
    noFolder: 'Aucun',

    exerciseCount: '{count} exercices',
    exerciseCountOne: '1 exercice',
    setCount: '{count} séries',
    setCountOne: '1 série',
    empty: 'Aucun exercice',

    /** Drag lives on a handle, so the handle has to say what it moves. */
    dragHandle: 'Déplacer {name}',

    actionsTitle: 'Routine',
    start: 'Démarrer',
    /** Une seule séance à la fois : la barre de reprise mène à celle qui tourne. */
    startBusyHint: 'Une séance est déjà en cours. Reprends-la par la barre verte.',
    duplicate: 'Dupliquer',
    duplicateHint: 'Une copie indépendante. Modifier l’une ne touche pas à l’autre.',
    moveTo: 'Déplacer vers un dossier',
    delete: 'Supprimer la routine',
    deleteHint: 'Elle disparaît avec ses exercices et ses séries prévues.',
    deleteConfirm: 'Supprimer',

    folderTitle: 'Dossier',
    folderNameLabel: 'Nom du dossier',
    folderNamePlaceholder: 'Push / Pull / Legs',
    folderCreate: 'Créer le dossier',
    folderRename: 'Renommer le dossier',
    folderSave: 'Enregistrer',
    folderDelete: 'Supprimer le dossier',
    /** Names the consequence, because the consequence is that nothing is lost. */
    folderDeleteHint: 'Le dossier disparaît. Ses {count} routines remontent à la racine.',
    folderDeleteHintOne: 'Le dossier disparaît. Sa routine remonte à la racine.',
    folderDeleteHintEmpty: 'Le dossier est vide.',
    folderDeleteConfirm: 'Supprimer',

    templatesTitle: 'Modèles',
  },

  routine: {
    notFound: 'Cette routine n’existe plus.',

    nameLabel: 'Nom de la routine',
    namePlaceholder: 'Poussée',
    /**
     * Everything the name should not have to carry. A title that wraps to three
     * lines is a paragraph, and a list of paragraphs cannot be scanned.
     */
    subtitleLabel: 'Sous-titre',
    subtitlePlaceholder: 'Lourde — barre et accessoires épaules',
    folderLabel: 'Dossier',
    countUnit: 'séries',

    emptyUnit: 'exercices',
    emptyBody: 'Ajoute tes exercices, puis leurs séries et leurs charges visées.',

    addExercise: 'Ajouter un exercice',
    /** Not "Enregistrer": every keystroke above is already in the database. */
    done: 'Terminé',
    /**
     * Le verbe de cet écran en salle. Il prend la place primaire de la barre.
     *
     * Un seul mot, et **le même que dans le menu ⋯ de la liste** : une action
     * garde son nom d'un bout à l'autre du parcours. « Démarrer la séance »
     * était un second nom pour la même chose — et il passait à la ligne.
     */
    start: 'Démarrer',

    deletedExercise: 'Exercice supprimé',
    deletedExerciseHint: 'Il ne fait plus partie de ta bibliothèque.',

    addSet: 'Ajouter une série',
    /** A set with no target is a valid plan, not a missing value. */
    setFree: 'libre',
    repsUnit: 'reps',
    repsRange: '{min} – {max}',
    /**
     * The only planned set type Lot 4 marks. Dropsets and sets to failure are
     * Lot 6, where the behaviour that gives them meaning arrives; planning one
     * without it would be a label that changes nothing.
     */
    warmupShort: 'ÉCH.',

    exerciseSheetTitle: 'Dans cette routine',
    restLabel: 'Repos entre les séries',
    restHint: 'Vide : le repos par défaut de l’exercice.',
    /** The clear chip: returns the picker to inheriting the exercise's own rest. */
    restInherit: 'Repos de l’exercice',
    /** Says where the displayed rest comes from, so an empty field is not a mystery.
        The value itself sits in the well above; the line only names its source. */
    restFromExercise: 'Vide : le repos de l’exercice s’applique.',
    restNoDefault: 'Aucun repos par défaut sur cet exercice.',
    notesLabel: 'Notes',
    notesPlaceholder: 'Prise large, tempo lent, cale sous les talons…',
    groupWithPrevious: 'Grouper avec le précédent',
    groupHint: 'Un superset : tu alternes entre les deux, sans repos entre eux.',
    ungroup: 'Dissocier le superset',
    ungroupHint: 'Le groupe entier redevient des exercices séparés.',
    remove: 'Retirer de la routine',
    removeHint: 'L’exercice reste dans ta bibliothèque, avec son historique.',
    removeConfirm: 'Retirer',

    setSheetTitle: 'Série {number}',
    setTypeLabel: 'Type de série',
    targetRepsLabel: 'Répétitions visées',
    targetRepsMaxLabel: 'Jusqu’à (facultatif)',
    targetRepsHint: 'Laisse vide pour une série sans objectif chiffré.',
    /** Three labels for one field: the kilos mean something different each time. */
    targetWeightLabel: 'Charge visée',
    targetWeightAddedLabel: 'Lest ajouté',
    targetWeightAssistLabel: 'Assistance',
    targetWeightHint: 'Laisse vide si tu décides la charge sur place.',
    targetWeightAddedHint: 'En plus de ton poids de corps. Vide = au poids du corps.',
    targetWeightAssistHint: 'Ce que la machine te retire. Plus c’est haut, plus c’est facile.',

    targetDurationLabel: 'Durée visée',
    targetDurationHint: 'En secondes. 90 s s’affiche « 1:30 ».',
    targetDistanceLabel: 'Distance visée',
    targetDistanceHint: 'En mètres. 1 000 m s’affiche « 1 km ».',
    applyToAll: 'Appliquer à toutes les séries',
    deleteSet: 'Supprimer la série',

    dragHandle: 'Déplacer {name}',
    moveUp: 'Monter',
    moveDown: 'Descendre',
  },

  picker: {
    title: 'Ajouter des exercices',
    add: 'Ajouter {count} exercices',
    addOne: 'Ajouter 1 exercice',
    /** The picker's way out of a fruitless search: it does not leave the routine. */
    clearSearch: 'Effacer la recherche',
    selected: 'sélectionnés',
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
    /** Not "Enregistrer": there is nothing left to save, only somewhere to go. */
    done: 'Terminé',
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
