> Audit du 2026-11-21, fait sur la v2.18.0 avant la suppression du tutoriel et la refonte des Réglages. Les constats 1, 2, 3, 7 et 8 sont corrigés en v2.19.0 ; les autres sont la matière de la v3.0.

# Audit d'ergonomie générale de FitTrack (v2.18.0), 21/11/2026

Conditions : build de production servi par `vite preview` et piloté avec Playwright (Chromium), viewport 390 × 844,
`deviceScaleFactor` 1, tactile, thème sombre. Le retour Android est simulé par `history.back()`. Sur l'APK, il passe
par `androidBackDecision`, qui commence lui aussi par `navigate(-1)` dès qu'un historique existe : le comportement est
donc le même. Le tutoriel (« Passer », « ? ») et l'écran Réglages sont hors périmètre.

**Données.** La consigne parle d'un bouton « Réinjecter les données » : il n'existe pas. `debug.reseed`
(`src/i18n/fr.ts:2296`) est « Restaurer le catalogue d'exercices », qui ne crée aucune séance. J'ai donc rempli l'appli
par des gestes réels : 3 séances « Full-body » faites dans l'interface, puis l'import Hevy du fichier
`src/features/history/__fixtures__/hevy-workout-data-real-anonymized.csv` (6 séances de janvier 2024, 25 exercices).
Ensuite : un bloc créé, une routine vide créée et une séance historique ouverte en correction.

## Taps par parcours (mesurés)

| Parcours | Taps | Remarque |
|---|---|---|
| Premier jour → première série validée | 5 jusqu'à la séance, puis 3 taps + 2 saisies par série | Passer › Créer une routine › Partir d'un modèle › Full-body › Démarrer |
| Lancer la routine suggérée (accueil) | 1 | quand l'accueil propose quelque chose (voir constats 4 et 5) |
| Série suivante, 1re séance | 3 taps + 2 saisies | rien n'est repris de la série du dessus (constat 7) |
| Série, à partir de la 2e séance | 1 | valeurs fantômes de la séance précédente |
| Remplacer un exercice | 3 + saisie | ⋮ › Remplacer › recherche › choix |
| Finir | 2 | Terminer la séance › Enregistrer |
| Routine vide + 2 exercices | 6 + saisie, puis environ 5 par exercice pour avoir 3 séries ciblées | chaque exercice arrive avec 1 série « libre » |
| Créer un bloc (programme) | environ 12, sélecteur de date compris | date de départ vide par défaut |
| Corriger une série d'une séance passée | 6, plus le défilement d'une page de 10 000 px | Historique › séance › ⋮ › Modifier › … › Enregistrer |
| Progression d'un exercice | 2, plus un défilement dans une liste alphabétique | +1 (« Voir tout l'historique ») après une pause |
| Fiche d'un exercice | 2 + saisie | si la recherche le trouve (constat 1) |

---

## Les 10 constats qui comptent le plus

### 1. La recherche d'exercice rend 0 résultat dès qu'on tape deux mots, et propose alors de créer un doublon
- **Parcours** : Exercices, ajouter un exercice en séance ou à une routine, remplacer un exercice. Les quatre écrans
  utilisent le même `ExerciseBrowser`.
- **Ce qui se passe** : « squat » trouve 9 exercices, mais « squat barre », « couché haltères » et « tirage poulie »
  n'en trouvent aucun. L'écran affiche « Rien ne correspond — n'est ni au catalogue ni dans tes exercices » et un gros
  bouton orange « Créer « squat barre » ». La recherche est une sous-chaîne exacte : « Squat (barre, nuque) » ne contient
  pas « squat barre » à cause de la parenthèse.
- **Pourquoi ça gêne** : à la salle, on tape comme on parle (« couché haltères »). Le message affirme à tort que
  l'exercice n'existe pas, et l'action proposée crée un exercice personnalisé en double, avec un historique coupé en
  deux et des records séparés.
- **Correction** : découper la recherche en mots, garder les exercices qui contiennent tous les mots dans n'importe quel
  ordre, ignorer la ponctuation, puis trier par pertinence (nom qui commence par le mot) et par usage.
- **Effort** : petit.
- **Capture** : `shots/52-exercices-recherche-zero.png`
- **Code** : `src/data/repositories/exercises.ts:30` (`normalizeSearch`) et `:52-56` (filtre `includes`, puis tri
  alphabétique).

