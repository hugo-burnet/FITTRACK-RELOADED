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
    decrease: 'Diminuer',
    increase: 'Augmenter',
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
    workout: 'séance',
    routines: 'routines',
    exercises: 'exercices',
    sets: 'séries',
    set: 'série',
    streakDays: 'jours d’affilée',
    kg: 'kg',
    seconds: 's',
    minutes: 'min',
    meters: 'm',
    kilometers: 'km',
    reps: 'reps',
    hours: 'h',
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
    adductors: 'Adducteurs',
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
    /**
     * RF-20 — le type de série se change **en séance**, au menu du rang.
     *
     * Une routine ne peut prescrire que « normale » et « échauffement » : qu'une
     * série devienne dégressive ou parte à l'échec se décide la barre en main.
     * L'entrée du menu porte le type courant en sous-titre, sinon il faudrait
     * ouvrir la feuille pour savoir ce qu'on est en train de changer.
     */
    setTypeAction: 'Type de série',
    /**
     * RF-30 — volontairement dans la feuille de série, jamais dans la grille.
     * L’entrée reste visible pour que le RPE soit découvrable ; seule l’échelle
     * se déplie, à la demande.
     */
    rpeLabel: 'Effort perçu (RPE)',
    rpeEmpty: 'Non renseigné',
    rpeValue: '{value} / 10',
    rpeOption: 'RPE {value} sur 10',
    rpeClear: 'Effacer le RPE',
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
    collapseAll: 'Tout replier',
    expandAll: 'Tout déplier',
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
    /**
     * RF-23 — la félicitation, sur la ligne qui a battu le record et pas dans un
     * toast en pied d'écran : un bandeau ne peut pas dire *laquelle* des vingt
     * lignes a battu quoi. Le nom du record vient de `record.*`, le même que la
     * fiche exercice. La série battue n'est pas répétée ici : la colonne
     * « précédent » de cette ligne l'affiche déjà, deux centimètres au-dessus.
     */
    recordBeaten: 'Record · {record}',
    /** La marque de l'exo replié : il y a un record dedans, ouvre pour voir lequel. */
    recordFolded: 'Record',
    /** Menu ⋯ de la séance. */
    workoutMenu: 'Options de la séance',
    deloadAction: 'Activer le deload à 80 %',
    deloadActive: 'Deload actif à 80 %',
    deloadMark: '80%',
    deloadTitle: 'Deload à 80 %',
    deloadBody: 'Les séries restantes passeront à 80 %, arrondies à 2,5 kg.',
    deloadConfirm: 'Appliquer',
    deloadNote: 'Deload — charges réduites à 80 %.',
    deloadError: 'Le deload n’a pas pu être appliqué. Réessaie.',
    rename: 'Renommer la séance',
    nameLabel: 'Nom de la séance',
    workoutNotesLabel: 'Notes de la séance',
    empty: 'Aucun exercice',
    emptyBody: 'Ajoute ton premier exercice — tu peux aussi en ajouter en cours de route.',
    /** RF-29 — a configurable ramp inserted before the working sets. */
    warmupAction: 'Calculer l’échauffement',
    warmupTitle: 'Échauffement',
    warmupTarget: 'Charge de travail',
    warmupStepPercentage: 'Pourcentage',
    warmupStepReps: 'Répétitions',
    warmupStepWeight: 'Charge proposée',
    warmupStepPercentageShort: '%',
    warmupStepRepsShort: 'reps',
    warmupStepWeightShort: 'kg',
    warmupRemoveStep: 'Supprimer cette étape',
    warmupAddStep: 'Ajouter une étape',
    warmupInsert: 'Insérer les séries',
    warmupInvalidTarget: 'Renseigne une charge de travail positive.',
    warmupInvalidSteps:
      'Chaque étape demande un pourcentage entre 0 et 100 et des répétitions entières.',
    warmupNoSuggestion: 'Aucune charge d’approche inférieure n’est disponible avec ce pas.',
    warmupInsertError: 'Les séries n’ont pas été insérées. Réessaie.',
    warmupPreviewEmpty: '—',
    /**
     * Le calculateur de plaques (RF-28), accroché au menu ⋯ d'une série. N'apparaît
     * que sur une vraie charge de barre (barbell, Smith, machine à plaques) : sur
     * une machine à broche ou un haltère fixe, il n'y a rien à charger.
     */
    plates: 'Plaques à charger',
    platesTitle: 'Plaques à charger',
    /** Le repère sous le schéma : le compte vaut pour un seul côté, l'autre est identique. */
    platesPerSide: 'De chaque côté',
    /** La charge totale visée, en gros, au-dessus du schéma. */
    platesTotalReading: '{weight} kg',
    /** Le seul réglage local du calculateur : la barre utilisée aujourd’hui. */
    platesBarWeight: 'Poids de la barre',
    /** Le matériel global de la salle, configuré là où il sert. */
    platesAvailable: 'Plaques disponibles',
    platesAvailableCount: '{selected} sur {total}',
    platesAvailableOption: '{weight} kg',
    platesAvailableEmpty: 'Aucune plaque sélectionnée.',
    platesAvailableSaveError: 'Impossible d’enregistrer les plaques disponibles.',
    /** Une machine à plaques n’a pas de barre réglable dans ce lot. */
    platesMachineBase: 'Charge à vide {weight} kg',
    /** Un côté sans aucune plaque : la charge visée est celle de la barre seule. */
    platesEmpty: 'Barre nue, aucune plaque à ajouter.',
    /** La liste des plaques d'un côté, séparées par des points médians. */
    platesReadingPlate: '{count} × {weight}',
    /** Une charge que le rack ne peut pas composer exactement. */
    platesRemainder: 'Il manque {weight} kg pour la charge exacte.',
    /** Une charge plus légère que la barre seule : il n'y a rien à charger. */
    platesBelowBar: 'Plus léger que la barre seule ({weight} kg).',
    /** Lecture du schéma pour un lecteur d'écran ; le dessin lui est masqué. */
    platesAria: 'De chaque côté : {plates}',
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

  /**
   * Un côté n'est nommé que lorsqu'il y en a un : `both` n'a pas de mot, parce
   * qu'écrire « Les deux » sur chaque série d'un développé couché serait du
   * bruit sur la seule information qui n'en est pas une.
   */
  side: {
    left: 'Gauche',
    right: 'Droite',
  },

  /**
   * Les trois records d'un exercice, nommés **une fois** pour toute l'app : la
   * fiche exercice les liste, la séance en direct les fête (RF-23), et un même
   * fait ne peut pas avoir deux noms. Clés = `RecordKind` de `lib/records`, donc
   * un quatrième record sans nom français ne passe pas le typecheck.
   */
  record: {
    heaviest: 'Charge max',
    mostReps: 'Reps max',
    bestVolume: 'Meilleure série',
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
    /**
     * Le mot gravé sous la ligne, découvert par le balayage — même geste et même
     * seuil que la séance en direct (cf. `workout.swipeDelete`) : une série d'une
     * routine se supprime d'un glissé vers la droite, sans passer par la feuille.
     */
    swipeDelete: 'Supprimer',

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
    regularity: 'Régularité',
    streak: 'Semaines',
    streakOne: 'Semaine',
    weeklyGoal: 'Objectif hebdo',
    defineGoal: 'Définir',
    goalPrompt: 'Choisis ton rythme pour suivre ta régularité.',
    goalSheetTitle: 'Séances par semaine',
    goalInput: 'Nombre de séances par semaine',
    goalSave: 'Enregistrer',
    viewSelector: 'Vue de l’historique',
    journal: 'Journal',
    calendar: 'Calendrier',
    exerciseFilter: 'Exercice',
    exerciseFilterTitle: 'Filtrer par exercice',
    allExercises: 'Tous les exercices',
    previousMonth: 'Mois précédent',
    nextMonth: 'Mois suivant',
    calendarGrid: 'Calendrier de {month}',
    workoutDay: '{date}, entraînement',
    weekdayMonday: 'L',
    weekdayTuesday: 'M',
    weekdayWednesday: 'M',
    weekdayThursday: 'J',
    weekdayFriday: 'V',
    weekdaySaturday: 'S',
    weekdaySunday: 'D',
    emptyDay: 'Aucune séance terminée ce jour-là.',
    exerciseCount: '{count} exercices',
    exerciseCountOne: '1 exercice',
    setCount: '{count} séries',
    setCountOne: '1 série',
    showMore: 'Afficher plus',
    emptyBody: 'Chaque séance terminée s’ajoute ici, et y reste. Aucune limite de durée.',
    filteredEmptyBody: 'Aucune séance terminée ne contient « {exercise} ».',
    showAllExercises: 'Voir tous les exercices',
    detailActions: 'Actions de la séance',
    detailDate: 'Date',
    detailStart: 'Début',
    detailDuration: 'Durée',
    detailNotes: 'Notes',
    detailTotals: 'Totaux',
    detailExercises: 'Exercices',
    detailSets: 'Séries de travail',
    detailReps: 'Répétitions',
    detailTonnage: 'Tonnage',
    detailTime: 'Temps',
    detailDistance: 'Distance',
    detailSet: 'Série {number}',
    detailRpe: 'RPE {value}',
    deletedExercise: 'Exercice supprimé',
    edit: 'Modifier',
    delete: 'Supprimer',
    deleteTitle: 'Supprimer cette séance ?',
    deleteBody: '« {name} » du {date} disparaîtra de ton historique et de tes records.',
    deleteConfirm: 'Supprimer',
    deleteError: 'La séance n’a pas pu être supprimée. Réessaie.',
    deletedNotice: 'La séance a été supprimée.',
    missingNotice: 'Cette séance n’existe plus.',
    editTitle: 'Modifier la séance',
    editName: 'Nom',
    editNotes: 'Notes',
    editDate: 'Date',
    editStart: 'Heure de début',
    editDuration: 'Durée de la séance',
    editDurationUnit: 'min',
    editExercises: 'Exercices',
    editAddExercise: 'Ajouter un exercice',
    editAddSet: 'Ajouter une série',
    editRemoveExercise: 'Retirer l’exercice',
    editRemoveSet: 'Supprimer la série',
    editExerciseNotes: 'Notes de l’exercice',
    editSetType: 'Type de série',
    editWeight: 'Charge',
    editReps: 'Répétitions',
    editDistance: 'Distance',
    editSetDuration: 'Durée',
    editRpe: 'RPE',
    editSave: 'Enregistrer',
    editSaveError: 'Les modifications n’ont pas pu être enregistrées. Réessaie.',
    editInvalidDate: 'Choisis une date et une heure valides.',
    editInvalidName: 'Donne un nom à la séance.',
    editDiscardTitle: 'Abandonner les modifications ?',
    editDiscardBody: 'Les changements non enregistrés seront perdus.',
    editDiscardConfirm: 'Abandonner',
    editExercisePicker: 'Choisir un exercice',
    editExerciseSearch: 'Chercher un exercice',
    editExerciseSearchPlaceholder: 'Développé, squat, tirage…',
    editNoExercise: 'Aucun exercice ne correspond.',
    editDragExercise: 'Déplacer {name}',
    editDragSet: 'Déplacer la série {number}',
    importAction: 'Importer depuis Hevy',
    importTitle: 'Importer Hevy',
    importChooseTitle: 'Choisir l’export',
    importChooseBody:
      'Sélectionne workout_data.csv. Le fichier reste sur cet appareil.',
    importChooseFile: 'Choisir le CSV',
    importWrongFile: 'Choisis le fichier workout_data.csv.',
    importReadError: 'Le fichier n’a pas pu être lu.',
    importErrorsTitle: 'Import impossible',
    importErrorLine: 'Ligne {line}',
    importErrorEmptyFile: 'Le fichier est vide.',
    importErrorMalformedCsv: 'La structure CSV est invalide.',
    importErrorMissingHeader: 'La colonne {field} manque.',
    importErrorUnexpectedHeader: 'La colonne {field} n’appartient pas à cet export.',
    importErrorRequiredValue: 'La colonne {field} est vide.',
    importErrorInvalidDate: 'La date de {field} est invalide.',
    importErrorInvalidNumber: 'La valeur « {value} » de {field} est invalide.',
    importErrorInvalidSetType: 'Le type de série « {value} » est inconnu.',
    importErrorInvalidMeasurement: 'Les mesures de « {value} » sont incompatibles.',
    importErrorWorkoutRange: 'La fin de séance doit suivre son début.',
    importErrorDuplicateSet: 'Deux séries portent le même rang {value}.',
    importDetectedTitle: 'Export détecté',
    importWorkoutCount: '{count} séances',
    importExerciseCount: '{count} exercices',
    importSetCount: '{count} séries',
    importMappingTitle: 'Associer les exercices',
    importMappingBody:
      'Vérifie les détections sûres, et choisis toi-même le reste.',
    /**
     * Plus « Proposition » : l'app ne propose plus rien quand elle n'est pas
     * sûre. Un nom affiché dans cette colonne se lit comme une décision déjà
     * prise, et c'est ainsi que quatre séries d'épaules ont fini en abdominaux.
     */
    importSuggested: 'À choisir',
    importSaved: 'Association mémorisée',
    importCanonical: 'Détection sûre',
    importSelected: 'Associé',
    importChooseExercise: 'Choisir un exercice FitTrack',
    importCreateCustom: 'Créer « {name} »',
    importUnresolved: '{count} associations restantes',
    importUnresolvedOne: '1 association restante',
    importReviewTitle: 'Vérifier l’import',
    importWillImport: '{count} séances seront importées.',
    importWillImportOne: '1 séance sera importée.',
    importWillSkip: '{count} séances déjà présentes seront ignorées.',
    importWillSkipOne: '1 séance déjà présente sera ignorée.',
    importCustomCount: '{count} exercices personnels seront créés.',
    importCustomCountOne: '1 exercice personnel sera créé.',
    importRoutineFolder:
      'Le dossier « {folder} » sera créé avec : {names}.',
    importContinue: 'Continuer',
    importSubmit: 'Importer',
    importWorking: 'Import en cours…',
    importSuccessTitle: 'Import terminé',
    importSuccessBody: '{imported} séances importées, {skipped} ignorées.',
    importRoutineCount:
      '{count} routines créées dans « {folder} ».',
    importRoutineCountOne: '1 routine créée dans « {folder} ».',
    importBackToHistory: 'Voir l’historique',
    importFailed: 'Aucune donnée n’a été écrite. Réessaie.',
    importedNotice:
      'Les séances Hevy importées sont maintenant dans ton historique.',
    importExerciseSearch: 'Chercher un exercice',
    importNoExercise: 'Aucun exercice ne correspond.',
    importEvidenceOneSetOne: '1 séance · 1 série',
    importEvidenceOne: '1 séance · {setCount} séries',
    importEvidenceSetOne: '{sessionCount} séances · 1 série',
    importEvidence: '{sessionCount} séances · {setCount} séries',
    importEvidenceSet: '{weight} kg × {reps}',
    importEvidenceValueSeparator: ' · ',
    importEvidenceExamples: 'Exemples dans le fichier',
    importNeedsConfirmation: 'À confirmer',
    importConfirmed: 'Confirmé',
    importConflict: 'Association à vérifier',
    importConflictMissing: 'L’exercice associé est introuvable',
    importConflictDeleted: 'L’exercice associé a été supprimé',
    importConflictMeasurement: 'Le type de mesure a changé',
    importConflictMultipleTargets:
      'Plusieurs exercices sont associés à cette source',
    importNewConfirmationOne: '{count} nouvelle association',
    importNewConfirmation: '{count} nouvelles associations',
    importReusedConfirmationOne: '{count} association confirmée réutilisée',
    importReusedConfirmation: '{count} associations confirmées réutilisées',

    /** Sortir une séance de l'app : la feuille système, ou le presse-papiers. */
    share: 'Partager',
    shareCopy: 'Copier le texte',
    /**
     * Le presse-papiers ne se voit pas. Un partage annulé, si : il n'a donc rien
     * à annoncer, et seule la copie a besoin d'être confirmée.
     */
    shareCopied: 'Séance copiée dans le presse-papiers.',
    shareFailed: 'La séance n’a pas pu être partagée ni copiée.',
    shareTitle: 'FitTrack — {name}',
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
    exportHistoryLink: 'Exporter tout l’historique',
    exportHistoryHint: 'Partage toutes tes séances dans un document texte lisible.',
    exportHistoryTitle: 'FitTrack — historique complet',
    exportHistoryCopied: 'Historique copié dans le presse-papiers.',
    exportHistoryFailed: 'L’historique n’a pas pu être partagé ni copié.',
    debugLink: 'Diagnostic',
    debugHint: 'Contenu de la base, stockage utilisé, réinitialisation.',

    /**
     * La réparation de l'instantané. Elle **repeint le passé**, ce que le jalon
     * 08A existe pour empêcher — donc jamais automatique, jamais silencieuse,
     * et la phrase de confirmation dit le prix plutôt que « es-tu sûr ? ».
     */
    repairLink: 'Réparer les muscles de l’historique',
    repairHint:
      'À utiliser après avoir corrigé un exercice mal classé : les séances passées gardent sinon l’ancien muscle.',
    repairConfirmTitle: 'Réparer l’historique',
    repairConfirmBody:
      'Chaque séance passée reprendra le nom, le muscle, le matériel et le type de mesure que ses exercices ont AUJOURD’HUI dans la bibliothèque. Un exercice renommé depuis prendra donc son nouveau nom. Rien n’est supprimé, et les charges et répétitions ne bougent pas.',
    repairConfirmAction: 'Réparer',
    repairDone: '{repaired} exercices de séance corrigés.',
    repairDoneOne: '1 exercice de séance corrigé.',
    repairDoneNone: 'Rien à corriger : l’historique est déjà d’accord avec la bibliothèque.',
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

  /**
   * Le document Markdown envoyé à un coach ou collé dans une IA. C'est le seul
   * endroit du dictionnaire dont le lecteur n'est pas devant l'écran : les
   * phrases y sont complètes, parce que personne ne pourra demander « ça veut
   * dire quoi, ce chiffre ».
   */
  export: {
    title: 'Export FitTrack',
    scopeWorkout: 'Périmètre : la séance « {name} » du {date}',
    scopeExercise: 'Périmètre : {name}, tout l’historique de cet exercice',
    scopeExerciseAnonymous: 'Périmètre : un exercice, tout son historique',
    scopePeriod: 'Période : {from} → {to}',
    scopeAll: 'Périmètre : tout l’historique',
    exportedAt: 'Export du {date}',
    workoutCount: 'Séances : {count}',
    workingSetCount: 'Séries de travail : {count}',
    /** L'unique chiffre agrégé du document dit lui-même ce qu'il ne compte pas. */
    tonnageNote:
      'Le tonnage ne compte que la charge externe réellement soulevée : ni assistance, ni poids du corps, échauffements exclus.',
    workoutHeading: '{name} — {date}',
    duration: 'Durée : {value}',
    tonnage: 'Tonnage : {value}',
    workingSets: '{count} séries de travail',
    /** Ni instantané, ni bibliothèque. On le dit, on ne l'invente pas. */
    unknownExercise: 'Exercice inconnu',
    /** Une case vide se lit comme un bug de génération ; un tiret, comme un trou. */
    missingValue: '—',
    columnSet: 'Série',
    columnType: 'Type',
    columnSide: 'Côté',
    columnReps: 'Reps',
    columnDuration: 'Durée',
    columnDistance: 'Distance',
    columnRpe: 'RPE',
    /**
     * Trois en-têtes pour un même champ, parce que ce sont trois choses
     * différentes : la charge soulevée, la ceinture ajoutée au poids du corps,
     * et l'aide que la machine retire. Les appeler toutes « Charge » est la
     * façon la plus simple de mentir sur ce qui a été fait.
     */
    columnWeightLoad: 'Charge',
    columnWeightAdded: 'Charge ajoutée',
    columnWeightAssist: 'Assistance',
    empty: 'Aucune séance sur ce périmètre.',
  },

  boot: {
    loading: 'préparation de la base',
    seedFailed:
      'Le catalogue d’exercices n’a pas pu être chargé. Tes données sont intactes, le reste de l’app fonctionne.',
    dismiss: 'Masquer',
  },

  /**
   * Les graphiques. Le nom d'une métrique dit **ce qu'elle compte**, jamais
   * « progression » ni « performance » : une courbe qui ne sait pas nommer son
   * chiffre est une courbe qu'on croit sur parole.
   */
  analytics: {
    title: 'Analyses',
    action: 'Analyses',
    /** L'entrée depuis la fiche exercice. */
    exerciseLink: 'Voir la progression',
    pickExercise: 'Choisis un exercice pour voir sa progression.',
    empty: 'Aucun exercice pratiqué pour l’instant. La première séance ouvrira cet écran.',

    /** Les deux sections de l'écran d'accueil des analyses. */
    overviewSection: 'Vue d’ensemble',
    exercisesSection: 'Exercices',

    metricFilter: 'Métrique',
    metricSheetTitle: 'Ce que la courbe compte',
    periodFilter: 'Période',
    periodSheetTitle: 'Période',

    /** Ce que le graphique dit à un lecteur d'écran, en une phrase. */
    chartSummary:
      '{metric} sur {count} séances, du {first} au {last}. Minimum {min}, maximum {max}, dernière valeur {current}.',
    chartSummaryOne: '{metric} sur une seule séance, le {first} : {current}.',

    /** L'échelle, gravée aux deux bouts — il n'y a pas d'axe dessiné. */
    scaleMin: 'Min',
    scaleMax: 'Max',
    record: 'Record',
    latest: 'Dernière',

    sessionsSection: 'Séances',
    emptyPeriod: 'Aucune séance sur cette période.',
    emptyPeriodAction: 'Voir tout l’historique',
    /** Une courbe demande deux points. Le dire, plutôt que tracer un trait vers rien. */
    singleSession: 'Une seule séance sur cette période : la courbe commencera à la suivante.',
    noMetric:
      'Cet exercice n’a pas de type de mesure connu, donc rien de comparable d’une séance à l’autre.',
  },

  /**
   * Les séances par semaine (G2). Une semaine sans séance **se dit** : c'est
   * l'information que cet écran existe pour donner, pas un trou dans les
   * données.
   */
  weekly: {
    title: 'Séances par semaine',
    /** L'entrée depuis l'écran des analyses. */
    link: 'Séances par semaine',
    subtitle: 'Ton rythme, semaine par semaine',

    weekOf: 'Semaine du {date}',
    /** Le compte d'une semaine, y compris « 0 séance ». */
    sessions: '{count} séances',
    sessionsOne: '1 séance',
    sessionsNone: '0 séance',

    /** Sous la lecture : l'objectif de CETTE semaine-là, et s'il est tenu. */
    goalReached: 'Objectif {goal} · atteint',
    goalMissed: 'Objectif {goal} · il en manquait {missing}',
    goalMissedOne: 'Objectif {goal} · il en manquait une',

    /** Ce que la fenêtre dit vraiment, sous le graphique. */
    average: '{average} séances par semaine en moyenne.',
    tally: '{reached} semaines sur {judged} à l’objectif.',
    tallyOne: '{reached} semaine sur {judged} à l’objectif.',

    /** Le zéro et le plafond, gravés — la base n'est pas arbitraire, elle est zéro. */
    scaleZero: '0',

    /** Aucun objectif jamais défini : on n'en invente pas un pour féliciter. */
    noGoal:
      'Aucun objectif hebdomadaire défini, donc aucune semaine n’est validée. Il se règle sur la carte Régularité de l’Historique.',
    noGoalAction: 'Aller à l’Historique',

    weeksSection: 'Semaines',
    emptyPeriod: 'Aucune séance sur cette période.',
    singleWeek: 'Une seule semaine sur cette période : un rythme demande plusieurs semaines.',

    /** Ce que le graphique dit à un lecteur d'écran, en une phrase. */
    chartSummary:
      'Séances par semaine sur {count} semaines, du {first} au {last}. De {min} à {max} séances, {average} en moyenne.',
    chartSummaryOne: 'Séances de la semaine du {first} : {current}.',
  },

  /**
   * Le volume hebdomadaire (G4). Deux cadrans sur les mêmes semaines : la
   * charge externe réellement soulevée et le temps complet passé en séance.
   * Aucun vert : une grande quantité n'est ni un objectif ni un jugement.
   */
  volume: {
    title: 'Volume d’entraînement',
    link: 'Volume d’entraînement',
    subtitle: 'Tonnage et durée par semaine',
    metricSheetTitle: 'Ce que le graphique mesure',
    metricTonnage: 'Tonnage',
    metricDuration: 'Durée',
    weekOf: 'Semaine du {date}',
    total: 'Total · {value}',
    average: 'Moyenne par semaine · {value}',
    weeksSection: 'Semaines',
    scaleZero: '0',
    emptyPeriod: 'Aucune séance sur cette période.',
    zeroTonnage:
      'Ces séances ne contiennent aucune charge externe comptée dans le tonnage.',
    singleWeek:
      'Une seule semaine sur cette période : une tendance demande plusieurs semaines.',
    tonnageHint:
      'Charges externes soulevées. Assistance, lest, poids du corps et échauffements exclus.',
    durationHint: 'Somme des durées complètes des séances.',
    chartSummary:
      '{metric} sur {count} semaines, du {first} au {last}. Minimum {min}, maximum {max}, moyenne {average}.',
    chartSummaryOne: '{metric} de la semaine du {first} : {current}.',
  },

  /**
   * Les séries par muscle (G3). Un muscle à **0 série** reste à l'écran : sur
   * une période, l'app a la couverture complète de ce qui a été fait, donc un
   * zéro est un fait observé — et c'est le seul fait que cet écran existe pour
   * donner. Un muscle négligé qui disparaît est un muscle qu'on ne remarque pas.
   */
  muscles: {
    title: 'Séries par muscle',
    /** L'entrée depuis l'écran des analyses. */
    link: 'Séries par muscle',
    subtitle: 'Ce que tu travailles, et ce que tu négliges',

    /** La lecture d'en-tête : le total, il ne dépend d'aucun geste. */
    totalLabel: 'Séries de travail',
    sets: '{count} séries',
    setsOne: '1 série',
    setsNone: '0 série',
    /** Ce qui rend deux périodes comparables entre elles. */
    weeklyRate: '{rate} par semaine',

    /**
     * Ce qui est **mesuré**, et non comment lire le dessin — la même nature que
     * `metricHint` sous une courbe. Le muscle principal seul est une
     * approximation : elle s'écrit, elle ne se cache pas.
     */
    footnote:
      'Comptées sur le muscle principal de chaque exercice. Échauffements exclus.',

    /** Les groupes sans région anatomique, quand ils portent quelque chose. */
    unscopedSection: 'Hors répartition',
    /** Ni instantané, ni exercice : un trou de l'app, pas un choix de l'utilisateur. */
    unknownMuscle: 'Muscle inconnu',

    emptyPeriod: 'Aucune série de travail sur cette période.',
    /** Des séries, mais aucune sur une région : quinze zéros seraient un mensonge. */
    noRegion:
      'Aucune série sur un muscle identifié dans cette période. Ce qui a été fait est listé ci-dessous.',
  },

  /** Le nom de chaque métrique. Il porte l'unité quand elle ne va pas de soi. */
  metric: {
    topWeight: 'Charge max',
    bestSetVolume: 'Meilleure série',
    sessionTonnage: 'Tonnage de la séance',
    topReps: 'Répétitions max',
    totalReps: 'Répétitions totales',
    workingSets: 'Séries de travail',
    lowestAssist: 'Assistance minimale',
    topDuration: 'Durée max',
    totalDuration: 'Durée totale',
    topDistance: 'Distance max',
    totalDistance: 'Distance totale',
  },

  /** Ce que chaque métrique compte vraiment, sous la courbe. Une phrase. */
  metricHint: {
    topWeight: 'La série de travail la plus lourde de la séance.',
    bestSetVolume: 'La meilleure série de la séance, charge × répétitions.',
    sessionTonnage:
      'Charge × répétitions, additionné sur la séance. Ne compte ni l’assistance ni le poids du corps.',
    topReps: 'La série de travail la plus longue en répétitions.',
    totalReps: 'Toutes les répétitions de travail de la séance.',
    workingSets: 'Les séries de la séance, échauffement exclu.',
    lowestAssist: 'L’assistance la plus faible de la séance. Moins, c’est mieux.',
    topDuration: 'La série de travail la plus longue.',
    totalDuration: 'Le temps de travail cumulé de la séance.',
    topDistance: 'La série de travail la plus longue en distance.',
    totalDistance: 'La distance cumulée de la séance.',
  },

  period: {
    '4w': '4 semaines',
    '12w': '12 semaines',
    '26w': '26 semaines',
    '52w': '52 semaines',
    all: 'Tout',
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
