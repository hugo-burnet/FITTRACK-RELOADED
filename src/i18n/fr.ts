/** Centralized French UI copy. */
const fr = {
  /**
   * La signature de l’app. Elle reste en anglais, telle qu’elle se dit : ce
   * n’est pas une phrase d’interface qu’on traduit, c’est un nom.
   *
   * En trois morceaux parce que l’ouverture les fait entrer l’un après
   * l’autre, et en une ligne parce que « À propos » la cite entière. Les
   * trois morceaux et la ligne doivent rester d’accord.
   */
  app: {
    name: 'FitTrack',
    principle: 'Progressive Overload',
    tagline: 'Production was the gym',
    slogan: 'FitTrack — Progressive Overload — Production was the gym',
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
    done: 'Terminé',
    decrease: 'Diminuer',
    increase: 'Augmenter',
    undo: 'Annuler',
    undoDelete: 'Annuler la suppression de {reading}',
    unlockExerciseOrder: 'Déverrouiller l’ordre des exercices',
    lockExerciseOrder: 'Verrouiller l’ordre des exercices',
    unlockRoutineOrder: 'Déverrouiller l’ordre des routines',
    lockRoutineOrder: 'Verrouiller l’ordre des routines',
  },

  nav: {
    label: 'Navigation principale',
    home: 'Accueil',
    planning: 'Planifier',
    history: 'Historique',
    progress: 'Progression',
    exercises: 'Exercices',
    settings: 'Réglages',
  },

  /**
   * Planifier. Trois espaces, trois sens qui ne se confondent pas : une routine
   * compose une séance, un programme organise les semaines, le Guide explique.
   * Le vocabulaire est verrouillé par la spécification — si deux de ces mots se
   * mettaient à vouloir dire la même chose, l'onglet n'aurait plus d'utilité.
   */
  /**
   * Le parcours « Apprendre à programmer ». Il n'apporte aucun contenu propre :
   * il ordonne des pages du Guide et dit pourquoi chacune arrive à ce moment-là.
   */
  learn: {
    title: 'Apprendre à programmer',
    entry: 'Apprendre à programmer',
    entryHint: 'Le Guide dans l’ordre où le lire, une phrase par étape.',
    intro:
      'Quatorze étapes, une phrase chacune. Tu peux t’arrêter après la sixième et déjà construire un programme qui tient : la suite sert à l’améliorer, pas à le rendre valable.',
    progress: '{done}/{total} lues',
    readStep: 'Lire cette étape',
    readTodo: 'À lire',
    readDone: 'Lu',
    markRead: 'Marquer « {title} » comme lu',
    limitTitle: 'Ce que ce parcours ne fait pas',
    limitBody:
      'Il ne construit pas ton programme et ne prescrit rien. Il te donne de quoi décider toi-même, et te dit où le corpus s’arrête.',
  },

  /**
   * L'entrée douleur et blessure. Elle est volontairement séparée des familles
   * du wiki : on la cherche dans un état d'esprit différent, et souvent vite.
   */
  injury: {
    entry: 'Douleur ou blessure',
    entryHint: 'Ce qui doit faire arrêter, ce qui doit faire consulter.',
  },

  planning: {
    tabsLabel: 'Espaces de Planifier',
    routines: 'Routines',
    programs: 'Programmes',
    guide: 'Guide',
    applyGuide: 'Mettre en pratique',
    applyGuideHint:
      'Le Guide explique ; il n’écrit aucun programme. Cette action ouvre l’éditeur de programme, sans rien y préremplir.',
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

  weekday: {
    long: {
      sunday: 'dimanche',
      monday: 'lundi',
      tuesday: 'mardi',
      wednesday: 'mercredi',
      thursday: 'jeudi',
      friday: 'vendredi',
      saturday: 'samedi',
    },
    // Deux « M » : c'est ce que tout le monde lit sur un agenda. Le nom complet
    // est dans l'étiquette accessible, là où l'ambiguïté se paierait.
    initial: {
      sunday: 'D',
      monday: 'L',
      tuesday: 'M',
      wednesday: 'M',
      thursday: 'J',
      friday: 'V',
      saturday: 'S',
    },
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

  /**
   * Les quatorze familles de mouvement, reprises du vocabulaire fermé du contrat
   * KB (`movement-pattern.vocab.json`). Elles nomment une **mécanique**, jamais
   * une zone du corps : c'est ce qui permet au wiki d'expliquer pourquoi deux
   * muscles coopèrent sans le deviner d'un nom d'exercice.
   */
  movementPattern: {
    poussee_horizontale: 'Poussée horizontale',
    poussee_verticale: 'Poussée verticale',
    tirage_horizontal: 'Tirage horizontal',
    tirage_vertical: 'Tirage vertical',
    squat: 'Squat',
    hinge: 'Hip hinge',
    fente: 'Fente',
    isolation_coude: 'Isolation du coude',
    isolation_epaule: 'Isolation de l’épaule',
    isolation_genou: 'Isolation du genou',
    isolation_hanche: 'Isolation de la hanche',
    isolation_cheville: 'Isolation de la cheville',
    isolation_poignet: 'Isolation du poignet',
    autre: 'Autre',
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

  /**
   * Comment les disques se posent. Nommé par le geste — « sur une barre »,
   * « d'un seul côté » — et jamais par le vocabulaire de la machine : ce qu'on
   * cherche à l'écran, c'est le tas de fonte qu'on a devant soi.
   */
  plateLoading: {
    none: 'Aucun',
    barbell: 'Sur une barre',
    two_sided: 'Deux côtés, sans barre',
    single_sided: 'Un seul côté',
  },

  plateLoadingHint: {
    none: 'Charge guidée, haltère fixe, élastique : rien à empiler.',
    barbell: 'Barre olympique, barre EZ, Smith. Le poids de la barre compte.',
    two_sided: 'Machine à deux pivots, haltère chargeable, chariot.',
    single_sided: 'Ceinture de lest, disque tenu, machine à un seul pivot.',
  },

  home: {
    title: 'Accueil',
    emptyBody: 'Le compteur démarre à ta première séance terminée.',
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
    chooseRoutineFolder: 'Choisir un dossier',
    changeRoutineFolder: 'Changer de dossier',
    rootRoutineFolder: 'Sans dossier',
    emptyRoutineFolder: 'Aucune routine dans ce dossier.',
    routineFolderWriteError: 'Impossible de changer de dossier.',
    programSection: 'Bloc en cours',
    programWeek: 'Semaine {current} sur {total}',
    /** La ligne « Programmes » quand aucun bloc ne tourne. */
    programsNone: 'Aucun bloc actif',
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
    pace: 'Lancer la cadence',
    effortQuestion: 'Effort perçu',
    effortLead: 'C’était',
    effortEasy: 'Facile',
    effortOk: 'Correct',
    effortHard: 'Dur',
    effortMax: 'Limite',
    effortOption: '{label}, RPE {value}',
    rpeGaugeLabel: 'RPE',
    rpeGauge: 'Jauge RPE',
    rpeConfirm: 'Valider le RPE {value}',
    paceStop: 'Arrêter la cadence',
    pacePreparing: 'Départ · {seconds}',
    paceStatus: 'Cadence · {current}/{total} · {tempo} s',
    // Le chrono d'un maintien. La préparation réutilise « Départ · n » : c'est
    // la même attente, et lui inventer d'autres mots la ferait lire comme autre
    // chose.
    holdStatus: 'Maintien · {time}',
    // La transition entre les deux côtés d'une série unilatérale. Même forme
    // que « Départ · n » parce que c'est la même attente — et en Silence, ce
    // relevé est tout ce qui dit que la série n'est pas finie.
    sideChanging: 'Changement de côté · {seconds}',
    holdStart: 'Démarrer le chrono',
    holdStop: 'Arrêter le chrono',
    holdTitle: 'Chrono',
    holdOpen: 'Chrono de {name}',
    holdNoSet: 'Aucune série à chronométrer sur cet exercice.',
    holdHelp:
      'Le chrono compte le temps tenu et l’écrit dans la série quand tu valides. Les deux dernières secondes, celles du relâchement, ne sont pas comptées.',
    // La cadence de l'exercice : le chrono du bandeau de la carte l'ouvre, et
    // l'arrête quand elle tourne.
    paceTitle: 'Cadence',
    paceOpen: 'Cadence de {name}',
    paceTempoLabel: 'Secondes par répétition',
    paceMenuHint: '{tempo} s par répétition',
    paceUnit: 's / rep',
    paceDecrease: 'Un quart de seconde de moins',
    paceIncrease: 'Un quart de seconde de plus',
    paceSetReading: '{reps} reps à ce tempo : environ {seconds} s de série.',
    paceNoSet: 'Aucune série à cadencer sur cet exercice.',
    paceMissingReps: 'Répétitions à saisir : la cadence les demandera avant de partir.',
    paceSetDefault: 'Par défaut partout',
    paceHelp:
      'Le tempo est celui de cet exercice. « Par défaut partout » le donne à ceux qui n’ont pas encore le leur.',
    complete: 'Valider la série {number}',
    completeFirstSide: 'Premier côté terminé — série {number}',
    completeSecondSide: 'Second côté — valider la série {number}',
    sideFirst: 'Premier côté en cours',
    sideTransition: 'Changement de côté · {seconds}',
    sideSecond: 'Second côté en cours',
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
    /** Un seul point de chargement : « de chaque côté » y serait un mensonge. */
    platesOneSide: 'À charger',
    platesTotalReading: '{weight} kg',
    platesBarWeight: 'Poids de la barre',
    platesBaseWeight: 'Charge à vide',
    /** Ce que la fiche a réglé, rappelé là où on charge vraiment. */
    platesLoadingReading: '{loading}',
    platesSettingsLink: 'Se règle sur la fiche de l’exercice.',
    platesAvailable: 'Plaques disponibles',
    platesAvailableCount: '{selected} sur {total}',
    platesAvailableOption: '{weight} kg',
    platesAvailableEmpty: 'Aucune plaque sélectionnée.',
    platesAvailableSaveError: 'Impossible d’enregistrer les plaques disponibles.',
    platesEmpty: 'Barre nue, aucune plaque à ajouter.',
    platesReadingPlate: '{count} × {weight}',
    platesRemainder: 'Il manque {weight} kg pour la charge exacte.',
    platesBelowBar: 'Plus léger que la barre seule ({weight} kg).',
    platesAria: 'De chaque côté : {plates}',
    platesAriaOneSide: 'À charger : {plates}',
    platesEmptyOneSide: 'Rien à charger.',
    platesBelowBase: 'Plus léger que la charge à vide ({weight} kg).',
  },

  androidNotification: {
    workoutChannel: 'Séance en cours',
    workoutChannelDescription: 'Affiche la séance active dans les notifications.',
    restChannel: 'Minuteur de repos',
    restChannelDescription: 'Sonne quand le temps de repos est terminé.',
    workoutBody: 'Touche pour revenir à la séance.',
    restTitle: 'Repos terminé',
    restBody: 'La prochaine série peut commencer.',
    recordChannel: 'Records battus',
    recordChannelDescription: 'Écrit un record dans les notifications, sans bruit.',
    reminderChannel: 'Rappels d’entraînement',
    reminderChannelDescription: 'Sonne aux jours et à l’heure que tu as choisis.',
    reminderTitle: 'C’est un jour de séance',
    reminderBody: 'Touche pour ouvrir FitTrack.',
    recordTitle: 'Record battu',
    recordOne: '{exercise} · {record} {value}',
    recordMany: '{count} records · {exercises}',
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
    applyButton: 'Appliquer {weight} kg',
    hideObservation: 'Masquer',
    nextLoad: 'Prochaine charge : {weight} kg',
    range_ceiling_reached:
      '{current} → {weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    range_ceiling_reached_assist:
      'Assistance {current} → {weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    range_ceiling_reached_plain:
      '{weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    /** Ceiling constat with no next load (stripped escalate, overload add_set sibling). */
    range_ceiling_reached_constat: '{sets} × {reps} a atteint le haut de la fourchette.',
    /** @deprecated Read alias — same wording as range_ceiling_reached. */
    range_completed:
      '{current} → {weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    range_completed_assist:
      'Assistance {current} → {weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    range_completed_plain: '{weight} kg car {sets} × {reps} a atteint le haut de la fourchette.',
    range_satisfied:
      'Fourchette respectée ({sets} séries ≥ {reps}, sans atteindre le plafond {max}).',
    range_missed:
      '{current} → {weight} kg car le bas de fourchette ({floor}) a été manqué {sessions} séances de suite (descendu à {low}).',
    range_missed_assist:
      'Assistance {current} → {weight} kg car le bas de fourchette ({floor}) a été manqué {sessions} séances de suite (descendu à {low}).',
    /**
     * Manque confirmé, mais l'allègement n'existe pas : un pas de plus sous la
     * charge tombe à zéro. Constat sans flèche — une flèche promet un chiffre.
     */
    range_missed_constat:
      'Le bas de fourchette ({floor}) a été manqué {sessions} séances de suite (descendu à {low}) : il n’y a rien de plus léger à charger, on garde la charge.',
    // Pas de flèche ici : « → » veut dire « fais ça » sur la carte d'objectif,
    // et une observation ne demande rien.
    intra_session_drop: 'Baisse de reps observée : {first} puis {low} (−{drop}).',
    plateau: 'Plateau détecté : {sessions} séances sans progrès du 1RM estimé ({value} kg).',
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
    staleTitle: 'Les records ne peuvent pas être affichés',
    staleBody:
      'FitTrack doit les recalculer depuis tes séances. Tes séances et tes séries ne seront pas modifiées.',
    repair: 'Recalculer les records',
    repairing: 'Recalcul en cours…',
    retryRepair: 'Réessayer',
    repairFailed:
      'Les records n’ont pas pu être recalculés. Tes séances sont intactes, tu peux réessayer.',
  },

  /**
   * Les paliers — et non « les jalons », qui désignent déjà les marques du rail
   * des records deux blocs plus haut. Deux mots pour deux choses : un record est
   * relatif à soi et tombe toutes les trois semaines, un palier est un seuil
   * écrit à l'avance qu'on ne franchit qu'une fois.
   *
   * « Franchir un palier » est en plus l'expression exacte du français pour ce
   * que la fonctionnalité célèbre, ce qu'aucun mot de trophée n'aurait dit sans
   * en faire un jeu.
   */
  milestone: {
    title: 'Paliers',
    link: 'Paliers',
    subtitle: 'Ce qui est acquis pour de bon',

    /** Fin de séance, à l'instant où il tombe. */
    unlockedOne: 'Palier franchi',
    unlockedMany: '{count} paliers franchis',
    unlockedHint: 'Acquis pour de bon. Ni une pause, ni une blessure ne te le reprendront.',

    achievedOn: 'le {date}',
    countOne: '1 palier',
    count: '{count} paliers',

    emptyTitle: 'Rien encore, et c’est normal',
    emptyBody:
      'Les paliers sont rares — ce sont les jours dont on se souvient, pas les progrès de la semaine. Continue de venir : le premier arrivera tout seul.',

    group: {
      strength: 'Force',
      gateway: 'Portes franchies',
      practice: 'Pratique',
      volume: 'Volume',
    },

    /**
     * Le sujet est écrit ici et jamais lu en base : un palier acquis en 2023 se
     * relit en 2027 même si l'exercice a été renommé ou supprimé.
     */
    subject: {
      bench: 'Développé couché',
      squat: 'Squat',
      deadlift: 'Soulevé de terre',
      overhead: 'Développé militaire',
      hipThrust: 'Hip thrust',
      row: 'Rowing barre',
      pullUp: 'Traction pronation',
      chinUp: 'Traction supination',
      dip: 'Dips',
      pistolSquat: 'Pistol squat',
      plank: 'Gainage',
      deadHang: 'Suspension à la barre',
    },

    /**
     * Les premières fois ont leur phrase entière, une par mouvement.
     *
     * Un gabarit « Première {sujet} » aurait écrit « Première dips » et
     * « Première pistol squat » : le genre du nom n'est pas une donnée qu'on
     * dérive, et le français n'est pas négociable sur ce point.
     */
    first: {
      pullUp: 'Ta première traction pronation',
      chinUp: 'Ta première traction supination',
      dip: 'Ton premier dips',
      pistolSquat: 'Ton premier pistol squat',
    },

    load: '{subject} à {value} kg',
    reps: '{subject} — {value} répétitions',
    duration: '{subject} — {value} min',
    dumbbellPair: 'La paire de {value} kg',
    sessions: '{value} séances',
    weeks: '{value} semaines d’entraînement',
    yearOne: 'Un an de pratique',
    years: '{value} ans de pratique',
    tonnage: '{value} tonnes soulevées',

    /** Ce que le palier a réellement valu, sous son titre. */
    reachedLoad: 'Franchi à {value} kg',
    reachedReps: 'Franchi à {value} répétitions',
    reachedDuration: 'Franchi à {value}',

    /**
     * La rétrospective de l'accueil. Une carte, un anniversaire, puis plus
     * jamais : elle s'efface d'elle-même une fois lue.
     */
    retrospective: {
      oneYear: 'Il y a un an',
      years: 'Il y a {count} ans',
      body: 'Tu franchissais ce palier. Il est toujours à toi.',
      dismiss: 'Fermer',
    },

    /** Une ligne sous le mème en grand. Le titre de la feuille dit le palier. */
    art: {
      'pepe-classic': 'Ça fait du bien. Voilà tout.',
      'pepe-smug': 'Tu le savais déjà.',
      'pepe-sad': 'Ça a fait mal. C’est fait.',
      'pepe-rare': 'Celui-là, presque personne ne le voit.',
      trollface: 'Ton toi d’avant n’y croyait pas.',
      wojak: 'Le début est toujours un peu triste.',
      doge: 'Wow. Much kilos.',
      'this-is-fine': 'Tout brûle. Tu restes.',
      stonks: 'Le graphe ne monte que d’un côté.',
      loss: 'Est-ce que c’est Loss ? Oui.',
      'woman-cat': 'Le débat du hip thrust, en une image.',
      'disaster-girl': 'C’est toi qui as mis le feu.',
      distracted: 'Les plus lourds, juste à côté.',
      'expanding-brain': 'Chaque année, un cran de plus.',
      'two-buttons': 'Continuer, ou continuer.',
      gigachad: 'Tu es lui, maintenant.',
      'git-gud': 'Tu es mort. Tu recommences.',
      'skill-issue': 'Le problème, c’était toi. Plus maintenant.',
      'we-go-jim': 'On y va. Point.',
      'leg-day': 'Jamais sauter les jambes.',
      'chicken-rice': 'Le plat le plus ennuyeux du monde. Ça marche.',
      'press-f': 'Respect.',
      'do-you-even-lift': 'La question. La réponse est oui.',
      pump: 'Le sang est arrivé.',
      'swole-doge': 'Même Doge a fait ses squats.',
      'light-weight': 'Léger. Relativement.',
      'ego-lift': 'Trop lourd, trop tôt. Ça compte quand même.',
      copium: 'Le militaire, ça passe par là.',
      'trade-offer': 'De la douleur contre des fesses. Marché conclu.',
      'forever-alone': 'Personne ne le voit. Toi si.',
      'me-gusta': 'Sale, efficace.',
      'they-dont-know': 'Ils ne savent pas que tu rows.',
      'chill-guy': 'Sans en faire un plat.',
      loading: 'Ça charge.',
      'one-more': 'Une de plus. Toujours une de plus.',
      'uno-reverse': 'Ça te devait une revanche.',
      'panik-kalm': 'La barre, le calme, la barre.',
      ez: 'Facile. Après coup.',
      cheems: 'Petit, mais il les a faites.',
      'computer-dog': 'Ne rien comprendre, et tenir.',
      'monkey-puppet': 'On ne parle pas de ça.',
      'its-over': 'Les avant-bras ont dit non. Tu as tenu.',
      'locked-in': 'Tu es revenu. Encore.',
      bonk: 'Stop au doute.',
      'always-has-been': 'C’était déjà ça. Toujours.',
      iceberg: 'Ce que tu vois, et tout ce qu’il y a dessous.',
    },
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
    collapseAll: 'Tout replier',
    expandAll: 'Tout déplier',
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
     * Le pont vers le corpus. Le libellé ne promet pas une réponse : il dit où
     * lire, ce qui est exactement ce que fait la base de preuves.
     */
    evidenceLink: 'Ce qu’en dit le corpus',
    evidenceCountOne: '{count} fiche — {section}',
    evidenceCountMany: '{count} fiches — {section}',
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
    missingRoutine: 'Routine supprimée',
    missingRoutineHint: 'La routine prévue {day} n’existe plus.',
    missingRoutineLocked: 'Cette semaine contient déjà une séance et ne peut plus être modifiée.',
    missingRoutineCompleted: 'Ce bloc est terminé et ne peut plus être modifié.',
    repairSplit: 'Choisir une autre routine',
    replaceRoutineTitle: 'Remplacer la routine supprimée',
    replaceRoutineHint:
      'Choisis la routine qui doit prendre sa place à partir de la semaine {week}.',
    replaceRoutineLabel: 'Routine de remplacement',
    replaceRoutineConfirm: 'Confirmer le remplacement',
    replaceRoutineFailed: 'La routine n’a pas pu être remplacée. Vérifie le bloc puis réessaie.',
    replaceRoutineEmpty: 'Aucune routine disponible. Tu peux en créer une vide ici.',
    replaceRoutineCreateLabel: 'Nom de la nouvelle routine',
    replaceRoutineCreatePlaceholder: 'Ex. Poussée A',
    replaceRoutineCreate: 'Créer et utiliser cette routine',
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
    shiftStartedWarning: 'Le bloc a déjà commencé. Les séances passées ne bougeront pas.',
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
    startsAtHint: 'Un lundi : les semaines du bloc se comptent du lundi au dimanche.',
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
    routinesReadError: 'Les routines n’ont pas pu être lues. Réessaie avant de composer le split.',
    newRoutine: 'Nouvelle routine',
    newRoutineLabel: 'Nom de la routine',
    newRoutinePlaceholder: 'Poussée',
    newRoutineHint:
      'Elle est créée vide et prend sa place dans le split. Les exercices s’ajoutent depuis l’onglet Routines, avant la première séance.',
    newRoutineCreate: 'Créer et placer',
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
    /** Même grammaire, pour une suite de semaines identiques repliée en une ligne. */
    weekRunLine: '{from}–{to} — {level} % · {phase}',
    phase: {
      construction: 'Construction',
      progression: 'Progression',
      overload: 'Surcharge',
      deload: 'Décharge',
      return: 'Reprise',
      test: 'Test',
    },
    // Ce que le niveau fait vraiment, écrit sous le nombre. Les anciennes
    // phrases d'intention étaient au conditionnel — « Progresser si les perfs
    // le permettent » — parce que le niveau ne prescrivait rien. Il opère
    // maintenant, donc il y a une règle, donc elle s'écrit.
    loadRule: {
      neutral: 'Charges inchangées : celles de tes routines.',
      up: '+1 cran de charge sur les séries de travail.',
      upMany: '+{count} crans de charge sur les séries de travail.',
      down: '−1 cran de charge sur les séries de travail.',
      downMany: '−{count} crans de charge sur les séries de travail.',
      deload: 'Deux crans de moins, une série de travail en moins, bas de la fourchette.',
      /** Sous le champ de saisie, une fois : le pas de l'effet n'est pas celui du champ. */
      hint: 'Un cran tous les 5 points. Un cran, c’est le plus petit saut de charge de l’exercice.',
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
    errorBasicsName: 'Donne un nom au bloc.',
    errorBasicsDate: 'Choisis la date de départ du bloc.',
    errorBasicsMonday: 'Le départ tombe un lundi : un bloc se compte en semaines pleines.',
    errorBasicsDuration: 'La durée va de 4 à 12 semaines.',
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
    /**
     * Le titre de section suffit à l'œil ; l'oreille, elle, n'a que ce libellé
     * pour savoir ce que porte le dessin — et depuis qu'il se touche, il n'est
     * plus décoratif.
     */
    detailMusclesLabel: 'Les muscles travaillés pendant cette séance',
    detailExercises: 'Exercices',
    detailSets: 'Séries de travail',
    detailReps: 'Répétitions',
    detailTonnage: 'Tonnage',
    detailTime: 'Temps',
    /**
     * Le seul chiffre estimé de la carte le dit lui-même, et dit aussi où on
     * le règle : une estimation qu'on ne peut pas corriger est un chiffre subi.
     */
    detailTimeHint:
      'Le temps compte les exercices chronométrés à la seconde, et les séries en répétitions à la cadence réglée sur l’exercice — 3 s par répétition par défaut.',
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

    viewsLabel: 'Vues de la fiche',
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

    /**
     * « Charge » — comment cet exercice se charge, et ce qu'il pèse déjà.
     *
     * Sur la fiche et pas seulement dans le formulaire de création : les deux
     * réglages valent autant pour « Extension lombaire » du catalogue que pour
     * un exercice fait maison, et le formulaire ne s'ouvre que sur le second.
     */
    loadSection: 'Charge',

    bodyweightFactorLabel: 'Part du poids du corps',
    bodyweightFactorHint:
      'Ce que ces répétitions soulèvent de toi. Sans ça, une traction sans lest pèse zéro dans le tonnage. Tractions et dips 100 %, squats 90 %, pompes 70 %.',
    bodyweightFactorNone: 'Non comptée',
    bodyweightFactorPreset: '{percent} %',
    bodyweightFactorError: 'Plus de 0 et jusqu’à 100 %.',
    bodyweightFactorMissingWeight:
      'Renseigne ton poids sur l’accueil pour que ces répétitions comptent.',

    plateLoadingLabel: 'Chargement en disques',
    plateLoadingHint: 'Décide si « Plaques à charger » apparaît en séance.',
    plateBaseWeightLabel: 'Poids de la barre',
    plateBaseWeightBarHint: 'Barre olympique 20 kg, barre EZ 10 kg, barre courte 7 kg.',
    plateBaseWeightMachineLabel: 'Charge à vide',
    plateBaseWeightMachineHint:
      'Ce qui pèse déjà avant le premier disque : un chariot, un levier, un bras de machine. 0 pour une ceinture de lest.',
    plateLoadingPreviewNone: 'Rien à charger sous {weight} kg.',
    plateLoadingPreviewLabel: 'Pour {weight} kg',

    catalogueNote:
      'Exercice du catalogue : son nom et son matériel ne se modifient pas. Tes notes, ton repos, ton incrément et son chargement, si.',
    /** Not "Enregistrer": there is nothing left to save, only somewhere to go. */
    done: 'Terminé',
    edit: 'Modifier',
    delete: 'Supprimer l’exercice',
    deleteHint:
      'Il quitte la bibliothèque. Tes séances passées gardent leurs séries et leurs charges.',
    deleteConfirm: 'Supprimer',
    cancel: 'Annuler',
  },

  /**
   * La vue Documentation d'une fiche d'exercice. Elle ne promet rien : elle dit
   * ce que le corpus rattache à cet exercice, et nomme ce qu'il ne rattache pas.
   */
  exerciseDoc: {
    tabTracking: 'Suivi',
    tabDocumentation: 'Documentation',
    summaryTitle: 'Ce que le wiki documente ici',
    emptyBody:
      'Aucun article ne couvre encore ce muscle. Le sommaire du wiki dit ce qui existe ; rien n’est cherché à sa place.',
    toSummary: 'Ouvrir le sommaire du wiki',
    readArticle: 'Lire l’article',
    clinicalTitle: 'Douleur et tolérance',
    clinicalHint:
      'Ce que le corpus clinique documente pour les articulations engagées par cet exercice. Aucun diagnostic, aucune prescription : en cas de doute, un avis médical reste la seule réponse.',
    secondaryTitle: 'Muscles secondaires',
    secondaryNoRole:
      'Le corpus ne documente pas le rôle de ce muscle dans cette famille de mouvement. Sa fiche complète reste accessible.',
    limitsTitle: 'Ce que cette page ne dit pas',
    limitPrimaryMissing: 'Aucun article ne couvre encore le muscle principal de cet exercice.',
    limitPatternMissing:
      'Aucune relation de mouvement n’est déclarée sur cet exercice. Les muscles restent documentés ; leur coopération, elle, ne s’invente pas.',
    limitMovementArticleMissing:
      'La famille de mouvement déclarée n’a pas encore d’article dans le wiki.',
  },

  exerciseForm: {
    createTitle: 'Nouvel exercice',
    editTitle: 'Modifier',

    nameLabel: 'Nom',
    namePlaceholder: 'Presse à cuisses inclinée',
    muscleLabel: 'Muscle principal',
    equipmentLabel: 'Matériel',
    movementPatternLabel: 'Famille de mouvement',
    movementPatternNone: 'Aucune',
    measurementLabel: 'Ce que tu saisis',
    /**
     * Le pluriel est le sujet : une traction en prise neutre travaille le dos
     * **et** les biceps, et le formulaire n'en acceptait qu'un seul — remonté
     * du téléphone, en ces termes.
     */
    secondaryMusclesLabel: 'Muscles secondaires',
    secondaryMusclesHint:
      'Ce que le mouvement sollicite aussi. Sert au schéma musculaire et à l’équilibre des séances.',
    secondaryMusclesNone: 'Aucun',
    secondaryMusclesCount: '{count} muscles',
    bodyweightFactorLabel: 'Part du poids du corps',
    bodyweightFactorHint: 'Optionnel. 70 % pour des pompes, 100 % pour des tractions.',
    bodyweightFactorError: 'Plus de 0 et jusqu’à 100 %.',
    bodyweightFactorDefault: '100',
    unilateralLabel: 'Unilatéral',
    unilateralHint: 'Un côté à la fois : presse unilatérale, curl marteau alterné.',

    submitCreate: 'Créer l’exercice',
    submitSave: 'Enregistrer',
  },

  knowledge: {
    title: 'Base de preuves',
    evidenceOnlyLabel: 'Extraits seulement',
    intro:
      'Pose une question pour retrouver des passages du corpus embarqué. FitTrack affiche les sources trouvées sans rédiger de conseil à leur place.',
    uncalibratedNotice:
      'Aucun seuil de réponse sûre n’est encore validé : les résultats sont des pistes à vérifier, pas une réponse.',
    queryLabel: 'Ta question',
    queryPlaceholder: 'Ex. : l’EMG prédit-elle l’hypertrophie ?',
    searchAction: 'Chercher dans les preuves',
    idleHint: 'La recherche reste sur cet appareil et fonctionne sans réseau.',
    emptyQueryTitle: 'Écris une question',
    emptyQueryBody: 'Quelques mots précis suffisent pour parcourir le corpus.',
    refusalLabel: 'Refus',
    noEvidenceTitle: 'Aucune preuve lexicale retrouvée',
    noEvidenceBody:
      'Le corpus embarqué ne contient aucun passage avec les termes recherchés. FitTrack ne complète pas les blancs.',
    resultsTitle: 'Passages retrouvés',
    resultCountOne: '{count} preuve',
    resultCountMany: '{count} preuves',
    proofNumber: 'Preuve {rank}',
    exactQuote: 'Citation exacte',
    limitTitle: 'Ce que cet écran ne fait pas',
    limitBody:
      'Il ne pose ni diagnostic, ni programme personnalisé, ni conclusion médicale. Un extrait peut être exact tout en étant insuffisant pour ton cas.',
    status: {
      unqualified: 'Cadre non qualifié',
      absenceOfEvidence: 'Absence de preuve',
      established: 'Établi dans le corpus',
      establishedDirection: 'Direction établie',
      mechanisticOnly: 'Mécanistique seulement',
      practiceOnly: 'Pratique seulement',
      probable: 'Probable',
      refuted: 'Réfuté',
      uncertain: 'Incertain',
    },

    /**
     * Le wiki. L'écran de recherche répond à « où est-ce écrit ? » ; celui-ci
     * répond à « qu'est-ce qu'il y a là-dedans ? ». Aucun libellé ne promet une
     * réponse : on parcourt, on lit, on remonte à la source.
     */
    wiki: {
      browseTitle: 'Parcourir le corpus',
      browseIntro:
        'Les documents embarqués, dans l’ordre où ils ont été écrits. Rien n’est rédigé ici : chaque passage vient d’un document source, à l’octet près.',
      sectionCountOne: '{count} section',
      sectionCountMany: '{count} sections',
      passageCountOne: '{count} passage',
      passageCountMany: '{count} passages',
      backToBrowse: 'Sommaire',
      notFoundTitle: 'Section introuvable',
      notFoundBody:
        'Cette adresse ne correspond à aucune section du corpus embarqué. Reviens au sommaire pour parcourir ce qui existe.',
      passageNumber: 'Passage {rank}',
      readInSection: 'Lire dans sa section',
      questionsEntry: 'Partir d’une question',
      questionsTitle: 'Questions',
      questionsIntro:
        'Des questions écrites par un pratiquant avant toute recherche. Elles sont classées selon ce que le corpus permet d’en faire, pas selon leur intérêt.',
      coveredTitle: 'Ce que le corpus documente',
      coveredIntro:
        'Chaque question mène aux passages qui la concernent. À toi de lire et de juger : FitTrack ne conclut pas à ta place.',
      uncoveredTitle: 'Ce que le corpus ne documente pas',
      uncoveredIntro:
        'Ces questions n’ont pas de réponse dans les documents embarqués. Elles sont listées plutôt que cachées : une page absente se dit, elle ne se devine pas.',
      uncoveredBadge: 'Hors corpus',
    },

    /**
     * Le wiki rédigé. Il remplace le routage par recherche : on entre par une
     * famille, on lit un article, et chaque paragraphe factuel dit d'où il
     * vient. Aucun libellé ne promet une réponse à une question libre.
     */
    article: {
      browseTitle: 'Le wiki',
      browseIntro:
        'Six familles, rédigées à partir du corpus embarqué. Chaque paragraphe factuel cite la source qui le porte ; rien n’est déduit d’un nom d’exercice.',
      familyMuscles: 'Comprendre les muscles',
      familyMovements: 'Comprendre les mouvements',
      familyExerciseChoice: 'Choisir et comparer les exercices',
      familyProgramming: 'Programmer l’entraînement',
      familyClinical: 'Tolérance et clinique',
      familyMethod: 'Méthode et lecture des preuves',
      articleCountOne: '{count} article',
      articleCountMany: '{count} articles',
      notFoundTitle: 'Article introuvable',
      notFoundBody:
        'Cette adresse ne correspond à aucun article du wiki embarqué. Reviens au sommaire pour parcourir ce qui existe.',
      unreviewedLabel: 'Non relu',
      unreviewedBody:
        'Matière non vérifiée ligne par ligne ; le remaniement éditorial ne vaut pas validation scientifique.',
      sourcesLabel: 'Sources',
      sourcesCount: '{count} affirmations',
      editorialLabel: 'Fil éditorial',
      searchTitle: 'Chercher dans tout le corpus',
      searchIntro:
        'Un raccourci facultatif, sans promesse de réponse : il retrouve des passages contenant tes mots, il ne décide pas s’ils répondent.',
    },

    /**
     * Le volet programmation. Il vient d'un document à 79 % tabulaire, dont les
     * tableaux avaient été extraits de façon déterministe en 2026-08 et n'étaient
     * consommés par rien. Chaque ligne est une fiche, pas une phrase — et aucune
     * n'a été relue par un humain, ce que le bandeau dit sans détour.
     */
    programming: {
      title: 'Programmation',
      entry: 'Volume, fréquence, deload…',
      intro:
        'Volume, fréquence, tempo, ordre des exercices, deload, progression. Chaque ligne vient d’un tableau du document source : affirmation, niveau de confiance, population étudiée, type de preuve, contradictions et limites.',
      rowCount: '{count} fiches',
      unreviewedLabel: 'Non relu',
      unreviewedBody:
        'Ces fiches ont été extraites automatiquement des tableaux du document, sans reformulation et sans modèle génératif. Elles sont donc fidèles au texte source, mais personne ne les a encore vérifiées une par une.',
      referencesTitle: 'Références citées',
    },
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
    knowledgeLink: 'Base de preuves',
    knowledgeHint: 'Retrouve des extraits du corpus embarqué, sans réponse inventée.',

    appearanceSection: 'Apparence',
    theme: 'Thème',
    themeDark: 'Sombre',
    themeLight: 'Clair',
    themeHint:
      'Sombre par défaut : une salle est mal éclairée et l’écran reste allumé une heure et demie.',

    announcerSection: 'Annonces',
    announcer: 'Annonces sonores',
    announcerSilence: 'Silence',
    announcerSounds: 'Sons',
    announcerVoice: 'Sons + voix',
    announcerVoiceOnly: 'Voix uniquement',
    announcerVoiceOnlyHint:
      'Garde les annonces utiles, sans cadence ni décompte des dernières répétitions.',
    announcerHint:
      'Un son à chaque série validée, un décompte sur les trois dernières secondes de repos, ' +
      'et une voix qui annonce la dernière série, un record, la fin de la séance.',
    announcerMusicHint:
      'Rien ne baisse le son de ta musique : les annonces se mélangent, elles ne prennent pas la main.',
    announcerVoiceReady: 'Voix installée : les annonces sont dites, pas seulement sonnées.',
    announcerVoiceMissing:
      'Aucune voix installée : seuls les sons se déclenchent. Les clips se fabriquent avec ' +
      'npm run voice:generate, puis se déposent dans public/voice.',
    announcerVoiceChecking: 'Vérification de la voix…',
    announcerEcho: 'Écho de haut-parleur',
    announcerEchoHint:
      'Les annonces sont diffusées comme dans une sono de hall : bande passante de haut-parleur, ' +
      'un écho de mur, une courte réverbération. C’est là qu’est le personnage — sans ça, ' +
      'c’est un mémo vocal. Les tics du décompte, eux, restent secs.',

    trainingSection: 'Entraînement',

    notificationsSection: 'Notifications',
    notificationsRest: 'Fin de repos',
    notificationsRestHint: 'Sonne quand le minuteur arrive à zéro, écran éteint.',
    notificationsRecords: 'Records battus',
    notificationsRecordsHint:
      'Écrit le record dans les notifications, sans un bruit : la séance l’a déjà annoncé.',
    notificationsReminders: 'Rappels d’entraînement',
    notificationsRemindersHint: 'Aux jours et à l’heure que tu choisis.',
    notificationsOn: 'Oui',
    notificationsOff: 'Non',
    notificationsDays: 'Jours de rappel',
    notificationsTime: 'Heure du rappel',
    notificationsNoDay: 'Aucun jour coché : rien ne sonnera tant qu’il en manque un.',
    notificationsNext: 'Prochain rappel : {date}.',
    notificationsAndroidHint:
      'Ces trois notifications sont posées par l’application Android. Dans un navigateur, ' +
      'seule l’app ouverte peut sonner.',

    effortSection: 'Effort et fatigue',
    effortPromptTitle: 'Demander l’effort après chaque série',
    effortPromptHint:
      'Une bande de quatre touches sous la série validée. Elle allonge le repos quand ça ' +
      'a été dur — 15, 30 ou 45 secondes de plus. L’ignorer ne coûte rien : elle s’efface seule.',
    effortPromptOn: 'Oui',
    effortPromptOff: 'Non',
    effortTempoHint:
      'La cadence de série s’allonge d’elle-même avec la fatigue : un quart de seconde par ' +
      'série déjà faite, une demi-seconde sur la dernière, une demi-seconde après trois ' +
      'quarts d’heure de séance — 5 secondes par répétition au maximum.',
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
    recordRepairTitle: 'Recalcul des records',
    recordRepairHint:
      'À utiliser uniquement si certains records semblent absents ou incorrects. Tes séances et tes séries ne sont jamais modifiées.',
    recordRepairAction: 'Recalculer tous les records',
    recordRepairWorking: 'Recalcul en cours…',
    recordRepairConfirmTitle: 'Recalculer tous les records',
    recordRepairConfirmBody:
      'Tous les records seront recalculés depuis les séances enregistrées. Tes séances et tes séries restent intactes.',
    recordRepairConfirmAction: 'Lancer le recalcul',
    recordRepairDone:
      'Recalcul terminé : ajouts : {created} · corrections : {updated} · anciens jalons retirés : {deleted}.',
    recordRepairFailed: 'Les records n’ont pas pu être recalculés. Tu peux réessayer.',
    repairStatusCurrent: 'À jour',
    repairStatusStale: 'Recalcul nécessaire',

    dataSection: 'Données et sauvegardes',
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
    debugLink: 'Dépannage et données',
    debugHint: 'État des records, historique, catalogue et stockage.',

    /**
     * La sauvegarde complète. Elle vit à côté du CSV et pas à sa place : le CSV
     * est l'historique dans un format que d'autres outils lisent, celle-ci est
     * tout le reste avec — routines jamais faites, programmes, records,
     * journal du coach, réglages, préférences — dans un format que seule
     * FitTrack relit.
     */
    backupSection: 'Sauvegarde complète',
    backupExportLink: 'Exporter tout le compte (JSON)',
    backupExportHint:
      'Séances, routines, programmes, records, réglages et préférences : tout ce que contient l’app, dans un fichier qu’elle sait relire.',
    backupExportTitle: 'Sauvegarde complète FitTrack',
    backupExportDownloaded: 'Sauvegarde téléchargée.',
    backupExportFailed: 'La sauvegarde n’a pas pu être enregistrée.',
    backupImportLink: 'Restaurer une sauvegarde',
    backupImportHint:
      'Remplace tout le contenu de l’app par celui du fichier. À faire sur un téléphone neuf, ou après une perte.',
    restoreConfirmTitle: 'Restaurer cette sauvegarde ?',
    // Une liste plutôt qu'une phrase : « 1 séances » se lit mal, et un fichier
    // à une seule séance est exactement le cas où on relit deux fois.
    restoreConfirmBody:
      'Contenu du fichier — séances : {workouts}, routines : {routines}, exercices : {exercises}, records : {records}. Tout ce que contient l’app aujourd’hui sera remplacé.',
    restoreConfirmAction: 'Tout remplacer',
    restoreDone: 'Sauvegarde restaurée. L’app se recharge.',
    restoreFailed: 'La restauration a échoué : rien n’a été modifié.',
    restoreErrorUnreadable: 'Le fichier n’a pas pu être lu.',
    restoreErrorNotJson: 'Ce fichier n’est pas une sauvegarde FitTrack (JSON attendu).',
    restoreErrorNotBackup: 'Ce fichier n’est pas une sauvegarde FitTrack.',
    restoreErrorVersion:
      'Cette sauvegarde vient d’une version plus récente de l’app. Mets l’app à jour avant de la restaurer.',
    restoreErrorEmpty: 'Cette sauvegarde est vide : rien n’a été remplacé.',

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
    repairLink: 'Mettre à jour les anciennes séances',
    /** Au pluriel depuis que l’instantané fige aussi les muscles secondaires. */
    repairHint:
      'Remplace le nom, les muscles, le matériel et le type de mesure enregistrés par les informations actuelles de la bibliothèque.',
    repairConfirmTitle: 'Mettre à jour les anciennes séances',
    repairConfirmBody:
      '{count} exercices de séance reprendront les informations actuelles de la bibliothèque. Les charges et les répétitions resteront intactes.',
    repairConfirmAction: 'Appliquer les mises à jour',
    repairDone: '{repaired} exercices de séance mis à jour.',
    repairDoneOne: '1 exercice de séance mis à jour.',
    repairDoneNone: 'Historique déjà à jour.',
    repairPreviewLoading: 'Analyse de l’historique…',
    repairPreviewCurrent: 'Historique déjà à jour',
    repairPreviewChanges: '{count} exercices de séance à mettre à jour',
    repairPreviewDetails:
      'Muscles : {muscles} · noms : {names} · matériels : {equipment} · types de mesure : {measurements}',
    repairFailed: 'Les anciennes séances n’ont pas pu être mises à jour. Tu peux réessayer.',
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
    title: 'Dépannage et données',

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
    reseed: 'Restaurer le catalogue d’exercices',
    reseedHint:
      'Ajoute les exercices officiels manquants et restaure leur classification musculaire. Tes exercices personnalisés, notes et temps de repos sont conservés.',
    reseedDone: 'Catalogue restauré.',
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
    seedFailed:
      'Le catalogue d’exercices n’a pas pu être chargé. Tes données sont intactes, le reste de l’app fonctionne.',
    dismiss: 'Masquer',
    consoleQuadriceps: '[ OK ] quadriceps.service active',
    consoleCore: '[ OK ] core.stability mounted',
    consoleEgo: '[ WARN ] ego-lifting detected',
    consoleExcuses: '[ FAIL ] excuses.mount: permission denied',
    consolePrompt: 'root@fittrack:~#',
    consoleCommand: 'progressive_overload = true',
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

    exportImage: 'Exporter en image',
    exportImageFooter: 'FitTrack · exporté le {date}',
    exportImageShared: 'Image partagée.',
    exportImageDownloaded: 'Image téléchargée.',
    exportImageCancelled: '',
    exportImageFailed: 'L’image n’a pas pu être créée.',

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
  monthly: {
    title: 'Rapport mensuel',
    link: 'Rapport mensuel',
    subtitle: 'Le résumé d’un mois civil, comparé au précédent',
    monthSheetTitle: 'Mois',
    empty: 'Aucune séance enregistrée : le premier rapport arrivera avec la première séance.',
    emptyMonth: 'Aucune séance ce mois-ci.',
    summarySection: 'Le mois',
    sessions: 'Séances',
    activeDays: 'Jours d’entraînement',
    sets: 'Séries de travail',
    reps: 'Répétitions',
    tonnage: 'Tonnage',
    duration: 'Temps de séance',
    exercisesSection: 'Ce qui a le plus pesé',
    exerciseReading: '{tonnage} · {sets}',
    exerciseSessions: '{count} séances',
    exerciseSession: '1 séance',
    comparedTo: 'Comparé à {month}.',
    noPrevious: 'Premier mois enregistré : il n’y a rien avant lui à comparer.',
    deltaSame: '=',
  },

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
   * La feuille ouverte par un doigt sur le corps dessiné, et la ligne qui dit
   * qu'on peut le toucher. **Partagée, et pas rangée sous `home`** : le même
   * geste existe sur l'accueil et sur une séance du Journal, et deux copies du
   * même texte finissent toujours par diverger sur une seule des deux.
   */
  muscleSheet: {
    /**
     * Le dessin ne dit pas qu'on peut le toucher — un corps humain ne ressemble
     * pas à un bouton. Une ligne sous la carte, et une seule : la découverte se
     * fait une fois, la ligne se lit toute la vie de l'écran.
     */
    tapHint: 'Touche un muscle pour voir les exercices',
    /** Le titre de la feuille est le nom du groupe ; ceci en est le sous-titre. */
    count: '{count} exercices du catalogue',
    countOne: '1 exercice du catalogue',
    empty: 'Aucun exercice du catalogue ne cible ce muscle.',
    /**
     * Trois muscles sont dessinés sans qu'aucun groupe du catalogue ne les
     * nomme — psoas, dentelé, jambier antérieur. Le doigt tombera dessus : il a
     * droit à une explication, pas à un tap qui ne fait rien.
     */
    unknown: 'Muscle hors catalogue',
    unknownBody:
      'Ce muscle est dessiné mais le catalogue ne le nomme pas : aucun exercice ne peut le cibler.',
    all: 'Voir dans le catalogue',
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

  tutorial: {
    pageHelp: 'Aide sur cette page',
    tourLabel: 'Visite guidée',
    helpTitle: 'Aide',
    stepCounter: 'Visite · {index} / {count}',
    introTitle: 'Prise en main',
    readText: 'Lire le texte',
    collapseText: 'Réduire',
    skip: 'Passer',
    previous: 'Précédent',
    next: 'Suivant',
    finish: 'Terminer',
    start: 'Commencer',
    promptBody:
      'Découvrez l’essentiel de FitTrack en moins de deux minutes trente. La visite utilise la voix uniquement pendant la présentation.',
    promptReplay:
      'Vous pourrez la relancer à tout moment avec le point d’interrogation dans l’en-tête.',
    explainPage: 'Expliquer cette page · {topic}',
    explainDuration: 'Environ vingt secondes.',
    restartFull: 'Recommencer la visite complète',
    fullDuration: 'Moins de deux minutes trente.',
    busyHint: 'Disponible dès la fin du décompte en cours.',
    voiceChoiceTitle: 'Guidage vocal',
    currentMode: 'Mode actuel : {mode}',
    modeVoice: 'Voix et sons',
    modeVoiceHint: 'Guidage complet pendant la séance.',
    modeSounds: 'Sons uniquement',
    modeSoundsHint: 'Impacts, cadence et validations, sans parole.',
    modeVoiceOnly: 'Voix uniquement',
    modeVoiceOnlyHint: 'Les annonces utiles, sans le battement des répétitions.',
    modeSilence: 'Silence',
    modeSilenceHint: 'Aucun son produit par FitTrack.',
    offScreenNotice:
      'Cet écran n’existe que pendant une séance : la visite le décrit sans l’ouvrir.',

    hud: {
      counter: '{index} / {count}',
      continue: 'Continuer',
      readDetail: 'Lire le détail',
      hideDetail: 'Masquer le détail',
      quit: 'Quitter le guide',
      retry: 'Réessayer',
      loadingTarget: 'Recherche de la commande sur cet écran…',
      stuck: 'La commande n’est pas apparue sur cet écran.',
    },

    history: {
      find: { title: 'Retrouver une séance' },
      edit: { title: 'Corriger une séance' },
      share: { title: 'Sortir une séance de l’app' },
      import: { title: 'Reprendre un historique Hevy' },
      calendarView: {
        instruction: 'Passe en vue Calendrier.',
        detail: 'Le Journal liste les séances, le Calendrier les situe.',
      },
      pickDay: {
        instruction: 'Touche un jour où il y a eu une séance.',
        detail: 'Les jours d’entraînement sont marqués.',
      },
      filterExercise: {
        instruction: 'Filtre par exercice.',
        detail: 'Le filtre s’applique au Journal comme au Calendrier.',
      },
      openWorkout: {
        instruction: 'Ouvre la séance.',
        detail: 'Elle s’ouvre en lecture : rien n’est modifié.',
      },
      openActions: {
        instruction: 'Ouvre le menu Actions de la séance.',
        detail: 'Tu y trouves Modifier, Partager et Supprimer.',
      },
      openEdit: {
        instruction: 'Ouvre Modifier.',
        detail: 'Un brouillon s’ouvre : la séance enregistrée ne bouge pas encore.',
      },
      saveEdit: {
        instruction: 'Enregistre la séance avec Enregistrer.',
        detail:
          'Enregistrer écrase la séance. Les séries retirées du brouillon sont supprimées, et les records sont recalculés.',
      },
      shareActions: {
        instruction: 'Rouvre le menu Actions de la séance.',
        detail: 'Partager et Supprimer y vivent.',
      },
      shareAction: {
        instruction: 'Choisis Partager.',
        detail:
          'Il produit un texte lisible de la séance. Rien ne quitte le téléphone tant que tu n’as pas choisi où l’envoyer.',
      },
      deleteLivesHere: {
        instruction: 'La même feuille porte Supprimer.',
        detail:
          'Il efface la séance de l’historique et des records. Le guide te montre où il vit et n’y touche pas.',
      },
      openImport: {
        instruction: 'Ouvre Importer depuis Hevy.',
        detail: 'Le parcours s’ouvre, sans lire de fichier.',
      },
      chooseFile: {
        instruction: 'Choisis le CSV.',
        detail:
          'Le fichier attendu est workout_data.csv, l’export Hevy. Rien n’est écrit à la lecture.',
      },
      review: {
        instruction: 'Passe à la revue avec Continuer.',
        detail: 'Les exercices que FitTrack ne reconnaît pas doivent d’abord être associés.',
      },
      yoursToPress: {
        instruction: 'Importer écrit toutes les séances d’un coup.',
        detail:
          'Une seule transaction — tout ou rien. C’est le geste le plus lourd de l’app, et il t’appartient.',
      },
    },

    workout: {
      compose: { title: 'Allonger la séance en cours' },
      setType: { title: 'Dire ce qu’est une série' },
      effort: { title: 'Noter l’effort d’une série' },
      plates: { title: 'Ce qu’il faut mettre sur la barre' },
      warmup: { title: 'Monter en charge avant la série' },
      pace: { title: 'Lancer et arrêter la cadence' },
      holdSides: { title: 'Un maintien, deux côtés' },
      deload: { title: 'Alléger une séance qui ne passe pas' },
      addSet: {
        instruction: 'Ajoute une série au pied de la carte.',
        detail:
          'Elle reprend les valeurs de la précédente. Aucune limite de nombre, ici comme partout.',
      },
      addExercise: {
        instruction: 'Ouvre Ajouter un exercice, sous la liste.',
        detail:
          'Le sélecteur s’ouvre sur son propre écran ; la séance en cours n’est pas quittée et rien n’est ajouté tant que tu n’as pas confirmé.',
      },
      setMenu: {
        instruction: 'Touche le numéro de la première série.',
        detail: 'Le numéro est un bouton : il ouvre le menu de cette série-là.',
      },
      chooseType: {
        instruction: 'Ouvre Type de série et choisis autre chose que Normale.',
        detail:
          'Le type décide si la série compte dans le volume et dans les records. Un échauffement ne compte ni dans l’un ni dans l’autre.',
      },
      completeSet: {
        instruction: 'Valide la première série.',
        detail: 'Elle est écrite en base immédiatement, pas à la fin de la séance.',
      },
      rpe: {
        instruction: 'Réponds à la bande Effort perçu.',
        detail:
          'Elle allonge le repos quand ça a été dur. L’ignorer ne coûte rien : elle s’efface seule.',
      },
      openPlates: {
        instruction: 'Ouvre Plaques à charger dans le bandeau de la carte.',
        detail:
          'Elle n’apparaît que sur un exercice à barre ou à disques, et seulement quand une charge est saisie.',
      },
      availablePlates: {
        instruction: 'Déplie Plaques disponibles et retire celles que tu n’as pas.',
        detail:
          'Le calcul ne propose plus que ce qui existe dans ta salle. Ce réglage est global, il ne touche pas cette série.',
      },
      exerciseMenu: {
        instruction: 'Ouvre le menu de l’exercice, à droite de son nom.',
        detail: 'Il porte ce qui ne tient pas sur la carte : cadence, échauffement, notes.',
      },
      openWarmup: {
        instruction: 'Choisis Calculer l’échauffement.',
        detail:
          'L’action n’existe que sur un exercice à charge : sans charge de travail, il n’y a pas de pourcentage à calculer.',
      },
      insertWarmup: {
        instruction: 'Appuie sur Insérer les séries.',
        detail:
          'Elles sont ajoutées avant tes séries de travail, marquées Échauffement, donc hors volume et hors records.',
      },
      openPace: {
        instruction: 'Ouvre Cadence dans le bandeau de la carte.',
        detail: 'La feuille montre le tempo en vigueur et ce qu’il donne sur la prochaine série.',
      },
      startPace: {
        instruction: 'Appuie sur Lancer la cadence.',
        detail:
          'Dix secondes pour te mettre en place, puis un battement par répétition et le décompte des trois dernières.',
      },
      stopPace: {
        instruction: 'Arrête la cadence.',
        detail:
          'Le carré du bandeau l’arrête sans ouvrir la feuille. Valider la série l’arrête aussi.',
      },
      openHold: {
        instruction: 'Ouvre Chrono dans le bandeau de la carte.',
        detail:
          'Sur un exercice mesuré en durée, l’horloge n’est pas un tempo : c’est elle qui écrit la valeur de la série.',
      },
      startHold: {
        instruction: 'Appuie sur Démarrer le chrono.',
        detail:
          'Dix secondes pour te mettre en position. Elles ne sont pas comptées dans la durée tenue.',
      },
      firstSide: {
        instruction: 'Premier côté fini : appuie sur la coche.',
        detail:
          'Elle ferme le côté, pas la série. Rien n’est enregistré, aucun repos ne démarre, et dix secondes courent pour changer de côté.',
      },
      secondSide: {
        instruction: 'Le décompte fini, la même coche ferme la série.',
        detail:
          'Une ligne représente les deux côtés : une saisie, une validation, un enregistrement. Verrouiller l’écran entre les deux ne perd rien.',
      },
      openDeload: {
        instruction: 'Active le deload à 80 %.',
        detail:
          'Il ne s’active pas seul : la feuille demande confirmation avant de toucher quoi que ce soit.',
      },
      applyDeload: {
        instruction: 'Appliquer réécrit les séries restantes.',
        detail:
          'Toutes passent à 80 %, arrondies à 2,5 kg. Le guide te montre où vit ce geste et n’y touche pas.',
      },
    },

    settings: {
      announcer: { title: 'Régler la voix du guidage' },
      notifications: { title: 'Quand l’app a le droit de parler' },
      mode: {
        instruction: 'Choisis un mode de guidage.',
        detail:
          'Chaque choix se fait entendre aussitôt. Silence coupe tout, y compris la ligne d’écho juste en dessous : le guide attend un mode qui parle ou qui sonne.',
      },
      echo: {
        instruction: 'Règle l’écho.',
        detail:
          'Il donne à la voix le grain d’une annonce de salle. Au casque à six heures du matin, l’éteindre change tout.',
      },
      reminders: {
        instruction: 'Allume Rappels d’entraînement.',
        detail:
          'C’est la seule des trois qui sonne un jour où tu n’as pas ouvert l’app. Le même interrupteur l’éteint.',
      },
      days: {
        instruction: 'Choisis les jours du rappel.',
        detail:
          'La semaine et l’heure n’apparaissent qu’une fois les rappels allumés. Il n’y a rien à enregistrer : chaque réglage est écrit au moment où tu le touches.',
      },
    },

    home: {
      body: { title: 'Le corps que l’Accueil dessine' },
      weight: { title: 'Ta pesée du jour' },
      muscleMap: {
        instruction: 'Touche un muscle sur le dessin.',
        detail:
          'Il montre ce que tu as travaillé sur les douze dernières semaines. Ce n’est pas une image : chaque muscle est une question posée au catalogue.',
      },
      muscleSheet: {
        instruction: 'La feuille liste les exercices de ce muscle.',
        detail:
          'Voir dans le catalogue ouvre la bibliothèque déjà filtrée sur lui. Rien n’est modifié en passant par ici.',
      },
      openWeight: {
        instruction: 'Ouvre la tuile poids du jour.',
        detail: 'Elle affiche ta dernière pesée, et un tiret tant qu’il n’y en a aucune.',
      },
      saveWeight: {
        instruction: 'Enregistrer écrit la pesée du jour.',
        detail:
          'Le guide ne la remplit pas à ta place : un poids de corps est une mesure réelle, pas une démonstration.',
      },
    },

    knowledge: {
      search: { title: 'Chercher dans les preuves' },
      learn: { title: 'Apprendre à programmer' },
      query: {
        instruction: 'Pose une question, puis lance Chercher dans les preuves.',
        detail:
          'La recherche est lexicale et tourne sur l’appareil : elle ne rend que les passages qui portent tes mots, et affiche un refus quand il n’y en a aucun.',
      },
      openResult: {
        instruction: 'Ouvre la première preuve avec Lire dans sa section.',
        detail:
          'Un extrait seul ne dit pas ce qu’il y avait autour. Le lien remet le passage dans son texte d’origine.',
      },
      openPath: {
        instruction: 'Ouvre Apprendre à programmer.',
        detail:
          'Quatorze articles du Guide, rangés dans l’ordre où ils s’éclairent. Le parcours explique ; il n’écrit aucun programme.',
      },
      markRead: {
        instruction: 'Le bouton À lire sert à suivre ta progression.',
        detail:
          'C’est toi qui déclares avoir lu, et le guide n’y touche pas. Le suivi reste sur cet appareil et se décoche aussi bien qu’il se coche.',
      },
      openStep: {
        instruction: 'Ouvre la première étape avec Lire cette étape.',
        detail:
          'Progression et autorégulation : le seul paramètre dont l’absence annule les autres.',
      },
      sources: {
        instruction: 'Déplie Sources sous un passage.',
        detail:
          'Chaque affirmation porte de quoi la vérifier. Il y a un bloc Sources par affirmation, pas un seul pour l’article.',
      },
    },

    analytics: {
      read: { title: 'Lire tes analyses' },
      share: { title: 'Sortir un graphique de l’app' },
      openWeekly: {
        instruction: 'Ouvre Séances par semaine.',
        detail:
          'Les analyses ne se remplissent qu’avec des séances terminées : sans historique, cette ligne n’est même pas là.',
      },
      period: {
        instruction: 'Ouvre le filtre de période et choisis-en une autre.',
        detail:
          'Douze semaines par défaut, et rien ne le dit à l’écran. Le filtre ne change que l’affichage : aucune séance n’est touchée.',
      },
      openWeeklyForShare: {
        instruction: 'Ouvre Séances par semaine.',
        detail:
          'Exporter en image n’apparaît que sous un graphique tracé. Sans séance sur la période, il n’y a rien à sortir.',
      },
      exportImage: {
        instruction: 'Appuie sur Exporter en image.',
        detail:
          'L’image est fabriquée sur l’appareil. Selon le téléphone, elle part ensuite dans le partage du système ou dans les téléchargements.',
      },
    },

    exercises: {
      find: { title: 'Trouver le bon exercice' },
      create: { title: 'Créer un exercice à toi' },
      search: {
        instruction: 'Cherche un exercice par son nom.',
        detail: 'Les accents et la casse sont ignorés : « developpe » trouve Développé couché.',
      },
      filterMuscle: {
        instruction: 'Ouvre Muscle et choisis un groupe.',
        detail:
          'Le filtre s’ajoute à la recherche au lieu de la remplacer. Le compteur au-dessus de la liste dit combien de lignes restent.',
      },
      filterEquipment: {
        instruction: 'Ouvre Matériel et choisis un équipement.',
        detail:
          'Les trois critères se cumulent. Quand plus rien ne correspond, Retirer les filtres enlève les deux et garde la recherche.',
      },
      openForm: {
        instruction: 'Ouvre Nouvel exercice, le + en haut.',
        detail:
          'Rien n’est créé à l’ouverture : le formulaire reste un brouillon tant que tu n’enregistres pas.',
      },
      name: {
        instruction: 'Donne-lui un nom.',
        detail:
          'C’est le seul champ obligatoire : Créer l’exercice reste éteint tant qu’il est vide.',
      },
      measurement: {
        instruction: 'Ouvre Ce que tu saisis et choisis la mesure.',
        detail:
          'Elle décide des champs de saisie pendant la séance : poids et répétitions, durée seule, distance et durée.',
      },
      unilateral: {
        instruction: 'Réponds à Unilatéral.',
        detail:
          'Oui quand le mouvement se fait un côté à la fois. L’une ou l’autre réponse convient : le guide te montre où la question se pose.',
      },
      save: {
        instruction: 'Appuie sur Créer l’exercice.',
        detail:
          'Il rejoint le catalogue avec les autres, sans limite de nombre, et s’ouvre aussitôt sur sa fiche.',
      },
    },

    program: {
      title: 'Construire et suivre un programme',
      whatIsABlock: {
        instruction: 'Une routine décrit une séance.',
        detail: 'Un programme organise plusieurs routines dans le temps, en semaines.',
      },
      openWizard: {
        instruction: 'Ouvre l’assistant par le +.',
        detail: 'Il se déroule en trois étapes : Cadre, Split, Semaines.',
      },
      nameBlock: {
        instruction: 'Saisis le Nom du bloc.',
        detail: 'Rien n’est encore enregistré à ce stade.',
      },
      startDate: {
        instruction: 'Choisis le Lundi de départ.',
        detail: 'Les semaines se comptent du lundi au dimanche : c’est pour ça que c’est un lundi.',
      },
      duration: {
        instruction: 'Choisis la Durée.',
        detail: 'Elle va de 4 à 12 semaines, et se modifie tant que le bloc est un brouillon.',
      },
      saveBasics: {
        instruction: 'Enregistre le cadre avec Continuer.',
        detail: 'Le brouillon existe alors vraiment : tu peux le quitter et y revenir.',
      },
      splitDay: {
        instruction: 'Choisis le Jour de la séance 1.',
        detail: 'Le split se répète chaque semaine du bloc.',
      },
      splitRoutine: {
        instruction: 'Choisis la Routine de la séance 1.',
        detail: 'La liste reprend les routines déjà créées.',
      },
      splitMore: {
        instruction: 'Ajouter une séance permet d’en poser d’autres.',
        detail: 'Une seule suffit pour comprendre : un bloc à une séance par semaine est valide.',
      },
      saveSplit: {
        instruction: 'Enregistre le split avec Continuer.',
        detail: 'Les séances de la semaine sont écrites dans le brouillon.',
      },
      recipe: {
        instruction: 'Applique une recette : Hypertrophie, Force ou Reprise.',
        detail: 'Elle pose une intention par semaine, plutôt que de les régler une à une.',
      },
      weekSheet: {
        instruction: 'Ouvre la première semaine.',
        detail: 'Tu y lis et règles sa phase et son niveau de charge.',
      },
      activate: {
        instruction: 'Active le bloc.',
        detail: 'Les semaines sont écrites. Un seul bloc est actif à la fois.',
      },
      readWeek: {
        instruction: 'L’Intention de la semaine décrit la semaine en cours.',
        detail: 'Elle porte la phase, le niveau, et ce que ça change aux charges.',
      },
      pickSession: {
        instruction: 'Sélectionne une séance dans La semaine.',
        detail: 'C’est cette séance que Démarrer lance.',
      },
      upcoming: {
        instruction: 'Les Semaines suivantes, repliées, montrent l’arc du bloc.',
        detail: 'Tu y vois la montée, puis la décharge.',
      },
      actionsMenu: {
        instruction: 'Ouvre le menu Options du bloc.',
        detail: 'Tu y trouves Modifier à partir de…, Décaler le bloc et Terminer le bloc.',
      },
      beforeStart: {
        instruction: 'Démarrer lance une vraie séance.',
        detail:
          'Les charges sont projetées par le niveau de la semaine. Le guide s’arrête ici et laisse ce geste.',
      },
    },

    campaign: {
      title: 'Ma première séance guidée',
      body: 'FitTrack ouvre chaque écran et attend ton geste. Rien n’est créé, rempli ni validé à ta place.',
      start: 'Commencer la découverte',
      later: 'Plus tard',

      prepare: { title: 'Préparer la séance découverte' },
      workout: { title: 'Ta première séance' },

      openCreate: {
        instruction: 'Ouvre le menu de création.',
        detail: 'Une routine est une séance que tu prépares une fois et que tu relances ensuite.',
      },
      createBlank: {
        instruction: 'Choisis Routine vide.',
        detail:
          'Elle est créée immédiatement : le nom et chaque modification sont enregistrés au fur et à mesure.',
      },
      name: {
        instruction: 'Nomme-la Séance découverte.',
        detail: 'Le nom sert à la retrouver dans ta liste. Tu peux le changer quand tu veux.',
      },
      openPicker: {
        instruction: 'Ouvre le catalogue d’exercices.',
        detail: 'Il contient les exercices fournis et ceux que tu créeras toi-même.',
      },
      search: {
        instruction: 'Cherche « curl ».',
        detail: 'La recherche filtre les 168 exercices sur le nom, sans distinguer les accents.',
      },
      curl: {
        instruction: 'Sélectionne Curl haltères.',
        detail:
          'Tu feras les répétitions avec les deux bras ensemble : une seule ligne et une seule validation.',
      },
      add: {
        instruction: 'Ajoute-le à la routine.',
        detail: 'La barre du bas n’apparaît qu’une fois quelque chose de sélectionné.',
      },
      secondSet: {
        instruction: 'Ajoute une deuxième série.',
        detail: 'Deux séries suffisent à voir ce qui se passe entre deux efforts : le repos.',
      },
      target: {
        instruction: 'Ouvre la première série et donne-lui une cible de répétitions.',
        detail:
          'La cible est une intention, pas une contrainte : pendant la séance tu saisiras ce que tu as réellement fait.',
      },
      rest: {
        instruction: 'Ouvre le menu de l’exercice et règle un repos.',
        detail:
          'Il démarre tout seul à chaque série validée, et reste ajustable pendant la séance.',
      },
      ready: {
        instruction: 'La routine est prête, et déjà enregistrée.',
        detail:
          'Le guide s’arrête ici. Il reprendra tout seul quand tu appuieras sur Démarrer — c’est à toi de choisir le moment.',
      },

      write: {
        instruction: 'Saisis la charge et les répétitions de la première série.',
        detail: 'Rien n’est encore enregistré comme fait : la saisie prépare la validation.',
      },
      validate: {
        instruction: 'Valide la série avec la coche.',
        detail:
          'C’est la coche qui écrit en base. Une séance interrompue à cet instant garderait cette série.',
      },
      restRail: {
        instruction: 'Le repos a démarré tout seul. Laisse-le finir.',
        detail:
          'Il tourne sur l’horloge du téléphone : il continue écran éteint, et même application fermée.',
      },
      secondEffort: {
        instruction: 'Fais la deuxième série, puis valide-la.',
        detail: 'Même geste que la première : saisir ce qui a été fait, puis la coche.',
      },
      finish: {
        instruction: 'Ouvre le bilan de la séance.',
        detail:
          'Rien n’est perdu : la séance existe déjà, le bilan sert à la relire avant de la ranger.',
      },
      save: {
        instruction: 'Enregistre la séance.',
        detail: 'Elle rejoint ton historique, et alimente records et progression.',
      },
      done: {
        instruction: 'C’est fini : tu as une séance derrière toi.',
        detail:
          'Historique garde ce que tu as fait, Progression ce que ça donne dans le temps. Le point d’interrogation ouvre l’aide de chaque écran.',
      },
    },

    recovery: {
      title: 'Séance toujours en cours',
      body: 'Cette séance a commencé il y a plus de douze heures. Choisis ce que tu veux en faire.',
      resume: 'Reprendre la séance',
      finish: 'Voir le bilan et terminer',
      discard: 'Abandonner la séance',
      discardTitle: 'Abandonner cette séance ?',
      discardBodyNone: 'Aucune série validée ne sera conservée.',
      discardBodyOne: 'La série validée ne sera pas conservée.',
      discardBody: '{count} séries validées ne seront pas conservées.',
      discardConfirm: 'Confirmer l’abandon',
    },

    mission: {
      label: 'Mission guidée',
      counter: 'Étape {index} sur {count}',
      dismiss: 'Passer cette mission',
      campaign: {
        title: 'Créer la séance découverte',
        instruction: 'Ouvre le menu de création, puis choisis Routine vide.',
        detail: 'Le nom et chaque modification sont enregistrés immédiatement.',
      },
      recovery: {
        title: 'Résoudre la séance en attente',
        instruction: 'Ouvre la séance en attente et choisis consciemment sa suite.',
        detail: 'FitTrack ne supprimera jamais cette séance automatiquement.',
      },
      routineCreate: {
        title: 'Créer une première routine',
        instruction: 'Ouvre le menu de création, puis choisis Nouvelle routine.',
        detail: 'Le nom et chaque modification sont enregistrés immédiatement.',
      },
      routineExercise: {
        title: 'Ajouter un exercice',
        instruction: 'Ajoute au moins un exercice à cette routine.',
        detail: 'Choisis un exercice que tu peux réellement effectuer maintenant.',
      },
      routineSet: {
        title: 'Préparer plusieurs séries',
        instruction: 'Ajoute une deuxième série au premier exercice.',
        detail: 'Elle permettra de voir le repos entre deux efforts.',
      },
      routineTargets: {
        title: 'Définir la série',
        instruction: 'Ouvre la première série et renseigne sa cible.',
        detail: 'Les champs proposés dépendent du type de mesure de l’exercice.',
      },
      routineRest: {
        title: 'Définir le repos',
        instruction: 'Ouvre les options de l’exercice et choisis un temps de repos.',
        detail: 'Ce repos démarrera après chaque série de travail compatible.',
      },
      routineStart: {
        title: 'Démarrer la routine',
        instruction: 'Démarre la séance depuis la barre d’action.',
        detail: 'Une seule séance peut être active à la fois.',
      },
      setInput: {
        title: 'Renseigner la première série',
        instruction: 'Renseigne les valeurs de la première série.',
        detail: 'S’il existe, touche le résultat précédent pour le reprendre en un geste.',
      },
      setValidate: {
        title: 'Valider la série',
        instruction: 'Touche la coche de la première série.',
        detail: 'La validation est écrite immédiatement sur cet appareil.',
      },
      rest: {
        title: 'Lire le repos',
        instruction: 'Laisse le minuteur atteindre la fin du repos.',
        detail: 'Le décompte reste fiable si tu quittes momentanément cet écran.',
      },
      workoutFinish: {
        title: 'Ouvrir le bilan',
        instruction: 'Quand ta séance est terminée, ouvre le bilan.',
        detail: 'Les séries non validées ne seront pas comptées.',
      },
      workoutSave: {
        title: 'Enregistrer la séance',
        instruction: 'Relis le bilan, puis enregistre la séance.',
        detail: 'Elle rejoindra immédiatement ton historique et tes analyses.',
      },
      backupExport: {
        title: 'Exporter une sauvegarde complète',
        instruction: 'Exporte une sauvegarde complète de FitTrack.',
        detail:
          'Le fichier contient tes séances, routines, exercices, réglages et progression du tutoriel.',
      },
      backupRestore: {
        title: 'Comprendre une restauration',
        instruction: 'Choisis un fichier de sauvegarde pour ouvrir sa confirmation.',
        detail:
          'Tu peux fermer la confirmation : cette mission ne demande pas de restaurer le fichier.',
      },
    },

    topic: {
      home: 'Accueil',
      routines: 'Routines',
      programs: 'Blocs',
      workout: 'Séance',
      coach: 'Coach',
      history: 'Historique',
      analytics: 'Progression',
      exercises: 'Exercices',
      settings: 'Réglages',
    },

    step: {
      intro: 'Un tour rapide des écrans essentiels avant ta première séance.',
      home: 'L’accueil te montre quoi lancer et où tu en es.',
      routines: 'Prépare tes séances, puis organise-les en blocs de plusieurs semaines.',
      programs: 'Un bloc étale tes routines sur plusieurs semaines, avec une intention.',
      workout: 'Renseigne charge et répétitions : la voix cadence, compte et relance.',
      coach: 'Le coach résume la séance et explique la prochaine progression.',
      history: 'Chaque séance terminée reste consultable et modifiable.',
      analytics: 'Suis tes records, ton volume, ta régularité et tes muscles.',
      exercises: 'Chaque exercice rassemble son historique et ses performances.',
      settings: 'Adapte la voix, les sons et le comportement de FitTrack.',
    },
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