### 2. Le retour Android avec une feuille ouverte quitte l'écran au lieu de fermer la feuille
- **Parcours** : séance (options d'un exercice, options de la séance) et toutes les feuilles de l'appli.
- **Ce qui se passe** : en séance, on ouvre ⋮ sur le Squat puis on fait « retour ». La feuille ne se ferme pas :
  l'appli quitte l'écran de séance et revient à l'Accueil. La séance survit grâce à la barre « Séance en cours », mais
  on n'est plus devant ses séries.
- **Pourquoi ça gêne** : sur Android, « retour » est le geste réflexe pour fermer un menu, encore plus à une main. Cela
  arrive plusieurs fois par séance, sur l'écran le plus important, et il faut ensuite le retrouver.
- **Correction** : faire consommer le retour par une feuille ouverte avant toute navigation (une pile de feuilles lue
  par le gestionnaire `backButton`, ou une entrée d'historique poussée à l'ouverture).
- **Effort** : moyen.
- **Captures** : `shots/53-retour-android-feuille-ouverte.png` puis `shots/54-retour-android-apres.png`
- **Code** : `src/platform/NativeRuntimeBridge.tsx:121` et `src/platform/androidBack.ts:17-18`, qui ne voient pas les
  feuilles. `src/ui/Sheet.tsx` ne gère pas le retour.

### 3. Le minuteur de repos est petit et sort de l'écran dès qu'on passe à l'exercice suivant
- **Parcours** : séance, repos.
- **Ce qui se passe** : le décompte « Repos 1:59 » est écrit en 14 px dans l'en-tête de la carte de l'exercice qu'on
  vient de faire. Dès qu'on ouvre ou fait défiler jusqu'à l'exercice suivant, il remonte hors de l'écran : mesuré à
  `top = -15 px`. Les boutons −15 s / +15 s partent avec lui.
- **Pourquoi ça gêne** : le repos est l'information qu'on regarde le plus souvent pendant une séance, de loin, le
  téléphone posé sur un banc. Le signal sonore de fin existe, mais il ne remplace pas le coup d'œil « combien il me
  reste ».
- **Correction** : un bandeau de repos collant, en haut de l'écran de séance ou juste au-dessus de « Terminer la
  séance », avec de gros chiffres et les boutons ±15 s.
- **Effort** : moyen.
- **Captures** : `shots/09-seance-repos.png` et `shots/12-seance-repos-hors-champ.png`
- **Code** : `src/features/workout/WorkoutExerciseCard.tsx:333` (`RestStatus` dans l'en-tête de la carte) et
  `src/features/workout/RestRail.tsx:210` (`text-sm`).

### 4. Quand un bloc est actif mais qu'il n'y a pas de séance aujourd'hui, l'accueil n'a plus de bouton « Démarrer »
- **Parcours** : accueil, programme.
- **Ce qui se passe** : dès qu'un bloc est actif, la carte du programme remplace complètement la suggestion de routine.
  Si le bloc commence lundi, ou si les séances de la semaine sont faites, la carte affiche seulement « Le bloc commence
  le 23 novembre. Aucune séance ne démarre avant. » Il n'y a aucun bouton.
- **Pourquoi ça gêne** : on vient s'entraîner un samedi « hors plan » et l'accueil ne propose rien. Il faut
  Planifier › routine › Démarrer (3 taps) et savoir que c'est là.
- **Correction** : dans ces deux cas, afficher sous la carte du bloc la suggestion habituelle, ou un bouton secondaire
  « Lancer une autre routine ».
- **Effort** : petit.
- **Capture** : `shots/38-accueil-programme-actif.png`
- **Code** : `src/features/home/HomeScreen.tsx:84` (alternative stricte ProgramHeroCard / HomeSuggestionCard) et
  `src/features/programs/ProgramHeroCard.tsx:142` (bouton seulement si `pick.kind === 'session'`).

### 5. Dès qu'un dossier existe, l'accueil retire le bouton « Démarrer » et ouvre d'office « Choisir les dossiers »
- **Parcours** : accueil (après l'import Hevy, ou dès qu'on range une routine dans un dossier).
- **Ce qui se passe** : l'import crée de lui-même le dossier « Import Hevy — 21/11/2026 — Archivé ». À l'arrivée sur
  l'accueil, la carte « À lancer » affiche deux fois « Choisir les dossiers », sans aucune routine ni bouton, et une
  feuille s'ouvre sans avoir été demandée. Il faut cocher « Sans dossier » puis « Terminé », soit 2 taps, avant de
  retrouver « Démarrer ».
- **Pourquoi ça gêne** : un geste de rangement (créer un dossier) casse l'action n° 1 de l'appli. Le libellé ne dit pas
  pourquoi l'appli le demande.
- **Correction** : par défaut, suivre toutes les routines (ou celles hors dossier) et ne jamais bloquer la suggestion.
  Le choix des dossiers reste disponible derrière l'icône existante.
- **Effort** : petit.
- **Capture** : `shots/22-accueil-avec-donnees.png`
- **Code** : `src/data/repositories/home.ts:296` (`required: folders.length > 0 && validSelected.length === 0`) et
  `src/features/home/HomeSuggestionCard.tsx:81` (ouverture automatique).

### 6. Premier jour : aucune « séance libre », et « Créer une routine » ne crée rien
- **Parcours** : premier jour.
- **Ce qui se passe** : l'accueil vide n'offre qu'une action, « Créer une routine ». Elle mène à la liste vide des
  routines, et non à la création : il faut encore choisir « Routine vide » ou « Partir d'un modèle ». Il n'existe aucun
  moyen de démarrer une séance sans routine. `startWorkout(routineId, name)` et le libellé `workout.emptyName`
  (« Séance libre ») existent, mais aucun écran ne les appelle.
- **Pourquoi ça gêne** : le premier jour, on est déjà à la salle, et le seul chemin oblige à apprendre ce qu'est une
  « routine » et à la composer. Le cas revient chaque fois qu'on improvise une séance hors routine.
- **Correction** : ajouter un bouton secondaire « Séance libre » sur l'accueil, et faire ouvrir directement la feuille
  « Créer » (vide ou modèle) par « Créer une routine ».
- **Effort** : petit.
- **Captures** : `shots/02-premierjour-accueil-vide.png` et `shots/03-premierjour-creer-routine.png`
- **Code** : `src/features/home/HomeSuggestionCard.tsx:143` (`navigate('/routines')`) et
  `src/data/repositories/workoutLifecycle.ts:59` (`startWorkout` non branché).

### 7. Première séance (et tout nouvel exercice) : chaque série se ressaisit entièrement
- **Parcours** : séance, saisie des séries.
- **Ce qui se passe** : on valide la série 1 à 60 kg × 8. Les séries 2 et 3 restent vides, et leur coche est
  désactivée. Une série ajoutée par « Ajouter une série » reprend la charge mais pas les reps quand la cible est une
  fourchette (« 5 – 8 »), donc elle non plus ne se valide pas en un tap. Résultat : 3 taps et 2 saisies au clavier par
  série, soit environ 75 gestes pour les 15 séries du modèle Full-body.
- **Pourquoi ça gêne** : c'est la toute première impression de l'écran le plus important, au moment où l'on découvre
  l'appli, avec le clavier qui couvre la moitié de l'écran à chaque série. Le choix « ne jamais emprunter un autre
  rang » est délibéré, mais il coûte cher exactement là où il n'y a pas de séance précédente.
- **Correction** : quand une série n'a ni séance précédente ni cible, proposer en fantôme (jamais enregistré
  d'office) les valeurs de la série validée juste au-dessus.
- **Effort** : moyen (décision à rouvrir).
- **Captures** : `shots/09-seance-repos.png` (série 2 vide juste après la 1) et `shots/26-seance2-apres-squat.png`
  (série 4 ajoutée, reps vides)
- **Code** : `src/features/workout/WorkoutSetRow.tsx:137-153`

### 8. « Remplacer l'exercice » ouvre les 175 exercices par ordre alphabétique, sans rien proposer d'équivalent
- **Parcours** : séance, remplacer un exercice (« la machine est prise »).
- **Ce qui se passe** : pour remplacer le Rowing barre, la liste commence par « Abduction à la machine », « Abduction
  élastique »… Il faut taper une recherche (et le constat 1 s'applique) ou ouvrir le filtre Muscle.
- **Pourquoi ça gêne** : c'est un geste fait sous pression, entre deux séries. Les candidats évidents (même muscle
  principal) sont à portée et l'écran ne les montre pas.
- **Correction** : ouvrir l'écran pré-filtré sur le muscle principal de l'exercice remplacé, avec une pastille pour
  enlever le filtre.
- **Effort** : petit.
- **Capture** : `shots/14-seance-remplacer.png`
- **Code** : `src/features/workout/WorkoutReplaceExerciseScreen.tsx:30` (`useState<BrowserQuery>({ search: '' })`)

### 9. Planifier : trois onglets frères, trois comportements de retour, et deux mots pour la même chose
- **Parcours** : Planifier (routines, programmes, guide).
- **Ce qui se passe** :
  - Le sous-onglet Routines n'a pas de flèche retour.
  - Programmes en a une, qui mène à l'Accueil.
  - Guide en a une, qui mène à un écran « Savoir » qu'aucun onglet ne montre.
  - L'onglet s'appelle « Programmes », mais tout le reste parle de « bloc » (« Créer un bloc », « Nouveau bloc »,
    « Aucun bloc actif »). On y trouve aussi « Split », « Benchmark », « Calibrer », « Surcharge » et « Décharge »,
    sans explication.
- **Pourquoi ça gêne** : on ne sait plus où « retour » va mener, et un utilisateur qui cherche son « programme » lit
  « bloc » partout. Ce coût revient à chaque visite de l'onglet.
- **Correction** : un seul mot (programme), des libellés français (« Répartition » plutôt que « Split », « Séance
  test » plutôt que « Benchmark »), et aucune flèche retour sur les trois sous-onglets.
- **Effort** : petit.
- **Captures** : `shots/33-programmes-vide.png`, `shots/34-programme-etape1.png` et `shots/50-planifier-guide.png`
- **Code** : `src/features/programs/ProgramListScreen.tsx:68` (`onBack`),
  `src/features/knowledge/WikiProgrammingScreen.tsx:29` (`navigate('/knowledge')`) et `src/i18n/fr.ts:1017`
  (`listCreate`), `:1101` (`stepSplit`), `:2766` (`Benchmark`).

### 10. Records : une chronologie d'événements, pas « mes records »
- **Parcours** : Progression › Records, et le bloc Records de la fiche exercice.
- **Ce qui se passe** :
  - L'écran empile chaque record dans l'ordre où il est tombé, y compris ceux qui sont déjà battus : Squat « Charge
    max 60 kg » apparaît sous « 62,5 kg ».
  - L'en-tête « Record actuel » montre le dernier événement (un tonnage de 1 480 kg) et non la meilleure charge.
  - « Meilleure série 500 kg » se lit comme une charge de 500 kg, alors que c'est 62,5 × 8.
- **Pourquoi ça gêne** : la question réelle est « c'est quoi mon max au squat ? ». Pour y répondre, il faut filtrer,
  parcourir et décoder les chiffres.
- **Correction** : une vue par défaut par exercice, avec seulement les records en cours (charge max, 1RM estimé,
  meilleure série écrite « 62,5 kg × 8 »). La chronologie passe derrière un lien.
- **Effort** : moyen.
- **Captures** : `shots/47-records.png` et `shots/49-exercice-fiche.png`
- **Code** : `src/features/records/RecordsScreen.tsx` et `RecordRail.tsx`, avec le libellé de `src/i18n/fr.ts:724`
  (`max_volume_set`).

---

## Autres constats (plus brefs)

**Routines**
- **Une routine vide abandonnée reste en base.** « Routine vide » crée tout de suite « Ma routine ». Si on fait retour
  sans rien ajouter, une seconde « Ma routine — Aucun exercice » reste dans la liste. On la retrouve en double dans le
  sélecteur de routine du programme. Petit effort. Capture `shots/55-routines-doublon-vide.png`, code
  `src/features/routines/RoutinesScreen.tsx:122`.
- **L'éditeur de routine sert aussi d'écran de consultation, et ses exercices sont sous la ligne de flottaison.**
  Ouvrir une routine pour la lancer montre d'abord le nom, le sous-titre, le dossier, « Mettre à jour les cibles » et
  « Benchmark ». Le premier exercice commence à 637 px. « Mettre à jour les cibles — D'après tes 3 dernières séances »
  s'affiche aussi sur une routine jamais faite. Capture `shots/05-premierjour-routine-creee.png`.
- **Chaque exercice ajouté arrive avec une seule série « libre ».** Pour obtenir 3 séries ciblées, il faut environ 5
  gestes par exercice.

**Séance**
- **Le coach propose, mais la validation en un tap enregistre l'ancienne charge.** En 2e séance, les valeurs fantômes
  restent à 60 kg alors que la carte Coach dit 62,5 kg. Sans toucher « Appliquer », on ne progresse pas. Capture
  `shots/23-seance2-valeurs-fantomes.png`.
- **Cibles sous 48 px en séance.** Les boutons « Cadence » et « Plaques à charger » font 44 px de large
  (`WorkoutExerciseCard.tsx:396`, `:408`). La jauge RPE fait 32 px de haut (`EffortStrip.tsx:79`). La coche non
  validée ne se voit qu'à peine : un carré de 34 px, une icône de 14 px, du gris sur du gris (capture
  `shots/07-seance-debut.png`).

**Fin de séance**
- **L'écran de fin passe sous silence les séries non faites.** 4 séries sur 15 sont enregistrées sans un mot.
- **Le coach recommande +2,5 kg au développé couché après 1 série sur 3** (« car 1 × 8 a atteint le haut »).
- **Libellés à corriger** : « COACH » apparaît deux fois, et le pluriel est écrit « 3 série(s) ». Capture
  `shots/15-fin-ecran.png`.

**Programmes**
- **La création d'un bloc démarre mal remplie.** La date de départ est vide par défaut, et on ne l'apprend qu'après
  « Continuer », par une erreur en haut d'écran. La durée par défaut est de 8 semaines alors que l'état vide dit
  « commence par poser quatre semaines » (`ProgramEditorScreen.tsx:50`).

**Historique**
- **Corriger une séance passée.** L'action est cachée sous ⋮. Une séance de 22 séries donne une page de 10 000 px,
  avec trois compteurs empilés par série. La croix de retrait d'un exercice agit sans confirmation, mais l'abandon des
  modifications est bien protégé. Capture `shots/43-historique-edition.png`.
- **Retrouver une séance ancienne.** Le calendrier avance mois par mois, sans saut d'année : 34 taps pour remonter
  à janvier 2024. Capture `shots/40-historique-calendrier.png`.
- **Indicateurs trompeurs.** « Régularité 0 semaines » s'affiche avec 3 séances cette semaine tant que l'objectif
  hebdo n'est pas défini. L'icône « Analyses » de l'en-tête double l'onglet Progression.

**Progression et exercices**
- **Lire la progression d'un exercice.** La liste des exercices est alphabétique, sans recherche ni « récents ». La
  période par défaut de 12 semaines affiche « Aucune séance sur cette période » après une pause, et il faut toucher
  « Voir tout l'historique ». Captures `shots/45-progression-accueil.png` et `shots/46-progression-exercice.png`.
- **Ordre des résultats dans Exercices.** Le tri est purement alphabétique : pour « squat », « Squat (barre, nuque) »
  n'arrive qu'en 6e position. Le champ de recherche affiche deux croix d'effacement (la croix native et la croix
  maison). Capture `shots/52-exercices-recherche-zero.png`.
- **Fiche exercice.** La silhouette musculaire occupe tout le premier écran, et les records, l'historique et le
  journal du coach (« Recommandations ») sont plus bas. La bande orange « Terminé » ne fait que doubler la flèche
  retour. Capture `shots/49-exercice-fiche.png`.

**Import Hevy (hors périmètre, relevé en passant)**
- 25 correspondances détectées doivent chacune être confirmées une par une : 50 taps, sans « Tout confirmer ».
  Capture `shots/19-import-hevy-mapping.png`.

## Ce qui marche bien
- Les cibles principales font toutes au moins 48 px, et l'action principale de chaque écran est une bande en bas,
  sous le pouce.
- En séance, l'exercice terminé se replie et le suivant s'ouvre tout seul. La barre « Séance en cours » suit sur
  tous les écrans.
- Dès la 2e séance, les valeurs de la séance précédente apparaissent en fantôme et se valident en un tap. Les records
  s'annoncent sur la ligne même.
- Les actions destructrices sont confirmées : supprimer une routine, abandonner une séance (avec le nombre de séries
  perdues), quitter une correction d'historique, y compris par le retour système.
- Les modèles de routine permettent une première séance en 5 taps.
