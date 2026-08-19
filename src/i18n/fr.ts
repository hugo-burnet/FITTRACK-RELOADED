/** Centralized French UI copy. */
const fr = {
  app: {
    name: 'FitTrack',
  },

  update: {
    available: 'Une nouvelle version est disponible.',
    reload: 'Recharger',
    later: 'Plus tard',
  },

  common: {
    yes: 'Oui',
    no: 'Non',
    back: 'Retour',
    close: 'Fermer',
    decrease: 'Diminuer',
    increase: 'Augmenter',
    undo: 'Annuler',
    undoDelete: 'Annuler la suppression de {reading}',
    unlockExerciseOrder: 'Déverrouiller l’ordre des exercices',
    lockExerciseOrder: 'Verrouiller l’ordre des exercices',
  },

  nav: {
    label: 'Navigation principale',
    home: 'Accueil',
    routines: 'Routines',
    history: 'Historique',
    progress: 'Progression',
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
    percent: '%',
    seconds: 's',
    minutes: 'min',
    meters: 'm',
    kilometers: 'km',
    reps: 'reps',
    hours: 'h',
  },

  rest: {
    decrease: 'Diminuer le repos',
    increase: 'Augmenter le repos',
    none: 'Aucun',
  },

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
    /** Le même nom que la séance elle-même porte (`workout.emptyName`). */
    startEmpty: 'Démarrer une séance libre',
    resumeTitle: 'Séance en cours',
    resume: 'Reprendre',

    /**
     * L'îlot de chiffres : deux tuiles, deux mots, pas de phrase.
     *
     * La série hebdomadaire n'y est plus. « 3 semaines d'affilée » ne se lit
     * qu'une fois — après, c'est un compteur qu'on ne consulte pas et qu'on perd
     * en se blessant. L'écran Rythme la garde, à un tap d'ici.
     */
    islandWeek: 'cette semaine',
    islandWeight: 'poids du jour',
    weekLink: 'Voir les séances par semaine',
    weightLink: 'Renseigner le poids du jour',

    /** La carte principale : quelle routine lancer aujourd'hui. */
    suggestionSection: 'À lancer',
    /** La règle, écrite : une suggestion qu'on ne peut pas expliquer s'ignore. */
    suggestionRule: 'La plus ancienne de tes routines.',
    neverPerformed: 'Jamais réalisée',
    lastToday: 'Réalisée aujourd’hui',
    lastYesterday: 'Réalisée hier',
    lastDays: 'Réalisée il y a {count} jours',
    lastDate: 'Réalisée le {date}',
    startRoutine: 'Démarrer {name}',
    noRoutines: 'Aucune routine pour l’instant. Une routine, c’est la séance écrite à l’avance.',
    createRoutine: 'Créer une routine',
    programSection: 'Bloc en cours',
    programWeek: 'Semaine {current} sur {total}',
    programStarts: 'Le bloc commence le {date}. Aucune séance ne démarre avant.',
    programNextWeek: 'La semaine {week} commence le {date}.',
    programWeekComplete: 'Toutes les séances prévues cette semaine sont terminées.',
    programTodayRule: 'Prévue aujourd’hui dans ton bloc.',
    programMissedRule: 'Prévue le {date} et encore à faire.',
    programUpcomingRule: 'Prochaine séance du bloc, prévue le {date}.',
    programStartError: 'La séance n’a pas pu démarrer. Vérifie le bloc puis réessaie.',
    /** La lecture a échoué — pas la base : rien n'est perdu, seulement illisible. */
    readError: 'Ces données n’ont pas pu être lues. Tes séances sont intactes sur l’appareil.',

    recentSection: 'Dernières séances',
    recentEmpty: 'Aucune séance terminée pour l’instant.',
    seeAll: 'Tout voir',

    /**
     * Les trois raccourcis. Les mots courts sont pour l'œil, sur trois colonnes
     * de 375 px ; le nom complet de chaque analyse est donné à l'oreille.
     */
    bodyLabel: 'Les muscles travaillés sur les douze dernières semaines',
    progressPace: 'Rythme',
    progressVolume: 'Volume',
    progressMuscles: 'Muscles',
    bodyWeightSection: 'Poids du jour',
    bodyWeightLabel: 'Poids du corps',
    bodyWeightSave: 'Enregistrer',
    bodyWeightPlaceholder: '80',
    bodyWeightSaving: 'Enregistrement…',
    bodyWeightHint: 'Renseigne ton poids pour compter les exercices au poids du corps.',
    bodyWeightLatest: 'Dernière mesure : {date}',
    bodyWeightError: 'Le poids n’a pas pu être enregistré. Réessaie.',
  },

  workout: {
    emptyName: 'Séance libre',
    restLabel: 'Repos {duration}',
    restRemaining: 'Repos, {time} restantes',
    complete: 'Valider la série {number}',
    uncomplete: 'Annuler la série {number}',
    previous: 'Précédent',
    noPrevious: '—',
    addSet: 'Ajouter une série',
    addExercise: 'Ajouter un exercice',
    finish: 'Terminer la séance',
    setNumber: 'Série {number}',
    target: 'objectif {value}',
    setTypeAction: 'Type de série',
    rpeLabel: 'Effort perçu (RPE)',
    rpeEmpty: 'Non renseigné',
    rpeValue: '{value} / 10',
    rpeProgramTarget: 'Cible du programme · {value} / 10',
    rpeOption: 'RPE {value} sur 10',
    rpeClear: 'Effacer le RPE',
    programContext: 'Programme · Semaine {week}',
    programDeload: 'Décharge planifiée',
    exerciseMenu: 'Options de {name}',
    progress: '{done} séries sur {total}',
    progressOne: '1 série sur {total}',
    progressNone: '0 série sur {total}',
    collapseAll: 'Tout replier',
    expandAll: 'Tout déplier',
    deletedExercise: 'Exercice supprimé',
    notFound: 'Cette séance n’existe plus',
    addSetAction: 'Ajouter une série',
    removeExercise: 'Retirer de la séance',
    removeExerciseConfirm:
      'Ses séries seront perdues, y compris celles déjà validées. Les autres exercices ne bougent pas.',
    deleteSet: 'Supprimer la série',
    swipeDelete: 'Supprimer',
    emptySetReading: 'Série {number}',
    notesLabel: 'Notes de l’exercice',
    notesPlaceholder: 'Réglage, sensation, douleur…',
    recordBeaten: 'Record · {record} · {value} · {gain}',
    recordsBeaten: '{count} records · {records}',
    recordFolded: 'Record',
    workoutMenu: 'Options de la séance',
    elapsedLabel: 'Séance en cours depuis {time}',
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
    plates: 'Plaques à charger',
    platesTitle: 'Plaques à charger',
    platesPerSide: 'De chaque côté',
    platesTotalReading: '{weight} kg',
    platesBarWeight: 'Poids de la barre',
    platesAvailable: 'Plaques disponibles',
    platesAvailableCount: '{selected} sur {total}',
    platesAvailableOption: '{weight} kg',
    platesAvailableEmpty: 'Aucune plaque sélectionnée.',
    platesAvailableSaveError: 'Impossible d’enregistrer les plaques disponibles.',
    platesMachineBase: 'Charge à vide {weight} kg',
    platesEmpty: 'Barre nue, aucune plaque à ajouter.',
    platesReadingPlate: '{count} × {weight}',
    platesRemainder: 'Il manque {weight} kg pour la charge exacte.',
    platesBelowBar: 'Plus léger que la barre seule ({weight} kg).',
    platesAria: 'De chaque côté : {plates}',
  },

  androidNotification: {
    workoutChannel: 'Séance en cours',
    workoutChannelDescription: 'Affiche la séance active dans les notifications.',
    restChannel: 'Minuteur de repos',
    restChannelDescription: 'Sonne quand le temps de repos est terminé.',
    workoutBody: 'Touche pour revenir à la séance.',
    restTitle: 'Repos terminé',
    restBody: 'La prochaine série peut commencer.',
  },

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
    tonnageHint:
      'Charge externe et poids du corps effectif estimé. Assistance soustraite, échauffements exclus.',
    nothingDone: 'Aucune série validée. Rien ne sera enregistré.',
    coachSection: 'Coach',
  },

  coach: {
    title: 'Coach',
    dismiss: 'Ignorer',
    objective: 'Objectif proposé',
    applyAction: 'Appliquer {weight} kg aux séries restantes',
    nextLoad: 'Prochaine charge : {weight} kg',
    range_ceiling_reached:
      '{current} → {weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    range_ceiling_reached_assist:
      'Assistance {current} → {weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    range_ceiling_reached_plain:
      '{weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    /** Ceiling constat with no next load (stripped escalate, overload add_set sibling). */
    range_ceiling_reached_constat:
      '{sets} × {reps} a atteint le haut de la fourchette.',
    /** @deprecated Read alias — same wording as range_ceiling_reached. */
    range_completed:
      '{current} → {weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    range_completed_assist:
      'Assistance {current} → {weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    range_completed_plain:
      '{weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    range_satisfied:
      'Fourchette respectée ({sets} séries ≥ {reps}, sans atteindre le plafond {max}).',
    range_missed:
      '{current} → {weight} kg car le bas de fourchette ({floor}) a été manqué {sessions} séances de suite (descendu à {low}).',
    range_missed_assist:
      'Assistance {current} → {weight} kg car le bas de fourchette ({floor}) a été manqué {sessions} séances de suite (descendu à {low}).',
    // Pas de flèche ici : « → » veut dire « fais ça » sur la carte d'objectif,
    // et une observation ne demande rien.
    intra_session_drop:
      'Baisse de reps observée : {first} puis {low} (−{drop}).',
    plateau:
      'Plateau détecté : {sessions} séances sans progrès du 1RM estimé ({value} kg).',
    long_rest: 'Repos long ({seconds} s) associé à une chute de reps.',
    /** Progression phase chose maintain — no increase_* was authorized. */
    progressionDeferred: 'Maintien — progression différée',
    /**
     * Overload selected add_set — volume constat, not a stripped load arrow.
     */
    addSet: 'Ajouter une série — {sets} × {reps} a atteint le haut de la fourchette.',
    /**
     * Test phase requalifies an already-authorized increase_* .
     * `{reason}` is the normal constat (ceiling step or satisfied range).
     */
    controlledAttempt: 'Tentative contrôlée — {reason}',
    historySection: 'Recommandations',
    statusPending: 'En attente',
    statusFollowed: 'Suivie',
    statusDismissed: 'Ignorée',
    // Deux causes désormais : l'activation d'un bloc et un signal plus récent.
    // « Remplacée par le programme » mentirait sur la seconde. Ce n'est jamais
    // un refus — d'où un mot neutre.
    statusSuperseded: 'Remplacée',
  },

  setType: {
    normal: 'Normale',
    warmup: 'Échauffement',
    dropset: 'Dégressive',
    failure: 'Jusqu’à l’échec',
  },

  side: {
    left: 'Gauche',
    right: 'Droite',
  },

  record: {
    max_weight: 'Charge max',
    max_added_weight: 'Lest max',
    min_assistance: 'Assistance minimale',
    max_reps: 'Répétitions max',
    best_1rm: '1RM estimé',
    max_volume_set: 'Meilleure série',
    max_volume_session: 'Tonnage séance',
    max_duration: 'Durée max',
    max_distance: 'Distance max',
    assistanceValue: '{value} d’assistance',
    sessionTonnageContext: 'Tonnage de la séance',
    repsContext: '{count} reps',
    weightRepsContext: '{weight} × {reps}',
    formulaContext: '{context} · {formula}',
    assistanceContext: '{weight} d’assistance',
    distanceDurationContext: '{distance} · {duration}',
    gain: '+{value}',
    gainLessAssistance: '−{value} d’assistance',
    formulaEpley: 'Epley',
    formulaBrzycki: 'Brzycki',
    formulaLombardi: 'Lombardi',
  },

  records: {
    title: 'Records',
    link: 'Records',
    subtitle: 'Tous tes jalons personnels',
    allExercises: 'Tous les exercices',
    allTypes: 'Tous les records',
    unknownExercise: 'Exercice indisponible',
    exerciseSheetTitle: 'Exercice',
    typeSheetTitle: 'Type de record',
    railLabel: 'Progression des records',
    currentMark: 'Record actuel',
    firstMark: 'Premier jalon',
    openMark: '{exercise}, {category}, {value}, le {date}',
    loading: 'Chargement des records',
    emptyTitle: 'Ton premier record commencera ici',
    emptyBody:
      'Valide une série pendant une séance : chaque nouveau meilleur résultat ajoutera un jalon à ce rail.',
    noResultsTitle: 'Aucun record avec ces filtres',
    noResultsBody: 'Change un filtre ou efface-les pour retrouver tous tes jalons.',
    clearFilters: 'Effacer les filtres',
    assistanceQualifier: 'd’assistance',
    staleTitle: 'Tes records doivent être reconstruits',
    staleBody:
      'Tes séances sont intactes. Reconstruis les records depuis ton historique pour afficher le rail.',
    repair: 'Réparer les records',
    repairing: 'Réparation en cours…',
    retryRepair: 'Réessayer',
    repairFailed: 'La réparation n’a pas abouti. Tes séances sont intactes, tu peux réessayer.',
  },

  setTypeHint: {
    normal: 'Une série de travail. Elle compte dans le volume et les records.',
    warmup: 'Ne compte ni dans le volume ni dans les records.',
    dropset: 'Enchaînée à la précédente, charge allégée, sans repos.',
    failure: 'Menée jusqu’à ne plus pouvoir enchaîner une répétition.',
  },

  routines: {
    title: 'Routines',
    programs: 'Programmes',
    programCurrentWeek: 'Semaine {current} sur {total}',
    programNoneActive: 'Aucun bloc actif',
    programReadError: 'Le bloc actif n’a pas pu être lu.',
    programRetry: 'Réessayer la lecture',
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

  program: {
    listTitle: 'Programmes',
    listCreate: 'Créer un bloc',
    listEmpty: 'Aucun bloc pour l’instant. Commence par poser quatre semaines d’entraînement.',
    listDuration: '{count} semaines · départ le {date}',
    statusDraft: 'Brouillon',
    statusActive: 'Actif',
    statusCompleted: 'Terminé',
    detailTitle: 'Suivi du bloc',
    /**
     * La carte du bloc actif mène à sa fiche — la seule porte vers ses options
     * (modifier, décaler, supprimer). Sans elle, un bloc qui n'a pas encore
     * commencé n'a aucun bouton : la liste le retire de ses lignes puisqu'il est
     * déjà en tête, et il n'était plus atteignable du tout.
     */
    openBlock: 'Ouvrir le bloc {name}',
    progressWeek: 'Semaine {current} / {total}',
    progressBefore: 'Le bloc commence le {date}.',
    progressAfter: 'Les {count} semaines sont terminées.',
    intentionTitle: 'Intention de la semaine',
    /**
     * La section liste les sept jours, pas seulement ceux qui portent une
     * séance : un bloc se lit autant à ses jours de repos qu'à ses séances.
     * « Séances de la semaine » mentait sur ce qu'on y trouve.
     */
    sessionsTitle: 'La semaine',
    restDay: 'Repos',
    sessionCompleted: 'Terminée',
    sessionToday: 'Aujourd’hui',
    sessionMissed: 'Manquée',
    sessionUpcoming: 'À venir',
    activeWorkoutCollision: 'Une séance est déjà en cours.',
    missingRoutine: 'Routine indisponible',
    missingRoutineHint: 'Cette séance doit être réparée dans le split.',
    repairSplit: 'Réparer le split',
    startSession: 'Démarrer {name}',
    upcomingTitle: 'Semaines suivantes',
    actionsLabel: 'Options du bloc',
    actionsTitle: 'Actions du bloc',
    editFuture: 'Modifier à partir de…',
    editFutureHint: 'Préparer le split d’une semaine future.',
    shiftAction: 'Décaler le bloc',
    shiftActionHint: 'Déplacer le calendrier par semaines entières.',
    shiftTitle: 'Décaler le bloc',
    shiftWeeksLabel: 'Nombre de semaines',
    shiftWeeksHint: 'Positif pour repousser, négatif pour avancer. Le bloc reste calé au lundi.',
    shiftStartedWarning:
      'Le bloc a déjà commencé. Les séances passées ne bougeront pas.',
    shiftConfirm: 'Confirmer le décalage',
    completeAction: 'Terminer le bloc',
    completeHint: 'Arrêter les prochaines séances sans effacer les données.',
    completeTitle: 'Terminer le bloc',
    completeBody: 'Les semaines, le split et les séances restent dans ton historique.',
    // Terminer ≠ supprimer : l'un arrête le bloc, l'autre l'efface. Le corps
    // dit ce qui reste, parce que c'est la seule question qu'on se pose ici.
    deleteAction: 'Supprimer le bloc',
    deleteHint: 'Effacer le bloc. Les séances déjà faites ne bougent pas.',
    deleteTitle: 'Supprimer le bloc',
    deleteBody:
      'Les séances déjà faites restent dans ton historique. Le split et les semaines de ce bloc disparaissent.',
    detailReadError: 'Le suivi n’a pas pu être lu. Tes données restent sur cet appareil.',
    actionError: 'L’action n’a pas pu être enregistrée. Réessaie.',
    newTitle: 'Nouveau bloc',
    editTitle: 'Modifier le bloc',
    notFound: 'Ce bloc n’existe plus.',
    loading: 'Chargement du bloc…',
    stepBasics: 'Cadre',
    stepSplit: 'Split',
    stepWeeks: 'Semaines',
    stepProgress: 'Étape {current} sur 3 · {name}',
    basicsIntro: 'Pose les limites du bloc avant de choisir les séances.',
    nameLabel: 'Nom du bloc',
    namePlaceholder: 'Force · fin d’été',
    startsAtLabel: 'Lundi de départ',
    durationLabel: 'Durée',
    durationOption: '{count} semaines',
    existingBasicsHint: 'Le cadre de ce brouillon est déjà enregistré.',
    continue: 'Continuer',
    activate: 'Activer le bloc',
    // Un brouillon s'enregistre, il ne s'active pas depuis l'éditeur : mettre
    // le bloc en route est une décision qui se prend sur la fiche, où l'on voit
    // ce qu'on lance.
    saveDraft: 'Enregistrer le brouillon',
    continueCreation: 'Continuer la création',
    saveRevision: 'Enregistrer la révision',
    saveRevisionWeek: 'Utiliser à partir de la semaine {number}',
    effectiveWeekLabel: 'Semaine d’entrée en vigueur',
    effectiveWeekHint:
      'La semaine courante apparaît seulement si aucune séance du bloc n’y est enregistrée.',
    splitIntro: 'Ce rythme se répète chaque semaine du bloc.',
    session: 'Séance {number}',
    sessionDayLabel: 'Jour de la séance {number}',
    sessionRoutineLabel: 'Routine de la séance {number}',
    chooseRoutine: 'Choisir une routine',
    addSession: 'Ajouter une séance',
    removeSession: 'Retirer la séance {number}',
    routinesLoading: 'Chargement des routines…',
    routinesReadError:
      'Les routines n’ont pas pu être lues. Réessaie avant de composer le split.',
    noRoutines: 'Crée d’abord une routine publiée, puis reviens composer le split.',
    weekday1: 'Lundi',
    weekday2: 'Mardi',
    weekday3: 'Mercredi',
    weekday4: 'Jeudi',
    weekday5: 'Vendredi',
    weekday6: 'Samedi',
    weekday7: 'Dimanche',
    weeksIntro: 'Règle l’intention de chaque semaine : phase et niveau.',
    week: 'Semaine {number}',
    editWeekReading: 'Modifier la semaine {number}, {line}',
    editWeekTitle: 'Semaine {number}',
    phaseLabel: 'Phase',
    loadIndexLabel: 'Niveau',
    loadIndexPreset: '{value} %',
    weekLine: '{number} — {level} % · {phase}',
    weekPhaseReading: 'Semaine {number} · {phase}',
    phase: {
      construction: 'Construction',
      progression: 'Progression',
      overload: 'Surcharge',
      deload: 'Décharge',
      return: 'Reprise',
      test: 'Test',
    },
    intention: {
      progression: 'Progresser si les perfs le permettent.',
      overload: 'Ajouter du volume si c’est déjà autorisé.',
      deload: 'Charge et volume réduits.',
      return: 'Retour à la prescription, sans forcer.',
      test: 'Tentative contrôlée, seulement si déjà autorisée.',
    },
    // Une recette pose un trajet, elle ne le verrouille pas : chaque semaine
    // reste modifiable juste en dessous.
    recipeIntro: 'Poser un trajet, puis le retoucher.',
    recipeApply: 'Appliquer la recette {name}',
    recipe: {
      hypertrophy: 'Hypertrophie',
      strength: 'Force',
      return: 'Reprise',
    },
    saveWeek: 'Enregistrer la semaine',
    errorBasics: 'Renseigne un nom, un lundi de départ et une durée de 4 à 12 semaines.',
    errorSplit: 'Choisis un jour et une routine pour chaque séance.',
    errorWeeks: 'Vérifie la phase et le niveau de chaque semaine avant d’activer le bloc.',
    errorRead: 'Le bloc n’a pas pu être lu. Tes données restent sur cet appareil.',
    errorSave: 'Cette étape n’a pas pu être enregistrée. Réessaie.',
    errorAnotherActive: 'Un autre bloc est actif. Termine-le avant d’activer celui-ci.',
    errorRoutineMissing: 'Une routine du split n’est plus disponible. Choisis-en une autre.',
    errorNoFutureRevision: 'Ce bloc n’a plus de semaine future à modifier.',
    replaceActiveTitle: 'Remplacer le bloc actif',
    replaceActiveBody:
      'Le bloc actif sera terminé avec tout son historique, puis ce nouveau bloc prendra sa place.',
    replaceActiveConfirm: 'Remplacer et activer',
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
    /** Past tense: the recap says what this session did, not what it targets. */
    detailMuscles: 'Muscles travaillés',
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
      'Sélectionne workout_data.csv (Hevy) ou une sauvegarde FitTrack. Le fichier reste sur cet appareil.',
    importChooseFile: 'Choisir le CSV',
    importWrongFile: 'Choisis workout_data.csv (Hevy) ou un fichier fittrack-….csv.',
    /**
     * Restaurer par-dessus des données existantes n'a pas de sens : les séances
     * sont dédoublonnées, mais les routines reviendraient en double. L'écran
     * s'ouvre quand même — on entre, on lit pourquoi, et on va vider. Bloquer le
     * bouton lui-même n'aurait rien expliqué.
     */
    importNotEmptyTitle: 'Vide d’abord la base',
    importNotEmptyBody:
      'Un import se fait sur une base vide, sinon tes routines reviennent en double. Vide les données, puis reviens ici.',
    importNotEmptyAction: 'Vider les données',
    /** Le cas rare : ajouter un export Hevy à un historique déjà là. */
    importAnyway: 'Importer quand même',
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
    importMappingBody: 'Vérifie les détections sûres, et choisis toi-même le reste.',
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
    importRoutineFolder: 'Le dossier « {folder} » sera créé avec : {names}.',
    /**
     * Les routines qu'on ne fait plus depuis un mois sont rangées à part : un
     * historique un peu long en ramène toujours, et la liste qu'on ouvre avant
     * une séance doit rester celle des routines vivantes.
     */
    importArchivedFolderHint:
      'Les routines sans séance depuis un mois sont rangées dans « {folder} ».',
    importContinue: 'Continuer',
    importSubmit: 'Importer',
    importWorking: 'Import en cours…',
    importSuccessTitle: 'Import terminé',
    importSuccessBody: '{imported} séances importées, {skipped} ignorées.',
    importRoutineCount: '{count} routines créées dans « {folder} ».',
    importRoutineCountOne: '1 routine créée dans « {folder} ».',
    importBackToHistory: 'Voir l’historique',
    importFailed: 'Aucune donnée n’a été écrite. Réessaie.',
    importedNotice: 'Les séances Hevy importées sont maintenant dans ton historique.',
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
    importConflictMultipleTargets: 'Plusieurs exercices sont associés à cette source',
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

    /**
     * The drawing is `aria-hidden`, so these two lines are what the muscles
     * actually *are* for a screen reader — and for anyone reading rather than
     * looking. They are not a caption.
     */
    musclesSection: 'Muscles travaillés',
    musclesPrimary: 'Principal',
    musclesSecondary: 'Aussi sollicités',

    recordsSection: 'Records',
    recordsLink: 'Voir tous les records',
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
    loadIncrementLabel: 'Incrément de charge',
    loadIncrementHint:
      'Plus petit saut de charge pour cet exercice. Vide = défaut selon le matériel ({value} kg).',
    loadIncrementAssistHint:
      'Sur une machine assistée, progresser baisse l’assistance de ce pas. Vide = défaut ({value} kg).',

    catalogueNote:
      'Exercice du catalogue : son nom et son matériel ne se modifient pas. Tes notes, ton repos et ton incrément, si.',
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
    bodyweightFactorLabel: 'Part du poids du corps',
    bodyweightFactorHint: 'Optionnel. 70 % pour des pompes, 100 % pour des tractions.',
    bodyweightFactorError: 'Plus de 0 et jusqu’à 100 %.',
    bodyweightFactorDefault: '100',
    unilateralLabel: 'Unilatéral',
    unilateralHint: 'Un côté à la fois : presse unilatérale, curl marteau alterné.',

    submitCreate: 'Créer l’exercice',
    submitSave: 'Enregistrer',
  },

  settings: {
    title: 'Réglages',

    /**
     * La section « Application » — l'installation sur l'écran d'accueil et
     * l'état du cache hors-ligne.
     *
     * Le libellé ne dit ni « PWA » ni « service worker » : ce que l'utilisateur
     * veut savoir, c'est si l'app marchera dans un sous-sol sans 4G. La ligne
     * répond à ça, en français, sans nommer la machinerie.
     */
    appSection: 'Application',
    installLink: 'Installer sur l’écran d’accueil',
    installHint: 'L’app s’ouvre depuis son icône, sans barre d’adresse.',
    installDone: 'FitTrack est installée.',
    installDismissed: 'Installation annulée.',
    installFailed: 'L’installation n’a pas pu démarrer.',
    /**
     * Affiché quand le navigateur ne propose rien : soit l'app est déjà
     * installée, soit c'est un iPhone (Safari n'a pas d'invite programmable) ou
     * un navigateur qui n'en veut pas. Renvoyer vers `docs/INSTALLATION.md`
     * serait un lien mort dans l'app — la phrase décrit donc le geste.
     */
    installUnavailable: 'Déjà installée, ou à ajouter depuis le menu du navigateur.',
    offlineReady: 'Prête pour le hors-ligne : l’app démarre sans réseau.',
    offlinePending: 'Copie hors-ligne en cours de préparation.',

    appearanceSection: 'Apparence',
    theme: 'Thème',
    themeDark: 'Sombre',
    themeLight: 'Clair',
    themeHint:
      'Sombre par défaut : une salle est mal éclairée et l’écran reste allumé une heure et demie.',

    trainingSection: 'Entraînement',
    oneRepMaxTitle: 'Estimation du 1RM',
    oneRepMaxSheetTitle: 'Formule d’estimation du 1RM',
    oneRepMaxLoading: 'Chargement…',
    oneRepMaxEpley: 'Epley',
    oneRepMaxEpleyHint: 'Un repère équilibré, couramment utilisé.',
    oneRepMaxBrzycki: 'Brzycki',
    oneRepMaxBrzyckiHint: 'Une estimation fondée sur la charge et le nombre de répétitions.',
    oneRepMaxLombardi: 'Lombardi',
    oneRepMaxLombardiHint: 'Une estimation qui progresse régulièrement avec les répétitions.',
    oneRepMaxExample: '100 kg × 5 → {value} kg',
    oneRepMaxFailed:
      'La formule n’a pas pu être enregistrée. La formule précédente reste utilisée.',

    recordsSection: 'Records',
    recordRepairTitle: 'Recalculer les records personnels',
    recordRepairHint:
      'Reconstruit les records depuis tes séances. Aucune séance ni série n’est modifiée.',
    recordRepairAction: 'Réparer les records',
    recordRepairWorking: 'Réparation en cours…',
    recordRepairConfirmTitle: 'Reconstruire les records',
    recordRepairConfirmBody:
      'Tous les records seront recalculés depuis les séances enregistrées. Tes séances et tes séries restent intactes.',
    recordRepairConfirmAction: 'Lancer la réparation',
    recordRepairDone:
      'Records réparés · créations : {created} · mises à jour : {updated} · suppressions : {deleted}.',
    recordRepairFailed: 'Les records n’ont pas pu être réparés. Tu peux réessayer.',

    dataSection: 'Données',
    exportHistoryLink: 'Exporter tout l’historique',
    exportHistoryHint: 'Partage toutes tes séances dans un document texte lisible.',
    exportHistoryTitle: 'FitTrack — historique complet',
    /**
     * L'export CSV — la sauvegarde, celle qu'on remet dans l'app. Le libellé dit
     * « sauvegarde » et pas « CSV » : le format est un moyen, ce qu'on cherche
     * ici c'est de ne pas perdre ses séances.
     */
    exportCsvLink: 'Sauvegarder l’historique (CSV)',
    exportCsvHint:
      'Un fichier réimportable dans FitTrack, lisible dans un tableur. Les routines jamais réalisées n’y sont pas.',
    exportCsvTitle: 'Sauvegarde FitTrack',
    exportCsvDownloaded: 'Sauvegarde téléchargée.',
    exportCsvEmpty: 'Aucune séance terminée à sauvegarder.',
    exportCsvFailed: 'La sauvegarde n’a pas pu être enregistrée.',
    exportHistoryCopied: 'Historique copié dans le presse-papiers.',
    exportHistoryFailed: 'L’historique n’a pas pu être partagé ni copié.',
    debugLink: 'Diagnostic',
    debugHint: 'Contenu de la base, stockage utilisé, réinitialisation.',

    /**
     * Les crédits. Ce n'est pas une politesse : la carte musculaire est une
     * œuvre dérivée sous CC BY-SA 4.0, dont l'article 3(a) exige que
     * l'attribution reste accessible à qui reçoit l'application — pas seulement
     * dans le dépôt. Le lien est donc une obligation, pas une décoration.
     */
    creditsLink: 'À propos et crédits',
    creditsHint: 'Origine de la carte musculaire et licences des travaux réutilisés.',

    /**
     * La réparation de l'instantané. Elle **repeint le passé**, ce que le jalon
     * 08A existe pour empêcher — donc jamais automatique, jamais silencieuse,
     * et la phrase de confirmation dit le prix plutôt que « es-tu sûr ? ».
     */
    repairLink: 'Réparer les muscles de l’historique',
    /** Au pluriel depuis que l’instantané fige aussi les muscles secondaires. */
    repairHint:
      'À utiliser après avoir corrigé un exercice mal classé : les séances passées gardent sinon les anciens muscles, principal et secondaires.',
    repairConfirmTitle: 'Réparer l’historique',
    repairConfirmBody:
      'Chaque séance passée reprendra le nom, le muscle, le matériel et le type de mesure que ses exercices ont AUJOURD’HUI dans la bibliothèque. Un exercice renommé depuis prendra donc son nouveau nom. Rien n’est supprimé, et les charges et répétitions ne bougent pas.',
    repairConfirmAction: 'Réparer',
    repairDone: '{repaired} exercices de séance corrigés.',
    repairDoneOne: '1 exercice de séance corrigé.',
    repairDoneNone: 'Rien à corriger : l’historique est déjà d’accord avec la bibliothèque.',
  },

  /**
   * Les crédits des travaux réutilisés.
   *
   * Écran obligatoire, pas informatif : CC BY-SA 4.0 §3(a) demande que
   * l'attribution accompagne l'œuvre « par tout moyen raisonnable au vu du
   * support ». Un fichier dans le dépôt couvre le code source ; il ne couvre pas
   * quelqu'un qui installe la PWA ou l'APK. Cet écran est ce moyen.
   *
   * Les noms d'auteurs ne sont pas traduits et le nom de la licence est laissé
   * dans sa forme canonique : c'est ce qui rend l'attribution vérifiable.
   */
  credits: {
    title: 'À propos et crédits',
    intro:
      'FitTrack réutilise des travaux publiés par d’autres. Voici lesquels, et sous quelles conditions.',

    muscleMapTitle: 'Carte musculaire',
    muscleMapWork: 'Z-Anatomy',
    muscleMapLicence: 'CC BY-SA 4.0',
    muscleMapAuthors: 'Kousaku Okubo (BodyParts3D) · Gauthier Kervyn · Marcin Zielinski',
    /**
     * Dire que le dessin est modifié n'est pas une précaution : §3(a)(1)(B)
     * l'exige dès qu'on publie une œuvre dérivée.
     */
    muscleMapNotice:
      'Le dessin est une œuvre dérivée : la géométrie a été extraite des maillages puis vectorisée. Il reste distribué sous la même licence, comme tout rendu qui en descend.',
    muscleMapLink: 'creativecommons.org/licenses/by-sa/4.0',

    appTitle: 'Application',
    appNotice:
      'Le reste de FitTrack n’est pas une œuvre dérivée de la carte et ne relève pas de sa licence.',
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
      'Le tonnage additionne la charge externe et le poids du corps effectif estimé, assistance soustraite et échauffements exclus.',
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

    /**
     * Ce que le point plein de la courbe veut dire. Même raison que sur les
     * séances : deux intensités d'une même teinte ne s'expliquent pas toutes
     * seules. Affichée à partir de deux points — avec une seule séance, le
     * « record » est la seule valeur qu'il y ait, et le dire serait creux.
     */
    chartLegend: 'Le point plein est le record de la période.',

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

    /**
     * Ce que les deux intensités du graphique veulent dire. Sans cette phrase,
     * deux tons d'une même teinte sont de la décoration ; avec elle, c'est une
     * information. Affichée seulement quand un objectif existe : sans objectif,
     * aucune colonne n'est pleine et la légende annoncerait un repère absent.
     */
    chartLegend: 'Les colonnes pleines sont les semaines où l’objectif est atteint.',

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
      'Aucune charge comptée. Renseigne ton poids sur l’accueil pour inclure les exercices au poids du corps.',
    singleWeek: 'Une seule semaine sur cette période : une tendance demande plusieurs semaines.',
    /**
     * Pourquoi aucune colonne ne ressort ici, alors que le graphique des séances
     * en met une en avant. Un aplat uniforme sans explication se lit comme une
     * couleur qui n'a pas pris — c'est exactement le retour qui est arrivé du
     * téléphone. Dit une fois, c'est une réponse.
     */
    chartLegend:
      'Toutes les semaines ont la même couleur : le volume n’a pas d’objectif à atteindre.',
    tonnageHint:
      'Charge externe et poids du corps effectif estimé. Assistance soustraite, échauffements exclus.',
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
    footnote: 'Comptées sur le muscle principal de chaque exercice. Échauffements exclus.',

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
    estimatedOneRepMax: '1RM estimé',
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
    estimatedOneRepMax:
      'La meilleure estimation de la séance selon la formule choisie dans les réglages.',
    bestSetVolume: 'La meilleure série de la séance, charge × répétitions.',
    sessionTonnage:
      'Charge externe et poids du corps effectif estimé × répétitions. Assistance soustraite, échauffements exclus.',
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
