# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.

**Dernière mise à jour :** 2026-08-13 (**Release Android v0.7.0 — front Programmes : recettes, suppression, éditeur empilé**).

## Front Programmes (v0.7.0)

L’actif est le héros de la liste (`ProgramHeroCard`, `leadWith`), les autres blocs
restent des rangées. Suppression d’un bloc depuis le menu ⋯ sur les trois statuts,
avec confirmation : les séances déjà faites ne bougent pas de l’historique.

Trois recettes (Hypertrophie / Force / Reprise) posent le trajet des semaines :
motif de 4 semaines répété puis tronqué, **ancré au `weekIndex`** du bloc, niveaux
lus dans `SUGGESTED_LOAD_INDEX`. Rien n’est persisté : une recette est un point de
départ, pas un état — retoucher une semaine relâche la chip.

**L’édition n’est plus un wizard.** Le wizard (`Étape n sur 3 · Nom` + rail) reste
sur `/programs/new` seulement. `/programs/:id/edit` est un défilement de sections :

- Brouillon : Cadre, Split, Semaines éditables → « Enregistrer le brouillon ».
  L’activation a quitté l’éditeur : elle vit sur la fiche.
- Actif : le sélecteur de semaine d’entrée en vigueur gouverne **aussi** les
  semaines — `< effectiveFromWeekIndex` s’affiche en lecture seule (une rangée,
  pas un bouton grisé). « Utiliser à partir de la semaine {n} » écrit
  `createScheduleRevision` + `replaceProgramWeeksFrom` : les lignes scellées ne
  sont pas réécrites, elles gardent leur identité. Une seule règle de bornage,
  lue deux fois, plutôt que deux règles qui divergent.
- Terminé : pas d’entrée éditeur.

Fiche : brouillon incomplet → « Continuer la création » ; complet → « Activer le
bloc », avec la feuille « Remplacer le bloc actif » si un autre tourne déjà.

Pas d’arc de `loadIndex` au-dessus de la liste : il dupliquait la liste. L’arc se
lit dans la colonne des niveaux. `loadIndex` n’est toujours un multiplicateur
nulle part.

Piège consigné : `getActiveWorkout()` renvoie `undefined`, pas `null` — comparer
à `null` passe le typecheck et grise le bouton pour toujours.

`ProgramEditorScreen` est passé de 517 à 359 lignes (`programEditorModel.ts`,
`useProgramEditorData.ts`, `ProgramStepNav`, `ProgramEffectiveWeekSelect`).
Reste au-dessus des ~300 de la convention : le découper plus loin demanderait un
sac de 12 props, ce qui coûterait plus que ça ne rapporte.

1504 tests / 131 fichiers.

---

**Précédent :** 2026-08-13 (Release Android v0.6.0 — intention de bloc, le Coach tranche).

Le % 1RM de semaine est mort. Une semaine porte `loadIndex` + `phase`. « 105 % »
n’est plus une multiplication : c’est un niveau affiché. La routine reste le 100 %.

Le moteur distingue `range_satisfied` (dans la fourchette) et `range_ceiling_reached`
(plafond). On n’ajoute jamais de charge tant que la plage n’est pas saturée. Un
plateau retire toute escalade, y compris `add_set`. La phase de la **prochaine**
séance choisit parmi les actions déjà autorisées ; elle n’en invente aucune.

La Décharge transforme les cibles avant la séance (deux incréments en moins, une
série en moins). `loadIndex` 60 ou 90 donne la même recette. La séance snapshot
`programPhase` / `programLoadIndex` : reclasse la semaine plus tard, l’historique
ne ment pas.

UI : `05 — 60 % · Décharge`, accueil `Semaine 3 · Progression`, wizard
`Étape 2 sur 3 · Split` + 1 2 3 (plus de faux onglets). Carte Coach : plus de
« 100 → 0 kg » ; Progression sans incrément = « Maintien — progression différée ».

Revue des 12 commits : lint (`_removed`), bornes `loadIndex` 1–200, prochaine
séance = slots encore ouverts (pas l’ordre du split), et retrait du flux
d’avertissements 1RM (feuille + acquittement, devenus inatteignables).
`evaluateCoach` reste le moteur pur du lib ; l’écran de fin passe par
`evaluateCoachForWorkout`.

Bump mineur : `0.5.1` → `0.6.0`. Le modèle de données change (migration Dexie
`version(7)` : les semaines perdent `prescriptionKind` / `prescriptionValue` /
`isDeload` au profit de `loadIndex` + `phase`). `versionName` vient de
`package.json`, `versionCode` du run GitHub. Installer par-dessus,
**sans désinstaller** — la migration doit tourner sur la base existante.

Checkpoint téléphone (après prochain APK) : créer un bloc 8 semaines, poser une
Décharge en S5, terminer une séance au plafond juste avant : la feuille Coach
ne doit pas proposer d’ajouter du volume. En S6 Reprise, la grille est celle
de la routine, pas celle de la Décharge. Wizard : les trois chiffres 1 2 3
sont lisibles d’une main. Vendredi avancé, lundi encore ouvert : le Coach
reste sur la semaine en cours.

**Mise à jour précédente :** 2026-08-13 (**Release Android v0.5.1 — le CSV ouvre enfin la feuille**).

Le téléphone disait « Sauvegarde téléchargée » et aucun fichier n'arrivait. Dans la
WebView, `<a download>` réussit en JS et n'écrit rien. L'APK écrit désormais le CSV
dans le cache natif et l'envoie à la feuille Android.

Bump de rustine : `0.5.0` → `0.5.1`. `versionName` vient de `package.json`,
`versionCode` du run GitHub. Installer par-dessus, **sans désinstaller**.

**Mise à jour précédente :** 2026-08-13 (**Bug — « Sauvegarde téléchargée » sans fichier**).

## Rapport d'investigation (corrigé)

Signalé : l'export CSV ne fonctionne plus, soupçon sur le Lot 17. Premier diagnostic
faux : ce n'était **pas** un échec affiché. Le téléphone disait « Sauvegarde
téléchargée » (lu « sauvegarde effectuée ») et aucun fichier n'arrivait.

### Ce que le Lot 17 n'a pas cassé

Le sérialiseur n'a pas bougé depuis le Lot 8. Une séance née d'un programme s'écrit
et se relit. Les champs de bloc ne traversent pas le CSV : Hevy décrit des séances,
pas un programme. Ce n'est pas une régression.

### La vraie cause

Dans la WebView Capacitor, `canShare({ files })` renvoie `false`. `saveTextFile`
tombait alors sur `<a download>` + `click()`. En JS, le clic **réussit**. Android
n'écrit rien. Réglages traduit `downloaded` par « Sauvegarde téléchargée. » — un
succès pour une opération qui n'a pas eu lieu.

C'est pour ça que le premier correctif (`canShare` qui lève) ne pouvait pas
expliquer le symptôme : une exception aurait montré le bandeau rouge. Ici le
bandeau était vert.

Le Lot 17 n'a rien changé à ce fichier. Il a changé le moment où on s'en sert.

### Correctif

Sur l'APK, plus de faux téléchargement. Le CSV est écrit dans le cache natif
(`@capacitor/filesystem`) puis passé à la feuille de partage Android
(`@capacitor/share`). Fermer la feuille n'est pas un échec. Une écriture refusée
l'est vraiment, et on le dit. Le navigateur de bureau garde `<a download>`, qui
y fonctionne.

**Checkpoint téléphone :** installer l'APK par-dessus l'app, **sans la désinstaller**.
Réglages → « Sauvegarder l'historique (CSV) » : la feuille Android doit s'ouvrir
(Drive, Fichiers, Gmail…). **Plus** de « Sauvegarde téléchargée » sans fichier.
Enregistrer, rouvrir : les accents et les séances du bloc sont là.

**Mise à jour précédente :** 2026-08-13 (**Accueil — le corps en tête, le reste en dessous**).

L'accueil posait cinq questions en cinq blocs et cinq intertitres, avec le dessin du corps tout en
bas. Il en pose deux : **qu'est-ce que je travaille** (le corps, en tête d'écran) et **qu'est-ce
que je lance** (juste dessous). Les deux chiffres personnels — séances de la semaine, poids du jour
— tiennent une bande de deux tuiles sous la carte de séance ; l'historique récent ferme l'écran.

Ce qui part : la **série de semaines d'affilée** (un compteur qu'on lit une fois et qu'on perd en
se blessant — l'écran Rythme la garde), les **± de la pesée** (`NumberInput` prend un
`steppers={false}` : un poids se lit sur une balance et se tape, il ne s'ajuste pas par pas de
100 g), et **trois intertitres** — « À lancer » et « Semaine 2 sur 8 » sont passés en sur-titre
*dans* leur carte.

La pesée était une carte permanente de 200 px pour un geste quotidien au mieux : elle est
maintenant une feuille (`HomeBodyWeightSheet`) derrière la tuile, qui se ferme d'elle-même sur une
écriture réussie — la tuile affichant la nouvelle valeur dit « c'est enregistré » mieux qu'une
ligne de texte.

**Le seul nombre à régler est dans `HomeMuscleMap` : `max-w-[15rem]`.** Le dessin est calé sur sa
largeur (deux figures deux fois et demie plus hautes que larges), donc c'est la largeur qui décide
de la hauteur, et la hauteur décide si le bouton « Lancer » passe au-dessus de la ligne de
flottaison. Mesuré sur 375 × 812 : carte du corps 96 → 463 px, carte de séance 487 → 697 px,
bouton à 586 → 642 px, barre d'action fixe à 699 px. Tout tient, à deux pixels près. Monter à
17rem donne un corps de 327 px et fait glisser le bas de la carte de séance sous la barre.

Prochaine étape évoquée : rendre les muscles cliquables pour ouvrir la liste des exercices qui les
travaillent. La géométrie est déjà nommée muscle par muscle (`musclesByGroup.ts`), donc c'est un
gestionnaire de clic et un écran, pas un nouveau dessin.

Checkpoint téléphone : ouvrir l'accueil et vérifier que le bouton de la séance à lancer est
visible sans faire défiler ; taper la tuile du poids et vérifier que le clavier suffit.

**Mise à jour précédente :** 2026-08-13 (**Release v0.4.0 — les programmes et une vraie anatomie**).

Deux gros morceaux dans la même version, écrits en parallèle sans se marcher dessus : le **Lot 17**
(périodisation, programmes multi-semaines, split hebdomadaire versionné) et le **remplacement de la
carte musculaire** par une géométrie dérivée de Z-Anatomy. Zéro fichier en commun entre les deux —
le recouvrement s'est limité à `src/i18n/fr.ts` et `PROGRESS.md`, tous deux fusionnés sans conflit.

Bump mineur : `versionName` vient de `package.json`, `versionCode` du numéro de run GitHub. Le tag
`v0.4.0` est ce qui publie la release et y attache l'APK ; un simple push sur `master` ne produit
qu'un artefact de 30 jours.

**Mise à jour précédente :** 2026-08-13 (**Carte musculaire Z-Anatomy — remplacement du body map**).

Les cinq écrans qui dessinaient un corps (accueil, bilan musculaire, fiche exercice, détail de
séance, fin de séance) passent d'une géométrie de 89 régions à 26 muscles anatomiques réels,
dérivés de Z-Anatomy. Le contrat `MuscleHighlight` n'a pas bougé d'un caractère : `BodyMap.tsx`
avait prévu ce remplacement par écrit, et aucun appelant n'a été réécrit.

**La couture est `src/ui/muscleMap/musclesByGroup.ts`, et nulle part ailleurs.** 16 groupes
dessinables → 23 muscles, plus 3 orphelins assumés (`hip_flexors`, `serratus_anterior`,
`tibialis_anterior`) : dessinés pour que le corps soit entier, jamais allumés faute d'un
`MuscleGroup` capable de les nommer. Exhaustif par construction via `satisfies`, et un test tient
la complémentarité 23 + 3 = 26.

`rotator_cuff` **est** allumé, avec `shoulders` — la coiffe stabilise l'épaule dans tout
mouvement, donc un développé qui l'allume dit vrai. C'est ce qui la sépare du serratus, qu'un
crunch ne travaille pas et qu'on refuse toujours de replier dans `abs`.

**Rampe de valeur, pas de couleur** : `color-mix(in srgb, var(--text-1) N%, var(--surface-2))`,
ce qui reproduit exactement l'ancien compositing en `fill-opacity` et garde l'accent réservé aux
actions principales. Deux instances côte à côte plutôt qu'un basculement de vue : la lecture
utile est *où sont les trous*, elle a besoin des deux moitiés dans l'œil en même temps.

**Nouvel écran `/settings/about`.** CC BY-SA 4.0 §3(a) exige que l'attribution accompagne l'œuvre
« par tout moyen raisonnable au vu du support » : un fichier dans le dépôt couvre qui clone, pas
qui installe la PWA. L'ancien NOTICE Apache-2.0 de `body-muscles` avait le même trou — il part
avec la géométrie qu'il couvrait.

L'ancien code vit sur la branche `archive/body-map-vendor`, poussée avant toute suppression.
`Z-Anatomy.zip` (102 Mo) est désormais ignoré : au-delà de la limite dure de GitHub, et c'est une
source, pas un produit.

**La rampe ne part pas de zéro, et c'est un correctif du téléphone.** Posée sur `--surface-2`,
la masse éteinte donnait **1,11:1** sur une carte `--surface-1` : le corps disparaissait et le
dessin se lisait en fil de fer, ses contours portant seuls la forme. Le muscle non travaillé
démarre donc à un cinquième de la rampe (2,05:1 en sombre, 1,71:1 en clair), et la silhouette —
tête, mains, pieds, sans contour propre — passe juste en dessous. Pas plus haut : un corps éteint
trop clair efface le trou, qui est précisément ce que ce dessin sert à montrer.

Checkpoint téléphone : ouvrir une fiche d'exercice et le bilan musculaire, vérifier que le dessin
reste lisible à cette taille — il est bien plus détaillé que l'ancien pour la même hauteur.

**Avant cela :** 2026-08-13 (**Lot 17 — périodisation et programmes multi-semaines**).

Livré : blocs de 4 à 12 semaines, split hebdomadaire versionné, prescriptions %1RM ou RPE,
décharges planifiées, démarrage depuis l’accueil et autorité explicite face au Coach du Lot 18.

Checkpoint téléphone restant : bloc de 8 semaines, décharge semaine 5, version effective d’une
routine, décalage du bloc et reprise complète en mode avion.

**Puis :** 2026-08-12 (**Release v0.3.3 — le coach sait enfin redescendre**).

La cinquième règle, `range_missed` : **deux séances de suite sous le bas de fourchette, à la même
charge → un incrément en moins.** C'est la moitié de RF-48 que le roadmap promettait depuis le
début et que le plan détaillé n'avait jamais retenue, sans que l'abandon soit consigné.

**Le « maintien » n'est volontairement pas un signal.** Le roadmap dit « maintien puis
diminution ». Mais un signal qui parle dès le premier bas de fourchette manqué parlerait presque
chaque séance — le « crier au loup » corrigé quelques heures plus tôt, refait à l'identique.
L'absence de reco **est** le maintien : c'est déjà ce que l'app dit quand elle se tait. Une seule
mauvaise séance, c'est du sommeil, un repas tardif ou un rack occupé, pas un programme à corriger.

**Deux garde-fous dans la règle :**
- **La même charge dans les deux séances**, sinon ce ne sont pas deux tentatives de la même chose
  et il n'y a rien à conclure.
- **Les séances de deload sont exclues**, comme partout ailleurs : les charges y baissent exprès.

**`previousLoad` est le miroir exact de `nextLoad`**, même grille, même arrondi, deux inversions
de signe pour l'assistance — reculer sur une machine assistée, c'est **remettre** du poids
dessus. Un test vérifie l'aller-retour : `previousLoad(nextLoad(x)) === x`, charge libre comme
assistée.

**Sévérité 50, au-dessus de `range_completed`** : échouer deux fois est plus urgent que réussir
une fois. Les deux ne peuvent de toute façon jamais coexister — l'une exige toutes les séries au
sommet de la fourchette, l'autre une série sous son plancher. En revanche `range_missed` masque
bien la « baisse de reps » qui l'accompagne forcément, et c'est voulu : entre une observation et
une charge à appliquer, c'est la charge qui vaut la place.

**Deux tests ont dû changer, et ce ne sont pas les assertions qui étaient en cause.** Les
fixtures de `plateau` et du deload de `coachEvaluate` prescrivaient une fourchette 8–12 puis
faisaient des séries de 5, deux séances d'affilée à la même charge : exactement la nouvelle règle.
Le moteur avait raison, la donnée de test était incohérente. Les fourchettes ont été alignées sur
ce qui est soulevé, pas les attentes sur ce qui sortait.

Portes locales : lint, typecheck, **1320 tests dans 119 fichiers**, build PWA.

**Mise à jour précédente :** 2026-08-12 (**Release v0.3.2 — le coach arrête de crier au loup, et un
refus ne l'éteint plus**).

Deuxième retour de terrain de la journée, quatre corrections. Trois d'entre elles sont des défauts
que seule une vraie séance pouvait révéler.

**1. La règle de chute de reps criait au loup.** Signalé : `80×12, 12, 12, 10` sur une fourchette
8–12 déclenchait « chute en séance ». Or 10 est **dans la prescription** — la fourchette dit 8 à
12, et finir à 10 c'est la respecter. `intraSessionDropSignal` ignore désormais une série qui
reste au-dessus du bas de fourchette ; seule une série qui **passe sous le plancher** est une
nouvelle. Un coach qu'on apprend à ignorer est un coach qu'on n'écoutera plus le jour où il a
raison. Deux tests gardent les deux côtés (silence à 10, signal à 7).

**2. La flèche voulait dire deux choses opposées.** La carte d'objectif dit `47,5 → 50 kg`
(« fais ça ») et l'observation disait `12 → 10 reps` (« j'ai vu ça ») — même grammaire visuelle,
sens inverses, introduits le même jour. L'observation devient « Baisse de reps observée : 12 puis
10 (−2). » La flèche reste réservée à ce qui se fait.

**3. Un refus éteignait la règle à vie.** `sameProposal` traitait « même exercice + même code +
pas de charge » comme la même proposition : refuser une fois « chute de reps » suffisait à ne
plus jamais la revoir sur cet exercice. Or refuser porte sur un **chiffre** (« non, pas 50 kg »),
pas sur une règle. Un signal sans charge n'est donc plus jamais mis en sourdine durablement — son
refus finit avec sa séance. Une règle qu'un seul appui peut tuer est une règle sur laquelle on ne
peut plus compter.

**4. L'appui : un chevron, pas une phrase.** « Appuyer pour appliquer aux séries restantes »
disparaît au profit du `ChevronRightIcon` déjà utilisé par `ListRow` pour « cette ligne fait
quelque chose ». Une phrase qui explique qu'une carte est tapable se lit une fois et s'enjambe
ensuite pour toujours. Et **la carte se ferme dès qu'on a appuyé** : appliquer, c'est accepter,
donc la reco passe en `followed` et sort de la file d'attente. Elle se ferme parce qu'elle quitte
`pending`, pas par un drapeau local qu'un remontage oublierait (règle n°4).

**Compromis assumé du point 4 :** si tu appliques puis que tu changes la charge en cours de
série, le journal dira « suivie » à la charge proposée. Marquer l'intention est plus juste que de
ne rien marquer, et `reconcileFollowedLoads` continue de rattraper le cas inverse — suivre la
proposition sans avoir appuyé.

**Ce qui restait ouvert : la baisse de charge.** — **livrée le jour même en v0.3.3**, cf. l'entrée
en tête de fichier.

Portes locales : lint, typecheck, **1305 tests dans 119 fichiers**, build PWA.

**Mise à jour précédente :** 2026-08-12 (**Release v0.3.1 — le coach s'applique d'un appui, et le
« +50 kg » qui voulait dire « passe à 50 »**).

Première session de terrain du Lot 18. Trois retours, dont un vrai bug, une fausse alerte et une
demande.

**1. Le libellé disait l'inverse de ce qu'il voulait dire.** La carte affiche déjà la charge à
mettre sur la barre en gros — `50 kg` — et la phrase en dessous reprenait la **même** valeur
derrière un `+` : « +50 kg car 3 × 12… », pour dire « passe à 50 ». Lu en salle, ça se comprend
comme « ajoute cinquante kilos ». Le libellé est maintenant un pas entre deux nombres :
`47,5 → 50 kg car 3 × 12 a atteint le haut de la fourchette.` La variante assistance garde la
même flèche avec le chiffre qui descend. `coachCopy.test.ts` verrouille les trois cas, dont un
`not.toContain('+')` explicite.

**2. « Aucune carte Coach en séance » n'était pas un bug.** Vérifié en rejouant la séquence en
base : une séance terminée en haut de fourchette laisse bien une reco en attente pour la
suivante. La cause est structurelle et attendue — `version(5)` crée le journal **vide**, sans
rattrapage, et une reco n'est écrite qu'à l'**enregistrement** d'une séance sous 0.3.0. Il faut
donc une séance sauvegardée avant que la carte ait quoi que ce soit à montrer. L'historique
antérieur n'est pas perdu pour autant : le moteur le lit à chaque évaluation (le plateau en a
besoin). Rien à corriger, mais à savoir avant de conclure à une panne.

**3. Un appui sur la carte applique l'objectif** (`applyCoachObjective`, demande utilisateur).
Ça ne rouvre pas la décision « ne jamais pré-remplir » de la tranche 3 : ce qui était interdit,
c'est que l'app décide seule — un chiffre qui apparaît tout seul est un chiffre qu'on arrête de
lire. Là c'est un geste explicite, et rien n'est verrouillé après. Les règles d'écriture sont
calquées sur `applyWorkoutDeload`, volontairement : une série déjà validée n'est **jamais**
réécrite, une série vierge reçoit une **cible** (le champ reste à remplir), une série déjà
saisie voit sa valeur remplacée. Le statut de la reco n'est pas touché à l'appui — c'est
`reconcileFollowedLoads` qui tranche en fin de séance sur ce qui a réellement été soulevé,
et non sur une intention.

Le geste est écrit sur la carte (« Appuyer pour appliquer aux séries restantes ») : une cible
tactile que rien n'annonce est une cible que personne ne trouve, encore moins entre deux séries.
« Ignorer » reste un bouton distinct à côté, à 48 px.

Portes locales : lint, typecheck, **1301 tests dans 119 fichiers**, build PWA.

**Checkpoints validés par l'utilisateur le 2026-08-12 :** Lots **5bis, 7, 8, 9, 10, 12, 13**.
Le Lot 18 reste partiel — l'incrément par exercice et la proposition de fin de séance sont
vérifiés en salle, la carte en séance et « Ignorer » attendent la prochaine séance (voir le
point 2 ci-dessus). Le deload est invérifiable à la main sans semaine de décharge : il est
couvert par `coachEvaluate.test.ts` (« pas de faux plateau en deload ») et validé par le code,
pas par l'usage. La courbe de progression attend d'avoir assez d'historique.

**Mise à jour précédente :** 2026-08-11 (**Lot 18 — coach déterministe, RF-48, sans IA**).

Plan suivi scrupuleusement : `docs/plans/lot-18-coach-deterministe.md`.

**Release Android v0.3.0 :** version applicative alignée sur le tag de publication. Le push de
`master` déploie la PWA et construit l’APK ; le tag `v0.3.0` publie l’APK dans GitHub Releases.

**Tranche 0 — mesure RPE avant toute règle de fatigue.** Source :
`%USERPROFILE%\Downloads\workout_data.csv` (export Hevy/FitTrack, 136 séries de travail).
Séries avec RPE : **0**. Taux : **0 %** (seuil ~50 %). **Décision figée :** les détections
qui exigent un RPE (charge trop lourde, signes de deload) restent hors V1. Les quatre règles
du plan (fourchette, chute intra-séance, plateau, repos long corrélé) n'utilisent pas le RPE
et sont livrées telles quelles. Ne pas contourner ce résultat.

**Tranche 1 — incrément de charge.** `Exercise.loadIncrementKg?` (non indexé, pas de
migration de backfill — défauts calculés), table `DEFAULT_LOAD_INCREMENT_KG` typée
`Record<Equipment, number>`, `nextLoad` qui inverse l'assistance, saisie dans « Tes réglages »
à côté du repos.

**Tranche 2 — moteur pur `src/lib/coach/`.** Signaux typés, jamais de phrases. Quatre règles,
comparateur un signal par exercice. Deload exclu des comparaisons ; imports Hevy sans
fourchette muets pour la double progression ; deux lignes du même exercice dans une séance
recollées.

**Tranche 3 — journal `coachRecommendations` (`version(5)`).** Statut pending / followed /
dismissed. Un refus à la même charge + même code ne revient pas. Réinjection : objectif
proposé en séance, **sans pré-remplir** la série.

**Tranche 4 — UX.** Carte Coach en séance (objectif + Ignorer), signaux en fin de séance sous
le corps, historique sur la fiche exercice. Accent interdit sur la carte (charte). Chaque
reco affiche le chiffre qui l'a produite.

**Revue des quatre tranches — trois corrections, toutes couvertes par des tests.** Les trois
bugs touchaient des pièges que le plan avait pourtant écrits :

- **Plateau sur machine assistée.** `nextLoad` inversait l'assistance, `plateauSignal` non :
  trois séances passant de 30 à 20 kg d'aide — de la vraie progression — sortaient un
  `plateau`. La règle est désormais **muette sur `weightRole === 'assist'`** : sans le poids
  du corps à soustraire, il n'y a rien d'honnête à comparer, et le moteur se tait plutôt que
  de lire un progrès comme une stagnation. C'est une limite assumée, pas un oubli.
- **Le journal enregistrait les succès comme des refus.** `recordCoachSignals` tournait avant
  `reconcileFollowedLoads` et passait la reco vivante à `dismissed` ; suivre le conseil *et*
  re-valider la fourchette effaçait donc la preuve. Ordre inversé, et nouveau statut
  **`superseded`** distinct de `dismissed` — un remplacement n'est pas un refus, et il ne doit
  pas interdire à cette charge de revenir.
- **Les drop sets déclenchaient « chute intra-séance ».** `isWorkingSet` n'exclut que
  l'échauffement. Nouveau `progressionSets` : séries de travail au sommet de la charge du
  jour, drop sets et séries de délestage exclus (avec l'inversion assist). Corrige aussi
  `range_completed`, qui proposait la charge suivante à partir du poids du drop set.

Plus : le coach ne bloque plus la fin de séance s'il jette, les échauffements ne comptent plus
comme charge de travail suivie, l'index `[exerciseId+status]` sert enfin, une observation sans
chiffre n'est plus étiquetée « Objectif proposé », et la fiche exercice n'affiche plus de carte
« Recommandations » vide.

Portes locales : lint, typecheck, **1299 tests dans 117 fichiers**, build PWA.

**Checkpoint téléphone :**
- [ ] Exercice barre / haltères / machine assistée : incrément crédible et modifiable.
- [ ] Valider toute une fourchette : fin de séance propose la charge suivante **avec**
      l'explication ; à la séance d'après l'objectif apparaît sans pré-remplir.
- [ ] Séance en deload : pas de faux plateau.
- [ ] **Machine assistée sur 3 séances : aucun plateau annoncé** (règle volontairement muette).
- [ ] **Séance avec drop set : aucune « chute en séance » signalée.**
- [ ] **Suivre une reco puis re-valider la fourchette : la fiche exercice affiche « Suivie »**,
      pas « Ignorée ».
- [ ] Ignorer une reco : elle ne revient pas à la charge identique.
- [ ] Migration `version(5)` au premier lancement : l'app s'ouvre, le journal Coach est vide
      tant qu'aucune séance n'a produit de signal.

**La vraie mesure vient après 3–4 semaines d'usage** — le « terminé » du lot sera long à
prononcer, et c'est normal.

**Mise à jour précédente :** 2026-08-11 (**Release Android v0.2.0 — records persistés, 1RM
estimé et schéma musculaire**).

Deux chantiers menés en parallèle, fusionnés pour cette release. Les deux entrées qui suivent
les décrivent en détail ; ce qu'il faut retenir de la fusion elle-même :

- **Aucune collision de migration.** La crainte consignée avant la fusion ne s'est pas
  matérialisée : le chantier des records n'a ajouté aucune version Dexie, donc la
  `version(4)` des muscles secondaires garde son numéro et son ordre.
- **`differs` de `historyRepair` a été étendue des deux côtés**, et les deux extensions sont
  justes : le coefficient de charge au poids du corps d'un côté, les muscles secondaires de
  l'autre. Les deux sont gardées — c'était le seul conflit de logique de la fusion.
- **Une assertion périmée sur la précision du 1RM** a été trouvée indépendamment par les deux
  sessions, et corrigée à la même valeur : une décimale, pas deux. `master` était rouge avant
  la fusion à cause d'elle — le test échouait sur `master` seul, sans aucune modification.

**Mise à jour précédente :** 2026-08-11 (**Lot 5bis — schéma musculaire, quatre écrans, et les
muscles secondaires figés dans l'instantané**).

> ⚠️ **À LIRE AVANT DE FUSIONNER `claude/lot-5bis-body-map`.**
>
> Cette branche ajoute **`this.version(4)`** dans `data/db.ts` (backfill des muscles
> secondaires). Une session parallèle travaille sur les records persistés et le 1RM estimé
> (design et plan déjà sur `master`), et persister `personalRecords` avec un recalcul complet
> demandera probablement **sa propre migration**.
>
> Deux `version(4)` fusionnées donnent soit une erreur Dexie, soit **pire et en silence** : un
> numéro déjà consommé sur le téléphone, et l'upgrade de l'autre branche qui ne s'exécute
> jamais. Aucune des deux sessions ne peut détecter ça seule — chacune ignore la migration de
> l'autre.
>
> **La règle : celui qui fusionne en second renumérote en `version(5)`.** Et l'ordre compte —
> un recalcul qui lit les instantanés doit passer **après** le backfill des secondaires, jamais
> avant. Vérifier ensuite `db.verno` dans `dbMigration.test.ts`, qui assère le numéro courant.
>
> Le reste ne se recoupe pas : `lib/records.ts` n'a pas été touché ici, et `best_1rm` était
> déjà déclaré dans `PersonalRecordType` avant les deux branches. Un conflit sur ce fichier est
> attendu et se règle à la main.

Le schéma est posé sur **quatre écrans** : la fiche exercice (ce qu'un mouvement travaille),
la fin de séance et le détail d'une séance au Journal (ce que cette séance a travaillé), et
« Séries par muscle » (tout ce que tu as travaillé). Un seul composant, une seule prop
`highlight`, trois façons de la calculer.

**Les muscles secondaires sont désormais figés dans l'instantané — `version(4)`.** Sans eux, un
développé couché allumait les pectoraux et laissait les triceps éteints : le dessin était faux
par rapport à ce qu'on sent. J'avais d'abord annoncé que corriger ça imposait de rouvrir la
décision 08B ; **c'était faux, et c'est la correction la plus utile de cette session.** 08B
interdit de lire la bibliothèque *au moment de l'affichage* pour interpréter une séance passée
— c'est ainsi que la même séance a eu deux noms sur un même écran. Écrire la bibliothèque
d'aujourd'hui **une fois** dans l'instantané est le mouvement inverse : à partir de là, la ligne
répond d'elle-même et cesse de dépendre du catalogue. C'est le marché que `version(2)` avait
déjà fait et documenté — la meilleure information disponible, et la seule.

Deux garde-fous à ne pas perdre de vue :

- `resolveExerciseIdentity` ne retombe sur la bibliothèque pour les secondaires **que si la
  ligne n'a aucun instantané du tout**. Une ligne instantanée sans secondaires est soit
  antérieure au champ, soit celle d'un exercice qui n'en a réellement aucun — emprunter ceux
  d'aujourd'hui dans le second cas serait exactement la réécriture que 08B interdit. Un test
  garde ce cas.
- `snapshotOf` **copie** le tableau au lieu de le référencer. Le partager ferait qu'éditer un
  exercice réécrirait silencieusement les séances passées. Un test le vérifie en mutant la
  source.

**Les chiffres restent des comptes, seul le dessin est pondéré.** `muscleBalance` continue de
ne compter que le muscle principal, et son argument tient : « 48 » doit rester un nombre de
séries qu'on peut recompter dans l'historique. Un dessin n'a pas ce devoir — il ne se lit pas,
il se regarde. Donc `sessionMuscleInvolvement` pondère (1 pour le muscle visé, 0,4 pour chaque
muscle sollicité, les deux chiffres que la fiche exercice affiche déjà) et son champ s'appelle
`value`, jamais `sets`.

**Les quatre dessins suivent la même règle**, y compris l'agrégat. `HistoricalExercise` diffuse
déjà l'identité entière, donc les secondaires y arrivaient gratuitement : il a suffi de les
déclarer et de les faire porter par `MuscleRow`. L'écran « Séries par muscle » calcule donc
maintenant son dessin par `muscleInvolvement(rows)` et **non** par ses propres comptes — un
corps, une règle. Le module s'appelle `lib/analytics/involvement.ts` (renommé depuis
`sessionMuscles.ts`, qui ne décrivait plus que la moitié de son usage).

Vérifié après migration sur la base du preview : le backfill a bien écrit
`['triceps','shoulders']` sur les lignes de développé couché ; une séance passe de 18 à 28
régions allumées avec une rampe à six niveaux, arithmétiquement conforme ; et sur l'écran
d'équilibre, le dessin est pondéré pendant que la liste continue d'afficher des séries entières
(30, 24, 18, 18, 0, 0).

**Mise à jour précédente :** 2026-08-11 (**Lot 5bis — schéma musculaire sur la fiche exercice**).

RF-06 réclamait « image ou démonstration animée » depuis le Lot 2 et le champ `imageUrl` n'a
jamais été rempli. La moitié à notre portée est livrée : la fiche d'un exercice montre
désormais une silhouette de face et de dos, avec les muscles travaillés allumés.

**La géométrie est reprise, pas dessinée.** 89 régions SVG de
[`vulovix/body-muscles`](https://github.com/vulovix/body-muscles) au commit `15c8085`, sous
Apache-2.0, avec le texte de la licence et le NOTICE dans `licenses/body-muscles/`. Seuls les
tracés sont repris — ni le composant amont, ni sa rampe de couleurs : le §8 exclut les
composants tiers, et réutiliser des coordonnées n'est pas en dépendre. Zéro dépendance ajoutée
au `package.json`. **Réserve consignée :** la provenance du dessin n'est pas documentée en
amont, le NOTICE revendique la paternité sans citer de source antérieure. On s'appuie sur cette
déclaration, comme pour tout actif open source — c'est une déclaration, pas une preuve, et le
dépôt est public.

**Une rampe de valeur, pas une couleur.** La charte réserve l'accent aux actions principales,
aux séries validées et aux records ; `MuscleBalanceCard` le documente et tous les écrans
d'analytics s'y tiennent. Un muscle allumé est donc la même encre que le texte, posée sur la
surface du corps à l'intensité travaillée. Deux couches plutôt qu'une, pour n'avoir aucune
couleur à interpoler et pour qu'un muscle allumé ne passe jamais derrière une région dessinée
après lui.

**Le piège annoncé par le roadmap était déjà désamorcé.** `MUSCLE_SCOPE` (Lot 12) classait déjà
les 19 groupes en `region` / `unscoped`. Il passe d'une annotation à `satisfies` — une
annotation élargit les valeurs et la distinction disparaît au niveau du type — ce qui permet
d'en dériver `RegionMuscle` et de typer la table de correspondance dessus. Classer un nouveau
groupe en `region` sans lui donner d'endroit où être dessiné **casse le typecheck**.

**Trois arbitrages, tous commentés sur place :** les trois bandes du trapèze sont réparties
comme les mouvements le font (haussement → `traps`, tirage → `upper_back`) ; le grand dentelé
reste éteint plutôt que replié dans `abs` ; et un exercice dont le muscle principal n'a pas de
région — 18 entrées du catalogue, dont le stepper — **promeut ses secondaires à pleine
intensité**, parce que 0,4 ne veut dire quelque chose que par rapport à un principal.

Portes locales : lint, typecheck, build PWA, **1089 tests dans 98 fichiers**. Vérifié dans le
navigateur à 375 px : 96 × 256 px par silhouette, section de 417 px (comparable aux 480 px de
« Tes réglages »), aucun débordement horizontal, 14 régions allumées sur le développé couché
(pectoraux à 1, triceps et épaules à 0,4), 12 à pleine intensité sur le stepper, et **aucune
section** sur « Mobilité », qui n'a rien à montrer.

**Trois défauts de rendu corrigés, tous remontés par l'utilisateur et tous mesurés avant
correction** — c'est la leçon transverse de la session : chacun était invisible aux tests et
aux mesures au DOM.

1. **Le corps était invisible.** Remplissage à 1,11:1 contre la carte, contour à 1,45:1, trait
   rendu à 0,28 px. Corrigé en `--axis` à 0,3.
2. **Les muscles allumés avaient perdu leur contour.** Le remplissage clair recouvrait le trait
   de sa propre région — mesuré en rasterisant à 4× : *pas un pixel allumé ne touchait un pixel
   de trait*. Le trait est passé en troisième couche, au-dessus des deux remplissages. Ça
   referme aussi les coutures d'un pixel entre régions voisines.
3. **« C'est anguleux. »** Vérifié : **836 sommets pour 8 commandes de courbe**, soit 0,9 %. La
   géométrie est polygonale par construction. `roundPath` coupe chaque sommet et le franchit
   par une quadratique passant par le sommet d'origine — le seul lissage qui ne peut pas
   inventer de forme, la courbe restant dans le triangle du coin. Part de courbes portée à
   48,7 %, surface dessinée perdue : 0,9 %. Le module est **conservateur par défaut** : un
   tracé portant déjà une courbe, un triangle (souvent un doigt), ou une coupe qui mordrait
   plus d'un tiers d'une arête reviennent intacts.

**Ce qu'aucun correctif ne règlera : le registre.** Les tracés du fournisseur restent des
approximations grossières. Enquête faite : toute la famille `react-body-highlighter` est de
même nature, et le seul candidat au dessin plus fin n'a **aucune provenance documentée** —
motif d'exclusion déjà retenu pour `free-exercise-db`. Une planche de stock coûte quelques
dizaines d'euros mais ses conditions interdisent de redistribuer le fichier source, ce qu'un
SVG commité dans un dépôt **public** fait par définition. **La vraie question n'est donc pas le
prix, c'est de savoir si le dépôt passe en privé** — auquel cas la planche anatomique *et* les
168 illustrations d'exercices (~150 $) se débloquent d'un seul coup. Décision de l'utilisateur
le 2026-08-11 : **on en reste là pour le moment.**

**Le corps était invisible, et les mesures au DOM ne l'ont pas vu.** Remonté par l'utilisateur
(« je ne vois absolument aucun schéma ») après une première passe déclarée vérifiée. Le
remplissage `--surface-2` du corps mesure **1,11:1** contre la carte et le contour `--border`
**1,45:1** ; en prime, `stroke-width` à 0,1 dans un viewBox large de 35 se rend à **0,28 px**.
Le corps était un fantôme et seuls les muscles allumés ressortaient — des taches blanches
flottantes, pas une anatomie. Contour repassé en `--axis` (l'encre de trait de la charte,
3,5:1 sur une carte) à `stroke-width` 0,3, soit 0,82 px.

**La leçon, et elle vaut au-delà de ce lot :** géométrie mesurée ≠ chose visible. Compter des
nœuds, des tailles et des `fill-opacity` au DOM prouve que le dessin *existe*, jamais qu'on le
*voit*. La contre-mesure est de rasteriser : le SVG est sérialisé avec ses variables résolues,
dessiné sur un canvas par-dessus la couleur de la carte, et les pixels sont comptés. Après
correction : 62 488 px de fond, **14 474 px de corps**, **4 170 px de contour**, 2 065 px de
muscle allumé, et **10,7 % du raster à 3:1 ou mieux** contre 2 % avant. C'est une vérification
qui marche sans capture d'écran, donc sans panneau navigateur affiché.

**Checkpoint téléphone :**
- [ ] Ouvrir « Développé couché (barre) » : les pectoraux sont allumés à fond, les triceps et
      les épaules en second, et ça correspond à ce que tu sens le lendemain.
- [ ] Ouvrir « Escalier (stepper) » : les jambes sont allumées, et « Cardio » reste écrit sous
      « Principal » sans rien allumer.
- [ ] Ouvrir « Mobilité » : aucune silhouette, pas un corps gris et muet.
- [ ] Terminer une séance : le corps de l'écran de fin ne montre que ce qui est enregistré,
      échauffements exclus — puis rouvrir la même séance au Journal et retrouver **le même
      dessin**.
- [ ] Analytics → Séries par muscle : les muscles jamais travaillés restent sombres, et la
      liste dessous affiche toujours des séries entières.
- [ ] Vérifier que la silhouette ne mange pas l'écran au point de rendre les records pénibles à
      atteindre.
- [ ] **La migration `version(4)` s'exécute sur ta vraie base au premier lancement.** Vérifier
      qu'un développé couché du passé allume bien ses triceps, et qu'aucune séance ancienne n'a
      changé de chiffre.

**Mise à jour précédente :** 2026-08-11 (**Records persistés, 1RM estimé et préparation
Android v0.2.0**).

Les records ne sont plus recalculés à l'affichage : ils sont **persistés** dans la table
`personalRecords` et rejoués comme une projection. Chaque série validée écrit ses records dans
la **même transaction** que la série — un crash entre les deux est impossible, conformément à
la règle « pas de perte de données ». Les catégories couvertes sont la charge max, le nombre max
de répétitions, la durée max, la distance max, l'assistance minimale, la meilleure série
(tonnage), le tonnage de séance et le **1RM estimé**. La formule d'estimation se choisit dans
Réglages → Entraînement (Epley par défaut, Brzycki, Lombardi) ; la changer ne touche **que** les
records `best_1rm`. Les valeurs brutes sont stockées en pleine précision, l'affichage arrondit —
au centième en général, au dixième de kg pour le 1RM, la précision du graphique.

La projection porte un numéro de version (`PERSONAL_RECORDS_PROJECTION_VERSION`). Au démarrage,
si la version enregistrée diffère, l'historique existant est reconstruit une fois en tâche de
fond — c'est ce qui rattrape les séances antérieures à cette version sans bloquer l'app. Toute
mutation qui peut déplacer un record le réconcilie : fin de séance, suppression, dévalidation
d'une série, édition ou suppression d'une séance passée, import Hevy, et correction d'une pesée
datée (qui ne rejoue que l'intervalle concerné, pour les exercices au poids du corps). Un
« Réparer les records » manuel reste disponible dans Réglages, et il est idempotent.

Nouvel écran **Records** (Progression → Records, ou depuis une fiche d'exercice, filtré) : un
rail chronologique des jalons, filtrable par exercice et par catégorie.

Portes locales : lint, typecheck, **1191 tests dans 108 fichiers**, build PWA, `android:sync`.

Une assertion périmée traînait dans `ExerciseDetailScreen.test.tsx` : elle attendait encore
`137,34 kg` alors que l'affichage du 1RM arrondit désormais au dixième. C'est le test qui avait
tort — la valeur brute persistée reste bien 137,34 —, l'assertion attend maintenant `137,3 kg`.

Benchmark `npm run bench:records` (fake-indexeddb, Node sous Windows, 2 000 séances × 8
exercices × 4 séries = 64 000 séries) : reconstruction complète initiale **3,85 s**,
reconstruction complète idempotente **5,71 s** (moyenne), reconstruction ciblée sur un exercice
**560 ms**, lecture du rail (les plus récents d'abord) **7,1 ms**. La lecture quotidienne est
donc ~80× plus rapide que la moindre reconstruction : la reconstruction complète reste réservée
au rattrapage de version et au bouton de réparation, jamais au chemin d'écriture. Dette assumée,
inchangée : pas d'index supplémentaire tant qu'un vrai téléphone ne dépasse pas 100 ms sur une
lecture de rail — un chiffre de `fake-indexeddb` ne justifie pas une migration de schéma.

Scénario local-first rejoué au navigateur à 375 px sur le serveur de dev, à travers les
dépôts et l'UI : première série validée → aucun message de félicitations mais un « Premier
jalon » sur Records ; amélioration stricte → la mention « 3 records » apparaît sous la bonne
série et le rail s'ouvre dessus ; égalité → aucun doublon ; édition à la baisse de l'ancien
record dans l'historique → le jalon précédent redevient courant (105 kg ramené à 95 kg, le
record retombe à 100 kg) ; bascule Epley → Brzycki → seul le 1RM change (116,7 → 112,5 kg) ;
rechargement complet → tout survit ; réparation manuelle → 0 créé, 0 modifié, 0 supprimé.
Aucune requête réseau hors du serveur de dev pendant tout le scénario.

**Checkpoint téléphone :** installer `FitTrack-v0.2.0.apk` par-dessus l'app existante **sans la
désinstaller** — c'est tout l'intérêt, le premier lancement doit rattraper l'historique existant
sans bloquer l'usage. À vérifier : le rail Records s'ouvre depuis Progression et reste fluide
sur l'historique complet ; une amélioration en séance apparaît tout de suite et survit à un
force-stop ; noms d'exercices longs, grandes valeurs, filtres et texte à 200 % restent lisibles ;
changer de formule met à jour les 1RM et le graphique ; une édition, une suppression, un import
ou une correction de pesée déplace bien les jalons concernés ; « Réparer les records » ne perd
aucune séance.

**Mise à jour précédente :** 2026-08-11 (**Champ du poids sur toute la ligne et préparation
Android v0.1.5**).

Rattrapage : la branche `claude/locked-exercise-card-padding-296653` portait un correctif jamais
fusionné, découvert en inventoriant les branches après coup — il n'était donc pas dans la v0.1.4.
Sur l'accueil, le champ du poids partageait sa ligne avec le bouton « Enregistrer » : il ne
mesurait que 85 px, dont 36 px de chaque côté pour les pas et le « kg », soit 13 px de texte.
« 80,5 » débordait et sa décimale était rognée — la pesée avait l'air tronquée. Le champ prend
maintenant la ligne entière et l'action passe dessous, la même disposition que la feuille
d'objectif hebdomadaire. Mesures relevées dans l'app par la session d'origine : 207 px de champ
à 375 px de large, 152 px à 320 px, rien de rogné jusqu'à « 1000,5 ».

Le commentaire introduit par ce correctif était rédigé en français ; il est repassé en anglais,
conformément à la règle « code et commentaires en anglais, interface en français ».

La version applicative est `0.1.5`. Portes locales : lint, typecheck, **1070 tests dans 96
fichiers**, build PWA — et `HomeBodyWeightCard.test.tsx` rejoué 5 fois après la fusion, vert à
chaque passe : le correctif d'attente tient malgré le changement de disposition.

**Checkpoint téléphone :** installer `FitTrack-v0.1.5.apk` par-dessus l'app existante sans la
désinstaller. Sur l'accueil, taper « 80,5 » dans le poids du jour : la décimale doit rester
lisible, le champ occuper toute la ligne et le bouton tenir dessous. La disposition n'a **pas**
été revérifiée au navigateur pendant cette session — c'est le point à regarder en premier.

**Mise à jour précédente :** 2026-08-11 (**Test instable du poids du corps et préparation
Android v0.1.4**).

Le test intermittent signalé dans la note précédente est corrigé, et c'était bien le test, pas
l'app. Le paragraphe `role="status"` de `HomeBodyWeightCard` est rendu en permanence — il porte
une espace insécable au repos — donc `findByRole('status')` renvoyait aussitôt l'élément vide et
l'assertion de texte courait contre l'écriture asynchrone : au hasard de l'ordonnancement, elle
lisait la chaîne vide. Les deux assertions de succès attendent maintenant le texte lui-même
(`findByText`), pas le rôle. Le second cas, « saves a first value and announces success », avait
le même défaut sans l'avoir encore montré : son `waitFor` sur le compteur Dexie est satisfait
*à l'intérieur* de `saveBodyWeight`, avant que React n'ait re-rendu l'état `saved`. L'assertion
sur `findByRole('alert')` est laissée telle quelle — le rôle `alert` n'existe que dans l'état
d'erreur, donc la requête est sa propre attente. Aucun texte attendu n'a été touché.

La version applicative est `0.1.4`. Elle embarque aussi le correctif du champ « poids de la
barre » décrit plus bas, qui n'avait pas encore été publié. Portes locales : lint, typecheck,
**1070 tests dans 96 fichiers**, build PWA — et le fichier instable rejoué 8 fois de suite,
vert à chaque passe.

**Checkpoint téléphone :** installer `FitTrack-v0.1.4.apk` par-dessus l'app existante sans la
désinstaller, puis refaire le checkpoint « poids de la barre » ci-dessous : c'est le seul
changement visible de cette version, le reste est du test.

**Mise à jour précédente :** 2026-08-11 (**Poids de la barre : un champ vidé reste vide**).

Dans la feuille « Plaques à charger », effacer le poids de la barre y réécrivait aussitôt
« 0 » : le champ renvoyait `undefined` au parent, qui le ramenait à 0 (`value ?? 0`), et
`NumberInput` resynchronise son texte sur la valeur pendant le rendu. Le zéro revenait donc
dans le champ qu'on venait de vider, et chaque frappe suivante se posait derrière lui — taper
22,5 donnait « 022,5 ». Mesuré dans le navigateur à 375 px.

Le champ garde maintenant son propre brouillon, autorisé à être vide, et ne transmet qu'un
nombre réel : `barWeight` reste un `number` pour l'appelant, et les diagrammes continuent de
calculer sur le dernier poids réellement saisi au lieu de sauter à la barre nue en pleine
frappe. Le champ est remonté à chaque ouverture de la feuille, pour qu'un champ laissé vide ne
revienne pas vide au-dessus d'une barre qui vaut toujours 20 kg.

Portes locales : lint, typecheck, build PWA, **1069 tests passants sur 1070**. L'échec restant,
`HomeBodyWeightCard` « keeps the edited value and allows retry after a rejected write », est
intermittent et **antérieur à ce correctif** : le `role="status"` est toujours présent dans le
DOM (il affiche une espace insécable au repos), donc `findByRole` le trouve immédiatement et
l'assertion court contre l'écriture asynchrone. Le test passe ou échoue au hasard sur le même
arbre de travail — c'est le test qui est à corriger, pas l'app.

**Checkpoint téléphone :** dans une séance en cours, ouvrir « Plaques à charger » sur un
exercice à la barre, effacer le poids de la barre — le champ doit rester vide, pas afficher
« 0 » — puis taper 22,5 : le champ doit lire exactement « 22,5 ».

**Mise à jour précédente :** 2026-08-11 (**Marge des cartes à l'ordre verrouillé et
préparation Android v0.1.3**).

Quand l'ordre des exercices est verrouillé, la poignée de déplacement disparaît : c'était elle
qui écartait le titre du bord arrondi de la carte, et son retrait collait le nom et son
sous-titre contre la bordure. L'en-tête porte désormais lui-même une marge de 16 px, mais
seulement à l'état verrouillé — déverrouillé, la poignée reste le premier élément de la ligne et
la mise en page ne change pas. Même règle dans l'éditeur de routine et dans la séance en cours.
Mesuré dans l'app : 16 px verrouillé, 44 px déverrouillé (la largeur de la poignée) sur les
deux écrans.

La version applicative est `0.1.3`. Portes locales finales : lint, typecheck, **1068 tests dans
96 fichiers**, build PWA.

**Checkpoint téléphone :** installer `FitTrack-v0.1.3.apk` par-dessus l'app existante sans la
désinstaller. Ouvrir une routine et une séance en cours : verrouillé, le titre de chaque
exercice doit respirer par rapport au bord de la carte ; déverrouillé, la poignée doit reprendre
sa place sans que rien d'autre ne bouge.

**Mise à jour précédente :** 2026-08-11 (**Tonnage au poids du corps et préparation
Android v0.1.2**).

Le poids du jour se renseigne directement depuis l'accueil et reste local dans les mesures
datées. Pour une séance historique, FitTrack prend la dernière mesure connue à sa date ;
si la séance précède toutes les mesures, la première mesure disponible sert de repli.
Une correction le même jour remplace la valeur au lieu d'ajouter un doublon.

Le tonnage effectif estimé suit `(poids du corps × coefficient + lest) × reps`, ou
`max(poids du corps × coefficient - assistance, 0) × reps`. Les tractions, dips et
variantes comparables utilisent 100 %, les pompes et mouvements comparables 70 %, les squats,
pistols, mollets et burpees 90 %. Les exercices segmentaires ou isométriques restent exclus :
ce total est une approximation biomécanique, pas une mesure de travail physique absolue.
Les exercices personnalisés en répétitions ou avec assistance acceptent leur propre
coefficient, strictement supérieur à 0 et jusqu’à 100 % ; les instantanés de séance
conservent le coefficient utilisé.

Fin de séance, historique, volume hebdomadaire, courbes et exports utilisent désormais le
même calcul. La version applicative est `0.1.2`. Portes locales finales sur le merge incluant
le correctif d'accueil de Claude : lint, typecheck, **1064 tests dans 94 fichiers**, build PWA,
build Android Web et synchronisation Capacitor à 0.

**Checkpoint téléphone :** installer `FitTrack-v0.1.2.apk` par-dessus l'app existante
sans la désinstaller. Enregistrer le poids sur l'accueil, puis terminer des pompes, squats,
tractions, séries lestées et assistées. Comparer les totaux Fin/Historique/Volume
hebdomadaire, corriger le poids du même jour, forcer l'arrêt et relancer hors ligne pour
confirmer la persistance.

**Mise à jour précédente :** 2026-08-10 (**Verrouillage de l'ordre des exercices**).

L’éditeur de routine et la séance en cours démarrent avec leur ordre verrouillé. Deux cadenas
indépendants, conservés uniquement pendant la session de l’application, masquent ou rendent les
poignées et bloquent réellement le pointeur comme le clavier. Le cadenas de séance se trouve après
« 80 % » ; celui de routine accompagne le résumé de la liste.

La version `0.1.1` est prête pour la release Android. Les portes locales lint, typecheck, tests,
build PWA et synchronisation Capacitor sortent à 0.

**Checkpoint téléphone :** installer `FitTrack-v0.1.1.apk` par-dessus l’application existante sans
la désinstaller. Dans une routine puis une séance, vérifier que les poignées sont absentes par
défaut, que les cadenas fermé/ouvert permettent le déplacement séparément, puis forcer l’arrêt et
relancer l’app pour confirmer le retour des deux cadenas fermés sans perte de données.
**Correctif Claude fusionné le 2026-08-11 :** mesure de l'accueil et mémoïsation de la
régularité, initialement développés sur `perf/home-dashboard-reads` hors lot.

**Point de départ :** l'accueil charge **toutes** les séances terminées pour en afficher trois
(`listCompletedWorkouts` dans `getHomeDashboard`), relit les trois tables de routines en entier,
et rejouait `calculateWeeklyRegularity` à **chaque rendu** — la fonction était appelée dans le
corps de `useHomeDashboard`, ni dans le `useLiveQuery` ni sous mémo. Elle est désormais sous
`useMemo`, avant les retours anticipés, et rend l'objet d'état complet : identité stable en
prime.

**L'écran le plus souvent ouvert était le seul que le banc grande base ne regardait pas.**
`history.bench.ts` mesurait la pagination et l'export ; `home.bench.ts` (`npm run bench:home`)
comble le trou. Les routines et l'objectif hebdomadaire y sont semés **exprès** : sans routines
`pickSuggestedRoutine` sort sur `candidates.length === 0`, sans objectif la régularité rend zéro
sans dérouler sa boucle — le banc aurait mesuré un accueil au repos et annoncé une bonne
nouvelle. Les séances sont rattachées aux routines **à tour de rôle**, c'est-à-dire dans le cas
le plus favorable à un futur arrêt anticipé : une fixture complaisante donne raison à la
correction qu'on avait envie d'écrire.

**Les chiffres, sur 2 000 séances / 64 000 séries** (~71 ms au total pour l'accueil) :

| | ms | part |
|---|---|---|
| Lecture non bornée des séances | 40,5 | 57 % |
| Compteurs des **3** lignes affichées | 17,7 | 25 % |
| Résumés de routines (3 tables entières) | 2,2 | 3 % |
| Régularité hebdomadaire | 1,3 | 2 % |
| Suggestion de routine | 0,076 | 0,1 % |

**Trois corrections « évidentes » que la mesure a annulées.** Avant de mesurer, la suggestion
était annoncée comme le morceau difficile, avec un `lastPerformedAt` dénormalisé sur `Routine`,
ses quatre points de synchronisation et son bouton « réparer » : elle coûte **76 microsecondes**.
La série hebdomadaire était annoncée comme une décision produit — la borner à 52 semaines pour
éviter un parcours sans fin : le banc a déroulé **428 semaines en 1,3 ms**. Et la mémoïsation,
présentée comme l'évidence à faire en premier, est la **plus petite ligne du tableau** ; elle a
été faite parce qu'elle était gratuite, pas parce qu'elle était urgente. **Le coût est dans la
sortie des lignes d'IndexedDB, jamais dans ce qu'on en calcule** — un raisonnement sur la
complexité algorithmique désignait à chaque fois le mauvais coupable.

**Et ça fusionne deux corrections qu'on croyait séparables.** Comme la suggestion a besoin de
tout l'historique, borner la lecture **impose** le parcours arrière avec arrêt anticipé, donc
l'index composé `[status+startedAt]` et sa migration `version(4)`. Une seule décision, pas deux.
Piège noté au passage : `deletedAt === 0` n'est pas dans cet index, il faudra sur-lire et couper
après, sinon trois séances supprimées d'affilée rendent une liste vide.

**À creuser avant d'y toucher :** `buildWorkoutSummaries` pour **3 lignes** coûte 17,7 ms, un
quart de l'écran. Un `anyOf` sur trois identifiants indexés ne devrait pas coûter ça — probable
artefact de `fake-indexeddb`, à confirmer sur le vrai moteur avant d'en tirer quoi que ce soit.

**Ce que ces chiffres ne sont pas :** des millisecondes de téléphone. C'est Node + jsdom +
`fake-indexeddb`, une implémentation JS en mémoire. D'un lancement à l'autre le total a varié de
**71 à 130 ms** sur la même machine — **seules les proportions se lisent**. À 3 échantillons la
marge d'erreur dépassait 60 %, d'où les 15 itérations du banc.

**Décision : on n'en fait pas plus.** À 71 ms pour une base deux ordres de grandeur au-dessus de
l'usage réel, la migration de schéma ne vaut pas son risque. Le banc reste, il tournera quand ça
comptera.

**Checkpoint téléphone :** aucun. Le `useMemo` ne change rien de visible — si l'accueil affiche
autre chose qu'avant, c'est une régression.
**Mise à jour précédente :** 2026-08-09 (**Lot 10 — application Android Capacitor**).

Le projet Android Capacitor 8 est versionné avec l'identifiant `com.fittrack.app`. Le build
Android utilise des chemins relatifs et aucun service worker, tandis que GitHub Pages conserve
son préfixe et sa PWA. Les barres système suivent le thème, les zones sûres Android sont prises
en charge et le bouton Retour suit la pile ou un parent de route déterministe.

Une notification silencieuse reste affichée pendant la séance. Le minuteur programme une
notification Android exacte avec `allowWhileIdle`; la sonnerie Web reste le secours si la
programmation native échoue. Les remplacements et annulations sont sérialisés pour éviter une
ancienne alarme après une nouvelle série.

`.github/workflows/android.yml` vérifie lint, typecheck, tests et sync Capacitor, puis produit un
APK signé avec une clé externe stable. Un tag `v*` crée automatiquement la GitHub Release et y
joint l'APK installable. La procédure de sauvegarde de la clé, de téléchargement, d'installation
et de mise à jour est dans `docs/ANDROID.md`. La clé locale vit sous `.secrets/`, hors Git, et doit
être sauvegardée séparément.

Le nettoyage demandé avant compilation a retiré ou raccourci 938 lignes de commentaires sans
changer les instructions exécutables. Portes finales locales : lint, typecheck, **1000 tests dans
86 fichiers**, build PWA et build/sync Android à 0.

**Checkpoint téléphone :** installer l'APK de la release, autoriser notifications et alarmes,
démarrer une séance, verrouiller l'écran pendant un repos, vérifier la sonnerie à l'échéance,
puis installer l'APK suivant par-dessus sans désinstaller et confirmer que l'historique reste.

**Mise à jour précédente :** 2026-08-02 (**Lot 9 — PWA : l'app s'installe et démarre sans
réseau**). Le jalon V1. La ligne 3 du README promettait « hors-ligne » depuis le Lot 0 ;
elle est vraie depuis ce lot et pas avant.

**Ce que le lot ajoute, en une phrase :** `vite-plugin-pwa` en `registerType: 'prompt'`, un
manifeste complet, quatre icônes, un bandeau « nouvelle version disponible », une ligne
d'installation dans les réglages, et `docs/INSTALLATION.md`.

**Le vrai sujet n'était pas l'installation, c'était la mise à jour.** Le Lot 0 avait déjà
consigné la version douce du problème : après un déploiement, l'onglet servait l'ancien
`index.html` pendant quelques minutes. Un service worker transforme ces quelques minutes en
**définitif**, parce qu'une fois installé ce n'est plus le réseau qui décide de la version
qui tourne. D'où `registerType: 'prompt'` — mais ça ne fait que la moitié du travail :
l'autre moitié est que **quelque chose doit le dire**, sinon le nouveau worker attend
derrière l'ancien indéfiniment et l'app est figée tout aussi complètement, en silence.
`UpdateBanner` est cette moitié.

**Et le risque symétrique — recharger sous une séance en cours — est la raison pour laquelle
le bandeau demande au lieu d'agir.** Règle n°4. « Plus tard » ne fait que masquer : le worker
continue d'attendre, la bascule se fera à une ouverture suivante.

**Le bandeau a été vérifié en déployant vraiment une v2 sous une page ouverte**, pas en
lisant la config : v1 installée et aux commandes → build d'une v2 → bandeau affiché → « Plus
tard » masque → rechargement, le bandeau revient → « Recharger » bascule et l'app repart.
**Le premier essai a échoué pour une raison qui n'était pas un bug de l'app** : la
modification déclenchant la v2 était un commentaire, que la minification supprime — le bundle
ressortait octet pour octet identique et le worker ne voyait donc aucune nouvelle version.
À retenir pour le Lot 10 et pour tout test de déploiement : **une v2 se fabrique avec une
chaîne visible, jamais avec un commentaire.**

**Le hors-ligne a été vérifié en coupant le réseau dans un vrai Chromium** : accueil,
bibliothèque (175 exercices), et une route différée (`Progression`) s'ouvrent toutes, zéro
erreur de page. Le précache fait **28 entrées / 777 Kio** — la limite de 2 Mio par fichier de
Workbox n'est pas en vue, le plus gros morceau étant `index-*.js` à 433 Ko. Cette limite
mérite quand même d'être surveillée : elle est **silencieuse**, un fichier au-dessus est
simplement omis du précache et le build reste vert.

**Les icônes sont générées, pas dessinées.** `scripts/generate-icons.mjs` reprend la
géométrie de `BarbellIcon` (`src/ui/icons.tsx`) et sort le 192, le 512, le maskable et
l'apple-touch. `sharp` n'est **pas** en devDependency : le script tourne à la main quand la
marque change, et la CI fait un `npm ci` à chaque push — payer une chaîne d'image native à
chaque déploiement pour quatre fichiers déjà commités serait un mauvais échange. La commande
est dans l'en-tête du script.

**Le maskable est un fichier séparé, pas un `purpose: 'any maskable'` partagé.** Un lanceur
qui rogne l'icône « any » mangerait ses coins arrondis ; et le dessin n'est pas le même — la
version maskable est réduite (échelle 16 au lieu de 18,5) pour tenir dans le cercle de
sûreté de 80 %, où la marque à sa taille normale passait sur le papier et paraissait à
l'étroit à l'œil.

**Deux détails qui ne se voient qu'une fois sur le téléphone :** iOS ne lit pas le manifeste
pour choisir son icône, il lit `<link rel="apple-touch-icon">` — sans cette balise, « Sur
l'écran d'accueil » depuis Safari pose une capture de la page. Et le favicon reste en
data-URI malgré `public/icon.svg`, parce qu'il s'affiche au premier rendu, avant que le
service worker n'existe.

**`isInstalled()` garde `matchMedia` derrière un `typeof`** : jsdom ne l'implémente pas du
tout ici (vérifié, ce n'est pas une précaution théorique), et un appel nu ferait échouer
chaque test montant l'écran de réglages — pour une ligne qui ne parle que d'affichage.

**Ce que le lot ne fait pas :** le minuteur ne sonne toujours pas écran éteint. Une PWA ne
sait pas le faire de façon fiable ; c'est la raison d'être du Lot 10.

Les quatre portes sortent à 0 : lint, typecheck, **945 tests dans 80 fichiers**, build Vite.

**Checkpoint téléphone (jalon V1) :**
1. Ouvrir le site dans Chrome, aller dans **Réglages → Application → Installer sur l'écran
   d'accueil**. L'icône doit apparaître dans le tiroir d'applications.
2. Lancer depuis l'icône : **pas de barre d'adresse**.
3. La même section doit afficher « Prête pour le hors-ligne ».
4. **Mode avion, fermer l'app, la relancer depuis l'icône** : elle doit démarrer entièrement.
5. Pousser une version et rouvrir l'app : le bandeau « Une nouvelle version est disponible »
   doit apparaître, et « Recharger » doit basculer dessus.

La procédure complète, iPhone compris, est dans `docs/INSTALLATION.md`.

**Mise à jour précédente :** 2026-08-02 (**sauvegarde CSV : export depuis FitTrack, réimport
comme un fichier Hevy**). Dernier morceau avant le v1, décidé en discussion : un seul format
pour sortir et pour rentrer, plutôt qu'un export d'un côté et un importeur de l'autre.

**Le format est celui de Hevy, plus cinq colonnes.** Les 14 colonnes d'origine, dans leur
ordre, et `fittrack_routine`, `fittrack_rest_seconds`, `fittrack_measurement`,
`fittrack_equipment`, `fittrack_side` — exactement ce que le format de Hevy ne sait pas
transporter. Elles sont facultatives des deux côtés : un export Hevy authentique n'en a
aucune et s'importe comme avant, une valeur illisible est ignorée plutôt que refusée. Le
fichier reste donc lisible par n'importe quel outil qui lit du Hevy, et l'app y retrouve ce
que Hevy aurait perdu. **Réutiliser l'importeur existant est ce qui rend l'affaire petite :
seul le sérialiseur était à écrire.**

**Le vrai bug était ailleurs : l'import fabriquait une routine à partir de séances qui
restaient sans routine.** `hevyWorkoutEntities` écrivait `routineId: ''` pendant que
`hevyRoutineImport` déduisait les routines de ces mêmes séances groupées par titre. D'où
« LOWER A — jamais réalisée » sur un accueil dont l'historique en était plein (rapporté du
téléphone), et un export CSV qui ressortait sans routine ce que l'import venait d'en
déduire. Les séances importées pointent désormais vers la routine née d'elles. Le
rattachement par le nom dans `pickSuggestedRoutine` reste : il rattrape les bases déjà
importées, qu'aucune migration ne réécrit.

**Ce que la reconstruction rend maintenant, en plus :** le repos par exercice (colonne
`fittrack_rest_seconds`), les supersets — la donnée était déjà dans `superset_id`, le
constructeur de routines la mettait simplement à 0 — et le côté travaillé des séries
unilatérales. Les routines dormantes (aucune séance depuis un mois, `isDormantRoutine`)
partent dans un dossier « … — Archivé » séparé : un historique un peu long en ramène
toujours, et la liste qu'on ouvre avant une séance doit rester celle des routines vivantes.

**L'heure exportée est celle du fuseau de l'appareil, pas celle stockée par la séance.** Le
format n'écrit qu'une heure murale à la minute, et l'import la relit dans le fuseau de
l'appareil : écrire l'heure d'une séance faite à l'étranger la ferait revenir décalée. Entre
conserver l'instant et conserver l'heure affichée, une sauvegarde conserve l'instant. Sur un
téléphone qui n'a pas voyagé, les deux sont la même valeur — changements d'heure compris,
l'offset étant lu à l'instant de la séance.

**L'import sur une base non vide : on entre, on lit, on va vider.** Les séances sont
dédoublonnées par leur clé d'import, mais les routines reconstruites viendraient doubler
celles déjà là. L'écran s'ouvre donc quand même et explique, avec un bouton qui emmène à
l'écran de vidage — plutôt qu'un bouton grisé qui n'aurait rien dit. « Importer quand même »
reste d'un cran en dessous : ajouter un export Hevy à un historique existant est le cas pour
lequel cet écran a été écrit.

**Ce qui n'est pas dans le fichier, et ne peut pas y être :** une routine **jamais
réalisée** (le format décrit des séances, elle n'en a aucune), les réglages, et les secondes
des horaires. Le JSON complet du Lot 8 reste le seul « tout revient à l'identique ».

**Le test qui compte est l'aller-retour** (`csvRoundTrip.test.ts`) : on sème une séance
tordue à dessein — superset, échauffement, RPE, série unilatérale, repos non standard, notes
à guillemets —, on exporte, **on vide la base**, on réimporte, on compare. Vérifié aussi en
navigateur réel : import d'un `fittrack-….csv`, deux dossiers de routines dont l'archive,
accueil qui affiche « Réalisée le 3 janvier » au lieu de « jamais », téléchargement du
fichier et relecture de son en-tête. Les quatre portes sortent à 0 : lint, typecheck,
**921 tests dans 78 fichiers**, build Vite.

**Checkpoint téléphone :** Réglages → « Sauvegarder l'historique (CSV) » : la feuille de
partage doit proposer d'enregistrer le fichier (Drive, Fichiers…). Le rouvrir dans un
tableur pour vérifier les accents. Puis Historique → Importer : l'écran doit demander de
vider d'abord. Vider par Réglages → Diagnostic, revenir, choisir le fichier téléchargé, et
retrouver ses séances, ses routines — et le dossier « Archivé » s'il reste des routines
qu'on ne fait plus.

**Mise à jour précédente :** 2026-08-01 (**les graphiques passent dans la teinte du thème :
jeton `--accent-data`**). Rapporté du téléphone comme « le orange ne s'applique pas, mais
seulement en mode sombre » sur le volume et sur la progression d'exercice.

**Le diagnostic tenait en une capture des deux thèmes côte à côte.** Les marques des
graphiques étaient dessinées en `--text-2` — une couleur réglée pour du **texte**. En clair,
la lisibilité la pousse vers #5c675e : sombre, et encore visiblement vert, donc les colonnes
avaient l'air d'appartenir à l'app. En sombre elle la pousse vers #b9b1a8 : si clair que la
teinte a disparu et qu'une barre se lit blanche. D'où un défaut qui n'existait vraiment
qu'en sombre, sans qu'aucune ligne de code ne soit conditionnée au thème. **Une couleur
réglée pour un paragraphe ne peut pas être aussi l'encre de données de l'app.**

**`--accent-data` est un jeton neuf parce que c'est un métier neuf** — le même raisonnement
que `--axis` au retour précédent. Deux intensités d'**une seule** teinte, jamais une teinte
contre un gris : le ton atténué est l'observation ordinaire, `--accent-ink` est celle qui
veut dire quelque chose. Mesuré au plancher des objets graphiques (3:1) et les deux tons
tenus à plus de 2:1 l'un de l'autre — sombre #a85a20 (3,5:1 sur une carte, 2,2:1 contre
l'encre), clair #4d9c72 (3,3:1 sur une carte, 2,1:1 contre l'encre). En clair l'atténué est
plus **clair** que l'encre, en sombre plus **foncé** : chacun s'éloigne de son fond.

**Le contrat de sens n'a pas bougé, il est juste devenu lisible.** L'accent plein continue
de dire « objectif atteint » (séances) et « record » (courbe), et le volume n'a toujours
aucune colonne pleine — il n'a ni objectif ni record, et une grande quantité n'est pas un
compliment. Ce qui a changé, c'est que les autres marques ne sont plus grises.

**Trois phrases de légende, et c'est la moitié du correctif.** Deux intensités d'une même
teinte que personne n'explique sont de la décoration ; nommées, c'est de l'information —
« Les colonnes pleines sont les semaines où l'objectif est atteint », « Le point plein est
le record de la période », et sur le volume « Toutes les semaines ont la même couleur : le
volume n'a pas d'objectif à atteindre », qui répond à la question telle qu'elle a été posée.
Chacune est conditionnée à son repère : pas de légende d'objectif si aucun objectif n'a
jamais été défini, pas de légende de record sur une séance unique.

**Le test du cadre partagé reconnaissait une barre à sa couleur** (`!== var(--text-2)`) et
serait devenu aveugle. Il liste maintenant les deux encres de données. Vérifié par mutant :
repeindre la ligne de base en `--border` fait toujours tomber le test. Les quatre portes
sortent à 0 : lint, typecheck, **880 tests dans 72 fichiers**, build Vite.

**Checkpoint téléphone :** en sombre, ouvrir Progression → Volume d'entraînement et
Progression d'exercice : les colonnes et la courbe doivent être orange, pas beige. Sur
Séances par semaine, vérifier qu'on distingue au premier coup d'œil la semaine à l'objectif
(orange vif) des autres (orange sourd) — et lire les trois légendes sous les graphiques.
Repasser en clair et vérifier la même chose en vert.

**Mise à jour précédente :** 2026-08-01 (**V2 de l'écran d'accueil + Progression dans la
barre**). L'accueil était un compteur à zéro et un bouton ; il répond maintenant à quatre
questions dans l'ordre où on se les pose : où j'en suis cette semaine, quoi lancer, ce que
j'ai fait dernièrement, où sont les courbes.

**La suggestion est une fonction pure, pas une heuristique.** `pickSuggestedRoutine`
(`src/lib/home.ts`) rend la routine **réalisée le moins récemment**, une routine jamais faite
passant devant toutes les autres, égalités tranchées par l'ordre de la liste. Aucun modèle de
récupération musculaire : il demanderait des données que l'app n'a pas, et une suggestion
qu'on ne peut pas expliquer en une phrase est une suggestion qu'on ignore — la phrase est
d'ailleurs écrite sous le bouton. Les séances libres et les imports sans `routineId` sont
ignorés, et une routine supprimée ne peut pas revenir par la porte de l'historique : la carte
des dernières réalisations est filtrée sur les routines vivantes avant d'être lue.

**Une seule lecture pour tout l'écran.** `getHomeDashboard` lit les séances terminées **une
fois** et les trois blocs s'y servent : la régularité prend leurs dates, la suggestion leurs
`routineId`, le mini-historique leurs trois premières lignes — et les compteurs
d'exercices/séries ne sont calculés que pour ces trois-là. `listFilteredCompletedWorkouts` et
`buildSummaries` d'`history.ts` sont devenus publics pour ça, plutôt que de rejouer la même
requête à côté.

**Zéro deuxième implémentation de la série hebdomadaire.** L'accueil appelle
`calculateWeeklyRegularity`, la fonction de l'Historique, sur les mêmes dates et le même
historique d'objectifs. **Sans objectif défini, la carte n'affiche qu'une colonne** : la série
vaut zéro tant qu'il n'y a rien à tenir, et « 0 semaines d'affilée » à quelqu'un qui
s'entraîne trois fois par semaine serait un reproche fabriqué. Pas de `2 / 4` inventé non
plus.

**Progression remplace Réglages dans la barre.** On regarde ses courbes toutes les semaines,
on change une préférence trois fois par an. Les Réglages passent dans l'en-tête de l'accueil
(icône `SlidersIcon`), la barre reste à cinq onglets (§12.1), et `/analytics` devient une
racine d'onglet — sa flèche de retour vers l'Historique est retirée, une flèche sur une racine
d'onglet promet un ailleurs qui n'existe pas. Le chargement paresseux des cinq écrans
d'analyse est intact : l'accueil ne dessine aucun graphique, seulement trois liens.

**Preuves.** Six tests neufs sur la fonction de suggestion (jamais réalisée prioritaire, moins
récente choisie, séance sans routine ignorée, routine supprimée écartée, égalité stable dans
les deux sens, aucune routine → `null`). Les quatre portes sortent avec le code 0 : typecheck,
lint, **880 tests dans 72 fichiers** et build Vite. Vérifié en pilotant le navigateur sur les
deux thèmes : base vide (« aucune routine »), écran plein sans objectif hebdo (une colonne),
écran plein avec objectif (deux colonnes), et les deux entrées vers les analyses. Les états
de chargement et d'erreur de lecture n'ont pas été reproduits à l'écran — seul le code les
couvre.

**Checkpoint téléphone :** ouvrir l'accueil et vérifier que la routine proposée est bien celle
que tu as faite il y a le plus longtemps. Taper la carte de la semaine → Séances par semaine.
Taper une séance du mini-historique → son détail. Vérifier les cinq onglets (Accueil,
Routines, Historique, Progression, Exercices) et que l'icône en haut à droite ouvre les
Réglages. Démarrer la routine proposée, puis revenir à l'accueil : le bouton « Démarrer »
doit être inerte et la bande « séance libre » avoir disparu tant que la séance tourne.

**Dernière mise à jour :** 2026-08-01 (**retours téléphone sur la palette : cadre de
graphique unifié, header de séance décollé**). Trois défauts rapportés en photo, trois
causes distinctes — aucune n'était la palette.

**Les deux graphiques en colonnes avaient divergé sur leurs trois marques communes.**
Ligne de base, moignon de zéro et sélection : `--border` d'un côté, `--text-2` de l'autre ;
une fente pleine ici, un contour là. `ChartSurface` avait factorisé l'interaction en
laissant le dessin de côté — vrai d'une courbe contre un histogramme, **faux d'un
histogramme contre un histogramme**. `ColumnFrame` possède désormais les trois marques et
les deux écrans le partagent : la façon dont deux graphiques restent identiques, c'est
qu'il n'y en a plus qu'un à changer.

**La sélection devient une marque sous la colonne.** Les deux réponses précédentes
échouaient à la mesure sur le thème clair : la fente pleine était `--surface-2` sur une
carte blanche — **1,14:1, invisible** — et le contour traversant la base se lisait comme un
rectangle égaré. La marque reprend l'atome de l'onglet engagé de la barre du bas. Elle
fonctionne à n'importe quelle hauteur, **y compris zéro** — la semaine vide est justement
celle qui mérite d'être tapée — et elle est en `--text-1`, **jamais l'accent** : sur le
graphique des séances l'accent dit déjà « objectif atteint », et une encre ne peut pas dire
deux choses sur un même dessin.

**`--axis` est un jeton neuf parce que c'est un métier neuf.** Ni `--border`, réglé pour un
bord de carte et qui mesure **1,35:1** sur une carte claire — invisible sous une barre — ni
`--text-2`, qui dessinait une ligne de base plus lourde que la donnée posée dessus. Son
propre plancher : 3:1, le seuil des objets graphiques.

**Le « ça colle » du header avait une cause exacte, et elle mordait ailleurs aussi.**
`HeaderAction` portait `-mr-2` : une marge négative qui existe pour que la cible de 48 px
déborde la marge d'écran et que le glyphe tombe sur le bord optique. C'est une propriété du
bouton **du bord**, pas de tous. Appliquée à chacun, elle mangeait exactement le `gap-2` du
header de séance — d'où la puce deload collée au chrono — et **superposait de 8 px les deux
icônes du header de l'Historique**, sans que personne l'ait vu. `last:-mr-2` corrige les
deux. Vérifié en pilotant : gaps de 8 px réels, cibles de 48 px intactes.

**Le chrono passe devant les commandes.** Posé entre le deload et le menu, il était encadré
de deux boutons et se lisait comme un troisième bouton qui refuse de répondre. La lecture
d'abord, les commandes groupées contre le bord — l'ordre de l'en-tête des routines, où le
compte précède le `+`. Il gagne la graisse d'un instrument et **un nom accessible** : un
lecteur d'écran annonçait « 0:02 » tout seul. L'étiquette est optionnelle et posée au seul
appelant où le chiffre est nu ; sur l'écran de fin et la barre de reprise il est déjà sous
un libellé écrit, et le nommer ferait doublon.

**L'état deload actif passe en `--accent-soft`.** Il était un aplat `--surface-2`, une tache
grise ; le jeton existe désormais et son emploi est précisément celui-là — un état que
l'encre d'accent désigne déjà (6,4:1 en sombre, 6,5:1 en clair).

**Preuves.** Un test neuf compare les deux cadres marque par marque, et un mutant a été tué
en le vérifiant : remettre une ligne de base propre au graphique de volume fait sortir
**3 marques contre 2** et casse aussi le test du curseur. Les quatre portes sortent avec le
code 0 : lint, typecheck, **874 tests dans 71 fichiers** et build Vite.

**Checkpoint téléphone :** ouvrir Analyses → Séances par semaine puis Volume
d'entraînement, et vérifier que les deux écrans ont la même ligne de base, le même moignon
de zéro et le même curseur. Taper une semaine vide au milieu : elle doit rester
sélectionnable et son curseur visible. Puis, en séance, vérifier l'espace entre le chrono,
la puce `80%` et le menu, et le fond orange sourd une fois le deload appliqué.

**Dernière mise à jour :** 2026-08-01 (**nouvelle palette — vert en clair, orange en
sombre**). Recolorage complet des deux thèmes depuis une référence visuelle fournie par
l'utilisateur. Aucune logique, aucun layout, aucune structure, aucune chaîne d'UI n'a changé.

**Le recolorage a tenu dans les jetons, et c'est la mesure de la dette évitée.** Les 622 usages
de couleur répartis sur 94 fichiers passaient déjà tous par `var(--…)` : aucune classe de palette
Tailwind, aucun hex dans un composant. `src/index.css` était le seul fichier à recolorer.

**L'accent devient dépendant du thème, ce qu'il n'était pas.** Le vert acide était commun aux deux
thèmes ; il y a maintenant un vert `#15803D` en clair et un orange `#FF8A3D` en sombre. `@theme`
étant un scope statique unique, il ne fait plus que **relayer** (`--color-accent: var(--accent-fill)`).
Les trois noms publics `--color-accent`, `--color-accent-dim` et `--color-accent-fg` sont inchangés :
aucun composant n'a bougé et les utilitaires `bg-accent` suivent toujours le thème. Vérifié en
pilotant sur les deux thèmes plutôt que supposé.

**Un écart assumé, mesuré, et c'est le seul.** En clair, `#15803D` est le **fond** de bouton, pas
l'encre : il donne **4,33:1 sur `--surface-2`**, sous le plancher de 4,5, et l'encre d'accent
atterrit justement sur les lignes pressées et les étiquettes de 11 px. `--accent-ink` prend donc
`#166534`, le hover de la palette fournie — **7,1:1 sur une carte, 6,3:1 sur `--surface-2`**. En
sombre la question ne se pose pas : l'orange fait 8,0:1 sur le fond, encre et fond partagent une
valeur. La séparation fill/ink du Lot 1 n'a pas été inventée pour l'occasion, elle a resservi telle
quelle.

**`--accent-soft` a un consommateur, sinon c'était un jeton mort.** La carte soulevée pendant un
glisser-déposer utilisait `--surface-2`, qui est aussi sa couleur **au repos** : soulever ne
changeait que l'anneau. Trois fichiers, un échange de couleur, zéro layout.

**Couleurs codées en dur restantes, toutes remplacées :** le voile des feuilles (`bg-black/60` →
jeton `--scrim`), la barre système Android dans `stores/theme.ts` **et** dans `index.html` (le
script anti-flash synchrone, qui aurait sinon fait clignoter l'ancien noir au démarrage), et le
favicon SVG inline, qui portait encore le noir et le vert acide.

**Trois commentaires corrigés plutôt que laissés à mentir.** Ils citaient des mesures du vert acide
(« 1,29:1 sur la page claire ») devenues fausses. Dans ce dépôt un commentaire porte une mesure ;
un chiffre périmé y coûte plus cher qu'une phrase absente.

**Un test modifié, signalé plutôt que glissé.** `theme.test.ts` fixait `#0a0a0b` / `#ffffff` sur la
balise `theme-color`. Ce qu'il vérifie — la balise suit `--surface-0` — est intact ; c'est la
palette qui a changé, pas la règle.

**Preuves fraîches.** Les quatre portes sortent avec le code 0 : lint, typecheck, **870 tests dans
70 fichiers** et build Vite. `--danger` et `--warn` restent hors palette fournie ; seule leur tenue
sur les nouvelles surfaces a été revérifiée (rouge à 5,8:1 en sombre, 5,7:1 en clair).

**Checkpoint téléphone :** ouvrir l'app, vérifier l'orange sur le bouton primaire, l'onglet actif et
une série validée. Basculer en thème clair dans Réglages et contrôler que le vert n'a jamais l'air
délavé sur une ligne pressée ni sur une étiquette en petites capitales. Vérifier enfin qu'aucun
flash noir n'apparaît au démarrage en thème clair.

**Dernière mise à jour :** 2026-08-01 (**bouton deload en séance livré**).

- Bouton `80%` ajouté au header de la séance en cours : confirmation, réduction des seules séries
  restantes au pas de 2,5 kg, protection contre la double application et reprise après fermeture.
- Le deload ajoute sans écraser la note `Deload — charges réduites à 80 %.` ; l'export Markdown la
  restitue par son pipeline de notes existant.
- Checkpoint téléphone : valider une première série, activer `80%`, vérifier que seules les séries
  restantes changent, tuer/reprendre l'app puis partager la séance et contrôler la note.

**Preuves fraîches.** Les quatre portes sortent avec le code 0 : typecheck, **870 tests dans 70
fichiers**, build Vite de **197 modules** et lint.

**Dernière mise à jour :** 2026-08-01 (**export de tout l’historique depuis les
Réglages**). La section Données propose désormais « Exporter tout
l’historique ». Le document réutilise sans divergence la chaîne canonique
`listHistoricalWorkouts` → `projectCoachExport` → `serializeMarkdown`, avec la
portée `{ kind: 'all-history' }`, puis ouvre la feuille de partage native. Si
elle n’est pas disponible, le presse-papiers prend le relais ; les issues de
copie et d’échec sont annoncées dans l’écran.

**Preuves.** Le cycle TDD couvre deux séances réunies dans un même Markdown, la
portée globale, l’historique vide, le repli presse-papiers et l’échec total. Les
tests ciblés de Réglages, du partage individuel et de l’adaptateur de plateforme
passent : **17 tests dans 3 fichiers**. Les portes fraîches sortent avec le code
0 : lint, typecheck, **839 tests dans 67 fichiers** et build Vite de **194
modules**.

**Checkpoint téléphone demandé :** ouvrir Réglages → Données → Exporter tout
l’historique. Vérifier que la feuille de partage contient les premières et
dernières séances et annonce « Périmètre : tout l’historique ».

**Dernière mise à jour :** 2026-08-01 (**export coach — autorité des séries de
travail centralisée**). Quand les échauffements sont exclus, le contenu exporté
et `workingSetCount` reposent désormais tous deux sur `isWorkingSet`. Le format,
les options et le comportement public de l’export restent inchangés.

**Preuves.** Le test de caractérisation couvre les séries `warmup`, `normal`,
`dropset` et `failure`, leur renumérotation et la cohérence du compteur. Un
mutant manuel limitant l’autorité canonique aux séries `normal` a bien fait
échouer le test (1 série comptée au lieu de 3). Les portes fraîches sortent avec
le code 0 : lint, typecheck, **835 tests dans 66 fichiers**, build Vite de
**194 modules** et `git diff --check`.

**Checkpoint téléphone :** aucun — aucun écran, format d’export ni comportement
utilisateur n’a changé.

**Dernière mise à jour :** 2026-08-01 (**phase 6 — chronologie hebdomadaire
centralisée**). `knownWeekStarts` est désormais l’unique autorité qui décide
quelles semaines locales sont suffisamment connues pour être rendues. Les
analyses « Séances par semaine » et « Volume d’entraînement » lui confient la
même règle : commencer à la borne seulement quand l’historique la précède,
sinon à la plus ancienne semaine observée, conserver les trous internes et ne
rien inventer pour un historique complet vide.

**Comportement préservé.** Les interfaces de `weeklySessionCounts` et
`weeklyVolumeBuckets` restent inchangées. Comptage, objectifs historiques,
filtrage de période, offsets des séances, tonnage et durée restent propres à
leurs moteurs. L’énumération passe toujours par `startOfLocalWeek` et
`addLocalWeeks`, jamais par une durée fixe, afin de traverser les changements
d’heure sans décaler les semaines.

**Preuves.** Quatre tests ciblent directement la nouvelle seam : fenêtre
connue, plus ancienne semaine, historique `Tout` vide et DST. Deux mutants
manuels ont été tués, l’un ignorant `hasEarlierHistory`, l’autre imposant la
borne même quand l’application ne connaît pas encore ces semaines. La revue de
tâche ne relève aucun problème critique, important ou mineur. Les portes
fraîches sortent avec le code 0 : lint, typecheck, **835 tests dans 66 fichiers**,
build Vite de **194 modules** et `git diff --check`.

**Checkpoint téléphone demandé :** ouvrir Historique → Analyses, comparer les
vues 4 semaines et `Tout` de « Séances par semaine » puis « Volume
d’entraînement ». Les deux écrans doivent afficher les mêmes semaines connues,
les mêmes zéros internes, totaux et moyennes qu’avant cette refacto.

**Dernière mise à jour :** 2026-08-01 (**phase 6 — parcours de routine protégé
et collection approfondie**). Un test d’intégration traverse désormais les
vrais `RoutinesScreen`, `RoutineEditorScreen` et `ExercisePickerScreen`, avec le
routeur React, les repositories, Dexie et `fake-indexeddb`, sans mock. Il crée
une routine vide, la renomme, choisit un exercice, ajoute une deuxième série,
démonte entièrement le parcours puis remonte la liste et retrouve le nom ainsi
que le résumé persistant `1 exercice · 2 séries`.

**Premier gros découpage de `RoutinesScreen` terminé.** Le nouveau module profond
`RoutineCollection` reçoit seulement les résumés chargés, les dossiers chargés
et un callback d’intentions. Il masque l’état vide, les lignes, les headings
racine/dossiers, le drag clavier/tactile et la conversion d’un déplacement en
placement persistant. `RoutinesScreen` conserve les live queries, la distinction
chargement/vide, la navigation, les commandes repositories et toutes les
feuilles. Il passe de **429 à 280 lignes** ; le nouveau module en compte 197.
Aucun rendu, texte, route, repository, schéma, migration, donnée ou dépendance
n’a changé.

**Preuves.** Le test de parcours a tué un mutant qui neutralisait l’écriture des
exercices sélectionnés. Les tests d’interface ont tué la suppression du heading
racine et la perte du contexte dossier pendant un déplacement. Les revues de
tâche puis la revue globale finale ne relèvent plus aucun problème critique,
important ou mineur. Les portes fraîches sortent avec le code 0 : lint,
typecheck, **831 tests dans 66 fichiers**, build Vite de **194 modules** et
`git diff --check`.

**Suite de la phase 6.** `RoutineEditorScreen` reste hors de cette tranche à 318
lignes ; son éventuel découpage demandera une preuve de préservation et un plan
séparés. Le checkpoint manuel Hevy décrit dans l’entrée suivante reste lui aussi
à effectuer indépendamment.

**Checkpoint téléphone demandé :** créer une routine vide, la renommer, ajouter
un exercice et une deuxième série, forcer la fermeture de FitTrack, rouvrir
l’application, puis vérifier que la liste affiche le même nom et
`1 exercice · 2 séries`. Aucun changement visuel n’est attendu.

**Dernière mise à jour :** 2026-08-01 (**identité fiable des exercices importés
livrée**). La cause exacte de la régression était l’alias « Développé Debout
Poulie Centrée » encodé comme certitude vers `cable-shoulder-press`, alors que
les quatre séries concernées dans les deux séances `LOWER A` sont un **Pallof
press** pour les abdominaux. La suggestion pointe désormais vers
`pallof-press`, déjà correctement décrit `abs + cable + weight_reps`.

**Autorité séparée et persistante.** Le schéma Dexie v3 ajoute la table
`externalExerciseBindings`, distincte du catalogue canonique `exercises`. Une
clé d’identité exacte conserve tous les mots discriminants du titre source
(`poulie`, `machine`, `assis`, `debout`, `centrée`) tout en normalisant seulement
Unicode, casse, accents, ponctuation et espaces. Les aliases et le classement
lexical ne sont que des suggestions : ils ne sont **jamais préconfirmés** et
seule une décision explicite de l’utilisateur fait autorité puis peut être
réutilisée aux imports suivants. Une liaison absente ou devenue incompatible
reste à confirmer ou passe en conflit ; aucun fallback silencieux ne la
remplace.

**Import sûr et réimport idempotent.** Les exercices personnalisés éventuels,
liaisons confirmées, séances, séries, routines et clés d’import sont écrits
atomiquement dans une seule transaction : une erreur annule tout. Réimporter le
même CSV crée zéro séance, zéro série, zéro routine et zéro exercice en doublon.
La bibliothèque d’exercices n’a pas été remplacée : elle contenait déjà le bon
mouvement et une bibliothèque plus grande n’aurait pas fourni l’identifiant
stable absent du CSV Hevy.

**Chemin complet durci.** Le parseur groupe désormais les variantes de casse,
d’accent et de ponctuation dès leur clé d’identité exacte, avant l’inférence du
type de mesure. Le draft appelle réellement le registre central pour produire
les décisions autorisées ; le repository ne peut plus transformer seul une
suggestion en confirmation utilisateur. Le scénario anonymisé issu du CSV réel
protège 6 séances, 25 identités et 136 séries, l’échec transactionnel tardif,
la conservation des choix, la reprise et l’invariance des neuf tables au
réimport. Toutes les valeurs de performance de la fixture sont synthétiques ;
les commits locaux qui contenaient brièvement les anciennes valeurs ont été
réécrits et leur blob purgé avant tout push.

**Preuves fraîches.** `npm run lint` et `npm run typecheck` sortent avec le code
0 ; les **823 tests dans 64 fichiers** passent ; le build de production Vite
compile **193 modules** et sort avec le code 0. La revue finale de l’ensemble
des changements ne relève aucun problème critique, important ou mineur.

**Checkpoint téléphone demandé :** réinitialiser FitTrack, importer le CSV,
confirmer les **25 identités**, inspecter les deux séances `LOWER A` et les
analyses musculaires, puis réimporter exactement le même fichier et constater
zéro doublon.

**Dernière mise à jour :** 2026-07-29 (**phase 6 — première preuve
d’intégration du parcours de séance**). `WorkoutScreen` possède désormais un
test qui traverse le vrai routeur React, les repositories, Dexie et
`fake-indexeddb` sans mock : il saisit 80 kg et 10 répétitions, attend leur
écriture, démonte entièrement l’écran, le remonte puis vérifie la reprise avant
de valider la série.

**L’invariant « aucune perte de données » est protégé à son interface
utilisateur.** Les valeurs restent écrites avant la coche et la validation
conserve charge et répétitions tout en ajoutant `isCompleted` et `performedAt`.
Le store éphémère de repos est arrêté de part et d’autre du scénario pour ne
laisser aucun état singleton entre les tests. Aucun fichier de production,
texte UI, schéma, donnée ou dépendance n’a changé.

**Preuves.** Un mutant manuel qui coupait le branchement
`onWrite → updateSetValues` a fait échouer l’attente Dexie sur les deux valeurs,
puis le code exact a été restauré et son absence de diff confirmée. Une revue
indépendante n’a relevé aucun problème critique, important ou mineur. Lint,
typecheck, **776 tests dans 59 fichiers** et build de production passent.

**Checkpoint téléphone :** pendant une séance, saisir charge et répétitions
sans cocher la série, forcer la fermeture de FitTrack puis la rouvrir. Vérifier
que la même séance et les deux valeurs reviennent, puis cocher la série. Aucun
changement visuel neuf n’est attendu.

**Prochaine tranche de phase 6 :** composer une routine complète à travers
`RoutinesScreen`, `RoutineEditorScreen` et `ExercisePickerScreen`, puis
retrouver son résumé persistant dans la liste avant le premier gros découpage
de `RoutinesScreen`.

**Dernière mise à jour :** 2026-07-29 (**records visibles en séance
centralisés**). `lib/records` possède désormais la projection
`workoutRecordKinds(groups, setsByExercise)` : elle sélectionne les séries
validées de la séance, les compare à leur univers live et associe chaque série
à son unique record principal. `WorkoutScreen` ne reconstruit plus cette règle.

**Comportement préservé.** La comparaison inclut toujours les séries déjà
validées de la séance, ignore les échauffements via `recordsBeatenBy` et ne
félicite jamais une première performance sans record à battre. Lorsqu’une série
bat la charge et le volume, seule « Charge max » reste affichée. Aucun
changement de requête Dexie, de rendu, de texte, de schéma ou de donnée.

**Preuves.** La baseline comptait 25 tests de `records`. Quatre tests TDD
couvrent le chargement de l’univers live, l’exclusion des séries non validées,
la priorité d’un double record et l’isolation de plusieurs exercices. Deux
mutants manuels ont été tués : suppression du filtre `isCompleted`, puis prise
du dernier record au lieu du premier. Lint, typecheck, **775 tests** dans 58
fichiers et build de production passent.

**Checkpoint téléphone :** dans une séance avec historique, valider une série
qui bat à la fois la charge et le volume. Vérifier qu’une seule félicitation
« Charge max » apparaît, qu’elle disparaît au décochage et revient au
recochage.

**Dernière mise à jour :** 2026-07-29 (**plans de repos par bloc
centralisés**). `lib/rest` possède désormais la transformation des exercices
ordonnés en `RestPlan` : durée commune du bloc et identification de son dernier
membre. `WorkoutScreen` ne reconstruit plus cette règle et projette seulement
ses détails vers les lignes persistées.

**Comportement préservé.** Un exercice simple conserve sa propre durée. Les
membres d’un superset partagent toujours la durée la plus longue et seul le
dernier peut déclencher le minuteur. Les lignes historiques sans durée passent
toujours par `resolveRestSeconds`. Aucun changement de store, de rendu, de son,
de schéma ou de donnée.

**Preuves.** La baseline comptait 21 tests de `rest` et 24 de `routineOrder`.
Quatre tests TDD couvrent les lignes seules, le maximum d’un superset, les
durées historiques invalides et la non-mutation. Deux mutants manuels ont été
tués : durée du premier membre à la place du maximum, puis tous les membres
marqués comme fins de bloc. Lint, typecheck, **771 tests** dans 58 fichiers et
build de production passent.

**Checkpoint téléphone :** lancer une séance avec un exercice simple puis un
superset dont les repos diffèrent. Vérifier la durée propre du premier, aucun
repos entre les membres du superset, puis la durée la plus longue après son
dernier membre.

**Dernière mise à jour :** 2026-07-29 (**placement des supersets
centralisé**). `lib/routineOrder` possède désormais toute la projection d’un
superset persistant vers son rendu : `supersetPlaces(rows)` rend l’index A/B/C
et la taille du bloc. L’éditeur de routine et la séance en direct ne
reconstruisent plus cette règle chacun de leur côté.

**Connaissance réellement dédupliquée.** Les deux écrans utilisent la même
fonction et les deux cartes importent le même type `SupersetPlace`. Il ne reste
qu’une déclaration de l’interface et une implémentation de la règle. La
normalisation, la numérotation persistée, les props et le rendu visuel restent
inchangés.

**Preuves.** Les 20 tests existants de `routineOrder` formaient la baseline ;
quatre tests TDD couvrent les lignes seules, les index, la taille, plusieurs
blocs et la non-mutation. Deux mutants manuels ont été tués : inclusion de
`group === 0` et taille forcée à `1`. Lint, typecheck, **767 tests** dans 58
fichiers et build de production passent.

**Checkpoint téléphone :** ouvrir une routine avec un superset de trois
exercices, vérifier A/B/C et le filet continu, démarrer la séance puis contrôler
le même rendu. Réordonner ensuite un membre et vérifier que routine et séance
restent cohérentes.

**Dernière mise à jour :** 2026-07-29 (**chargement des périodes d’analyse
centralisé**). `useHistoricalPeriod(period, openedAt)` est désormais la seam
commune à « Séances par semaine », « Séries par muscle » et « Volume
d’entraînement ». Le hook calcule la fenêtre, choisit la portée historique, lit
les séances et l’antériorité, puis rend un snapshot cohérent avec son état
`stale`.

**Comportement préservé.** Les moteurs analytiques, périodes, tris, snapshots et
règles de séries n’ont pas changé. L’écran de progression d’un exercice garde sa
lecture spécialisée. Au premier chargement, les trois analyses globales
n’annoncent plus un faux état vide ; pendant un changement de période, elles ne
peuvent plus associer les nouvelles bornes à l’ancien résultat Dexie.

**Preuves.** Le cycle TDD couvre la fenêtre bornée, `Tout`, l’historique
antérieur et la conservation atomique du snapshot précédent. Lint, typecheck,
**763 tests** dans 58 fichiers et build de production passent. Aucun changement
de schéma, migration, donnée ou texte UI.

**Checkpoint téléphone :** ouvrir Historique → Analyses, puis les trois analyses
globales. Passer de 12 à 4 semaines puis à `Tout` : l’ancien rendu doit rester
brièvement visible à opacité réduite, sans faux message vide. Les chiffres,
semaines et répartitions doivent rester identiques.

**Dernière mise à jour :** 2026-07-29 (**projection historique — P0 corrigé,
module approfondi**). La lecture annuelle bornée respecte désormais la porte
opt-in de 5 000 ms sur le dataset de référence de 2 000 séances. Le schéma Dexie,
les données et les comportements visibles n'ont pas changé.

**Deux commits applicatifs séparés.** Le correctif remplace les grands `anyOf`
par des lectures `workoutId` petites, indexées et bornées. La refactorisation
fait de `listHistoricalWorkouts` la seam unique : sélection, soft-delete,
validation, ordre et identité historique restent derrière le repository ;
exports et analytics ne reçoivent plus les entités Dexie.

**Preuves.** Le benchmark annuel opt-in respecte la porte de 5 000 ms ; lint,
typecheck, tests unitaires et build de production sont verts. La baseline lente
reste versionnée dans `docs/baselines/2026-07-28-refactor-baseline.md`.

**Checkpoint téléphone :** ouvrir Historique → Analyses et comparer les périodes
4, 12, 26, 52 semaines et Tout. Vérifier ensuite une séance contenant un
exercice renommé ou supprimé, puis partager son export Markdown : nom historique,
totaux, séries et dates doivent être identiques à avant la refactorisation.

**Dernière mise à jour :** 2026-07-28 (**phase 0 — baseline de
refactorisation terminée**). Le tag `refactor-phase-0-start-2026-07-28` pointe
sur `fcfb03ab4cfea6e23c7c74a868feb46b3e219bb5` ; la référence durable est
`docs/baselines/2026-07-28-refactor-baseline.md`. Aucune fonctionnalité
applicative ni aucun schéma Dexie n'a changé.

**Historique de charge mesuré, pas produit.** Le dataset déterministe contient
2 000 séances, 16 000 lignes et 64 000 séries. Le benchmark opt-in a mesuré
`listHistoryPage({}, 0, 20)`, `listCompletedWorkoutTimestamps()` et une
projection annuelle bornée de `listExportSources`; la projection historique
reste le P0 à corriger séparément avant toute refactorisation structurelle.

**Scan d'architecture fait, sans décision d'interface.**
`improve-codebase-architecture`, `codebase-design` et `refactoring` ont été
utilisés. `reduce-system-complexity` n'est pas installé, car aucune source
vérifiée n'a été trouvée. Deux candidats sont consignés dans le rapport
temporaire ; la projection historique est la recommandation principale après
le correctif P0 séparé.

Les anomalies d'hôte sont consignées dans la baseline mais non corrigées :
`npm.ps1` est bloqué et le membre
`CompressionLevel.SmallestSize` manque sous Windows PowerShell 5.1. Les mesures
gzip utilisent une variante compatible. **57 fichiers, 766 tests** avant la
passation de cette tâche.

**Checkpoint manuel : aucune donnée du téléphone n'a été modifiée. Ouvrir
FitTrack, vérifier que l'accueil, l'historique et une séance existante
s'affichent comme avant. Aucun parcours fonctionnel neuf n'est attendu :
la phase 0 est une référence de mesure.**

**Dernière mise à jour :** 2026-07-28 (**jalon G4 — volume d’entraînement
hebdomadaire**). Le quatrième et dernier graphique de la première couche
d’analyse existe : `Historique → Analyses → Volume d’entraînement`. Spec :
`docs/superpowers/specs/2026-07-28-analytics-weekly-volume-design.md`.

**Un écran, deux cadrans, les semaines ne bougent pas.** `Tonnage` additionne
les charges externes réellement soulevées ; `Durée` additionne
`Workout.durationSeconds`, donc la séance complète et jamais les seules séries
chronométrées. Changer de métrique garde la semaine sélectionnée. Changer de
période revient à la semaine la plus récente.

**Le tonnage ne possède aucune formule neuve.** Chaque séance passe par
`sessionTotals()` avec le `weightRole` du type de mesure résolu par l’instantané
08A/08B : les échauffements, l’assistance et le lest ne se glissent donc pas
dans G4 par une seconde définition. Le poids du corps n’est pas inventé. Douze
tests neufs fixent en plus les deux séances d’une même semaine, les trous
internes, l’absence de semaines avant le début de l’historique, `Tout`, le
dimanche soir dans son offset, le changement d’heure, la moyenne avec zéro et
la durée de séance opposée exprès à celle d’une série.

**Quatrième graphique, quatrième passage par la même porte.**
`listExportSources({ kind: 'period', from, to })`, `periodBounds()` et
`listCompletedWorkoutTimestamps()` : aucune requête, aucun repository et aucune
définition de « séance qui compte » ajoutés. `WeeklyVolumeScreen` est différé ;
le build le sort à **6,72 kB** (**2,52 kB gzip**). Aucune dépendance, aucun jeton
de couleur et aucun octet de bibliothèque de graphiques.

**Le tonnage et la durée par muscle sont écartés, pas oubliés.** G3 donne déjà
la répartition des séries. Des kilos de squat et des kilos de mollets ne sont
pas commensurables ; une durée de séance ne se répartit pas honnêtement entre
ses exercices. G4 reste donc la seule lecture que ses deux unités partagent
réellement : leur évolution dans le temps.

**Zéro accent.** Une grosse semaine n’est ni un objectif atteint ni
automatiquement une victoire. Toutes les barres restent en `--text-2`.
La première version pilotée avait pourtant deux défauts que le typecheck ne
pouvait pas voir : l’axe écrivait **« 20,9 K »**, parce que `.label-xs`
capitalisait le suffixe compact `k`, et le moignon zéro, l’axe et la fente de
sélection ne mesuraient que **1,10:1 à 1,29:1**. L’axe est désormais en chiffres
tabulaires sans transformation de casse ; les repères informatifs utilisent
`--text-2` et la sélection est un contour qui franchit la base. Mesuré après
correction : **7,18:1 en sombre, 7,03:1 en clair**, sans introduire une couleur
qui porterait un faux sens.

**Revue indépendante refermée.** L’écran distingue maintenant la lecture Dexie
en cours d’une période réellement vide : il conserve le dernier graphique à
opacité réduite au changement de période et n’annonce plus prématurément
« Aucune séance ». Les dates longues incluent l’année pour rendre `Tout`
non ambigu, et une durée hebdomadaire nulle se lit **0 min**, jamais 0 s.

**56 fichiers, 764 tests** (+3 fichiers, +20) ; `lint`, `typecheck`, `test:run`
et `build` sont verts.

**Vérifié en pilotant, en 375 × 812 px**, sur les trois semaines présentes dans
la base locale : 8 842,5 kg, 20 868,4 kg puis une semaine courante à zéro ; la
liste et le cadran concordent, la semaine zéro est visible et sélectionnable,
la bascule vers la durée garde le 20 juillet sélectionné, et le retour au
tonnage rend bien 20 868,4 kg. Le changement 12 → 4 semaines revient à la
semaine la plus récente. SVG `role="img"` avec résumé complet, hors ordre de
tabulation ; une seule fente de sélection ; plus petite cible **48 px** ; aucun
débordement (`scrollWidth === innerWidth === 375`) ; aucune erreur console.
L’entrée « Volume d’entraînement » existe une seule fois entre le rythme et les
muscles sur l’écran Analyses.

**Checkpoint à vérifier sur le téléphone :** ouvre **Historique → Analyses →
Volume d’entraînement**. Sur « Tonnage », vérifie à la main une semaine avec une
séance de charge et une séance au poids du corps : seuls les kilos externes
réellement soulevés doivent compter. Passe à « Durée » : la semaine sélectionnée
ne doit pas changer et le total doit être la somme des durées complètes de tes
séances. Tape une semaine sans entraînement au milieu de ton historique : elle
doit rester visible et lire zéro. Change enfin de période et vérifie que les
semaines antérieures à ta première séance ne sont jamais inventées.

**Deux constats consignés, non codés** (2026-07-28, fin de session) :

**1. Une série n'est pas une unité de coût constante d'un muscle à l'autre.** Relevé par
l'utilisateur : « les lombaires et le haut du dos ne sont pas du tout chargés pareil ». Trois séries
d'hyperextension à 10 kg et trois de tirage horizontal à 47,5 kg pèsent identiquement sur cet écran.
**Le classement inter-muscles de G3 est donc un ordre de grandeur, pas un verdict** — ce qu'il sait
dire honnêtement, c'est un muscle comparé à lui-même dans le temps, et un zéro ou un quasi-zéro.
C'est une limite de la forme, pas un défaut à corriger ; à écrire dans la spec G3. (Le tonnage par
muscle de G4 ne la lèvera qu'en partie : des kilos de mollets et des kilos de squat ne sont pas
comparables non plus.)

**2. Une association Hevy mémorisée passe avant un alias canonique** (`saved ?? canonical`,
`hevyImportDraft.ts`). Conséquence : les quatre mauvais choix mémorisés lors du premier import
battraient les alias corrects ajoutés depuis, sur une réimportation future. **Le correctif envisagé
a été écarté en l'écrivant** : faire repasser en choix explicite les cas où les deux sources
divergent rouvrirait la question **à chaque import, indéfiniment**, puisque le conflit se recrée à
l'identique — et le cas le plus fréquent est légitime (un titre Hevy associé exprès à une machine
personnelle). Une vraie solution demande de savoir *quand* le mapping a été enregistré, donc un
champ de plus. Risque faible et décroissant : l'usage est passé à la saisie dans l'app, et une
réimportation des mêmes séances est dédupliquée.

**Historique précédent :** 2026-07-28 (**le semis réconcilie la classification — sans quoi le
correctif catalogue n'atteignait personne**).

**Défaut livré par moi, trouvé par une capture d'écran du téléphone.** Après le correctif catalogue,
l'écran affichait encore **Fessiers 22**, **Grand dorsal 12 contre Haut du dos 6**, et Adducteurs à
zéro : exactement l'état d'avant. Cause : `seedDatabase()` était **strictement additif** — il
n'insérait que les slugs manquants et n'écrivait jamais sur une fiche existante. Les 4 exercices
neufs arrivaient donc bien, mais `Adduction à la machine` et les 7 rowings, déjà présents,
**gardaient leur ancien muscle**. Le correctif ne touchait qu'une installation neuve.

**Et la conséquence en cascade, qui est le vrai enseignement : « Réparer l'historique » relit la
bibliothèque.** Il a donc consciencieusement recopié `glutes` sur l'adduction. Le bouton
fonctionnait ; **c'est sa source qui était périmée**. Une réparation ne peut jamais dépasser la
qualité de ce qu'elle relit — le checkpoint annoncé envoyait droit dans le mur.

**`reconcileClassification()` réaligne `primaryMuscle` et `secondaryMuscles`, et rien d'autre.**
Arbitrage tranché après consultation (« le plus adapté ») : quel muscle un mouvement travaille est
une donnée anatomique dont l'app répond et dont **tous** les graphiques dépendent ; le **nom**, les
**notes** (`userNotes`, « siège position 4 » est l'exemple même du checkpoint du Lot 3) et le
**repos par défaut** appartiennent à l'utilisateur et ne sont touchés sur aucune ligne, jamais.
L'option « n'écrire que sur les fiches jamais modifiées » a été écartée pour une raison de fond :
elle échoue exactement là où ça compte, une seule note posée sur un rowing suffisant à lui laisser
son muscle faux à vie.

Écarts assumés, écrits plutôt que cachés : une fiche du catalogue **délibérément** reclassée par
l'utilisateur sera réalignée — ses propres exercices (`isCustom: 1`, sans slug) sont intouchables et
c'est là qu'un désaccord se loge. Les fiches **soft-deleted sont réalignées aussi** : un exercice
supprimé reste celui qui a été pratiqué, et son historique lit encore son muscle. Rien n'est écrit
quand rien ne diffère — la fonction tourne à chaque démarrage, et un `updatedAt` bougé pour rien
salirait toutes les lignes aux yeux de la synchronisation future (ADR-002).

Piège rencontré en écrivant les tests : **`slug` n'est pas indexé**, donc `where('slug')` échoue.
La réconciliation charge la table une fois — le semis la lisait déjà.

**53 fichiers, 744 tests** (+5), quatre portes vertes.

**Vérifié en pilotant, sur l'état exact du téléphone reproduit** : catalogue remis à l'ancienne
classification, note « Siège position 4 » et repos 210 s posés dessus, historique gelé sur les
anciens muscles. Au rechargement, la bibliothèque se réaligne seule (**adducteurs**, **haut du
dos**) et **la note, le repos et le nom sont intacts** ; l'historique, lui, **reste gelé** — le passé
ne se repeint pas tout seul. Après le bouton : « 2 exercices de séance corrigés », et l'écran affiche
**Adducteurs 6 · Haut du dos 4**.

**Ordre à respecter, et c'est le nouveau checkpoint :** ouvrir l'app **d'abord** (le semis réaligne
la bibliothèque), **puis** Réglages → Réparer. L'inverse ne donne rien.

**Historique précédent :** 2026-07-28 (**une hypothèse ne porte plus l'habit d'une certitude**).
Suite directe du correctif catalogue ci-dessous. Question posée par l'utilisateur : « on devrait
améliorer la reconnaissance des exos ? » — **non, et les chiffres le disent** : les quatre titres qui
partaient n'importe où n'avaient aucune cible au catalogue. Cinq exercices ajoutés et quatre lignes
d'alias ont fait 20/24 → **24/24 sans toucher une ligne d'algorithme**. Améliorer le classement de
secours n'aurait produit que de **meilleures mauvaises réponses** : il ne se déclenche que là où le
catalogue est muet, et aucun score ne sort une rotation externe d'une liste qui n'en contient pas.

**Ce qu'il fallait corriger, c'est ce que l'app fait quand elle ne sait pas.** `HevyMappingDraftRow`
portait `suggestion = canonical ?? rankHevyExerciseCandidates(...)[0]` — donc, faute d'alias, le
premier d'un classement flou. La feuille l'affichait en **bouton `primary`, pleine largeur, en tête**
(l'élément le plus sûr de la charte) et la ligne de revue affichait son **nom** sous l'étiquette
« Proposition ». Un appui, et l'hypothèse était gelée par l'instantané 08A.

**`suggestion` est supprimé, pas rendu prudent.** Réduit au certain, il devenait exactement
`resolution` : deux noms pour une chose. `resolution` n'est donc plus posé d'office que par un
**alias canonique** ou un **mapping mémorisé**, les deux seules sources sûres.

**Et la vraisemblance n'est pas jetée — elle descend à sa vraie place : elle ordonne la liste.**
`filterHevyMappingExercises` trie désormais par `rankHevyExerciseCandidates`. Le bon candidat reste à
un seul appui, mais c'est un choix pris **parmi ses alternatives** au lieu d'une réponse entérinée.
Rien n'est écarté : l'ordre change, jamais le contenu — un test le fixe.

Étiquettes suivies : « Proposition » devient **« À choisir »**, et `importUseSuggestion` est
supprimée (chaîne morte). **53 fichiers, 739 tests** (+1 fichier, +4), quatre portes vertes.

**Vérifié par les tests, pas en pilotant** — et c'est signalé plutôt que glissé : avec le catalogue
corrigé, les 24 titres du vrai CSV sont tous canoniques, donc la feuille d'association ne s'ouvre
plus du tout sur cet export. Le nouveau comportement se voit sur un titre non couvert ; les trois
tests neufs le fixent, le parcours réel n'a pas été rejoué au doigt.

**Historique précédent :** 2026-07-28 (**correctif catalogue — G3 a trouvé un vrai défaut, et ce
n'était pas dans G3**). Retour d'usage : « les séries me paraissent incohérentes… en fait j'ai
l'impression que certains exos sont mal mappés ». Il avait raison, et le vrai CSV Hevy l'a prouvé.

**Diagnostic fait sur ses vraies données, pas sur une fixture.** Son export réel (5 séances,
110 séries de travail, 24 titres) rejoué dans le vrai pipeline d'import : **abdominaux 15 et épaules
6**. Or il ne fait que du gainage en abdos. Quatre défauts, tous dans le **catalogue**, aucun dans
le moteur de G3 :

| Défaut | Effet |
|---|---|
| Aucune rotation externe / coiffe dans les 168 exercices | « Rotation Externe Poulie » classé sur un **crunch** → 4 séries d'épaules en abdos |
| Aucun développé épaules à la poulie | « Développé Debout Poulie Centrée » sur un **Pallof press** → 4 de plus en abdos |
| `Adduction à la machine` classée `glutes` | l'adduction travaille les **adducteurs** ; c'est l'ABduction qui fait le moyen fessier |
| 7 rowings horizontaux classés `lats` | et le catalogue **se contredisait** : « Rowing buste appuyé » était en `upper_back`, « Rowing à la machine » en `lats` |

Après correction, sur les mêmes 110 séries : **abdominaux 7, épaules 14**, fessiers 22 → 16,
adducteurs 6, haut du dos 3 → 5. Et **les 24 titres tombent automatiquement, zéro « À choisir »**
(il y en avait 4).

**`adductors` est le 19e `MuscleGroup`,** décidé avec l'utilisateur. Le vocabulaire n'avait pas la
case, donc six séries par semaine atterrissaient sur le muscle que le mouvement *opposé* travaille.
**Les deux garde-fous ont sauté au typecheck, exactement comme ils sont faits pour** : l'étiquette
française de `fr.ts` et le `Record<MuscleGroup, MuscleScope>` de G3. C'est la première fois qu'ils
servent, et ils ont désigné les deux seuls endroits à corriger.

**La règle de classement du dos est écrite plutôt que devinée** : **plan vertical** (traction,
tirage vertical, pull-over) → grand dorsal ; **plan horizontal** (rowing, tirage horizontal) → haut
du dos, parce que c'est de la rétraction d'omoplates. Appliquée aux 7 d'un coup. Piège désamorcé en
route : le slug `rowing-machine` n'est pas un rowing, c'est le **Rameur** (cardio) — première
tentative reprise depuis les vrais slugs, avec une garde qui refuse de reclasser ce qui n'était pas
`lats`.

**Quatre tests ont échoué, et il ne fallait surtout pas retourner leur assertion.**
`hevyExerciseMatch.test.ts` affirmait « does not invent a canonical target for » les quatre titres
en question. Ce test disait vrai **de l'état du catalogue**, pas d'un comportement voulu. Les quatre
sont donc passés dans le tableau « maps X to slug Y », même assertion, et **la règle de fond est
gardée dans un test neuf** sur un titre inconnu : un titre non couvert ne reçoit aucune association
d'office. Ce n'est pas l'assertion qui a changé, c'est le catalogue.

**Le vrai manque que ce bug a révélé, et il dépasse le cas : rien ne permettait de réparer un
historique déjà écrit.** La migration v2 a gelé le muscle sur chaque ligne — c'est tout l'acquis de
08A/08B — donc corriger le catalogue ne rattrape rien. D'où
`resnapshotHistory()` (`repositories/historyRepair.ts`) et **Réglages → Réparer les muscles de
l'historique**, sous `ConfirmSheet` : **ça repeint le passé, donc jamais automatique et jamais
silencieux**, et la phrase de confirmation annonce le prix (un exercice renommé depuis prendra son
nouveau nom) au lieu de demander « es-tu sûr ? ». Cinq tests, dont le piège qui compte :
`snapshotOf(undefined)` rend `{}`, et l'écrire **effacerait** la seule trace de ce qu'était une
ligne dont l'exercice a disparu — la fonction garde donc la ligne intacte. Les exercices
soft-deleted sont lus (un exercice supprimé est encore celui qui a été pratiqué), `updatedAt` est
touché seulement quand la ligne change vraiment (ADR-002).

**52 fichiers, 735 tests** (+1 fichier, +6) ; quatre portes vertes, aucun avertissement au build.

**Vérifié en pilotant**, base repartie de zéro pour semer le catalogue corrigé : Rameur toujours en
`cardio`, puis un historique fabriqué **dans l'état du bug** (adduction gelée en `glutes`, tirage
horizontal en `lats`, plus une ligne dont l'exercice n'existe pas). Avant : Fessiers 6, Grand dorsal
4. Après le bouton : **Adducteurs 6, Haut du dos 4**, Fessiers et Grand dorsal à 0, rapport
« 2 exercices de séance corrigés » — la troisième ligne gardée, et son instantané « Machine de la
vieille salle / quads » **intact**.

**Checkpoint à vérifier sur le téléphone :** ouvrir **Réglages → Réparer les muscles de
l'historique**, lire la phrase de confirmation, confirmer. Puis **Historique → Analyses → Séries par
muscle** : tes abdominaux doivent tomber à tes seules séries de gainage, et tes épaules remonter.
Vérifie ensuite dans l'Historique qu'aucune séance n'a changé de charge ni de répétitions — la
réparation ne touche que le nom, le muscle, le matériel et le type de mesure.

**Historique précédent :** 2026-07-28 (**jalon G3 — séries par muscle**). La répartition existe :
`Historique → Analyses → Séries par muscle`. Spec :
`docs/superpowers/specs/2026-07-28-analytics-muscle-group-series-design.md`.

**Aucune requête neuve, troisième fois de suite.** `listExportSources({ kind: 'period', from, to })`
et `periodBounds()`, comme G1 et G2. Un troisième fichier de requêtes ferait **une troisième
définition de « séance qui compte »** — la faute que 08B a passé une session à réparer.

**Le muscle principal seul, et c'était la décision à prendre d'avance.** `secondaryMuscles` a été
exclu de l'instantané exprès au jalon 08A et n'existe que dans la bibliothèque **d'aujourd'hui** :
une répartition qui le lirait redistribuerait six mois de séries passées à chaque édition d'un
exercice — le bug de 08B, transposé du nom au muscle. La migration v3 a été examinée et écartée :
elle ne pourrait remplir les lignes existantes qu'avec la bibliothèque d'aujourd'hui, donc en
**inventant** le passé au lieu de le conserver. Et surtout, la pondération (1 au principal, 0,4 aux
secondaires) ne peut pas devenir une unité de comptage : « 48 » cesserait d'être un nombre de séries
pour devenir un score dont le total ne vaut plus ce qui a été fait, et qu'aucun comptage manuel dans
l'Historique ne retrouve. **Un compte se vérifie, un score se croit** — et être vérifiable est la
seule prétention de cet écran. L'approximation est écrite sur l'écran, en une phrase.

**G3 est une troisième forme, et `ChartSurface` n'est pas touché — vérifié, pas supposé.** Ses trois
possessions tombent une par une. (1) **Pas de `<svg>`** : les étiquettes sont des noms français à
taille de lecture, et un `<text>` dans un `viewBox` mis à l'échelle ment sur sa taille — c'est
exactement pourquoi G1 et G2 gardent tout leur texte **hors** du SVG ; le texte en HTML impose la
barre en HTML. (2) **Pas de « marque la plus proche en x »** : les marques sont empilées en y. (3)
**Pas de résumé lecteur d'écran séparé, parce que le dessin EST la liste.** En G1 et G2, le `<svg>`
était muet et il fallait une liste jumelle en dessous ; une ligne classée porte son nom et son
nombre en texte. Il n'y a pas de doublon accessible à écrire quand il n'y a pas d'original
inaccessible.

**Donc aucune sélection, et c'est une conséquence, pas un oubli.** G1 et G2 ont un curseur parce
qu'une marque posée sur un axe partagé ne peut pas porter son étiquette. Une ligne classée la porte
déjà : une sélection ne révélerait **rien**. Les lignes ne sont donc pas des boutons — vérifié en
pilotant, aucun `<button>` dans les quinze `<li>`.

**Une troisième géométrie dans `plot.ts`, et pas une généralisation des deux premières.**
`barFractions(values, ceiling)` rend une **part de piste de 0 à 1**, et non des coordonnées, parce
que la piste est fluide (§ ci-dessus) — c'est aussi ce que le rail de `HistorySummaryCard` consomme
déjà (`scaleX`). Ce n'est pas `barLayout` couché : `barLayout` place N colonnes **le long** d'une
boîte (`slot`, `centerX`, `BAR_FILL`) parce que l'axe des abscisses est à lui ; ici la mise en page
appartient au DOM et quatre des cinq champs de `BarSlot` seraient ignorés. Ce que la fonction
possède vraiment : **une valeur nulle rend exactement 0, jamais le plancher** (l'absence n'est pas
une petite quantité), et **une valeur non nulle garde un plancher** de 2 % (1 série sur un plafond
de 60 fait deux pixels et se lit comme zéro). C'est le symétrique de la leçon de G2, que G2 n'avait
pas rencontré.

**Le zéro : information, et c'est le point de conception du jalon.** Transposition de la leçon de
G2, demandée au cadrage. Ce qui départageait en G2 n'était pas « vide » mais **ce que l'app sait** :
avant le premier enregistrement elle ne sait rien, au milieu elle sait tout. Ici, sur une période,
la couverture est complète par construction — « 0 série de mollets en 12 semaines » est un fait
**observé**, et c'est le seul fait que cet écran existe pour donner. **La liste des lignes vient donc
de l'anatomie, pas des données.** Un muscle négligé qui disparaît de la liste est un muscle qu'on ne
remarque pas : ce serait le seul vrai échec possible de cet écran. Un muscle à zéro reçoit **4 px en
`--border`**, la réponse exacte de G2 tournée de 90°.

**Sauf trois, et c'est ainsi que le type devient explicite.** `cardio`, `full_body` et `other` n'ont
aucune région anatomique. Le critère qui tranche est celui ci-dessus : « 0 série de Corps entier »
ne dit rien à personne — ce ne sont pas des muscles, ce sont des cases de rangement. Ils sortent du
classement et **n'apparaissent que s'ils portent quelque chose** : faire disparaître quarante séries
de cardio serait l'autre faute, celle que le Lot 5bis nomme (« ça existe, mais rien ne le montre »).
D'où `MUSCLE_SCOPE: Record<MuscleGroup, 'region' | 'unscoped'>` — **un `Record` et pas une liste** :
ajouter une valeur à `MUSCLE_GROUPS` sans la classer casse le typecheck, même mécanique que
`muscle.*` dans `fr.ts`. Un quatrième cas est nommé plutôt qu'avalé : une ligne dont le muscle ne se
résout pas va sous « Muscle inconnu », **jamais fondue dans `other`** — `other` est un choix de
l'utilisateur, l'inconnu est un trou de l'app. `neck` n'est pas un cas spécial : décider quels
muscles méritent une ligne serait l'app décidant ce que son utilisateur a le droit de négliger.

**Zéro chose colorée, et il faut le dire parce que la règle en demande une.** La charte réserve
l'accent aux actions primaires, aux séries validées et aux records ; **G3 n'a aucun des trois.**
Colorer le muscle le plus travaillé serait **féliciter un déséquilibre**, l'inverse exact de ce que
l'écran sert à voir ; colorer le moins travaillé serait une alerte que l'app n'a aucun seuil pour
justifier. La règle dit « une seule chose colorée **et c'est une information** », pas « il en faut
une ».

**Une erreur de la spec corrigée pendant l'implémentation, et elle valait la peine.** La spec
affirmait que `hasEarlierHistory` n'avait aucun sens ici — vrai pour la répartition (un muscle ne
commence pas d'exister à une date), **faux pour la moyenne hebdomadaire de l'en-tête**, qui est un
chiffre *par semaine* et hérite mot pour mot du défaut que G2 a payé en usage. `listCompletedWorkoutTimestamps()`
est donc lu ici aussi, et le nombre de semaines n'est pas `WEEKS[period]` mais
**`weeklySessionCounts(...).length`**, le moteur de G2 lui-même : les deux écrans ne peuvent pas
diviser par deux nombres différents. Vérifié en pilotant — 4 semaines d'historique dans une fenêtre
de 12, 26 ou 52 donnent **13,6 par semaine** dans les trois cas, jamais 5,7.

**51 fichiers de tests, 729 tests** (+1 fichier, +21) ; `lint`, `typecheck`, `test:run` et `build`
sont verts, et le build n'a toujours **aucun** avertissement. `MuscleBalanceScreen` sort à
**4,94 kB** (gzip 1,89) en quatrième route différée.

**Vérifié en pilotant, en 375 × 812 px**, sur 8 séances et 68 séries de travail injectées sur
4 semaines, avec cinq pièges posés exprès et tous désamorcés : **4 échauffements exclus** (total 68
et non 72) ; **le même exercice deux fois dans une séance additionne** (Pectoraux 13 = 4+2+4+3) ; une
ligne dont **l'instantané dit « mollets » et la bibliothèque « épaules »** compte pour les mollets
(2), et les épaules restent à 3 ; **égalité Biceps 6 / Triceps 6 départagée par l'ordre canonique** ;
**Cardio 5 et Muscle inconnu 1 en « Hors répartition »**, jamais fondus ensemble ni dans « Autre ».
Quatre régions à 0 (Trapèzes, Avant-bras, Lombaires, Cou) restent à l'écran avec leur moignon de
4 px en `--border`, visuellement impossible à confondre avec la plus petite quantité réelle (20,2 px
pour 2 séries). **La longueur est la quantité** : 8/13 mesuré à 0,615 contre 0,615 attendu. Aucun
débordement horizontal (`scrollWidth === innerWidth === 375`), plus petite cible 48 px, aucune
erreur console, et l'état vide affiche bien sa phrase au lieu de quinze barres à zéro.

**Checkpoint à vérifier sur le téléphone :** ouvrir **Historique → l'icône de courbe → Séries par
muscle**. Le total en haut doit être **le nombre de séries de travail que tu as réellement faites**
sur la période — échauffements exclus — et il doit se retrouver à la main dans l'Historique si tu
comptes. Vérifie que les muscles que tu sais négliger sont bien **en bas de la liste, à zéro, et
toujours visibles** : c'est ce que l'écran existe pour montrer. Attention au sens de la mesure : un
exercice compte pour **son muscle principal seulement**, donc le développé couché ne donne rien aux
triceps — la phrase sous le graphique le dit. Renomme ou **reclasse** un exercice dans la
bibliothèque (change son muscle principal) : **la répartition passée ne doit pas bouger.** Enfin,
change de période — 4, 12, 26, 52 semaines et Tout : la moyenne « par semaine » ne doit pas
s'effondrer quand la fenêtre est plus large que ton historique.

**Historique précédent :** 2026-07-28 (**jalon G2 — séances par semaine**). Le rythme
d'entraînement a son histogramme : `Historique → Analyses → Séances par semaine`. Spec :
`docs/superpowers/specs/2026-07-28-analytics-weekly-sessions-design.md`.

**Aucune requête neuve, et l'alternative légère a été refusée pour une raison de fond.**
`listCompletedWorkoutTimestamps()` (Lot 07) rend exactement ce qu'un compte de séances demande —
sauf qu'elle ne rend que des `number`. Or une séance porte son propre
`startedTimezoneOffsetMinutes` (jalon 08A), et sans lui il est impossible de dire dans quelle
semaine civile elle tombe. `listExportSources({ kind: 'period', from, to })` rend le `Workout`
entier, donc l'offset vient avec. `'all'` passe par `{ kind: 'all-history' }`, qui existait déjà :
inventer `from: 0` aurait marché **et** aurait été l'app décidant en silence de sa date de
naissance.

**Contradiction connue, consignée plutôt que glissée :** la carte Régularité de l'Historique
groupe encore par l'offset du téléphone d'aujourd'hui. Sur une seule zone elle donne le même
résultat que cet écran ; après un voyage, non. Hors périmètre de G2 — la corriger veut dire changer
la signature d'une lecture du Lot 07 et rejouer ses 15 tests.

**Le moteur de régularité est réutilisé, et rien n'a été déplacé.** `startOfLocalWeek`,
`addLocalWeeks` et `resolveWeeklyGoal` sont importés de `lib/history.ts`, comme `periods.ts` le
faisait déjà. Déplacer aurait coûté un renommage à travers quatre fichiers du Lot 07 pour zéro
comportement gagné. `resolveWeeklyGoal` est le point qui compte : **l'objectif change dans le
temps**, et une semaine de juin doit être jugée sur l'objectif de juin. Vérifié en pilotant, et
c'est visible dans le dessin : avec un objectif passé à 4 il y a six semaines, la semaine du
1er juin à **3 séances est verte** parce que l'objectif d'alors était 2. Sous l'objectif
d'aujourd'hui le décompte donnerait 6 semaines validées, pas 8.

**Le fuseau :** `weekStartOf(startedAt, offset)` en trois pas — le jour civil de la séance
(`localDateKey`), ce jour reconstruit **à midi** dans le calendrier du lecteur, puis
`startOfLocalWeek`. Midi et non minuit : dans certains fuseaux minuit n'existe pas le jour d'un
passage à l'heure d'été et `new Date(y, m, d)` glisse d'un jour. La reconstruction dans le
calendrier du lecteur est aussi ce qui fait tomber le résultat **exactement** sur l'un des seaux
énumérés ; sans elle, une séance et son seau vivraient dans deux référentiels et ne se
rencontreraient jamais. Offset absent (séances d'avant la migration v2) → offset du lecteur, donc
le comportement du Lot 07 à l'identique.

**Un retour d'usage corrigé juste après, et il portait sur le raisonnement central du jalon :
« l'app me montre des semaines à 0 avant que mon historique commence, ça sert pas à
grand-chose ».** Il a raison. La règle « une semaine sans séance est une semaine où on ne s'est
pas entraîné » n'est vraie **qu'à partir de la première séance enregistrée**. Avant elle, un zéro
n'est pas une mesure : c'est une semaine dont l'app ne sait rien, donc exactement le zéro inventé
que G1 interdit — la règle avait été appliquée trop loin. Et il coûtait deux fois : trois semaines
d'historique réel dessinaient **neuf barres vides devant elles**, et la moyenne annonçait **0,5
séance par semaine au lieu de 1,5**, parce qu'elle divise par le nombre de seaux.

La distinction à tenir est fine : **une semaine vide *avant* l'historique n'existe pas ; un trou
*dans* l'historique reste**, c'est lui l'information. `weeklySessionCounts` reçoit donc
`hasEarlierHistory`, et **il ne peut pas être déduit à l'intérieur** : la fenêtre ne rend que son
propre contenu, et vu de l'intérieur « rien avant » et « rien pendant » sont indiscernables.
L'écran répond avec `listCompletedWorkoutTimestamps()` — la lecture de `number` nus écartée plus
haut pour le comptage, ici au bon niveau puisqu'on ne lui demande qu'un booléen. Vérifié dans les
deux sens en pilotant : 3 semaines d'historique dans une fenêtre de 12 → **4 barres**, axe partant
de la première séance, moyenne 1,5, et le trou du milieu conservé ; puis une séance ajoutée 20
semaines en arrière → les **12 barres** reviennent, vides du début comprises, moyenne 0,5. Trois
tests neufs fixent les deux sens et leur frontière.

**Un second retour d'usage, sur le dessin cette fois : « je comprends pas ce qu'est la colonne
blanche, ni pourquoi la hauteur est comme ça ».** Deux questions, une seule cause — si ça demande
une explication, c'est raté. (1) **La barre sélectionnée changeait de couleur** (`--text-2` →
`--text-1`), alors que la spec elle-même disait « la sélection n'est pas une couleur » : elle se
lisait donc comme une *troisième catégorie* à côté du vert et du gris, au lieu d'un curseur. (2)
**Une semaine à zéro ne dessinait rien du tout**, donc l'œil lisait un espacement irrégulier
plutôt qu'une colonne vide — et une fois le rythme des colonnes cassé, toutes les hauteurs
paraissent arbitraires.

Corrigé en trois points : la sélection est **la fente allumée** (`--surface-2`), dessinée en
premier, et elle **franchit la ligne de base en haut et en bas** — parce qu'aucune barre ne fait
ça, donc elle ne peut pas être prise pour une valeur ; c'était exactement l'erreur de la version
blanche. Une barre garde une seule règle de couleur : accent si l'objectif est atteint, `--text-2`
sinon, quoi qu'il arrive. Et une semaine à zéro reçoit **4 px dans le ton de l'axe** : « cette
semaine existe, et elle vaut zéro », sans jamais se lire comme une petite quantité. Vérifié en
pilotant, y compris le cas décisif — taper la semaine vide pose bien la bande dessus et la lecture
affiche « 0 séance ».

**Zéro est une mesure — c'est la règle de G1 retournée, et c'est le point de conception du
jalon.** G1 : « une séance sans valeur pour la métrique ne produit aucun point, jamais un zéro »,
parce qu'un zéro inventé fait plonger la courbe. Ici, **une semaine sans séance n'est pas une
donnée manquante : c'est une semaine où on ne s'est pas entraîné**, et c'est l'information que
l'écran existe pour donner. Les deux règles disent la même chose — on ne trace que ce qu'on sait.
D'où la conséquence structurelle : **la liste des barres vient de la période, pas des séances.**
C'est aussi ce qui rend la moyenne honnête, « 3 séances par semaine » calculé en sautant les
semaines vides ne voulant rien dire.

**Une barre n'est pas une ligne — ce qui a été factorisé, et ce qui ne l'a pas été.** G1 interdisait
d'abstraire avant deux cas concrets ; il y en a deux, et la réponse est que **le dessin ne se
factorise pas et l'interaction se factorise entièrement**.

- *Pas partagé — l'échelle.* `plotBounds` borne par les données et non par zéro, et G1 a payé ce
  choix en gravant le min et le max. Pour un histogramme ce serait un mensonge : **la longueur
  d'une barre EST la quantité**, 2 et 4 doivent faire du simple au double. D'où `barLayout()` à
  côté de `plotPoints()`, et pas un drapeau : une ligne et une barre ne sont pas d'accord sur ce
  que veut dire le bas de la boîte. Les deux étiquettes gravées ne sont donc plus le min et le max
  mais **le plafond et le zéro**.
- *Pas partagé — la marque et la sélection.* Un anneau autour d'une barre de hauteur **zéro**
  n'entoure rien, or la semaine à zéro est précisément celle qu'on veut taper. La sélection est un
  repère **sous le filet de base**. Vérifié en pilotant : taper la colonne du 8 juin (0 séance)
  sélectionne bien cette semaine et affiche « 0 séance · Objectif 2 · il en manquait 2 ».
- *Partagé, et c'est tout — la surface.* `ChartSurface` : le `<svg>`, son `viewBox`, `role="img"`
  + résumé, l'absence d'ordre de tabulation, `touch-none`, la capture du pointeur et « la marque la
  plus proche en x ». Il reçoit **les abscisses**, pas les données : il ne sait ni ce qu'est une
  séance ni ce qu'est une semaine. `ProgressChart` est réécrit par-dessus — non-régression vérifiée
  en pilotant : même `viewBox -12 -12 324 144`, même résumé lecteur d'écran, un seul point accent,
  et le geste sélectionne toujours (appui au tiers → 82,5 kg au 25 mai).
- *Pas fait :* aucun `<Chart type="line" | "bar">`, aucune couche « série ». Deux cas ne font pas
  une bibliothèque.

**Une seule chose est colorée : la semaine qui atteint son objectif.** La charte réserve l'accent
aux actions primaires, **aux séries validées** et aux records. Une semaine tenue est une semaine
validée au sens exact où une série cochée l'est : un engagement pris puis tenu. Même vert, même
fait, autre échelle. Et **l'objectif fixe le plafond de l'échelle** plutôt que d'ajouter une ligne
de repère : objectif 5 contre des semaines à 2 laisse les barres à deux cinquièmes, le manque se
voit sans qu'on l'écrive — et un repère aurait été un escalier, l'objectif changeant dans le temps.
Cas traité : **aucun objectif jamais défini** → aucune barre verte, et une phrase renvoyant vers
l'Historique. Inventer un objectif serait féliciter quelqu'un pour une cible qu'il n'a pas choisie ;
`goalWeeksReached` rend d'ailleurs `judged: 0` et non « 0 sur 12 ».

**Le warning Vite historique a disparu, et c'est un effet de bord à ne pas prendre pour une
victoire.** Avant ce jalon : `index` à **653,67 kB** (gzip 188,58) avec l'avertissement. Après :
`index` **398,10 kB** (gzip 107,06) + un chunk `Screen` partagé de **258,21 kB** (gzip 83,95), sans
avertissement. La troisième route différée a donné à Rollup une frontière pour sortir de l'entrée
du code déjà commun. **Les octets n'ont pas disparu, ils se sont scindés** ; c'est le premier
chargement qui est découpé, pas le total qui baisse. `ChartSurface` sort en chunk partagé de
1,48 kB, `WeeklySessionsScreen` à 6,41 kB (gzip 2,35).

**50 fichiers de tests, 708 tests** (+1 fichier, +29) ; `lint`, `typecheck`, `test:run` et `build`
sont verts, et le build n'a plus **aucun** avertissement.

**Vérifié en pilotant, en 375 × 812 px**, sur 67 séances injectées couvrant 26 semaines avec deux
trous, un changement d'objectif, deux séances le même jour et un dimanche à 23 h 30 porté à UTC+2 :
12 seaux dont les deux semaines vides ; les deux séances du même jour comptent pour 2 ; **la séance
du dimanche 23 h 30 reste dans SA semaine** (5 le 29 juin, 0 le 6 juillet — elle aurait glissé sans
son offset) ; moyenne 2,9 ; 8 semaines sur 12 à l'objectif ; échelle gravée 5 / 0 ; aucun
débordement horizontal (`scrollWidth === innerWidth === 375`) ; plus petite cible 48 px ; SVG hors
ordre de tabulation ; aucune erreur console.

**Checkpoint à vérifier sur le téléphone :** ouvrir **Historique → l'icône de courbe → Séances par
semaine**. Le nombre de barres doit être le nombre de semaines de la période, **trous compris** —
une semaine où tu n'as rien fait doit apparaître comme une colonne vide, pas disparaître. Tape une
de ces colonnes vides : la lecture doit dire « 0 séance ». Vérifie ensuite que les semaines vertes
sont bien celles où tu as tenu ton rythme, et que la phrase du bas (« X semaines sur Y à
l'objectif ») correspond à ce que tu comptes à la main. Si tu changes ton objectif hebdo dans
l'Historique, **les semaines passées ne doivent pas changer de couleur** — seules les semaines à
partir de ce lundi sont jugées sur la nouvelle cible. Enfin, change de période : 4, 12, 26, 52
semaines et Tout.

**Historique précédent :** 2026-07-28 (**jalons G0 + G1 — la couche d'analyse et la première
courbe**). Un exercice a maintenant sa progression : `Historique → Analyses`, ou « Voir la
progression » depuis sa fiche. Spec :
`docs/superpowers/specs/2026-07-28-analytics-exercise-progress-design.md`.

**G0 n'a ajouté aucune requête, et c'est le point de conception du jalon.** Le document de
finition demandait trois lectures bornées neuves (§9.1) ; les trois existaient déjà sous un autre
nom. `listExportSources(scope)` applique exactement ses règles — séances archivées, lignes et
séries vivantes, séries validées seulement, `from` inclusif / `to` exclusif, bornage par l'index
`startedAt` — et son en-tête l'annonçait depuis E1 (« the bounded reads the exports **and, later,
the charts** are built on »). Écrire `analyticsQueries.ts` aurait fait deux portes vers la même
table avec deux définitions possibles de « séance qui compte » : exactement la faute que 08B vient
de réparer entre l'écran d'historique et l'export.

Ce qui manquait, c'est l'agrégation. Elle est pure, dans `src/lib/analytics/` : `periods.ts`
(bornes tombant sur des débuts de semaine locale — « il y a 28 × 24 h » coupe une semaine en deux
et fait clignoter le premier point selon l'heure d'ouverture), `metrics.ts`, `plot.ts` et
`sessions.ts`.

**`metrics.ts` porte la seule règle qui compte : jamais la même métrique pour tous les types
d'exercice.** Onze métriques, réparties par `measurementType` **lu dans l'instantané**. Sans cette
table, « charge max » sur une machine assistée félicite la séance la plus *aidée* — le poids d'une
assistance dort dans le même champ que celui d'un développé couché. D'où aussi
`betterWhen: 'higher' | 'lower'`, qui n'existe que pour l'assistance : **descendre y est une
victoire**, donc le record est le minimum. Vérifié en pilotant : sur les dips assistés, le point
accent est à `cy = 120`, tout en bas de la boîte.

Deux règles héritées, jamais réécrites : les échauffements sortent par `isWorkingSet`, et le
tonnage passe par `sessionTotals` — aucun troisième calcul du tonnage n'existe dans ce dépôt. Et
une règle neuve : **une séance sans valeur pour la métrique ne produit aucun point, jamais un
zéro.** Un zéro serait tracé, et une courbe qui plonge au sol parce qu'un exercice a été retypé est
un mensonge que le lecteur ne peut pas voir.

**Le graphique est un cadran, pas une illustration.** SVG à la main, zéro dépendance : la seule
chose qu'une bibliothèque calcule vraiment est dans `plot.ts`, où elle est testée, et Recharts
aurait coûté ~100 kB gzip sur un chunk déjà signalé, plus une charte à re-mater et des tooltips au
survol — inutilisables au doigt. **Une seule chose est colorée : le point qui détient le record**,
parce que la charte réserve l'accent aux actions primaires, séries validées et records, « rien
d'autre » — une courbe de séances passées n'est aucun des trois, son sommet si. Aucune grille : le
min et le max sont **gravés aux deux bouts**, ce qui est le prix payé comptant pour une échelle qui
ne part pas de zéro (80 → 85 kg sur un axe partant de zéro est plat, donc muet). Deux étiquettes,
jamais une par point. On **tape**, on ne survole pas : un appui n'importe où sélectionne le point le
plus proche en x, donc aucune cible ponctuelle à viser. Le tableau accessible n'est pas un doublon
caché : c'est la liste de séances, et elle porte chaque valeur.

**Un défaut trouvé uniquement en pilotant :** ouvrir la courbe d'un second exercice gardait la
sélection du premier — le gainage s'ouvrait sur le 2 juin parce que c'est là qu'on avait tapé sur le
développé couché. Cause : **React Router ne remonte pas le composant quand seul le paramètre
change.** Corrigé par l'état clé-sur-l'exercice, l'idiome que `ExerciseDetailScreen` utilise déjà.
La période, elle, survit exprès : c'est la fenêtre qu'on lit, pas une propriété de l'exercice.

**Les routes d'analyse sont les seules différées** (§12.2), et le découpage est mesuré :
`ExerciseAnalyticsScreen` sort à **9,34 kB** (gzip 3,25) du bundle principal. La séance en direct ne
paie pas le JavaScript des graphiques.

**Trois écarts argumentés avec le document de finition**, détaillés dans la spec : pas de
`analyticsQueries.ts` (ci-dessus) ; **pas d'allure (min/km)** — elle demande une seconde inversion
de sens et une unité composite que rien d'autre n'écrit, une inversion suffit à un premier jalon ;
**pas de 1RM estimé** — c'est RF-46 et il appartient au Lot 12, avec sa formule configurable en TDD.

**49 fichiers de tests, 679 tests** (+4 fichiers, +38) ; `lint`, `typecheck`, `test:run` et `build`
sont verts. Le warning Vite historique sur le chunk principal reste le seul avertissement.
Vérifié en 375 × 812 px sur un historique de 9 semaines injecté : aucun débordement horizontal
(`scrollWidth === innerWidth === 375`), cibles de 48 et 56 px, un seul point accent, résumé
lecteur d'écran complet, aucune erreur console.

**Deux retours d'usage corrigés juste après, sur capture d'écran :** (1) **le point du record était
rogné à droite** — l'anneau de sélection fait `r = 9` plus 1,5 px de trait, soit 9,75 px, et le
`viewBox` n'en réservait que 8 ; or le dernier point est précisément là où le record se trouve le
plus souvent. `PAD` passe à 12, marge restante mesurée : 2,25 px. (2) **le contenu collait à
l'en-tête sur tous les écrans** — `Screen` ne posait aucune marge haute sur sa zone de défilement.
`pt-3` ajouté **là**, dans le cadre, et pas dans vingt écrans dont un finirait par l'oublier : avec
le `pb-4` de l'en-tête ça fait 28 px, exactement l'écart que les écrans posent déjà entre deux blocs
(`space-y-7`). Vérifié à 12 px sur Historique, Exercices, Routines, Réglages, Analyses, Progression,
Diagnostic, formulaire d'exercice et éditeur de routine. La bande épinglée de la séance en direct
reste au ras de l'en-tête, volontairement : c'est un bandeau d'instruments qui porte son propre
filet, et le contenu reçoit ses 12 px sous elle.

**Simulation complète du checkpoint** (l'utilisateur n'a pas encore assez d'historique) : 78 séances
et 226 séries fabriquées sur 9 mois. Cinq cas vérifiés dans l'app réelle — 40 séances avec plateau,
blessure et remontée ; assistance décroissante ; séance unique ; exercice retypé (10 séances en
base, **6 points**, aucun zéro inventé) ; deux séances le même jour civil (**deux points**). Deux
pièges posés exprès et désamorcés : un échauffement à 150 kg au milieu de séries à 80 kg (la ligne
lit **80 kg**) et l'égalité de record (le point vert tombe sur la **première** fois atteinte).

**Checkpoint à vérifier sur le téléphone :** ouvrir **Historique → l'icône de courbe**, choisir un
exercice que tu pratiques depuis des semaines. La courbe doit correspondre à ce que tu as
réellement fait, et le point vert doit être la séance où tu as posé ta meilleure marque — la
**première** fois que tu l'as atteinte, pas la dernière. Balaie la courbe du doigt : le grand chiffre
au-dessus doit suivre, et la liste dessous doit donner les mêmes valeurs. Puis change de métrique et
de période. Enfin, ouvre un exercice **assisté** (dips ou traction assistée) : la courbe descend
quand tu progresses, la phrase sous le graphique doit dire « Moins, c'est mieux », et le point vert
doit être **en bas**.

**Historique précédent :** 2026-07-28 (**jalon 08B — l'historique lit l'instantané**).
La contradiction ouverte par E2 est refermée : après un renommage, l'écran de détail d'une séance
passée et le document partagé depuis cet écran donnent désormais **le même nom**, parce qu'ils
appliquent la même règle.

Cette règle a un seul endroit : `resolveExerciseIdentity(row, exercise)` dans
`src/lib/exerciseSnapshot.ts` — l'instantané de la ligne, puis la bibliothèque d'aujourd'hui, puis
rien, **champ par champ**. Elle vivait dans `projectCoachExport`, qui l'appelle maintenant au lieu
de la porter. Champ par champ et non « l'instantané ou la bibliothèque, en bloc » : une ligne peut
porter un instantané partiel, et retomber sur la bibliothèque pour les quatre parce qu'un seul
manque perdrait les trois autres. La fonction ne rend aucune clé absente plutôt qu'une clé à
`undefined` : nommer le trou en français reste au appelant — `t('history.deletedExercise')` sur un
écran, `t('export.unknownExercise')` dans un document.

**Ce n'est pas qu'un titre.** `exerciseMeasurementType` décide **quels chiffres d'une série sont
lus** : `HistoryWorkoutDetail` s'en sert pour `performedParts` (les valeurs affichées) et pour
`measurementShape().weightRole` (ce qui compte comme tonnage). D'où les tests du jalon, écrits sur
des fixtures où l'instantané et la bibliothèque se contredisent **exprès** — un test où les deux
concordent ne peut pas dire lequel a été lu : une séance enregistrée en gainage dont l'exercice est
retypé en charge × reps doit continuer à se lire « 45 s », et une séance en charge × reps dont
l'exercice devient assisté doit continuer à compter ses 800 kg de tonnage. Trois des six tests
échouent sur l'ancien code, vérifié en le remettant.

**`historyDraft.ts` avait le même défaut**, et il était plus grave : l'éditeur d'archive prenait
son `measurementType` dans la bibliothèque, donc le retypage d'un exercice changeait **quels champs
une série passée offrait à la saisie**. Rebranché aussi. Rien ne change côté persistance :
`saveArchivedWorkout` re-dérivait déjà l'instantané, et seulement quand l'`exerciseId` de la ligne
change réellement. `HistoryExerciseEditor` n'avait rien à corriger — il affiche ce que le brouillon
lui donne.

**La fiche exercice n'a pas ce défaut** : elle décrit l'exercice *lui-même*, pas une séance passée,
donc son titre et son sous-titre doivent bien être ceux d'aujourd'hui ; et sa liste de séances
passe par `topSetLabel`, qui ne lit aucun `measurementType`.

**Un point laissé tel quel, à décider :** `WorkoutFinishScreen` lit encore
`line.exercise.measurementType` et `line.exercise?.name`. C'est le récapitulatif de la séance qu'on
vient de finir — la fenêtre pour que la bibliothèque ait changé entre-temps est de quelques
minutes, et l'écran n'est pas de l'historique. Hors périmètre de ce jalon, signalé plutôt que
glissé dedans.

**45 fichiers de tests, 641 tests** (+1 fichier, +12) ; `lint`, `typecheck`, `test:run` et `build`
sont verts. Le warning Vite historique sur le chunk principal reste le seul avertissement.

**Checkpoint à vérifier sur le téléphone :** renommer un exercice de la bibliothèque, puis ouvrir
une ancienne séance qui l'utilise dans l'Historique — le détail doit afficher **l'ancien nom**, et
`⋯` → **Copier le texte** doit donner exactement le même. Puis `⋯` → **Modifier** sur cette même
séance : l'en-tête de l'exercice porte l'ancien nom lui aussi, et les champs de saisie de ses
séries n'ont pas changé de nature. Enregistrer sans rien toucher ne doit rien réécrire.

**Historique précédent :** 2026-07-28 (**jalons E1 + E2 — la projection d'export et le Markdown**).
Une séance sort maintenant de l'app en trois gestes : `⋯` → **Partager** → la feuille système.
Une entrée **Copier le texte** est à côté, au même rang, parce que « coller dans une IA » est
l'usage nommé et que le presse-papiers est ce geste-là.

La chaîne est en quatre maillons dont un seul touche Dexie :
`listExportSources` (requêtes bornées, quatre périmètres) → `projectCoachExport` (pur, aucune
chaîne française) → `serializeMarkdown` (pur) → `shareText` (`src/platform/`). Chaque flèche est
testée seule ; la projection et le sérialiseur n'ont jamais besoin d'une base.

**C'est le premier consommateur de l'instantané 08A, et il le valide.** Vérifié en pilotant sur une
vraie séance à trois exercices : renommer « Good morning (barre) » en « RENOMMÉ APRÈS COUP » et
changer son muscle et son matériel ne bouge **rien** dans le document réexporté — ni le nom, ni
« Ischio-jambiers · Barre ». Le tonnage du document (**922,5 kg**) et son compte de séries de
travail (**6**) sont exactement ceux affichés par l'écran, parce que la projection appelle la même
`sessionTotals` : l'assistance des dips et la série d'échauffement sont hors tonnage des deux
côtés. Aucune erreur console, aucun débordement horizontal en 375 px, cibles de 56 px.

**Une contradiction créée par ce jalon, laissée ouverte volontairement** (refermée depuis, par le
jalon 08B ci-dessus) **:** au même moment, l'écran
`HistoryWorkoutDetail` de cette séance affiche, lui, **le nouveau nom** — il lit encore la
bibliothèque. L'export a raison, l'écran a tort, et c'est l'état que le jalon 08A annonçait
(« aucun consommateur n'est encore rebranché »). Le rebrancher touche aussi
`exerciseMeasurementType`, donc la façon dont ses chiffres sont *lus* et pas seulement son titre :
ça mérite son jalon et ses tests.

**Quatre écarts argumentés avec le document de finition**, détaillés dans la spec :
`src/lib/export/` plutôt qu'un second arbre `src/domain/` (§7 de l'architecture définit déjà `lib/`
comme LA couche pure, et deux couches au contrat identique n'auraient aucune règle pour les
départager) ; pas de `definitions: MetricDefinition[]` (un export de séances n'a aucune métrique —
le seul chiffre agrégé, le tonnage, dit lui-même ce qu'il ne compte pas, en une phrase dans
l'en-tête) ; **partage de texte et non de fichier** (le `.md` en pièce jointe fait ouvrir quelque
chose au lecteur, le téléchargement fait chercher un fichier — le fichier arrivera avec le CSV, où
il *est* le produit) ; et la politique de fuseau appliquée ici, à son premier consommateur, plutôt
qu'en E0.

**Deux petits déplacements au passage :** `formatDuration` quitte `HistoryWorkoutDetail` pour
`i18n/labels.ts`, parce que l'écran et le document doivent écrire la même séance de la même
longueur ; et `src/platform/` naît, nommément comme un ajout au §7 de l'architecture (un
adaptateur d'API navigateur n'est ni pur, ni une porte vers la base, ni un composant).

**Hors périmètre assumé :** pas d'écran `/settings/export` (il n'a de sens qu'avec un choix de
format, donc avec E3/E4), pas de CSV, pas de JSON, pas de téléchargement.

**44 fichiers de tests, 629 tests** (+5 fichiers, +86) ; `lint`, `typecheck`, `test:run` et `build`
sont verts. Le warning Vite historique sur le chunk principal reste le seul avertissement.

**Checkpoint à vérifier sur le téléphone :** ouvrir une vraie séance dans l'Historique, `⋯` →
**Partager**, et vérifier que la feuille Android s'ouvre et que le texte arrive **dans le corps**
du message (WhatsApp, Gmail, une note) et non en pièce jointe. Fermer la feuille sans choisir :
l'app ne doit **rien** afficher. Puis `⋯` → **Copier le texte**, coller dans une conversation avec
une IA et lire le document : les colonnes doivent correspondre à ce que chaque exercice se mesure
en (pas de colonne « Charge » sur un gainage, « Assistance » sur une machine assistée), les
décimales être françaises, et aucune série ne doit être résumée.

**Historique précédent :** 2026-07-28 (**jalon 08A — l'instantané des métadonnées d'exercice**).
Chaque `WorkoutExercise` fige désormais le nom, le type de mesure, le muscle principal et le
matériel de son exercice **au moment où il entre dans la séance**, et chaque `Workout` porte
`startedTimezoneOffsetMinutes`. Renommer un exercice, changer son type de mesure ou son muscle ne
réécrit plus le passé — c'est le prérequis des exports et des graphiques, posé pendant qu'il reste
peu de données à rattraper.

Les quatre points de création écrivent l'instantané : `startWorkoutFromRoutine` (qui réutilise le
`bulkGet` déjà fait pour le repos), `addWorkoutExercise`, l'import Hevy, et l'éditeur d'archive.
Règle unique : **l'instantané suit l'`exerciseId`**. Ligne créée ou exercice corrigé → métadonnées
d'aujourd'hui ; ligne inchangée → jamais retouchée, même si la bibliothèque bouge.

Deux écarts assumés avec le document de finition, documentés dans la spec :
`deleteExercise` est un **soft delete**, donc supprimer un exercice ne perd aucune métadonnée —
d'où l'abandon de `snapshotQuality` (ses trois valeurs étaient inatteignables), remplacé par des
champs simplement optionnels dont l'absence est le seul signal. Et `secondaryMuscles` /
`isUnilateral` ne sont pas copiés : aucun export ni graphique planifié ne les lit, et la
bibliothèque les conserve.

Migration `version(2).upgrade()` sans changement de `stores` — aucun des cinq champs n'est indexé.
Elle est **testée sur une vraie base version 1** (`src/data/dbMigration.test.ts`) : c'est le seul
endroit du dépôt où le chemin de migration s'exécute, `resetDb` ouvrant partout ailleurs
directement le schéma courant. **39 fichiers de tests, 543 tests** ; `lint`, `typecheck`,
`test:run` et `build` sont verts. Le warning Vite historique sur le chunk principal reste le seul
avertissement.

**Aucun consommateur n'est encore rebranché sur l'instantané** : les écrans continuent de lire la
bibliothèque. Les brancher est le travail des jalons d'export et de graphiques, qui savent ce dont
ils ont besoin.

**Checkpoint à vérifier sur le téléphone :** ouvrir l'app une fois (la migration s'exécute au
premier chargement), vérifier qu'aucune séance de l'historique n'a changé d'apparence, puis
renommer un exercice de la bibliothèque et rouvrir une ancienne séance qui l'utilise — elle doit
encore afficher **l'ancien nom** une fois les écrans rebranchés, et l'ancien nom est déjà en base
dès maintenant (visible via l'écran de debug ou un export ultérieur).

**Historique précédent :** 2026-07-27 (**poids des routines Hevy**). Chaque série d’une routine
importée reprend maintenant le poids exact de la série correspondante dans la séance
représentative (`targetWeight`). Une série sans poids reste sans cible et le RPE n’est pas copié.

**Historique précédent :** 2026-07-27 (**filtres du sélecteur d’exercices Hevy**). La fenêtre de
validation manuelle propose maintenant les filtres **Muscle** et **Matériel** de la bibliothèque.
Recherche, muscle, matériel et compatibilité du type de mesure se combinent ; fermer ou valider
une association remet les trois critères à zéro. Vérifié avec le vrai CSV : `Épaules + Poulie +
elevations` ne conserve que `Élévations latérales (poulie)`. À **402 × 698 px**, aucun débordement
horizontal et aucune erreur console sur le parcours testé. **35 fichiers de tests, 521 tests** ;
`lint`, `typecheck`, `test:run` et `build` sont verts. Le warning Vite historique sur le chunk
principal reste le seul avertissement.

**État fonctionnel repris :** tester sur le téléphone les filtres Muscle et Matériel pendant les
quatre associations manuelles Hevy, puis terminer les checkpoints d’import et de séance décrits
ci-dessous.

**Historique précédent :** 2026-07-27 (**import Hevy enrichi : détection fiable + routines**).
Les titres Hevy connus sont maintenant associés par alias canonique vers les `slug` stables du
catalogue ; le classement de secours comprend des synonymes français/anglais et donne un poids
fort au matériel. Les identités de mapping incluent désormais le matériel : barre, haltères et
Smith ne peuvent plus s’écraser. Les anciens mappings sans matériel restent relus en repli.
Sur le vrai export de validation, **20 exercices sur 24** reviennent directement cochés et justes ;
seuls `Rotation Externe Poulie`, `Hip Thrust (Dumbbell)`, `Tirage bas iso-latéral` et
`Développé Debout Poulie Centrée` restent à choisir.

Le même import crée maintenant un dossier `Import Hevy — JJ/MM/AAAA` et une routine par nom de
séance. Pour chaque nom, la référence est la plus complète des cinq séances les plus récentes,
puis la plus récente en cas d’égalité. Ordre, nombre et type des séries sont repris ; aucun
superset, poids cible ni RPE cible n’est inventé. Dossier, routines, séances, exercices et mappings
partagent la même transaction Dexie.

**Vérification réelle en 375 × 812 px :** 4 séances, 24 exercices et 90 séries détectés ;
4 routines `LOWER A`, `UPPER B`, `LOWER B`, `UPPER A` créées dans un seul dossier daté ; zéro
débordement horizontal et zéro erreur console. La seconde importation annonce **0 importée,
4 ignorées** et laisse un seul dossier avec 4 routines. **34 fichiers de tests, 519 tests** ;
`lint`, `typecheck`, `test:run` et `build` sont verts. Le warning Vite historique sur le chunk
principal reste le seul avertissement.

**État fonctionnel repris :** le code du Lot 07 est complet jusqu’au jalon 07C et ses retours
d’usage. Restent les checkpoints sur le téléphone réel : choisir le CSV depuis Android, vérifier
les quatre associations manuelles, importer, recharger hors ligne, ouvrir/corriger une séance et
une routine importées, puis confirmer la réimportation sans doublon. Terminer aussi la vérification
07B et la bascule « Tout replier / Tout déplier » au milieu d’une vraie séance.

**Historique précédent :** 2026-07-27 (**jalon 07C implémenté**). L’Historique importe hors ligne
`workout_data.csv` depuis Hevy : lecture RFC 4180, validation détaillée, aperçu, association
explicite et mémorisée des exercices, créations personnalisées sans quota, déduplication et
écriture Dexie atomique.

**Historique précédent :** 2026-07-27 (**refactorisation pré-07B terminée**). Les façades publiques
`workouts.ts` et `routines.ts` conservent exactement leurs APIs, tandis que leurs responsabilités
sont réparties dans huit modules internes de moins de 300 lignes. Aucun consommateur, test,
comportement ou périmètre de transaction Dexie n’a changé.

**Historique précédent :** 2026-07-25 (**Lot 6 officiellement terminé — checkpoint téléphone
RF-28 validé par l’utilisateur**). Sans plaque de 25 kg, une cible de 100 kg sur une barre de 20 kg
affiche bien **2 × 20 kg par côté** ; la désélection persiste après rechargement ; remettre 25 kg
restaure **25 + 15 kg par côté**. Les trois tranches du Lot 6 sont maintenant validées en usage
réel.

**Historique antérieur :** 2026-07-24 (**RF-28 — les plaques disponibles sont désormais
configurables, globales et persistées dans IndexedDB** — cf. la section dédiée ci-dessous).
La feuille « Plaques à charger » propose les dix dénominations canoniques dans une section
repliable neutre, sans comptage de paires ni plaque personnalisée. Toutes sont actives par défaut ;
un inventaire vide reste valide. Chaque bascule écrit immédiatement via le repository `settings`,
réveille `useLiveQuery` et recalcule tous les schémas ouverts. Vérifié dans la vraie app en
375 × 812 px : cibles de 48 px, aucun débordement, focus neutre, 100 kg sur une barre de 20 kg
devient **2 × 20 kg par côté** sans plaque de 25 kg, persiste après rechargement, puis redevient
**25 · 15 kg** après resélection. 24 fichiers, **332 tests** (+12), quatre portes vertes.
**L’implémentation du Lot 6 est terminée ; sa clôture officielle attend le checkpoint téléphone
RF-28 demandé à l’utilisateur.**

**Historique antérieur :** 2026-07-24 (**Reste du Lot 6, tâche 5 sur 5 : le poids de
barre se règle là où il sert, dans « Plaques à charger » (RF-31)** — cf. la section dédiée
ci-dessous. Valeur éphémère par exercice de la séance affichée : elle survit à la fermeture de la
feuille, mais pas à une navigation ou un rechargement. Barre et Smith réglables ; machine à plaques
fixe à 0 kg, sans faux réglage de barre. Aucun schéma, repository, réglage global ni stockage ajouté.
Vérifié en 375 × 812 px : 20 → 15 kg recalcule immédiatement 100 kg en 25 + 15 + 2,5 par côté ;
15 kg est encore lu après fermeture/réouverture ; aucun débordement, cibles de 48 px, focus neutre,
console vide. 320 tests (+7 pour RF-31), quatre portes vertes. **La tranche 3 est terminée et
validée en usage réel ; le checkpoint RF-31 est validé sur téléphone et en salle.** —
Antérieurement : **Reste du Lot 6, tâche 4 sur 5 : le calculateur
d’échauffement insère une rampe configurable avant les séries de travail (RF-29)** — cf. la section
dédiée ci-dessous. Rampe proposée 40 % × 10, 60 % × 5, 80 % × 3, arrondie vers le bas au pas de
2,5 kg, sans limite de nombre d’étapes. Écriture immédiate dans une seule transaction Dexie :
`setType: 'warmup'`, cibles seulement, rangs continus, rollback complet. Vérifié en 375 × 812 px :
aucun débordement, cibles de 48 px minimum, focus et actions neutres, ordre 40/60/80 puis 100 × 5
encore lu après rechargement. 313 tests (+29 pour RF-29), quatre portes vertes. — Antérieurement :
**Reste du Lot 6, tâche 3 sur 5 : le RPE facultatif se saisit
dans la feuille de série sans charger la grille (RF-30)** — cf. la section dédiée ci-dessous.
Échelle 6–10 par pas de 0,5, effacement explicite, écriture immédiate via `updateSetValues`, état de
divulgation purement éphémère. Vérifié en 375 px : dix cibles de 48 × 60,64 px minimum, sélection et
focus neutres, valeur puis effacement relus après rechargement depuis IndexedDB via Dexie. 284 tests
(+4 pour RF-30), quatre portes vertes. — Antérieurement : **Reste du Lot 6, tâche 2 sur 5 : le record battu se
voit en direct, sur la ligne qui l'a battu (RF-23)** — cf. la section dédiée ci-dessous. **Rien n'est écrit
en base** : `personalRecords` reste vide et la question est reposée à chaque rendu, ce qui rend
gratuite l'invalidation d'un record décoché, supprimé ou requalifié en échauffement. 279 tests (+20),
quatre portes vertes. — Antérieurement : **Le rang d'une série passe sous transaction** — le défaut
hors périmètre relevé à la tâche 1 est corrigé, et il touchait bien `addWorkoutExercise` aussi : cf.
la note en fin de section « Types de séries ». 259 tests, quatre portes vertes. — Antérieurement :
**Reste du Lot 6, tâche 1 sur 5 : les types de séries sont
modifiables en séance (RF-20)** — cf. la section dédiée ci-dessous. Le crochet était posé depuis le
Lot 5 (le bouton de rang existait « pour que le Lot 6 y accroche le type ») et les quatre phrases
dormaient dans `fr.ts` depuis le Lot 4, lues par personne. **Les marques sont des pictogrammes, pas
des mots** — décision de l'utilisateur : « ÉCH. » et « ÉCHEC » ne se séparent pas à bout de bras.
**Et une règle de repos manquante, trouvée en lisant** : la série *avant* une dégressive ne doit pas
reposer. 256 tests, quatre portes vertes. **Un défaut hors périmètre trouvé en pilotant** : `addSet`
lit le rang puis écrit sans transaction → deux séries au même `order` (sorti en tâche à part,
**corrigé depuis**). — Antérieurement : **Quatre retours d'usage post-séance, corrigés et vérifiés en
pilotant le navigateur en 375 px.** (1) **Scroll impossible en recherchant un exo** : la vraie cause
n'était pas la liste mais le clavier — sur Android il se pose *par-dessus* la vue sans en réduire la
hauteur (`resizes-visual` par défaut), donc le conteneur `100dvh` ne débordait pas et ses derniers
résultats restaient piégés derrière le clavier. Corrigé **à la racine** par `interactive-widget=resizes-content`
dans le viewport (`index.html`) — global, pas seulement le picker de routine. (2) **Filet de repos collé
au séparateur** : relevé de `bottom-0` à `bottom-[5px]` (`RestRail.tsx`), 5,8 px de gap mesurés. (3)
**« x série sur y » qui partait au scroll** : déplacé dans le slot `sub` de `Screen` (épinglé sous
l'en-tête, hors défilement, sur sa propre ligne — règle du Lot 4), vérifié en direct qu'il suit la
validation. (4) **Impossible de supprimer une série dans une routine** : chaque ligne enveloppée dans
`SwipeToDelete`, le composant exact de la séance en direct (`RoutineExerciseCard.tsx` + `deleteRoutineSet`).
Piège corrigé au passage : le wrapper faisait de chaque ligne un `:last-child`, ce qui cassait les
séparateurs via `last:border-b-0` — le filet est désormais piloté par une prop `last`. 252 tests, trois
portes vertes. **Leçon transverse** : un scroll « impossible » est souvent un problème de clavier/viewport,
pas de liste ; la corriger dans la liste aurait masqué le défaut sans le résoudre. — Antérieurement :
**Trois retours d'usage sur les plaques + le repos, corrigés
en pilotant depuis le téléphone** — cf. section « Trois retours … » sous le calculateur de plaques.
En résumé : (1) le picker de repos débordait sur « 3:00 » → grille 5 colonnes ; (2) le filet de repos
tombait sous « Ajouter une série » → remonté sur le séparateur header/corps ; (3) les plaques étaient
introuvables **et** figées sur une seule charge → icône visible sur la carte + **un schéma par charge
distincte**. 252 tests, quatre portes vertes. — Antérieurement : **Tâche 2 du reste-Lot-6 livrée : le
calculateur de plaques (RF-28)**, moteur pur en TDD (10 tests), schéma monochrome par choix de charte.
Et : **Checkpoints en salle validés par l'utilisateur : Lot 5 et minuteur du Lot 6 sont bons.** Tout ce qui était livré a été jugé sur une vraie séance et tient — les
trois paris du minuteur (filet sous la série, repos dans le statut de la card, rendu fluide) sont
confirmés. Le Lot 5 est **terminé** ; le Lot 6 reste ouvert sur son **reste** (plaques, échauffement,
RPE, record en direct, types de séries), seule la tranche minuteur y est close. Prochain travail :
Lot 5bis (schéma musculaire) ou la suite du Lot 6. — Antérieurement : **Les trois derniers réglages
de la feuille routine / mise en page sont faits** — #7 espacement 1ère carte : re-mesuré, déjà résolu par la suppression du bandeau
(24 px, comme partout, aucun code) ; #6 well du `RestPicker` centré (`items-center`, nombre à 10/10 px
du well) ; #4 phrase de repos ramenée de 2 lignes à 1. **Un défaut de plus trouvé en pilotant** — le
`ConfirmSheet` mangeait ses boutons : `safe-bottom` et `pb-5` posaient tous deux `padding-bottom` et
s'écrasaient ; nouvel utilitaire additif `sheet-bottom`, **28 px** de gap sous les boutons. Quatre
passes vertes, 242 tests. Il ne reste que le **checkpoint en salle** de la refonte.
— Rappel antérieur : survie au kill et mode avion **validés**, bouton d'ajout en séance vide corrigé
(`614e523`), refonte de l'écran de séance complète (briques 2+3), vitest ne ramasse plus les
worktrees d'agent (`b7dda06`).)

## Lot 07 — journal de session (instantané historique ; le lot est terminé)

### Jalon 07C — import CSV Hevy hors ligne

**Livré dans cette session :**

- parseur pur RFC 4180 des 14 colonnes Hevy : BOM, guillemets, virgules, retours à la ligne,
  dates locales françaises, nombres décimaux, types de séries et cinq formes de mesure ;
- regroupement stable des séances, exercices, supersets et séries, avec provenance
  `importSource: 'hevy_csv'` et clé d’import déterministe ;
- suggestions déterministes, choix explicite parmi tous les exercices de mesure compatible,
  création personnalisée et mappings mémorisés seulement vers des exercices encore vivants ;
- préparation en lecture seule puis transaction Dexie unique couvrant exercices, séances, blocs,
  séries et mappings ; rollback testé et aucune écriture avant l’action finale ;
- assistant mobile `/history/import` avec erreurs françaises par ligne, compteurs, revue,
  résultat séparant importées/ignorées et raccourci depuis l’Historique ;
- fixture strictement anonymisée de quatre séances couvrant notes multilignes, supersets,
  `normal`, `warmup`, `dropset`, `failure` et les cinq formes de mesure.

**TDD, revue et portes :**

- tests rouges puis verts pour le parseur, les suggestions, les mappings, le repository atomique,
  le brouillon d’interface, la fixture complète et le refus d’un en-tête connu dupliqué ;
- revue finale : le nom d’un exercice choisi hors proposition est maintenant restitué dans la
  liste ; une réimportation faite uniquement de doublons peut aller jusqu’au récapitulatif final ;
- suite complète : **31 fichiers, 472 tests** ;
- `lint`, `typecheck`, `test:run` et `build` passent. Le seul avertissement reste le chunk Vite
  principal supérieur à 500 kB (**630,58 kB**, gzip **181,71 kB**).

**Vérification du fichier réel :**

- export détecté : **4 séances, 24 exercices, 90 séries** ;
- premier import : **4 importées, 0 ignorée** ; le Journal affiche les quatre séances et leurs
  nombres d’exercices/séries ;
- seconde passe : mappings repris, **0 importée, 4 ignorées**, aucune erreur console ;
- rendu 375 × 812 px sans débordement horizontal ni cible visible sous 48 px.

**Prochaine reprise exacte :**

1. effectuer le checkpoint téléphone complet 07B ;
2. effectuer le checkpoint téléphone 07C ci-dessous ;
3. une fois ces validations manuelles obtenues, clôturer officiellement le Lot 07 et reprendre
   le prochain lot de `docs/plans/00-ROADMAP.md`.

**Checkpoint manuel demandé :** sur Android, ouvrir Historique → Importer depuis Hevy, choisir
`workout_data.csv`, contrôler plusieurs associations, terminer l’import puis recharger en mode
avion. Ouvrir une séance importée, corriger une charge, enregistrer et vérifier le total. Relancer
enfin le même import et confirmer que les quatre séances sont ignorées sans doublon.

### Jalons 07A et 07B — consultation, régularité et correction

**Livré dans cette session :**

- spec validée : `docs/superpowers/specs/2026-07-25-lot-07-historique-design.md` ;
- plan d’exécution : `docs/superpowers/plans/2026-07-25-lot-07a-consultation-regularite.md` ;
- moteur pur `src/lib/history.ts` : semaine locale lundi–dimanche, traversée DST, résolution de
  l’objectif applicable et streak qui ne casse pas sur une semaine courante incomplète ;
- réglage `weeklyTrainingGoalHistory` dans `settings` : premier objectif rétroactif, changements
  suivants effectifs au lundi, remplacement dans la même semaine, entier positif sans maximum ;
- repository `src/data/repositories/history.ts` : journal récent d’abord, pagination 20 + 1,
  filtre exercice prêt, lecture d’un jour local et options d’exercices réellement pratiqués ;
- écran Journal : carte Régularité, objectif initialisable et modifiable au tap, rail
  proportionnel, état vide et séances archivées réelles ;
- grille mensuelle pure en TDD, vue Calendrier conforme au langage visuel FitTrack et filtre par
  exercice partagé entre Journal et Calendrier ;
- navigation depuis les résumés vers le détail archivé, totaux et séries en lecture seule,
  confirmation de suppression et notice de retour au Journal ;
- éditeur rétroactif à brouillon local : métadonnées, exercices et séries, ajout/suppression/réordre
  sans quota, sortie protégée et sauvegarde transactionnelle unique.

**TDD et portes :**

- `src/lib/history.test.ts` : 15 tests ;
- `src/data/repositories/settings.test.ts` : 10 nouveaux tests, 17 au total ;
- `src/data/repositories/history.test.ts` : 32 tests, dont les mutations transactionnelles 07B ;
- `src/features/history/historyDraft.test.ts` : 8 tests purs de dates locales, copie indépendante et
  brouillons temporaires ;
- suite complète : **27 fichiers, 401 tests** ;
- `lint`, `typecheck`, `test:run` et `build` passent. Le warning Vite historique sur le chunk
  principal supérieur à 500 kB reste inchangé.

**Prochaine reprise exacte :**

1. effectuer le checkpoint téléphone complet de 07B : détail, modification persistée et
   suppression d’une séance de test ;
2. écrire/exécuter le plan 07C : import `workout_data.csv` Hevy, aperçu, mapping, déduplication et
   transaction atomique. `measurement_data.csv` reste réservé au futur lot Mesures.

**Checkpoint manuel demandé :** sur téléphone, ouvrir une séance terminée depuis le Journal,
modifier une charge et le type d’une série, enregistrer puis recharger pour vérifier les totaux.
Ensuite supprimer uniquement une séance de test et confirmer sa disparition du Journal, du
Calendrier et des records.

## Dernier lot terminé

**Lot 6, tranche 1 — Minuteur de repos.** Code livré, vérifié en pilotant l'écran, puis **validé sur
une vraie séance en salle (2026-07-24)**. La tranche est close.

**Lot 6, tranche 2 — Calculateur de plaques (RF-28).** Code et configuration des dénominations
livrés (cf. sections dédiées ci-dessous). La vérification navigateur en 375 × 812 px est faite ;
**le checkpoint final sur téléphone est validé par l’utilisateur (2026-07-25)**.

**Lot 6, tranche 3 — Le reste, en 5 tâches, une par une, arrêt entre chaque.** La tranche est
**terminée et validée en usage réel (2026-07-24)**. L'ordre était celui de la valeur en salle,
arbitré au début de la session :

1. ✅ **Types de séries en séance (RF-20)** — `ed70013`, cf. la section dédiée ci-dessous.
2. ✅ **Record battu en direct (RF-23)** — `825c66b`, cf. la section dédiée ci-dessous.
3. ✅ **RPE, masquable (RF-30).** Saisie repliable dans la feuille de série, aucune colonne ni badge
   dans la grille. `updateSetValues` existant écrit ou efface la valeur ; aucun changement de
   repository, de schéma ou de réglage global. `629abc7`, cf. la section dédiée ci-dessous.
4. ✅ **Calculateur d'échauffement (RF-29).** Rampe en pourcentages configurable dans le menu `⋯`
   de l’exercice, moteur pur en TDD et insertion transactionnelle immédiate avant les séries de
   travail. Spécification `6db57de`, implémentation `b90ecae`, cf. la section dédiée ci-dessous.
5. ✅ **Poids de barre (RF-31).** Réglable **dans la feuille des plaques**, là où le besoin naît
   (« aujourd'hui je suis sur une barre de 15 »). Choix éphémère par exercice tant que l’écran de
   séance reste monté, retenu après fermeture/réouverture de la feuille. Le comptage des paires,
   le poids de barre global et les autres réglages matériels restent au **Lot 8** ; seule la
   sélection durable des dénominations a finalement été sortie pour achever RF-28. `1e03a31` ;
   checkpoint validé sur téléphone et en usage réel.

**Clôture officielle du Lot 6 : terminée le 2026-07-25.** Toute l’implémentation, les vérifications
automatisées/navigateur et les checkpoints téléphone sont validés. Le Lot 5bis, le Lot 7 et le
Lot 8 ne sont pas commencés.

### Plaques disponibles configurables (RF-28) — 2026-07-24

**Une source de vérité globale, durable et sans migration.** Le repository
`src/data/repositories/settings.ts` lit et écrit la clé `availablePlateWeightsKg` dans la table
`settings` existante. Il normalise les valeurs sur les dix dénominations canoniques
25 / 20 / 15 / 10 / 5 / 2,5 / 1,25 / 1 / 0,5 / 0,25 kg, supprime doublons et valeurs invalides,
et conserve l’ordre canonique. Une absence de réglage ou une valeur historique inutilisable
retombe sur toutes les plaques ; un tableau vide explicite reste valide. Chaque sauvegarde tient
dans un seul `db.settings.put`. Aucun composant n’importe `db` et le schéma Dexie ne change pas.

**Le flux reste local-first et réactif.** `WorkoutScreen` observe le repository avec
`useLiveQuery`, fournit toutes les plaques pendant la lecture initiale, puis transmet la sélection
à `PlateLoadSheet`. La feuille construit un `PlateInventory` et le passe à chaque appel de
`computePlateLoad` : tous les schémas se recalculent immédiatement, sans modifier le moteur pur.
La sauvegarde est attendue ; en cas d’échec, le choix courant reste visible et un message localisé
invite à réessayer.

**Interface dans « Plaques à charger ».** Une section native repliable « Plaques disponibles »
est placée après le poids de barre et avant les schémas. Elle affiche le compte sélectionné, puis
une grille 5 × 2 de boutons `aria-pressed` de 48 px minimum. Les états sélectionné, désélectionné
et focus emploient la palette neutre : aucun accent visuel réservé aux records. Toutes les
dénominations peuvent être retirées ; l’état vide affiche explicitement qu’aucune plaque n’est
sélectionnée et les schémas rendent le poids manquant. Le poids de barre RF-31 reste éphémère par
exercice.

**TDD et régression :**

- repository : import absent au rouge, puis **7 tests verts** sur valeur par défaut, lecture,
  normalisation, persistance, inventaire vide, repli sûr et écriture atomique ;
- feuille : cinq comportements ajoutés au rouge, puis **8 tests verts** au total sur l’affichage,
  le recalcul, la persistance déléguée, l’état vide et le message d’échec ;
- un test rouge supplémentaire a reproduit la double ponctuation de l’annonce lecteur d’écran
  « Barre nue… », puis le gabarit localisé a été corrigé ;
- suite complète : **24 fichiers, 332 tests** — soit 12 tests de plus que le checkpoint RF-31.

**Pilotage réel, 375 × 812 px, port 5173, base `/FITTRACK-RELOADED/` :**

- `innerWidth === document.body.scrollWidth === 375` ; aucun débordement horizontal ;
- les dix boutons mesurent **57,6 × 48 px** et restent actionnables à une main ;
- retirer 25 kg passe le compteur à 9/10 et transforme 100 kg sur barre de 20 kg en
  **2 × 20 kg par côté** ; les schémas 40/60/80 kg se recalculent aussi ;
- recharger l’app conserve 9/10 et **2 × 20 kg** ;
- remettre 25 kg restaure 10/10 et **25 + 15 kg par côté** ;
- retirer les dix plaques donne 0/10, le message d’état vide, une barre nue et 80 kg manquants
  pour une cible de 100 kg ;
- les dix plaques ont été restaurées à la fin ; aucune erreur ni aucun avertissement navigateur.

`typecheck`, `lint`, `test:run` et `build` passent. Le build conserve seulement l’avertissement Vite
déjà connu sur le chunk principal supérieur à 500 kB.

**✅ Checkpoint téléphone RF-28 : validé par l’utilisateur le 2026-07-25.** Sans 25 kg, 100 kg sur
une barre de 20 kg donne **2 × 20 kg par côté** et le choix survit au rechargement. Après
resélection de 25 kg, le schéma retrouve **25 + 15 kg par côté**.

### Poids de barre réglable (RF-31) — 2026-07-24

**La durée de vie est volontairement courte et explicite.** `WorkoutScreen` garde le poids choisi
dans un état React indexé par `WorkoutExercise.id`. Fermer puis rouvrir « Plaques à charger » sur le
même exercice conserve donc le choix du jour. Changer d’exercice n’emporte pas la valeur avec lui ;
quitter/recharger l’écran la remet au défaut matériel. Rien n’est écrit dans IndexedDB,
`localStorage`, Zustand ou un repository. Ce n’est ni un réglage global anticipé, ni un début
d’inventaire de salle.

**Le contrat matériel reste étroit :**

- barre olympique et Smith : défaut 20 kg, poids réglable sans quota, par pas de 2,5 kg ou saisie
  décimale directe ;
- machine à plaques : base fixe 0 kg, texte honnête « Charge à vide 0 kg », aucun contrôle nommé
  « Poids de la barre » ;
- machine à broche, haltère fixe, charge ajoutée/assistée : toujours exclus par les deux portes
  existantes de `platesConfigFor`.

`plateConfig.ts` expose maintenant `barWeightAdjustable` avec le poids et le nombre de côtés.
`PlateLoadSheet` réutilise le `NumberInput` existant au-dessus des schémas : trois contrôles de
48 px, surfaces et focus neutres, aucun accent. Le contrôle remplace le rappel passif de barre au
lieu d’ajouter une nouvelle carte ou une seconde feuille. Toute modification repasse immédiatement
les charges distinctes dans `computePlateLoad` ; le moteur reste pur, sans accès réseau et
entièrement disponible hors-ligne.

**TDD :** deux cycles rouges puis verts, plus la régression trouvée en revue :

- 4 cas sur `platesConfigFor` : barre, Smith, machine à plaques et mesure non chargeable ;
- 3 cas sur `PlateLoadSheet` : recalcul 20 → 15 kg, machine sans faux réglage et effacement ramené
  visiblement à 0 kg plutôt qu’interprété en silence ;
- suite complète : **23 fichiers, 320 tests**.

**Pilotage réel, 375 × 812 px, port 5173, base `/FITTRACK-RELOADED/` :**

- `innerWidth === document.body.scrollWidth === 375` ; feuille sans débordement horizontal
  (`375,2 px` de boîte composée sur un viewport de 375 px, sans hausse du `scrollWidth`) ;
- boutons − / + / fermer : **48 × 48 px** ; champ : **216 × 48 px** ;
- `getComputedStyle` du focus : halo et `outlineColor` `rgb(161, 161, 170)` (`--text-2`), jamais
  l’accent réservé aux records et séries validées ;
- sur les charges 40/60/80/100 kg, passer la barre de 20 à 15 kg recalcule immédiatement les quatre
  lectures ; 100 kg devient **25 · 15 · 2,5 par côté** ;
- après fermeture complète puis réouverture, le champ lit encore **15** et le schéma de 100 kg
  porte encore **25 · 15 · 2,5** ;
- aucune erreur ni aucun avertissement navigateur.

`typecheck`, `lint`, `test:run` et `build` passent. Le build conserve seulement l’avertissement Vite
déjà connu sur le chunk principal supérieur à 500 kB.

**✅ Checkpoint salle RF-31 : validé par l'utilisateur sur téléphone et en usage réel
(2026-07-24).** Le poids de barre réglable recalcule correctement les plaques, reste propre à
l'exercice, survit à la fermeture/réouverture de la feuille et revient au défaut après navigation
ou rechargement. Barre et Smith sont réglables ; la machine à plaques reste fixée à 0 kg.

### Calculateur d’échauffement (RF-29) — 2026-07-24

**Le calcul reste explicite et modifiable.** L’action « Calculer l’échauffement » vit dans le menu
`⋯` de chaque exercice dont la mesure porte une vraie charge (`weightRole: 'load'`) ; elle ne
surcharge ni le header ni la grille. La feuille propose 40 % × 10, 60 % × 5 et 80 % × 3, avec
pourcentage et répétitions éditables, suppression et ajout d’étapes sans quota. La charge de travail
vient de la première série non-échauffement (`weight`, puis `targetWeight`) et reste modifiable.
Les exercices au poids du corps, assistés, ou mesurés seulement en temps/distance n’exposent pas
l’action.

**Règles du moteur pur `lib/warmup.ts` :**

- calcul en centièmes de kilogramme entiers, puis arrondi **vers le bas** au pas de 2,5 kg ;
- charge minimale de 20 kg pour une barre ou une Smith, zéro pour les autres charges ;
- résultat conservé seulement si `0 < charge d’approche < charge de travail` ;
- deux étapes aboutissant au même poids restent deux séries distinctes ;
- validation stricte des nombres finis, des pourcentages dans `]0, 100[` et des répétitions
  entières positives ;
- aucune limite artificielle sur le nombre d’étapes.

**La persistance est une seule décision transactionnelle.** `insertWarmupSets` lit le parent et les
séries vivantes, crée toutes les nouvelles lignes avec `setType: 'warmup'`, `targetWeight` et
`targetReps` seulement, puis décale les séries existantes dans la même transaction Dexie. Les tests
couvrent l’ordre, les soft-deletes, deux insertions concurrentes, le parent absent et le rollback
après échec de renumérotation. Les séries générées restent non validées (`isCompleted: 0`,
`performedAt: 0`) : les règles déjà livrées les excluent du volume, des records et du repos.

**TDD :** les trois nouveaux blocs ont été vus rouges puis verts :

- 15 cas exécutés pour le moteur et ses entrées invalides ;
- 5 cas repository ajoutés au fichier de séances ;
- 9 cas exécutés pour l’éligibilité et le préremplissage.

Suite complète : **21 fichiers, 313 tests**. `typecheck`, `lint`, `test:run` et `build` sont verts.
Le build garde l’avertissement Vite déjà connu sur le chunk principal supérieur à 500 kB ; aucune
erreur de production.

**Pilotage réel, 375 × 812 px, base `/FITTRACK-RELOADED/` :**

- `document.body.scrollWidth === innerWidth === 375` et la feuille mesure 375 px sans débordement ;
- chaque bouton et champ mesuré fait **48 px de haut minimum** ;
- le focus du champ de charge est `rgb(161, 161, 170)` (`--text-2`), pas l’accent ;
- l’ajout d’une quatrième étape fonctionne et invalide correctement une ligne incomplète ;
- après insertion, la grille lit 40 × 10, 60 × 5, 80 × 3 puis la série de travail 100 × 5 ;
- après rechargement complet, le même ordre et les mêmes cibles sont relus par la vue Dexie ;
- aucune erreur ni aucun avertissement navigateur.

**✅ Checkpoint salle RF-29 : validé en usage réel (2026-07-24).** Sur un exercice barre prévu à
100 kg, la rampe 40/60/80 s'insère avant la série de travail, persiste après fermeture/réouverture
de l'app, ne lance pas de repos et reste naturelle avec le matériel réellement disponible.

### RPE masquable (RF-30) — 2026-07-24

**« Masquable » ne crée pas un réglage avant le Lot 8.** Le RPE ne prend jamais une colonne, un
badge ou une préférence dans la grille principale. L'entrée « Effort perçu (RPE) » reste en revanche
toujours visible dans la feuille de la série : c'est elle qui rend la fonction découvrable. Son
sous-titre dit « Non renseigné » ou la valeur courante ; un appui déplie l'échelle dans la même
feuille.

**État et persistance sont volontairement séparés :**

- l'ouverture de l'échelle est un `useState` local à `WorkoutRpeField` ; fermer la feuille l'oublie ;
- la valeur appartient toujours à `WorkoutSet.rpe`, déjà prévu au Lot 2 ;
- `WorkoutScreen` relaie seulement `{ rpe }` à `updateSetValues`, qui écrivait déjà `SetValues` ;
- « — » écrit `undefined` et efface donc réellement la propriété ;
- aucun changement de repository, de schéma Dexie, de Zustand ou de réglage global.

**La forme vient de la salle, pas d'un formulaire de bureau.** Les neuf valeurs de 6 à 10 par pas
de 0,5 et l'effacement tiennent en **2 × 5**. La sélection gagne un fond, une graisse et une double
bordure neutres ; elle n'emprunte jamais l'accent réservé aux records et aux séries validées.
`aria-pressed` porte la sélection et la valeur courante est reliée comme description accessible au
bouton de divulgation.

**TDD :** quatre tests de composant ont été vus rouges puis verts : masquage jusqu'à la demande,
description accessible de la valeur courante, choix de 8,5 et effacement vers `undefined`.

**Pilotage réel, 375 × 812 px :**

- les dix cibles mesurent toutes **48 px de haut** et **60,64 px de large au minimum** ;
- la feuille ouverte tient entièrement dans le viewport ;
- `getComputedStyle` mesure la sélection à `font-weight: 700`, fond `rgb(161, 161, 170)` et texte
  sombre, contre `500`, fond `rgb(30, 30, 33)` et texte secondaire pour une valeur non choisie ;
- aucun contrôle RPE ne prend la couleur `--accent-ink` ;
- 8,5 reste lu après un rechargement complet, puis « Non renseigné » reste lu après effacement et
  second rechargement : dans les deux cas, le rendu est réhydraté par l'abonnement Dexie, pas gardé
  par l'état React.

**Pièges trouvés uniquement en pilotant :** le premier câblage avait placé le composant dans la
feuille d'exercice, où sa condition était impossible ; puis le focus global dessinait une ligne
accent sous la divulgation. Le composant vit maintenant dans la vraie feuille de série et ses focus
utilisent `--text-2`, tout en restant visibles au clavier.

**✅ Checkpoint salle RF-30 : validé en usage réel (2026-07-24).**

### Record battu en direct (RF-23) — 2026-07-24

**La décision qui commande tout le reste : rien n'est écrit.** `personalRecords` existe depuis le
Lot 2 et reste vide ; la détection en direct est **dérivée**, comme le Lot 3 dérive les records de
l'historique qu'il lit. C'était le point à trancher, et voici pourquoi il tombe de ce côté :

- **Un record est un fait sur l'historique, pas un événement.** Écrit à la validation, il devient un
  mensonge à la seconde où on décoche la série, où on la supprime, où on retape un chiffre — et
  depuis la tâche 1, où on la **requalifie en échauffement en pleine séance**. Chacun de ces gestes
  est à un appui sur cet écran. Il faudrait donc cinq chemins d'invalidation en cascade, tous à
  garder synchrones avec la vérité. **Dérivé, ça ne coûte rien : la question est simplement reposée
  à chaque rendu.** Vérifié en pilotant, les trois cas.
- **Le Lot 13 (recalcul complet) lira la même fonction**, donc une seule règle pour les trois
  consommateurs — ce que l'en-tête de `records.ts` promet depuis le Lot 3.
- `personalRecords` reste ce qu'elle est : **un cache**. Le jour où la lecture d'historique coûterait
  (une année de séances, six exercices, à chaque frappe), c'est elle qu'on remplit — avec **cette**
  fonction, pas une autre. La remplir aujourd'hui serait un cache sans lecteur, et un cache qui peut
  mentir.

**`recordsBeatenBy(candidate, others)`** (TDD, 15 tests) répond littéralement à « qu'est-ce que cette
série vient de battre » : elle rend les records battus, le plus significatif d'abord, **avec la série
qui les tenait**. Trois règles méritent leur ligne :

- **Un record demande un tenant du titre.** La première série d'un exercice jamais fait ne bat rien,
  elle *devient* la marque. Sinon la félicitation partirait sur la première série de travail de
  chaque nouvel exercice, sans pouvoir nommer ce qu'elle a battu. L'égalité ne compte pas non plus —
  c'est la règle de `pickBest` lue par l'autre bout : un record s'établit la première fois qu'on
  l'atteint.
- **Les reps ne comptent que là où il n'y a aucune charge à battre.** Au développé, le maximum de
  répétitions est une série légère, et l'appeler record est un mensonge. La fiche exercice appliquait
  déjà cette règle **à son affichage** (`showReps`) ; elle descend là où elle appartient.
- **La candidate se filtre elle-même** des `others`. Le site d'appel passe tout l'exercice — c'est ce
  qui rend l'appel impossible à rater.

**La comparaison inclut les séries déjà validées aujourd'hui.** `listRecordSets` est **l'exact
opposé de `getLastPerformance`** : celle-là existe pour tenir la séance en cours *dehors* (la colonne
« précédent » est une référence, pas un miroir), celle-ci pour l'y faire entrer (un record battu à la
série 2 est un record). Une requête par exercice sur `[exerciseId+performedAt]`, qui saute les séries
non validées au lieu de les lire pour les jeter.

> **Conséquence assumée : le bandeau suit le record, il ne fige pas l'instant.** Si la série 2 bat
> l'historique puis que la série 3 bat la série 2, le bandeau **descend** sur la 3. Deux « records »
> pour un même exercice seraient un écran qui se contredit ; et figer l'instant demanderait de
> stocker l'événement — exactement ce qu'on vient d'écarter.

#### La félicitation vit dans la card, pas dans un toast

Un bandeau en pied d'écran ne peut pas dire **laquelle** des vingt lignes a battu **quoi** — et le
temps de la chercher, il est parti. C'est le raisonnement d'`UndoRow` (Lot 5), appliqué à l'émotion
inverse : ici la **position est la moitié du message**.

- **Un bandeau sous la ligne** (`RecordNote`), sur la surface de la série validée, à 12 px — le
  retrait de `RestRail`, pour que les deux choses qui pendent sous une série s'accordent. Il ne
  répète pas les chiffres battus : la colonne « précédent » de cette ligne-là les montre déjà, deux
  centimètres au-dessus.
- **Pas dans la pastille de rang.** Ce créneau de 48 px appartient au **type** de série depuis la
  tâche 1, et un record peut parfaitement être une dégressive ou une série à l'échec — **vérifié en
  pilotant : la marque dégressive et le bandeau cohabitent** sans se disputer la place.
- **Une étoile sur la card repliée, et ce n'est pas un ornement.** Cocher la **dernière** série
  replie l'exercice, et la dernière est souvent la plus lourde : sans marque au repli, le seul record
  qu'on voulait voir serait celui qu'on ne voit jamais — apparu et refermé dans la même image.
  **Constaté en pilotant, c'est exactement ce qui s'est passé.** Le header dit *qu'il y en a un*,
  déplier dit *laquelle et lequel* : la même divulgation que le repli applique déjà aux chiffres.
- **L'accent est légitime ici comme nulle part ailleurs** : la charte le réserve aux séries validées
  **et aux records**, et c'est les deux à la fois.
- **Une étoile, pas un trophée.** Un trophée a été dessiné puis écarté : sa silhouette est une forme
  fermée arrondie sur un pied, c'est-à-dire **celle de la flamme** à bout de bras — et les marques de
  la tâche 1 tiennent sur des silhouettes maximalement distinctes. L'étoile est radiale et pointue :
  elle ne rentre en collision avec aucune des trois.
- **Les trois records sont nommés une seule fois** pour toute l'app (`record.*` + `recordLabel`), et
  la fiche exercice lit désormais les mêmes noms — ses trois clés `exercise.record{Heaviest,MostReps,
  BestVolume}` sont supprimées. Un même fait ne peut pas avoir deux noms.

#### Ce qui a été mesuré, en pilotant l'app en 375 px

Sur une vraie séance montée dans l'app (une séance terminée à 100 kg × 5 comme historique, puis une
séance à trois séries) — pas sur des données injectées.

- **L'égalité ne fête rien** : la série 1 à 100 × 5 face à un historique à 100 kg n'affiche aucun
  bandeau, et aucune étoile n'apparaît au repli.
- **Deux records distincts sur deux lignes distinctes** : « Record · Charge max » sous la série 2
  (102,5 × 5) et « Record · Meilleure série » sous la série 3 (60 × 12, soit 720 contre 512,5). Une
  seule ligne d'écran ne pourrait pas dire ça.
- **Les trois invalidations, en direct** : requalifier la série 2 en échauffement **efface son
  record** en gardant ses 102,5 × 5 affichés ; décocher la série 3 efface le sien ; recocher le
  rend. Aucun code d'invalidation n'existe.
- **Survie au rechargement complet** : les deux bandeaux sont là après un F5, et l'exercice replié
  garde son étoile — mesuré à 5 instants sur 2 s, deux rechargements de suite, pour écarter une
  bascule tardive.
- **Contraste, deux thèmes** : **12,87:1** en sombre et **5,23:1** en clair (accent-ink sur
  `--surface-2`, la paire déjà mesurée pour le statut de repos).
- **Géométrie** : bandeau 343,2 × **24 px** à x = 16, étoile 14 px ; les lignes de série restent à
  **60 px** et les coches à **48 × 48** — le bandeau s'ajoute *sous* la ligne sans la toucher. Aucun
  bouton sous 44 px, **aucun débordement horizontal**, **aucune erreur console**.
- **Le bandeau balaye avec sa ligne** : il est le second enfant du bloc qui porte le `translateX`
  (vérifié dans le DOM), donc supprimer une série de record ne laisse pas sa félicitation derrière.

#### ✅ Checkpoint en salle — RF-23, validé en usage réel le 2026-07-24

- [x] **Un record se voit sans le chercher, entre deux séries.** C'est tout le pari : si le bandeau
      passe inaperçu à bout de bras, c'est le repère qui est trop discret — pas la détection.
- [x] **L'étoile sur l'exo replié se comprend.** C'est le seul endroit où la forme est seule, sans le
      mot à côté. Si elle se lit « favori » plutôt que « record », le repli est le bon endroit mais
      pas la bonne marque.
- [x] **« Record · Meilleure série » veut dire quelque chose en salle.** « Charge max » est évident ;
      le volume d'une série l'est moins. Si ça ne parle pas, ce record ne mérite peut-être pas un
      bandeau — le montrer serait alors du bruit sur l'écran le plus chargé de l'app.
- [x] **Le bandeau qui descend d'une ligne** quand une série suivante fait mieux : est-ce que ça se
      lit comme « le record a bougé », ou comme « j'ai perdu mon record » ? C'est le point où la
      dérivation se voit à l'œil nu.
- [x] **Rien ne fête une première fois.** Un exercice jamais fait ne dit rien à sa première série de
      travail. Si ça donne l'impression que la détection ne marche pas, c'est la règle « il faut un
      tenant du titre » qu'il faut revoir — pas le code.

### Types de séries modifiables en séance (RF-20) — 2026-07-24

**Le chemin était déjà dessiné.** Le bouton de rang de `WorkoutSetRow` portait depuis le Lot 5 le
commentaire « Lot 6 hangs the set type here, which is why it is a button already », et `fr.ts`
écrivait les quatre `setType.*` **avec leurs quatre `setTypeHint.*`** depuis le Lot 4 — quatre
phrases que rien ne lisait. Le menu de série gagne « Type de série », avec le type courant en
sous-titre (sinon il faut ouvrir la feuille pour savoir ce qu'on est en train de changer), puis un
`OptionSheet` — le composant existait, les phrases aussi. Rien d'inventé.

`updateSetType` ne touche **jamais** aux chiffres : requalifier une série change ce qu'elle *est*,
pas ce qu'elle dit. Une série repassée en échauffement garde ses 60 × 12 et reste en base ; c'est
`isWorkingSet` qui l'écarte du volume et des records, une seule règle pour les deux.

**Les marques sont des pictogrammes, pas des mots — décision de l'utilisateur.** J'avais proposé
trois abréviations ; il a répondu « et si on remplaçait ça par des SVG plutôt qu'une écriture ». Il a
raison, et pour une raison qui rend le reste évident : **« ÉCH. » et « ÉCHEC » ne se séparent pas à
bout de bras, une main, essoufflé** — et c'est la seule distance à laquelle cet écran se lit. Une
forme se reconnaît sans se déchiffrer. Trois silhouettes volontairement éloignées :

| Type | Marque | Pourquoi cette forme |
|---|---|---|
| Échauffement | flamme (courbe fermée) | chauffer, littéralement |
| Dégressive | trois barres qui descendent et raccourcissent (horizontales) | c'est le geste : on retire des plaques et on repart |
| Jusqu'à l'échec | éclair (zigzag diagonal) | tout ce qui restait y est passé |

- **Une seule couleur, et ce n'est pas un compromis.** La charte n'a qu'un accent, et le rouge veut
  déjà dire « destructif » partout dans l'app — un troisième ton aurait demandé un jeton neuf
  (`--warn-ink` n'existe pas, `--color-warn` est un aplat à ~2:1 sur blanc). C'est donc la **forme**
  qui porte le sens et l'accent qui appuie : exactement la règle du Lot 4, où un accent seul ne peut
  rien porter (plein soleil, daltonisme). **Si les trois formes ne se séparent pas en salle, la
  couleur est le repli** — et elle passera par un vrai jeton, pas par un hex en dur.
- **La marque n'est pas une légende.** Le type se choisit dans une feuille qui l'écrit en toutes
  lettres avec sa phrase ; le pictogramme ne fait que rappeler ce qu'on a choisi. Il n'a donc pas à
  être devinable de zéro, seulement reconnaissable.
- **Le numéro reste sur une série normale.** C'est lui qui dit où on en est dans l'exercice. La
  marque le **remplace** au lieu de se serrer à côté : 48 px ne tiennent pas deux glyphes qui doivent
  tous les deux se lire sans regarder.
- `RoutineExerciseCard` (Lot 4) **n'a pas bougé** : sa marque « ÉCH. » se pose *à côté* du numéro, pas
  à sa place, et l'éditeur de routine ne planifie que normale/échauffement. Ce n'est pas le même slot,
  donc ce n'est pas la même décision.

#### La règle de repos qui manquait, trouvée en lisant

`setTypeHint.dropset` promet depuis le Lot 4 « enchaînée à la précédente, charge allégée, **sans
repos** », pendant que `rest.test.ts` assérait qu'une dégressive **déclenche** un repos. Les deux ne
peuvent pas être vrais — et **c'est le test qui a raison sur le fond** : une dégressive *termine* la
chaîne, donc elle est due sa récup comme n'importe quelle série de travail.

Ce qui manquait est **en amont** : la série *avant* une dégressive ne doit pas reposer, puisqu'on
allège la barre et on repart. `isRestTriggering` prend donc un `nextSetType`, et une suite de
dégressives (100 → 80 → 60) s'enchaîne sans repos jusqu'à la dernière. Le calcul du « suivant » se
fait dans la grille de l'exercice, pas dans le bloc de superset : ce sont deux questions différentes,
et les deux exclusions se cumulent.

**Une contradiction entre une chaîne d'UI et un test est un défaut**, pas un détail de rédaction : la
phrase promettait un comportement que le code ne rendait pas.

#### Ce qui a été mesuré, en pilotant l'app en 375 px

- Les trois marques rendent : **20 px de glyphe dans une cible de 48 × 48**, jamais réduite.
- `aria-label` = « Série 2 — Dégressive » : le type est **dit**, le dessin reste `aria-hidden` comme
  toutes les icônes de l'app. Une série normale garde « Série 2 » tout court.
- **Contraste, deux thèmes, aucun échec** : 12,87:1 (ligne validée) et 14,24:1 (ligne intacte) en
  sombre ; **5,23:1 et 6,04:1 en clair**. Le plancher WCAG 1.4.11 des éléments non textuels est 3:1.
- **La règle de la dégressive vérifiée en direct** : cocher la série 1 quand la 2 est dégressive ne
  démarre **rien** (aucun `progressbar`, aucun « Repos » à l'écran) ; cocher la dégressive démarre
  « Repos 1:55 » avec `aria-valuetext` « Repos, 2:00 restantes ».
- Aucun débordement horizontal, aucune erreur console.
- `workout.warmupShort` est **supprimé** de `fr.ts` : son dernier consommateur vient de partir.

#### ✅ Checkpoint en salle — RF-20, validé en usage réel le 2026-07-24

- [x] **Les trois pictogrammes se distinguent d'un coup d'œil, bras tendu, sans les chercher.** C'est
      le point fragile de la tâche : une forme ne se déchiffre pas, elle se reconnaît — ou pas. Si
      deux d'entre eux se confondent, **le repli est la couleur** (un jeton propre, pas un hex), pas
      un retour aux mots.
- [x] **La flamme se lit bien comme « échauffement »** et pas comme « série chaude / lourde ». C'est
      le seul des trois dont la métaphore peut basculer.
- [x] Marquer une série en dégressive **en pleine séance**, la barre en main : le chemin
      rang → « Type de série » → choix se fait-il d'une main, entre deux séries ?
- [x] **La série qui précède une dégressive ne déclenche aucun repos** — et ça ne surprend pas. Le
      pari est que c'est ce que tu attends (on allège et on repart) ; si ça donne l'impression d'un
      minuteur qui a raté son départ, c'est la règle qu'il faut revoir, pas le code.
- [x] Une série repassée en échauffement **après** avoir été validée : ses kilos restent affichés,
      et elle disparaît du volume et des records. Vérifiable sur l'écran de fin.

> **Un défaut hors périmètre, trouvé en lisant la base — deux séries au même rang.** Le dump
> IndexedDB de la séance de test montrait **deux séries vivantes à `order: 1`**. `addSet` calcule le
> rang avec `(await liveSetsOf(...)).length` **puis** écrit, sans transaction — alors que `deleteSet`
> et `restoreSet`, juste en dessous dans le même fichier, sont déjà enveloppés dans
> `db.transaction('rw', …)`. Deux ajouts qui se chevauchent lisent donc la même longueur. Reproduit
> par deux clics dans le même tick JS ; sur téléphone, un double appui ou une frame en retard suffit.
> **C'est la famille du « piège n°2 » du Lot 2** (le `.count()` qui comptait les supprimées) — même
> symptôme, autre cause. Sorti du chemin en tâche à part pour ne pas gonfler le commit du Lot 6 ;
> `addWorkoutExercise` est à vérifier au même titre.

#### ✅ Corrigé — le rang d'une série se lit et s'écrit sous transaction — 2026-07-24

La lecture du rang et l'écriture de la ligne sont désormais **une seule** `db.transaction('rw',
db.workoutExercises, db.workoutSets, …)`. IndexedDB sérialise deux transactions `readwrite` de
portées qui se recouvrent, donc la seconde ne lit plus qu'après le commit de la première.

- **`addSet` et `duplicateLastSet` passent par un seul chemin d'écriture**, `appendSet`, qui lit les
  voisines vivantes **une fois** et en tire les deux réponses : le rang, et la série à reproposer.
  C'étaient deux lectures pour une seule décision — `duplicateLastSet` lisait la dernière série
  *avant* d'appeler `addSet`, qui relisait la même liste pour compter.
- **`addWorkoutExercise` avait bien le même trou**, et il était réel : la transaction existait déjà
  mais la lecture du compte était restée *dehors*, juste au-dessus. Le test l'a confirmé avant le
  correctif (deux exercices ajoutés en même temps, tous deux à `order: 0`). La lecture est rentrée
  dans la transaction ; celle de la fiche exercice (repos par défaut) reste dehors, ce n'est pas
  l'objet de la course et la valeur est un instantané de toute façon.
- **Trois tests** (`workouts.test.ts`, « rangs concurrents — deux appuis dans le même tick ») lancent
  deux appels en `Promise.all` et assèrent des rangs distincts. **Les trois échouent sans le
  correctif** — vérifié : `[0, 0]`, `[0, 1, 1]`, `[0, 0]`.

**Une transaction n'est pas un ornement de la ligne qui écrit** : ici les deux appels de `deleteSet`
et `restoreSet` étaient enveloppés, celui d'`addSet` non, et rien ne le signalait — c'est la
*lecture* qui décide, pas l'écriture. Toute lecture qui sert à calculer ce qu'on va écrire appartient
à la transaction de cette écriture.

État vérifié : `typecheck`, `lint`, `test:run` (**259**, +3), `build` — les quatre passent.

### Calculateur de plaques (RF-28) — 2026-07-24

**Le moteur** (`src/lib/plates.ts`, pur, TDD, 10 tests) décompose une charge en plaques **par côté** :
greedy du plus lourd au plus léger, ce qui est aussi le compte de plaques minimal qu'un pratiquant
saisit. Tout tourne en **centièmes entiers** (0,25 kg → 25) pour qu'aucune soustraction ne croise un
fantôme de flottant. Ce qu'il ne peut pas composer exactement est rendu comme `remainderKg` (« il
manque 1 kg »), jamais arrondi en douce. Pas barbell-only (recommandation audit M5) : `sides: 1` =
machine à plaques à un seul peg, `barWeight` bas + `sides: 2` = haltère chargeable, et un rack fini
(`countPerSide`) modélise la paire unique de 25 que rationne toute salle.

- **Un test corrigé, pas son assertion.** Le premier test supposait un jeu s'arrêtant à 1,25 kg —
  faux, le jeu par défaut descend à 0,25, donc 40,5/côté = 25+15+0,5 **est** atteignable et le moteur
  a raison de renvoyer 101. J'ai changé le **rack du test** (rack grossier), pas le résultat. C'est la
  règle CLAUDE.md : un test qui échoue ne se « corrige » pas sur l'assertion sans comprendre pourquoi.

**La face** (`PlateLoadSheet.tsx`) : une barre **vue de face**, plaques dessinées comme des dalles
dont la **hauteur porte le poids** (√ du poids, comme le diamètre du vrai disque), plus la lecture
exacte « De chaque côté · 25 · 15 · 1,25 kg ». Accrochée au menu ⋯ d'une série, `platesConfigFor`
(`plateConfig.ts`) ne l'offre que sur une **vraie charge de barre** : `weightRole === 'load'` **et**
équipement ∈ {barbell, Smith, plaque}. Une machine à broche ou un haltère fixe n'a rien à charger —
lui montrer un schéma serait un mensonge assuré. Cas limites honnêtes : reliquat, et charge sous la
barre (« plus léger que la barre seule »).

- **Le schéma est monochrome, en encre — un choix, pas un défaut.** La charte n'a **qu'un accent**,
  réservé aux records et aux séries validées ; six couleurs de plaques réelles (IPF) casseraient à la
  fois cette règle et le plancher de contraste. La hauteur + l'étiquette portent la distinction. C'est
  « réutiliser le vocabulaire avant d'inventer » appliqué. Alternative colorée gardée en réserve si une
  séance la réclame. **À trancher au checkpoint visuel.**
- **`platesConfigFor` extrait dans son propre fichier** (`plateConfig.ts`) : cohabiter avec un
  composant cassait le fast-refresh (react-refresh), et ça garde `lib/plates` sans le vocabulaire
  `Equipment` de l'app.

État vérifié le 2026-07-24 : `typecheck`, `lint` (0 warning), `test:run` (**252**, +10), `build` —
les quatre passent. Le cas du checkpoint (102,5 kg → 25+15+1,25 par côté) **est** un test qui passe.

#### Trois retours d'usage — plaques + repos — 2026-07-24

Pilotés depuis le téléphone sur ton serveur de dev (la pane navigateur de la session Claude ne
s'affichait pas — aucune capture possible ici, mais le HMR montrait tout à chaud).

**1. Le picker de repos débordait — `3:00` passait à la ligne.** Les 5 chips (`1:00 … 3:00`) étaient
en `flex flex-wrap` : à 375 px la dernière tombait seule sur une 2ᵉ ligne. Passées en
**`grid grid-cols-5`** → une seule ligne, largeurs égales, garanti quelle que soit la police système.
Le chip « hériter » garde sa ligne à lui (c'est un mode, pas une 6ᵉ durée).

**2. Le filet de repos vivait sous « Ajouter une série » — ça n'avait pas de sens déplié.** `RestRail`
était en `absolute … bottom-1`, ancré au conteneur de la carte, donc collé tout en bas. Remonté **sur
le séparateur header/corps** : le header passe `relative`, le filet en `bottom-0` dedans. Bonus gratuit
— cocher la dernière série **replie** l'exo, et le bas du header devient alors le bas de la carte, donc
le filet **reste visible replié** (le cas courant) sans layout shift.

**3. Les plaques étaient introuvables, et figées sur une seule charge.** Deux défauts en un :
- *Découvrabilité* : l'accès était planqué derrière l'appui sur le **numéro** de série, qui ne se lit
  pas comme un bouton. Déplacé sur une **icône plaque** (`PlateIcon`, déjà dans l'app — réutilisée, pas
  inventée) posée dans le header de la carte, à droite du bloc titre/sous-titre, avant le ⋯. Rendue
  seulement pour un exercice de barre. Retirée du menu ⋯ (une seule porte). Passage intermédiaire par
  le menu ⋯ de l'exercice, abandonné au profit de l'icône sur retour utilisateur.
- *Correction* : le calcul prenait **une seule charge** (la dernière série de travail) pour tout
  l'exercice — « on fait une série à 100 puis une à 55, et ça prend 55 pour tous ». `PlateLoadSheet`
  prend désormais la **liste des charges distinctes** (`exerciseLoads` dédoublonne dans l'ordre,
  échauffements compris — on charge la barre pour eux aussi) et dessine **un schéma par charge**. La
  barre nue est rappelée une seule fois en bas.

`typecheck`, `lint`, `test:run` (**252**, inchangé — corrections de composants + moteur déjà couvert),
`build` : les quatre passent après les trois correctifs. ⬜ Checkpoint visuel toujours à valider en
salle (icône plaque → un schéma par charge ; filet sur le séparateur ; picker sur une ligne).

Plan détaillé : `docs/plans/lot-06-minuteur.md`. Cinq formes dessinées, quatre écartées par
l'utilisateur — le détail et les raisons sont dans le plan, section « La forme retenue ».

### La forme, en une phrase

**Le minuteur est une barre de 3 px dans une voie, sous la série qu'on vient de cocher**, plus
`REPOS 1:30` sur la ligne de relevés. Aucune commande, aucun appui, aucune cible tactile ajoutée.

### État vérifié le 2026-07-22

- ✅ `npm run typecheck`, `npm run lint`, `npm run test:run` (**238 tests**), `npm run build`.
- ✅ **Vérifié dans la vraie app, sur une vraie séance** : cocher une série démarre le repos, la
  barre avance, atteint 100 %, et **le repos se referme seul après la grâce**.
- ✅ Contrastes mesurés aux deux thèmes : barre/ligne **12,87:1 sombre, 5,23:1 clair** ; barre/voie
  11,06 et 4,49 ; relevé « Repos » 15,31 et 6,63. Aucune cible sous 48 × 44, aucun débordement.
- ✅ Géométrie mesurée : ligne 60 px, voie 3 px, **3 px d'air au-dessus, 4 px en dessous**, 12 px de
  retrait de chaque côté.
- ✅ **Checkpoint en salle : validé.** Les **trois paris** tiennent sur une vraie séance — cf. la
  fin du plan.

### Ce qui a été abandonné, et pourquoi

- **`±15 s` n'existe pas.** Décision de l'utilisateur sur son usage réel : il ne s'en sert jamais
  sur Hevy. Le repos par défaut est réglable par exercice depuis le Lot 3 — ajuster à chaque série
  rustinait un défaut mal réglé au lieu de le corriger une fois. Une fonctionnalité retirée ne peut
  pas mal se comporter. La variante avec pas-à-pas est dessinée **et mesurée** dans le plan, à
  reprendre telle quelle si une séance la réclame.
- **« Visible en haut de l'écran »** (roadmap) est devenu « sur la ligne de la série ». Trois
  tentatives en haut de l'écran ont été rejetées au doigt : « un peu fat, ça prend beaucoup de
  place », puis « ça fait posé, pas intégré à l'app » — le mot exact du Lot 5 sur les barres
  collantes.

### Les trois défauts trouvés en pilotant, pas en relisant

**1. La grâce ne se déclenchait jamais.** L'effet qui l'arme dépendait de `now`, qui change chaque
seconde : chaque battement annulait le `setTimeout` et en repartait un neuf. La barre serait restée
affichée toute la séance. **C'est exactement le piège que `UndoRow` documente depuis le Lot 5**, et
j'y suis retombé en l'ayant sous les yeux. Les deux minuteries — le son et la grâce — sont
maintenant armées **une fois, depuis l'instant de fin**, et ne dépendent plus du battement. Calculer
le délai depuis l'instant plutôt que passer une durée fixe rend aussi un montage tardif correct au
lieu de relancer le repos.

**2. `restSeconds` est `undefined` sur les séances déjà en base.** Le champ n'est pas indexé, donc
il n'y a pas eu de migration à écrire — et rien n'a rempli les lignes existantes. `Math.max` sur un
`undefined` rend `NaN`, `endsAt` devient `NaN`, et le repos se termine à l'instant où il démarre. La
lecture passe désormais par `resolveRestSeconds`, qui retombe sur 120 s. **Aucun test ne pouvait le
voir** : il fallait une base antérieure au champ.

**3. La barre passait sous le bouton de validation.** 48 px de contrôles centrés dans 56 px ne
laissent que 4 px de marge, et une barre de 3 px dedans traversait la coche — c'est ce qui faisait
« pas fini » à l'écran. La ligne passe à **60 px** avec une réserve permanente en bas, réservée sur
**toutes** les lignes : une ligne qui grandirait au démarrage d'un repos décalerait la liste soixante
fois par séance.

### Trois défauts de plus, trouvés en s'en servant — 2026-07-23

Le minuteur livré la veille était vérifié en pilotant l'écran de dev. Trois réglages plus tard,
l'utilisateur en a remonté trois défauts qu'aucune vérification au clavier ne pouvait voir : il
fallait *régler* un repos et *cocher* une série pour de vrai.

**1. Un repos réglé « 2:30 » durait deux secondes.** Le champ demandait des **secondes**, alors que
toute l'app écrit ses durées en `m:ss` (« Repos 2:00 », « 1:30 min · 20 kg »). L'utilisateur a tapé
« 2,3 » en pensant deux minutes et demie ; le champ, qui accepte le décimal pour la charge
(« 102,5 »), a stocké **2,3 secondes**. Au démarrage de la séance, `resolveRestSeconds` arrondit —
`Math.round(2.3)` = 2 — et comme 2 > 0 la valeur passe pour un override valide qui bat même le
défaut de l'exercice. Un champ dont l'unité diffère de la façon dont l'app *montre* la même grandeur
partout ailleurs : c'est le piège qui se referme.

Correctif : `ui/RestPicker`, qui parle la langue du reste de l'app — une lecture d'horloge `m:ss`,
des raccourcis tapotables (1:00 · 1:30 · 2:00 · 2:30 · 3:00) et des `±15 s`. **Aucun champ texte :
retaper « 2,3 » est devenu impossible.** Aux deux points de réglage (fiche exercice, feuille de
routine) ; `NumberInput` reste tel quel, la virgule y étant indispensable pour la charge. Une donnée
déjà corrompue ne se devine pas, mais le picker la **rend visible** : un `2.3` stocké s'affiche
« 0:02 », aucun raccourci allumé, et un seul appui le répare.

*(Ces `±15 s` règlent la durée par défaut ; ils ne contredisent pas le « ±15 s n'existe pas » plus
haut, qui parlait d'ajuster le compte à rebours **en pleine séance** — ça n'existe toujours pas.)*

**2. La barre avançait par à-coups d'une seconde.** Elle était pilotée par un `setState` à chaque
seconde, donc elle sautait d'un cran par battement ; l'utilisateur attendait « une ligne bien
fluide ». Remplacée par **une seule transition CSS linéaire**, armée une fois de la position courante
jusqu'au plein, sur la durée restante : le compositeur remplit chaque image. Une transition CSS est
calée sur l'horloge murale, donc elle reste juste après un passage en arrière-plan — là où l'ancien
battement était étranglé à ~1 cran/minute. Repli **pas-à-pas** sous `prefers-reduced-motion`.

**3. Décocher une série ne coupait pas son repos.** Le code défendait *exactement* ce comportement :
« corriger une faute de frappe ne doit pas coûter ta récup ». La prémisse était fausse : les chiffres
d'une série **restent modifiables une fois cochée** (`SetValueCell` n'a aucun état désactivé), donc
on ne décoche jamais pour corriger un chiffre — décocher veut dire « pas faite », et le repos s'arrête
avec elle. `stop(setId)` ne touche que le repos de cette série, jamais celui qu'une autre fait
tourner. **Un raisonnement écrit dans le code n'est pas une preuve sur l'usage** : il faut aller
vérifier si sa prémisse tient à l'écran.

Vérifié en pilotant la vraie app : le picker stocke des entiers propres (150, 165, jamais 2.3) ;
cocher arme une `CSSTransition` `width` linéaire sur la durée restante ; décocher démonte la barre ;
recocher repart. `typecheck`, `test:run` (**238, inchangé** — trois correctifs de composant, couverts
par l'E2E), `build` : les trois passent. Le rendu fluide se juge sur un écran allumé — **checkpoint
en salle.**

### Le même piège, une cellule plus loin — la durée d'une série — 2026-07-23

Le picker a réglé le **repos**, mais la même virgule attendait deux cellules plus loin, sur la durée
*saisie*. Dans la grille de séance, une série chronométrée s'entre dans `SetValueCell` — le même champ
que la charge, qui *doit* accepter le décimal (« 102,5 » pour une demi-plaque). Conséquence exacte du
défaut du minuteur : sur un gainage, « 1:30 » tapé « 1,3 » y stockait **1,3 seconde**. Et la « Durée
visée » d'une routine (`RoutineSetSheet`, un `NumberInput`) portait le même trou, **jamais corrigé**
par la tranche minuteur — celle-ci n'avait touché que le *repos*, pas la durée prescrite.

Pas de picker cette fois. Une cellule de 3,5 rem n'a pas la place des `±48 px` (c'est écrit dans
`SetValueCell`), et surtout un clavier numérique n'a pas de touche `:` — un `m:ss` tapé n'y est pas
atteignable. Le champ reste, on lui retire le séparateur : `ui/numberField` gagne `INTEGER` à côté de
`NUMERIC`, et la colonne durée — grille **et** routine — refuse la virgule et passe le clavier en
`numeric`. La charge et les reps gardent leur décimal. C'est la préférence déjà consignée en mémoire :
*contraindre la saisie plutôt que la remplacer par des chips*.

Une durée reste **en secondes entières**, comme le Lot 5 l'avait décidé (« une durée se saisit en
secondes, pas en m:ss ») ; la grille lit déjà « 90 » partout (précédent, fantôme), donc rien ne change
à l'affichage — seul le décimal disparaît. Aucune chaîne d'UI ajoutée.

Vérifié en pilotant la vraie app sur « Gainage planche » (`time_only`) : « 1,3 » tapé dans la cellule
devient « 13 », `inputMode="numeric"`, aucune virgule ne s'inscrit. `typecheck`, `test:run` (**242**,
+4 : la cellule et le champ entier), `build` : les trois passent.

> **Note de comptage.** Les entrées de la tranche minuteur annonçaient « 458 tests », un chiffre qui
> ne correspond pas au dépôt : `test:run` en compte **242** ici (238 avant ce correctif). Le vrai fil
> est 217 (Lot 5) → 238 → 242. Les deux « 458 » ci-dessus ont été ramenés à 238.

### Retour post-séance, et la refonte de l'écran de séance décidée — 2026-07-24

Premier vrai usage en salle du Lot 5 + minuteur. **Survie au kill et mode avion : OK.** Sept retours
remontés, tous triés **avant** de toucher au code (le code lu et l'app pilotée en 375×812).

**Deux « bugs », deux verdicts opposés :**

- **Historique vide après la séance — ce n'est pas un bug.** `HistoryScreen` est une souche : l'écran
  d'historique est le **Lot 7**, pas encore fait. La donnée, elle, est bien écrite par
  `finishWorkout` — c'est *pourquoi* une routine déjà faite se pré-remplit ensuite
  (`getLastPerformance`). Rien de perdu, juste pas encore d'écran pour la relire.
- **Aucun bouton pour ajouter un exo en séance vide — vrai bug, corrigé (tâche 1, commit `614e523`).**
  Pas un commit oublié : le sélecteur `/workout/add` et l'`AddRow` existaient. Le bouton était
  seulement **enfermé dans la branche `exercises.length > 0`** de `WorkoutScreen`, alors que
  l'éditeur de routine le rend toujours au pied de la liste. Sorti de la condition, même carte, même
  geste dans les deux états. Le cas se produit via « Démarrer une séance vide » (accueil). Vérifié en
  pilotant : bouton présent (48×343), mène à `/workout/add`.

**Cinq réglages, mesurés dans l'app, en attente :**

- **#7 — 1ère carte collée au header.** Gap meter→carte = **0 px** contre **12 px** entre cartes
  (`Screen`, conteneur de scroll `padding-top: 0`). À reprendre **après** la refonte, qui rebat cette
  mise en page.
- **#6 — nombre mal centré dans le well du `RestPicker`** (feuille « Dans cette routine »). Le nombre
  tombe **10 px trop haut** : le well est en `items-baseline` au lieu de `items-center`.
- **#4 — phrase de repos trop longue.** `routine.restFromExercise` fait **2 lignes à 375 px** (3 avec
  une police système plus grande). À raccourcir.
- **#5 — chrono en header : absorbé par la refonte** (chrono global épinglé au header).
- **Export JSON en fin de séance** (a. séance seule / b. historique complet) : **n'existe pas**, c'est
  le **Lot 8** (Réglages & export/import). Aligné local-first. À cadrer plus tard.

**La refonte de l'écran de séance — décidée avec l'utilisateur, à construire.**

Principe : **chaque timer va où vit son sens**, et les exos finis quittent le board.

- **Repli des exos terminés** en header gris/vert, dépliables au clic (accordéon). C'est le *repli*
  qui porte « où j'en suis » — pas une horloge qui voyage. Règle de repli : replier quand toutes les
  séries *actuelles* sont cochées ; re-déplier si on décoche ou ajoute une série ; toggle manuel au
  clic. L'édition d'une série cochée reste possible (rouvrir l'exo — décision Lot 5 conservée).
- **Chrono global épinglé au header** (fait de *séance*, jamais scrollé). Pas dans une card : une card
  scrolle, et y parquer l'horloge lui donnerait deux contrats (temps + « tu es ici ») — le piège du
  « slot à deux contrats » déjà consigné.
- **Repos dans le statut de la card active.** Le statut « ● en cours » devient « ● Repos 0:47 » le
  temps du repos (le point `●` reste, seul le texte bascule), en `--accent-ink`. **Le filet reste
  inchangé** (la barre fluide du Lot 6). Le repos n'est pas un 3ᵉ élément : c'est le statut du moment.
  Idée de l'utilisateur, retenue telle quelle. C'est un **retour** au placement pré-Lot-6-final (le
  repos vivait sur la série), réhabilité par le repli : la card active reste près du haut.
- **Écarté : le chrono qui « voyage » de card en card.** Il suppose une progression linéaire que
  l'app refuse (désordre, superset, insertion mid-séance) et il double le sens que le repli porte déjà.
- **À juger en salle** : si un repos déborde pendant qu'on prépare l'exo suivant, le décompte est sur
  le header de l'exo *précédent* ; avec le repli il n'est qu'à un header de distance — probablement un
  faux problème, mais à sentir au doigt.

**File des tâches (ordre d'importance), une par une, arrêt entre chaque :**

1. ✅ Bouton d'ajout en séance vide (`614e523`).
2. ✅ **Repli des exos terminés** (`2e69376`) — dans `WorkoutExerciseCard` seul, pas `WorkoutScreen`.
   Le header devient le bouton de repli ; repli/dépli piloté par la complétion (état ajusté pendant
   le rendu, motif `NumberInput`), toggle manuel, re-dépli sur décochage/ajout. Vérifié en pilotant,
   deux thèmes. **Repli instantané, pas d'animation de hauteur** : le chevron tourne (`rotate` v4),
   le corps apparaît d'un coup. Choix de v1 — à juger en salle : si le « pop » gêne, l'animation
   `1fr → 0fr` (celle d'`UndoRow`) est le repli tout prêt. **Point de checkpoint.**
3. ✅ **Chrono au header + repos dans le statut** (`b41b221`) — bandeau `WorkoutMeter` dissous et
   supprimé, fix #5 absorbé. Le chrono global monte au header (titre | chrono | menu) ; le repos
   descend dans le statut de la card (le sous-titre devient « ● Repos 0:47 », `RestStatus`) et le
   filet (`RestRail`) se pose au bas de la card, visible même repliée — c'est le cas courant, cocher
   la dernière série referme l'exo pendant que le repos coule. L'avancement « N séries sur M » passe
   au-dessus de la liste. Écarté comme décidé : chrono qui voyage, statut « en cours » permanent.
   Vérifié en pilotant, deux thèmes (repos sombre 12,87 / clair 5,23). **La refonte de l'écran de
   séance est complète (briques 2+3) — reste à la juger en salle, d'un bloc.**
4. ✅ **#7 espacement 1ère carte — re-mesuré, rien à corriger.** Le bandeau `WorkoutMeter` dissous
   en tâche 3, l'écran de séance retombe sur la frame `Screen` partagée : header→contenu = **24 px**
   (les 16 px de `pb-4` du header + l'interligne), **identique à l'écran Exercices** (24 px aussi),
   mesuré dans l'app. Le « collé à 0 px » était le *bandeau* qui butait contre la 1ère carte, pas la
   frame ; il n'existe plus. Aucun changement de code — le correctif était la suppression du bandeau.
5. ✅ **#6 centrage du well `RestPicker`** — `items-baseline` → `items-center` sur le well, la paire
   nombre+unité passant dans un span interne qui garde son `items-baseline` à elle. Les chiffres
   montaient ~10 px trop haut parce que l'alignement baseline calait tout le groupe sur la ligne de
   base au lieu de le centrer. Mesuré dans l'app : « 1:30 » à **10 px du haut / 10 px du bas** du well
   (centré au pixel), le « min » toujours calé sur la ligne de base des chiffres.
6. ✅ **#4 phrase de repos raccourcie** — `routine.restFromExercise` passe de « Repos de l'exercice :
   {seconds} s. Renseigne pour le remplacer ici. » (**2 lignes**) à « Vide : le repos de l'exercice
   s'applique. » (**1 ligne**, mesurée à 335 px). Le nombre est retiré de la phrase : il vit déjà dans
   le well juste au-dessus (`emptyReading`, en `m:ss`), donc le répéter en « s » était à la fois
   redondant *et* incohérent avec le well. Param `{seconds}` retiré du call site en conséquence.

> **Un même utilitaire ne peut pas poser `padding-bottom` deux fois — le sheet mangeait ses boutons.**
> Retour de l'utilisateur en pilotant : dans un `ConfirmSheet` (« Abandonner cette séance ? »), les
> boutons étaient collés au bas de l'écran. Cause : le corps du `Sheet` était `safe-bottom px-5 pb-5`,
> et `safe-bottom` **comme** `pb-5` posent tous deux `padding-bottom` — deux utilitaires du même calque
> qui s'écrasent, l'inset (0 px sur un écran sans encoche) l'emportant. Le gap voulu de 20 px était
> annulé, et sur téléphone il ne restait que la barre de gestes. Nouvel utilitaire dédié `sheet-bottom`
> = `calc(env(safe-area-inset-bottom, 0px) + 1.75rem)` : **une** déclaration, additive (gap réel **plus**
> barre de gestes). `safe-bottom` reste tel quel pour `BottomNav`, où il est seul et correct. Mesuré :
> **28 px** sous les boutons du `ConfirmSheet` (était 0). C'est le pendant `padding-bottom` de la note
> Lot 1 sur le calque des utilitaires — deux propriétés identiques ne s'additionnent jamais, la
> dernière gagne.

> **Piège d'outillage trouvé au passage — vitest exécutait les worktrees d'agent.** `test:run` n'avait
> aucun `exclude`, donc il ramassait les tests des trois copies du dépôt sous `.claude/worktrees/` :
> **943 tests** au lieu de 242, run 4× plus long, et un test cassé dans un vieux worktree aurait fait
> échouer la CI sans rapport avec le code. **C'est le pendant exact de la note « ESLint ignore
> `.claude` »**, jamais transposé à vitest. Corrigé (`b7dda06`) : `exclude` reprend
> `configDefaults.exclude` + `**/.claude/**`, et `defineConfig` vient de `vitest/config` (au lieu de
> la triple-slash). **Le vrai compte est 242** ; toute entrée plus ancienne qui cite un autre chiffre
> comptait peut-être les worktrees.

### Ce que le Lot 6 ajoute à la charte

- **Le balayage de contraste doit s'étendre aux éléments non textuels.** Il parcourt les nœuds de
  texte depuis le Lot 3 ; un filet de 3 px n'en est pas un. C'est ce qui a laissé passer le rail de
  superset du Lot 4, mesuré ici à **1,29:1 en thème clair** — quasi invisible. Corrigé à part.
- **`--color-accent` ne peut pas servir de filet.** Sur `--surface-2` en thème clair il mesure
  **1,02:1** : le vert acide et le gris clair ont la même luminance. Un trait doit être lisible
  *contre* une surface, donc c'est de l'encre — `--accent-ink`.
- **ESLint ignore `.claude`.** Un worktree d'agent y pose un second projet TypeScript complet, et
  ESLint cesse alors de parser **tout** le dépôt : 193 erreurs de parsing, aucune réelle.

### Ce que cette tranche ne fait pas

À la livraison de cette tranche, le reste du Lot 6 — plaques, échauffement, RPE, record en direct
et types de séries — était intact. C'était une tranche, décidée comme telle.

> **Périmé depuis.** Les plaques ont été livrées en tranche 2, puis les types de séries et le record
> en direct en tranche 3, tâches 1 et 2. Restent : RPE, échauffement et poids de barre — cf.
> « Lot en cours ».

---

## Lot 5 — Séance en direct (cœur)

### État vérifié le 2026-07-22

- ✅ `npm run typecheck`, `npm run lint`, `npm run test:run` (**217 tests**, +69), `npm run build`.
- ✅ **Les quatre pièges du Lot 2 vérifiés en base**, chacun avec son test (cf. ci-dessous).
- ✅ **Reprise après un rechargement complet** : chronomètre juste, série cochée intacte, et le
  `107,5` **tapé mais pas coché** toujours là.
- ✅ **Chemin à un appui mesuré** : un `click` sur la coche d'une ligne intacte a écrit
  `weight: 100, reps: 5` en base, la ligne est passée en `--surface-2`, la coche en accent.
- ✅ **Focus vérifié comme au Lot 4** : `102,5` tapé caractère par caractère dans la grille,
  `document.activeElement` reste le champ aux 5 frappes, `selectionStart` va de 1 à 5 — malgré une
  écriture en base à **chaque** caractère.
- ✅ Contrastes mesurés sur les 3 écrans × 2 thèmes : **zéro échec, minimum 6,04:1**. Un échec
  trouvé et corrigé, cf. ci-dessous.
- ✅ Cibles tactiles en 375 × 812 : aucun élément sous 48 px de haut ni 44 px de large, **coche et
  cellules comprises**. Aucun débordement horizontal sur les 6 types de mesure.
- ✅ **Clôture vérifiée en base** : séance à 7 séries dont 1 cochée → 6 séries supprimées,
  3 exercices retirés, 1 exercice et 1 série gardés, statut `completed`, durée 247 s.
- ✅ **Non-régression Lot 3** : la fiche exercice affiche maintenant de vraies données produites
  par le Lot 5 — record 100 kg × 5, historique à deux dates, échauffements exclus du relevé.
- ✅ **Checkpoint en salle : validé par l'utilisateur.**

### Les quatre pièges du Lot 2, trouvés en lisant le code

Aucun n'était détectable avant ce lot : **rien ne créait de `WorkoutSet`**, donc ce code n'avait
jamais été exercé. Chacun a son test, qui échoue sans son correctif.

1. **`getLastPerformance` renvoyait la séance en cours.** Elle remonte l'index et s'arrête sur la
   première série validée ; dès que la série 1 d'aujourd'hui était cochée, c'était elle. La colonne
   « précédent » aurait cessé d'être une référence pour devenir **un miroir de ce qu'on venait de
   taper**. → `excludeWorkoutId`. Le test assère les deux comportements côte à côte.
2. **`addSet` comptait les séries supprimées** : le `.count()` de Dexie ne filtre pas `deletedAt`.
   Supprimer une série puis en ajouter une produisait deux séries de même `order`.
3. **Une séance abandonnée aurait continué d'alimenter l'historique.** Le statut seul ne suffit
   pas : `getLastPerformance` et les records du Lot 3 lisent des séries **sans jamais regarder le
   statut de leur séance**. Une séance ratée serait devenue la référence de la suivante.
   → `discardWorkout` cascade le *soft delete*.
4. **`finishWorkout` gardait les séries jamais cochées.** Une routine de 6 × 4 pose 24 lignes, on
   en fait 17 : les 7 autres ne sont pas des séries à zéro, ce sont des séries qui n'ont pas eu lieu.

### Le geste — trois états, un seul appui

| Ce que la cellule montre | D'où ça vient | Ce que la coche enregistre |
|---|---|---|
| Un chiffre en **encre, gras** | **tu l'as tapé** — rien d'autre n'atterrit jamais là | ce chiffre |
| Un chiffre en **gris, maigre** | la prescription du jour, sinon la dernière fois | **ce chiffre** |
| Rien | ni prescription ni historique | rien |

Une série identique à ce qui est proposé coûte donc **un appui**, là où le cadrage en tolérait
deux. Toucher le champ **ne recopie pas** le gris : une valeur que tu n'as pas tapée ne doit jamais
être indiscernable d'une valeur que tu as tapée.

### Décisions et écarts par rapport au plan

- **La saisie est en ligne, pas dans une feuille** — et ça ne contredit pas le Lot 4. Une routine,
  c'est trois valeurs × cinq séries × six exercices posées d'un coup, assis ; une séance, c'est une
  ligne à la fois, entre deux séries, une main. Une feuille coûte déjà deux appuis pour s'ouvrir et
  se fermer.
- **La colonne « précédent » reste une colonne**, pas un simple placeholder. Le moment où elle sert
  vraiment, c'est **quand on ne la reprend pas** : « la dernière fois 97,5 × 5, aujourd'hui
  j'essaie 100 ». Un placeholder disparaît à la première frappe, précisément là. Elle est tapable,
  et elle écrit la dernière fois par-dessus la prescription.
- **La ligne d'en-têtes (`PRÉCÉDENT · kg · REPS`) est ce qui permet à la colonne « précédent » de
  se passer d'unités.** Les chiffres sont dans les mêmes colonnes que les champs : « 97,5 × 5 » se
  lit une fois contre l'en-tête, pas sur chaque ligne. Sur 375 px c'est la différence entre une
  grille et un mur de texte.
- **Aucun store Zustand.** Le chronomètre se dérive de `startedAt`, la séance en cours se lit par
  `getActiveWorkout()`. Un store recopierait des données persistées, ce qu'ADR-004 interdit — et
  c'est précisément là que naissent les pertes de séance. `stores/activeWorkout.ts` n'existe pas.
  Le Lot 6 en aura un vrai besoin (minuteur), pas celui-ci.
- **Écriture en base à la frappe**, plus tôt que la règle non négociable n°4 ne l'exige :
  `isCompleted` reste 0 tant que ce n'est pas coché, donc rien n'entre dans l'historique, mais un
  kill de l'app ne coûte même pas les caractères en cours.
- **La barre de reprise est permanente, il n'y a pas de redirection au démarrage.** Rouvrir l'app
  en pleine séance ne prouve pas qu'on veut l'écran de séance : aller chercher un réglage de
  machine sur une fiche exercice est exactement la raison d'en sortir. Une barre répond aux deux
  besoins — reprendre après un kill, et revenir après être allé voir autre chose.
- **`Démarrer` est en bas, pas en haut.** `PROGRESS.md` annonçait « en haut de l'éditeur de
  routine » ; c'était contraire à la règle du Lot 1 (« actions primaires en bas, jamais en haut »)
  et au défaut que l'utilisateur avait lui-même remonté au Lot 3. Arbitré avec lui : la barre
  collante devient **« Terminé » + « Démarrer la séance »**, et « Ajouter un exercice » descend en
  fin de liste, comme « Ajouter une série » est déjà en pied de carte. Trois boutons sur 343 px,
  c'est trois libellés tronqués — et en salle le verbe de cet écran est *démarrer*.
- **Une séance à la fois.** L'accueil ne propose rien quand une séance tourne, et « Démarrer »
  devient « Reprendre » : un bouton qui ne peut rien démarrer est pire que pas de bouton.
- **Le tonnage ne compte que les kilos qui sont vraiment la charge.** Un lest de 10 kg sur une
  traction et une assistance de 20 kg sur une machine vivent dans le même champ qu'un développé à
  100 kg ; les additionner produit un nombre faux. Conséquence assumée : une séance de tractions
  affiche un tonnage nul — c'est pour ça que l'écran de fin montre **trois chiffres**.
- **La colonne « précédent » est indexée strictement.** La série 5 ne retombe jamais sur la série 4
  de la dernière fois : le gris n'est pas décoratif, la coche l'enregistre, donc emprunter la
  charge d'une autre série écrirait un nombre que personne n'a soulevé.
- **`workoutHistory.ts` extrait de `workouts.ts`.** 617 lignes, bien au-delà de la règle des 300.
  La coupe n'est pas arbitraire : ces deux requêtes lisent **à travers** les séances (fiche
  exercice du Lot 3, écran de séance, historique du Lot 7) alors que tout le reste écrit **dans**
  la séance en cours.

### Le défaut trouvé en pilotant l'écran — la fourchette de reps disparaissait

Le premier écran réel, monté depuis une vraie routine, montrait **une case vide** là où la routine
prescrivait 8 – 12.

Cause : la prescription était recopiée dans `weight`/`reps`. Or **« 8 – 12 » n'est pas un nombre** :
elle n'avait littéralement nulle part où aller. Et la prescription qui *passait* (100 kg) arrivait
en texte foncé, **indiscernable de ce qu'on venait de taper**.

`WorkoutSet` porte désormais sa prescription dans des champs `target*` (non indexés, donc **aucune
migration** — même précédent que `Routine.subtitle` au Lot 4). De là découle la règle sur laquelle
tient tout l'écran : **rien n'est en encre tant que ce n'est pas tapé.** La séance se souvient de
ce qu'on lui a demandé même si la routine change ensuite — et le Lot 18 lira les mêmes champs :
savoir si tu as atteint le haut de la fourchette est *toute* l'entrée de l'auto-progression.

### Le défaut trouvé en mesurant — la valeur proposée était illisible

Le balayage de contraste a échoué sur **chaque** valeur grisée de la grille : **3,44:1 en sombre,
2,02:1 en clair**. Un appui y enregistrait un nombre que personne ne pouvait lire.

Le Lot 1 avait rangé cette valeur sous `--text-3` en la décrivant comme « une valeur volontairement
atténuée, un écho de donnée qu'on peut réutiliser ». **Elle ne l'est pas** : dans cette grille, le
gris est *ce que la coche écrit*. C'est le nombre le plus lourd de conséquence de l'écran.

Le gris passe donc à `--text-2`, et c'est la **graisse** qui porte la distinction proposé/saisi
(`font-normal` contre `font-semibold`) — exactement le couple que `NumberInput` appliquait déjà à
ses placeholders depuis le Lot 1. Mesuré après : proposé 6,49:1 en graisse 400, saisi 15,13:1 en
graisse 600.

**`--text-3` n'a plus aucun consommateur dans l'app.** Le Lot 3 l'avait déjà retiré des
placeholders, le Lot 2 des quotas, le Lot 1 des micro-libellés ; le Lot 5 lui retire son dernier
usage annoncé. Le jeton reste déclaré avec la raison écrite en clair dans `index.css`, pour que
personne ne le réintroduise sans lire pourquoi.

### Le défaut signalé — le filet de superset était invisible en thème clair

Le filet de 3 px qui matérialise un superset était peint en `--color-accent`. Mesuré : **1,29:1 sur
`--surface-0` en clair**, contre 15,31:1 en sombre — d'où le fait que personne ne l'ait vu. Le seuil
WCAG 1.4.11 pour un élément non textuel porteur d'information est **3:1**.

C'est la troisième occurrence du **même** défaut : le partage aplat/encre, posé au Lot 1 pour
l'accent, transposé au rouge au Lot 4 (`--danger-ink`), et ici **pas appliqué alors que le jeton
existait déjà**. La règle est pourtant écrite dans `index.css` : `--color-accent` est un **aplat**
(une forme qui porte `--color-accent-fg`), `--accent-ink` est ce qui doit être **lisible contre**
une surface. Un filet de 3 px ne porte rien par-dessus — c'est de l'encre.

Les deux appels étaient de l'encre : `WorkoutExerciseCard` (Lot 5) et `RoutineExerciseCard`
(Lot 4), le même filet dessiné deux fois. Mesuré après bascule sur `--accent-ink`, dans l'app qui
tourne : **6,63:1 sur `--surface-0`, 6,04:1 sur `--surface-1`, 5,23:1 sur `--surface-2`** en clair ;
le thème sombre est inchangé au bit près (15,31:1), les deux jetons y étant la même valeur.

Audit fait dans la foulée : **les neuf `--color-accent` restants portent tous `--color-accent-fg`
sur le même élément**, donc tous des aplats légitimes. Ces deux filets étaient les seuls écarts.

**Les lettres A / B / C ne bougent pas.** Le correctif rend le filet visible, il ne rend pas les
lettres inutiles — un accent seul ne peut pas porter du sens (plein soleil, daltonisme), et c'est
la décision du Lot 4 rappelée plus bas.

### Le retour sur les boutons — quatre passes, quatre fois juste

Remonté après lecture du code livré : « les boutons ne s'intègrent pas correctement dans l'app ».
Quatre allers-retours ont suivi. **Aucun de ces défauts n'était visible au typecheck, au lint ni
aux tests** ; trois d'entre eux ont été trouvés en regardant une capture d'écran.

**1. J'avais inventé un composant visuel.** Une boîte en pointillés pour « Ajouter un exercice ».
`border-dashed` n'existait **nulle part ailleurs** dans le dépôt — toutes les surfaces d'ici sont
pleines et sans bordure, donc un contour vide se lit comme un emplacement à remplir. Deux « + »
cohabitaient sur le même écran en deux langues.

**2. « Démarrer la séance » passait à la ligne dans son bouton.** J'avais mesuré `168x56` et conclu
que ça allait : la boîte allait, le texte cassait dedans.

**3. Le chronomètre était un menu secret.** Il occupait le coin haut-droit, là où tous les autres
écrans posent une icône, et cachait le seul accès à « Renommer » et « Notes ». En `--accent-ink`,
qui dans cette charte veut dire *engagé* — une horloge en vert accent se lit comme un témoin.

**4. Deux commandes empilées pour une seule action.** « Reprendre » dans la barre collante et la
barre de reprise 32 px dessous : même vert exact (`rgb(199,242,82)`), même hauteur, même
destination, et **toutes deux conditionnées par la même séance active** — elles ne pouvaient pas
apparaître l'une sans l'autre.

**5. « Ça chevauche, ça fait posé là. »** Les barres d'action étaient des `position: sticky` posées
par-dessus le contenu. J'ai d'abord rustiné la couleur (`--surface-1`) : **pire**, c'est la couleur
des cartes, mesurée identique, donc la dernière carte fondait dans la bande.

**6. « Pourquoi j'ai Terminé et Démarrer ? »** — la meilleure question du lot. « Terminé » appelait
le **même `goBack` que la flèche de l'en-tête**. Il datait du Lot 3, quand une fiche n'avait pour
seule sortie qu'un mot en haut à droite ; la flèche est arrivée au Lot 4 et le doublon lui a
survécu.

### Ce que le Lot 5 ajoute à la charte du Lot 1

La charte est figée depuis le Lot 1 et les lots suivants s'appuient dessus. Le Lot 5 n'ajoute donc
**aucun vocabulaire visuel neuf** : il nomme ce qui existait déjà en double, et supprime ce qui
faisait doublon.

| Primitive | Ce qu'elle nomme | Points d'appel |
|---|---|---|
| `ui/AddRow` | « encore un de ceux-là » — le seul geste d'ajout | 4 |
| `ui/HeaderAction` | le bouton du coin haut-droit, une icône jamais un mot | 3 |
| `ui/ActionBand` | l'action primaire, en bande pleine largeur | 6 |
| `ui/numberField` | le cœur décimal partagé avec `NumberInput` | 2 |

Trois règles en découlent, à respecter dans les lots suivants :

- **Une action primaire par écran, et jamais une navigation.** Revenir en arrière est le travail de
  la flèche de l'en-tête. Un bouton qui appelle `goBack` en double est un bouton en trop.
- **La bande d'action est un frère flex, jamais une superposition.** C'est le raisonnement que le
  Lot 1 avait tenu pour la barre de navigation et jamais transposé. Le défilement vit dans `Screen`,
  entre l'en-tête et le pied ; rien ne peut passer dessous.
- **Sa forme est celle de la barre de reprise** — bord à bord, sans retrait, sans arrondi, 56 px.
  C'est la seule grande surface d'accent de l'app dont l'utilisateur ne se soit jamais plaint.

**`--text-3` n'a plus aucun consommateur.** Le Lot 1 le réservait à « la valeur précédente du
Lot 5 » ; cette valeur s'est révélée être ce que la coche enregistre, et le jeton y mesurait
2,02:1 en clair. Il reste déclaré dans `index.css` avec la raison écrite, pour que personne ne le
réintroduise sans la lire.

### Le balayage pour supprimer une série — et le seuil qui est un mot

Demandé après le premier essai en salle : « parfois on met une série par erreur, ou on veut en
faire moins ». La suppression existait déjà (appui sur le rang → feuille → « Supprimer la série »),
mais à deux appuis et une feuille modale, entre deux séries, essoufflé.

Trois décisions, dans l'ordre où elles se sont imposées :

- **Le seuil, c'est le mot.** Le balayage découvre « SUPPRIMER » gravé dans la surface sous la
  ligne, et la suppression part quand le mot est **entièrement lisible**. Pas de compteur de pixels
  à apprendre, pas de jauge à lire : la typographie *est* la jauge, et un mot à moitié découvert
  dit « pas encore » sans légende. La largeur est **mesurée sur le span rendu**, jamais écrite en
  dur — l'app n'embarque aucune police, donc le mot fait la largeur que le téléphone lui donne.
  C'est la leçon du Lot 5 sur la fourchette de reps, appliquée avant d'avoir le bug. Mesuré ici :
  71,2 px, soit un seuil de 103 px, borné à \[72, 170\] pour qu'une police exotique ne rende pas le
  geste impossible ni gratuit.
- **Pas de bandeau rouge.** La charte réserve `--color-danger` comme **aplat**, et un aplat rouge
  sous le pouce serait la chose la plus forte de l'écran — plus forte qu'une série validée, qui est
  censée l'être. Le danger reste de l'**encre**, sur le mot : `--text-2` avant le seuil,
  `--danger-ink` après, plus la pastille haptique de 10 ms que `ReorderableList` emploie déjà à la
  prise. Mesuré : 5,49:1 en sombre, 5,10:1 en clair sur `--surface-2`.
- **L'annulation tient la place du disparu, pas un toast.** Un toast en pied d'écran peut dire
  *qu'*une série est partie, jamais **laquelle** — or cet écran empile vingt lignes de deux
  nombres. Un bandeau posé entre la 2 et la 3 n'a besoin d'aucun mot pour le dire, et il apparaît
  sous le pouce qui vient de balayer. Coût : aucun portail, aucune surcouche, aucun z-index. Six
  secondes, puis il se referme en `1fr → 0fr`. `restoreSet` remet la série **à son rang** (tri à
  deux clés : l'ordre, puis la rescapée d'abord à égalité) — sans ça, une série reprise en
  deuxième place réapparaît en troisième.

**Trois défauts trouvés en pilotant, pas en relisant :**

- **`touch-action` est le seul levier qui compte.** `none` (le réflexe) fige le défilement de
  l'écran le plus défilé de l'app ; écouter sans lui fait bagarrer le geste contre le scroll
  pendant les premières frames. `pan-y` est la réponse : le navigateur garde le vertical, en natif,
  et cède l'horizontal.
- **`setPointerCapture` lançait une exception et tuait le geste entier.** La capture n'est qu'un
  confort — elle sert si le doigt sort de la ligne. Un navigateur qui la refuse laissait la ligne
  **bloquée à moitié ouverte**, mot affiché, plus rien pour la refermer. Elle est maintenant en
  `try`/`catch` : jamais une précondition.
- **La suppression était déclenchée par `transitionend`.** Ça lie une **écriture en base à une
  peinture** : un onglet mis en arrière-plan par un appel entrant — le cas que la règle n°4 nomme
  explicitement — laissait le geste fait, la ligne partie de l'écran et **rien d'écrit**. Remplacé
  par un `setTimeout` de 220 ms, qui se résout toujours ; et si l'app meurt dans cet intervalle, la
  série est encore là, ce qui est le bon sens de l'échec pour une suppression.

**Ce qui reste vrai après :** le balayage est un **raccourci**, pas le seul chemin. L'appui sur le
rang ouvre toujours la feuille avec « Supprimer la série » — c'est elle qui porte l'accessibilité
clavier et lecteur d'écran, et elle était là avant.

### Ce que le Lot 5 ne fait pas — à savoir avant de tester

- **Le minuteur de repos** (Lot 6, RF-22/RF-27). Le repos par exercice est stocké et affiché, rien
  ne le déclenche.
- ~~**Changer le type d'une série en séance** (Lot 6, RF-20). Le type est **repris de la routine** et
  affiché (« ÉCH. »), il ne se modifie pas ici.~~ **Fait au Lot 6, tranche 3, tâche 1** — et le
  « ÉCH. » de l'écran de séance est devenu un pictogramme.
- ~~**Le RPE** (Lot 6, RF-30).~~ **Fait au Lot 6, tranche 3, tâche 3** — repliable dans la feuille de
  série, jamais ajouté à la grille. ~~La détection de record en direct (Lot 6, RF-23).~~ **Fait au
  Lot 6, tranche 3, tâche 2** — dérivé de l'historique et des séries validées de la séance.
- **Relire ou corriger une séance passée** (Lot 7). Cet écran ne connaît que la séance `active`.
- **Une durée se saisit en secondes**, pas en `m:ss`. À rouvrir si ça gêne.
- **`isUnilateral` n'est toujours lu par personne.** Le champ existe depuis le Lot 2 ; ni le
  Lot 3, ni le 4, ni le 5 ne le consomment. C'est le contrôle de fin de lot institué au Lot 4 —
  consigné ici comme **en attente**, pas comme oublié.

### ✅ Checkpoint Lot 5 — **validé en salle (2026-07-24)**

- [ ] **Une vraie séance complète avec l'app.**
- [ ] En pleine séance : tuer l'app depuis le gestionnaire de tâches, la rouvrir → la séance
      reprend où elle en était, aucune série perdue.
- [ ] Mode avion pendant toute la séance → aucune différence.
- [ ] Saisir une série sans lunettes, d'une main, en 3 secondes.
- [ ] Ajouter un exercice non prévu au milieu, et en réordonner deux au doigt.
- [ ] Se tromper de ligne, décocher, corriger.
- [ ] **Balayer une série vers la droite** : le mot « SUPPRIMER » se découvre, la ligne devient
      plus lourde au seuil, la pastille haptique se sent **sans regarder**.
- [ ] Balayer par erreur puis appuyer sur « Annuler » → la série revient **à sa place**.
- [ ] Défiler la liste en partant d'une ligne de série → la page défile normalement, rien ne bouge
      latéralement. C'est le point qui casse en premier si `touch-action` bouge.
- [ ] Balayer en partant d'un champ de saisie → **rien ne doit se passer** (le clavier ne doit pas
      s'ouvrir en route).

---

## Lot 4 — Routines

### Definition of Done — vérifiée le 2026-07-22

- ✅ `npm run typecheck`, `npm run lint`, `npm run test:run` (**146 tests**, +62), `npm run build`
  passent tous les quatre.
- ✅ **Glisser-déposer vérifié par événements `pointerType: 'touch'` synthétiques**, avec relecture
  de l'ordre **dans IndexedDB** et pas seulement du DOM : la ligne bouge, `order` est renuméroté
  0…n sans trou, le superset survit.
- ✅ **La page défile toujours** : `touch-action` calculé vaut `none` sur la poignée (44 × 72 px) et
  `auto` sur la ligne et sur la carte.
- ✅ **Duplication vérifiée dans le vrai écran** : copie à 9 exercices / 22 séries / 82,5 kg, puis
  renommage de la copie **et** retrait d'un de ses exercices → l'original est resté à 9 exercices,
  22 séries, 82,5 kg. Aucun identifiant partagé entre les deux arbres (test unitaire).
- ✅ **Dossier supprimé, routines intactes** : les deux routines sont toujours là, à la racine. Le
  texte de confirmation accorde au singulier (« Sa routine remonte à la racine. »).
- ✅ Sélection multiple vérifiée : « curl » → 15 résultats, 3 touchés, bouton « Ajouter
  3 exercices », lignes ajoutées aux rangs 6, 7 et 8.
- ✅ Superset vérifié de bout en bout : groupement, lettres **A / B / C**, 3 filets d'accent de 3 px
  (dont deux de 277 px qui enjambent la gouttière de 12 px, et un de 265 px qui s'arrête), puis
  dissociation du groupe entier.
- ✅ Contrastes **mesurés** sur les 3 écrans × 2 thèmes : **934 nœuds de texte, zéro échec**,
  minimum **6,04:1**.
- ✅ Cibles tactiles en 375×812 : **aucun élément sous 48 px de haut ni 44 px de large**.
- ✅ Aucun débordement horizontal (`scrollWidth === innerWidth === 375`), **36 px** de dégagement
  entre la dernière carte et la barre collante.
- ✅ **Non-régression Lot 3 vérifiée** après l'extraction de `ExerciseBrowser` : « developpe
  couche » → 4 résultats, `#/exercises?q=developpe+couche&muscle=chest`, et le retour depuis une
  fiche restitue **la recherche et le filtre**.

### Décisions et écarts par rapport au plan

- **Les six modèles ne sont pas seedés.** Le seed du catalogue tourne à chaque démarrage ; le même
  mécanisme ferait réapparaître « Poussée » chaque fois qu'on la supprime. La ligne de partage
  écrite au Lot 2 s'applique telle quelle : le catalogue appartient à l'app et revient toujours, ce
  que l'utilisateur compose lui appartient et ne revient jamais. Un modèle est donc un **choix**,
  qui produit une routine ordinaire. Un test vérifie que **chaque slug cité existe au catalogue** —
  sinon la routine produite manquerait silencieusement un exercice.
- **Supprimer un dossier ne supprime pas ses routines.** Elles remontent à la racine, et le nombre
  concerné est annoncé dans la confirmation. Ranger et détruire sont deux gestes différents.
- **L'écran d'une routine *est* son éditeur.** Tout s'écrit à la frappe (précédent du Lot 3), donc
  il n'y a ni état modifié à valider ni mode lecture à en distinguer.
- **Aucun bouton « Démarrer ».** C'est le Lot 5. Un bouton qui ne fait rien est pire que pas de
  bouton — et l'emplacement est réservé en haut de ce même écran.
- **Pointer Events, pas l'API HTML5 de glisser-déposer.** Chrome Android n'émet **jamais**
  `dragstart` depuis un événement tactile : un lot bâti dessus ne marcherait que sur le PC du
  développeur, alors que le checkpoint dit « au doigt sur ton téléphone ».
- **`touch-action: none` sur la poignée seule**, jamais sur la ligne ni sur la liste. Posé sur la
  liste, c'est tout l'écran qui cesse de défiler.
- **Le superset se lit à la lettre autant qu'à la couleur.** Les exercices groupés portent **A / B /
  C** — l'ordre d'alternance, la seule information que le lecteur d'un superset a besoin de lire —
  en plus du filet d'accent. La charte n'a qu'un accent, et un accent seul ne peut pas porter du
  sens (plein soleil, daltonisme). Un exercice non groupé n'a pas de lettre : **l'absence de marque
  est elle-même l'information**.
- **« Dissocier » dissout le groupe entier**, jamais un membre. Retirer le membre du milieu d'un
  groupe de trois n'aurait pas le même sens que retirer le premier, et une action dont l'effet
  dépend de l'endroit où on a touché est une action à laquelle personne ne se fie.
- **Une ligne déposée entre deux membres d'un même groupe le rejoint.** Le filet dessine un
  contenant ; déposer dans un contenant met dedans. **La règle n'est volontairement pas généralisée**
  à une ligne portant déjà un groupe : `[B:1, C:2, A:1, D:2]` ne dit pas si A est entré dans (C, D)
  ou C dans (B, A) — l'information de « qui a bougé » n'est pas dans le tableau. Une règle qui
  tranche devine. Les deux groupes se dissolvent, ce qui est **visible à l'écran**, et un test fige
  ce comportement pour que personne ne le « répare » à l'aveugle.
- **`originRoutineId` reste vide à la duplication.** Une copie n'est pas une version ; le champ
  décrit une filiation qu'aucun écran ne lit. Le versionnage est du Lot 17.
- **Le sélecteur d'exercices est un écran, pas une feuille.** Trois raisons, toutes issues des
  168 lignes : une feuille plafonne à 88 % et imbriquerait une zone de défilement dans une autre ;
  les en-têtes de lettre collants sont dessinés sur le fond de page et peindraient par-dessus la
  surface de la feuille ; et le bouton retour Android du Lot 10 se comporte correctement sans rien
  ajouter.
- **Le sélecteur ne propose pas « Créer « x » »** sur une recherche infructueuse — créer un exercice
  abandonnerait la routine en cours d'écriture, et le retour ne saurait pas restituer la sélection.
  Sa sortie est **« Effacer la recherche »**, qui ne quitte pas le geste en cours.
- **Une série se modifie dans une feuille, pas en ligne.** Trois valeurs × cinq séries × six
  exercices sur 375 px, c'est un marécage de cibles à 24 px. **« Ajouter une série » recopie la
  précédente** (3 × 8-12 @ 80 kg = une saisie et deux appuis) et **« Appliquer à toutes les
  séries »** couvre la montée de charge, l'entretien le plus fréquent d'une routine.
- **Seul l'échauffement est planifiable au Lot 4.** Dégressive et échec sont du Lot 6, où RF-20 leur
  donne un comportement ; et une dégressive ne se planifie pas vraiment, elle se décide la barre en
  main.
- **Les dossiers et les routines ne se réordonnent pas au doigt.** Le budget de glisser-déposer va
  aux exercices, où le checkpoint l'exige. Tri par création ; déplacement entre dossiers par le menu.

### Le défaut trouvé en testant — les feuilles enchaînées ne s'ouvraient pas

`ActionSheet` appelait `action.onSelect()` **puis** `onClose()`. Les deux atterrissent dans le même
lot de rendu React, donc la dernière écriture gagne : toute action qui **ouvre une autre feuille**
posait son état, que la fermeture effaçait aussitôt. *Nouveau dossier*, *Déplacer vers un dossier*,
*Supprimer la routine*, *Renommer* — **aucune ne s'ouvrait**.

Invisible aux tests unitaires (c'est de l'ordonnancement d'état React) et invisible à la lecture du
code. **Trouvé en pilotant l'interface pour de vrai.** Correctif d'une ligne : fermer d'abord, agir
ensuite. `OptionSheet` portait le même motif, latent — corrigé aussi.

### Deux « bugs » qui n'en étaient pas — le panneau navigateur ne compose jamais

Deux mesures ont paru révéler des défauts. **Les deux venaient de l'environnement de test, pas du
code**, et les deux auraient conduit à « corriger » du code correct :

1. **Le fond de la carte soulevée** restait `--surface-1` alors que la classe
   `bg-[var(--surface-2)]` était bien posée, la règle CSS bien émise et la variable bien résolue.
   Cause : la transition ne démarre jamais faute d'occasion de rendu. `card.style.transition =
   'none'` → la valeur saute immédiatement à `rgb(30,30,33)`. **Le CSS était juste.**
2. **Le défilement automatique** ne bougeait pas. Cause : `requestAnimationFrame` **ne se déclenche
   jamais** ici — mesuré, `0 frame en 1 s`, `document.visibilityState === 'hidden'`.

La conséquence tirée : la partie du drag qui ne peut pas être exercée dans ce panneau ne devait pas
être la seule sans test. `edgeScrollDelta` a donc été **extrait en fonction pure** (`ui/edgeScroll.ts`,
8 tests). En l'écrivant, un vrai défaut est apparu : la vitesse n'était pas bornée, donc un doigt
traîné **au-delà** du haut de l'écran faisait accélérer la liste indéfiniment — exactement quand on
ne peut plus corriger. Bornée.

### Les cinq retours du premier essai sur téléphone — tous corrigés

Remontés par l'utilisateur après une vraie session de saisie. **Cinq sur cinq étaient justes.**

**1. Le clavier se fermait à la première frappe.** Le pire des cinq : il rendait la saisie décimale
(`102,5`, quatre caractères) littéralement impossible.

`Sheet` déclare son effet avec `[open, onClose]`, et cet effet appelle `panelRef.current?.focus()`.
Or les appelants passent `onClose` en **flèche inline**, donc son identité change à chaque rendu du
parent ; et une feuille dont les champs écrivent en base à la frappe se re-rend **à chaque
caractère**. L'effet rejouait donc, et reprenait le focus. Mesuré : `document.activeElement`
devenait `DIV[dialog]` dès le **premier** caractère.

Le focus d'ouverture vit maintenant dans son propre effet, dépendant de `open` **seul**. Vérifié
après correctif : `102,5` se tape en entier, focus conservé, curseur de 1 à 5 ; idem sur les notes
(11 caractères, curseur à 11).

**Pourquoi les tests ne l'ont pas vu** : je posais les valeurs par `dispatchEvent` sans jamais
vérifier `document.activeElement`. Une saisie programmatique ne perd pas le focus de la même façon
qu'un doigt. **Toute vérification de champ doit désormais assurer le focus, pas seulement la valeur.**

**2. On ne pouvait pas glisser une routine dans un dossier.** J'avais écarté le besoin (« le budget
de drag va aux exercices »). À tort.

La liste est maintenant **plate, et un en-tête est une position, pas un contenant** : le dossier
d'une routine **est** l'en-tête au-dessus d'elle. Déposer réordonne et range d'un seul geste, sans
cible de dépôt à viser au pouce ni logique de transfert entre conteneurs. L'en-tête « Sans dossier »
n'apparaît qu'à partir du premier dossier — mais alors toujours, sinon une routine entrée dans un
dossier ne pourrait plus en ressortir. Vérifié dans les deux sens.

Conséquence de mise en page : chaque routine devient **sa propre carte**, comme les exercices de
l'éditeur — une ligne doit pouvoir se détacher de ses voisines pour être soulevée.

**« Déplacer vers un dossier » reste dans le menu ⋯.** Le glisser est rapide, le sélecteur est
précis, et avec une douzaine de routines le dossier visé peut être à deux écrans du pouce.

**3. L'en-tête de l'éditeur était illisible en responsive.** Le titre est le **nom choisi par
l'utilisateur** : lui opposer un relevé « 22 SÉRIES » *et* un lien « Routines » faisait trois
éléments en concurrence sur 375 px, et ça cassait dès que le nom dépassait « Poussée ».

L'en-tête ne porte plus que le titre et le retour — **exactement la forme de la fiche exercice du
Lot 3**. Le relevé descend au-dessus de la liste qu'il compte, là où il est réellement informatif.

**4 et 5. Les routines ont un sous-titre.** `Routine.subtitle` (non indexé, donc **aucune migration**).
Sans lui, une routine qu'on veut décrire devient un titre qui passe à la ligne trois fois et se lit
comme un paragraphe — et une liste de paragraphes ne se parcourt pas.

Trois registres distincts sur la ligne, au lieu de deux gris identiques :

| Ligne | Registre |
|---|---|
| `Poussée` | `text-base` / `--text-1` |
| `Lourde — barre et accessoires épaules` | `text-sm` / `--text-2` — de la prose |
| `9 EXERCICES · 22 SÉRIES` | `.label-xs` gravé / `--text-2` — un décompte annote, il ne raconte pas |

Mesuré : 87 px avec sous-titre, 64 px sans (la ligne se referme proprement).

Re-vérifié après ces cinq correctifs : contrastes **0 échec / min 6,04:1**, aucune cible sous
48 × 44, aucun débordement horizontal, **148 tests**.

### Deux retours du deuxième essai — la navigation et le clavier

**1. Le retour est une flèche, plus le nom de la page.** Depuis le Lot 3, revenir en arrière se
faisait en touchant le **nom de la destination** en haut à droite (« Exercices », « Routines »,
« Réglages »). Remonté du téléphone : un mot dans un coin se lit comme une **étiquette**, pas comme
une commande — et il posait un second texte à côté d'un titre choisi par l'utilisateur, sur 375 px.

La flèche est maintenant **centralisée dans `Screen`** (prop `onBack`), à **gauche**, avant le
titre : cinq écrans qui déclaraient chacun leur bouton en partagent un seul, identique. Le titre
gagne toute la largeur restante et **tronque** au lieu de passer à la ligne.

Atteindre le coin haut-gauche d'un pouce n'est pas le problème que ce serait pour une action
primaire : tout écran assez long porte déjà sa vraie sortie sur une barre collante dans la zone du
pouce (règle du Lot 3). Quatre chaînes mortes supprimées de `fr.ts` au passage.

**2. La touche « OK » du clavier ne faisait rien.** Et c'est exact : **hors d'un `<form>`, `Entrée`
n'a aucune action par défaut sur un `<input>`**. Le clavier restait donc devant la feuille, et la
seule issue était de faire glisser la feuille vers le bas.

Deux correctifs, parce que la plainte contenait deux choses :

- `Input` et `NumberInput` interceptent `Entrée` → `blur()`, ce qui referme le clavier. (Pas
  `Textarea` : là, `Entrée` doit insérer une ligne.)
- **`Sheet` a maintenant une croix visible.** Le glissement vers le bas marche et reste, mais c'est
  un geste qu'il faut déjà connaître — et c'était la seule façon de ranger une feuille.
  `stopPropagation` sur le `pointerdown` de la croix : l'en-tête est la surface de glissement, sans
  ça appuyer sur la croix aurait commencé un drag. **Vérifié : le `transform` du panneau ne bouge
  pas à l'appui.**

Mesuré : flèche et croix à **48 × 48** sur les quatre écrans, flèche bien à gauche du `h1`, retour
qui navigue réellement (`#/routines/xxx` → `#/routines`), `Entrée` qui défocalise champ texte **et**
champ numérique, contrastes des deux icônes **7,03:1 à 18:1** sur les deux thèmes.

### Le huitième retour — le type de mesure n'était branché sur rien

Remonté après validation du checkpoint, et c'est le défaut le plus profond du lot : **une planche,
un rameur et un développé couché avaient le même écran de configuration.**

Trois choses, une seule cause :

1. **`RoutineSet` n'avait ni durée ni distance.** Le schéma ne pouvait littéralement pas stocker
   « planche 45 s ». Deux champs ajoutés (`targetDurationSeconds`, `targetDistanceMeters`), non
   indexés donc **sans migration**.
2. **`measurementType` n'était lu nulle part** en dehors du formulaire de création. Choisi au
   Lot 2, porté par les 168 exercices, et consommé par zéro écran. C'est exactement le
   « la création de l'exercice n'est pas reliée à l'exo dans la routine » de l'utilisateur.
3. **Le repos par défaut de l'exercice n'était jamais consulté.** La carte n'affichait que
   `row.restSeconds`, alors que `0` veut dire « prends celui de l'exercice » (§4.2). Un repos réglé
   dans la bibliothèque au Lot 3 avait donc l'air perdu.

**`lib/measurement.ts` (TDD, 17 tests)** est le fil manquant : un type de mesure entre, la forme
sort. La feuille rend ses champs à partir d'elle, la ligne formate à partir d'elle — les deux ne
peuvent plus se contredire.

| Type de mesure | Champs | Ce que la ligne affiche |
|---|---|---|
| `weight_reps` | reps + charge | `8 – 12 REPS · 102,5 kg` |
| `reps_only` | reps + **lest** | `8 REPS · +10 kg` |
| `assisted_weight_reps` | reps + **assistance** | `8 REPS · −20 kg` |
| `time_only` | durée | `45 s` |
| `weight_time` | durée + charge | `1:30 min · 20 kg` |
| `distance_time` | distance + durée | `1,5 km · 6:00 min` |

**Le même champ de kilos veut dire trois choses**, et les appeler tous « charge » est la façon la
plus simple pour une routine de mentir : une charge sur un développé, un **lest** qu'on ajoute à son
poids de corps sur une traction, une **assistance** que la machine retire. D'où trois libellés et
les signes `+` / `−` sur la ligne.

Le repos affiché est désormais **le repos effectif** (l'override de la routine, sinon celui de
l'exercice), et le champ vide porte la valeur héritée en placeholder avec la phrase qui l'explique.

### Le défaut trouvé en mesurant — le rouge était illisible en thème clair

Trouvé par le balayage de contraste de ce correctif, et **il ne datait pas du Lot 4** : `#ff5c5c`
mesure **3,03:1 sur blanc, 2,75:1 sur une carte, 2,39:1 sur une ligne pressée**. Toutes les
commandes destructives de l'app étaient concernées, y compris « Supprimer l'exercice » du Lot 3.

C'est le piège que le Lot 1 avait résolu pour l'accent et **jamais transposé au rouge**. Même
correctif, même raisonnement : `--danger-ink` (`#ff5c5c` en sombre, `#b91c1c` en clair) pour tout ce
qui doit se lire **contre** une surface ; `--color-danger` reste le remplissage. Les deux seuls
appels étaient de l'encre.

Après : **6,08:1 en sombre, 5,89:1 en clair**, sur les six commandes destructives de l'app.

### Checkpoint Lot 4 — ✅ validé le 2026-07-22

Validé par l'utilisateur **sur le site déployé, au doigt**, après trois passes de correctifs
(sept défauts au total : cinq au premier essai, deux au second).

- [x] Tu crées ta vraie routine de séance, avec tes exercices, tes séries et tes charges cibles.
- [x] **Tu tapes `102,5` en entier dans une charge cible, sans que le clavier se ferme.**
- [x] Tu donnes un nom court à une routine et un sous-titre : la liste se lit d'un coup d'œil.
- [x] **Tu fais glisser une routine sous un en-tête de dossier : elle y entre. Tu la remontes au-dessus :
      elle en ressort.**
- [x] Tu réordonnes les exercices **au doigt**, sans frustration — et la page défile encore
      normalement quand tu ne touches pas la poignée.
- [x] Tu dupliques une routine et tu la modifies : l'originale n'a pas bougé.
- [x] Tu groupes deux exercices en superset : le filet et les lettres A/B apparaissent.
- [x] Tu pars d'un modèle (Poussée), tu le modifies, tu le supprimes : il ne revient pas au
      rechargement.
- [x] Tu ranges deux routines dans un dossier, tu supprimes le dossier : **tes routines sont
      toujours là.**

**Sept défauts remontés, sept justes, zéro faux positif.** Aucun n'était visible en relecture de
code, et aucun n'a été trouvé par les tests : tous demandaient un pouce et un vrai écran. La leçon
de méthode est consignée dans « Pièges rencontrés » — vérifier le **focus**, pas seulement la
valeur, et douter d'un différé de fonctionnalité qui n'a pas été discuté avec l'utilisateur.

---

## Lot 3 — Bibliothèque d'exercices

### Definition of Done — vérifiée le 2026-07-22

- ✅ `npm run typecheck`, `npm run lint`, `npm run test:run` (**84 tests**, +19), `npm run build`
  passent tous les quatre.
- ✅ **Recherche vérifiée dans un vrai navigateur** : « squat » → 9 sur 168 ; « developpe couche »
  **sans accent** → 4 sur 168 dont « Développé couché (barre) » ; « zzzz » → 0 sur 168 avec le
  bouton *Créer « zzzz »*. Latence de frappe **inférieure à 10 ms**.
- ✅ **Filtres vérifiés** : Haltères → 26 sur 168 ; Haltères + Biceps → 5 sur 168. L'URL suit
  (`#/exercises?equipment=dumbbell&muscle=biceps`).
- ✅ **Retour arrière vérifié** : depuis une fiche, revenir retombe sur
  `#/exercises?q=developpe%20couche`, avec le champ rempli et le relevé à 4 sur 168.
- ✅ **Cycle complet création → note → suppression** vérifié en lisant IndexedDB directement, pas
  le DOM : `isCustom: 1`, `isUnilateral: 1`, `quads`/`machine`, **pas de slug**,
  `userNotes: 'siège position 4'`, `defaultRestSeconds: 45`.
- ✅ **Pas de saut de curseur** : 16 caractères tapés un par un dans les notes,
  `selectionStart` reste à 16 malgré une écriture en base à chaque frappe.
- ✅ **Records et historique vérifiés avec de vraies données** (deux séances fabriquées en base,
  puis effacées) : charge max 102,5 kg × 5, meilleure série 90 kg × 10 — deux séries différentes,
  donc les deux lignes s'affichent bien. L'échauffement de 60 kg × 10 n'apparaît nulle part.
- ✅ Contrastes **mesurés** sur les trois écrans + le sélecteur ouvert, thème sombre **et** clair :
  minimum **6,49:1** en sombre, **6,04:1** en clair. Un échec trouvé et corrigé, cf. ci-dessous.
- ✅ Cibles tactiles mesurées en 375×812 sur les trois écrans : **aucun élément sous 48 px de haut
  ni 44 px de large**. Lignes du sélecteur : 56 px.
- ✅ Mise en page mesurée en 375×812 : `scrollWidth === innerWidth === 375` partout (aucun
  débordement horizontal), **32 px** sous le dernier élément une fois défilé tout en bas, sur la
  bibliothèque comme sur la fiche.
- ✅ En-tête de lettre collant vérifié : à 4 000 px de défilement, « E » est épinglé à 0 px du haut
  de la zone de défilement.

### Le catalogue avait 168 exercices, il en a toujours 168

Aucun exercice n'a été ajouté ni retiré. Ce lot ne fait qu'exposer le catalogue du Lot 2.

### Décisions et écarts par rapport au plan

- **La virtualisation demandée par le cadrage n'a pas été faite — après mesure.** Un forçage
  complet du calcul de mise en page des 168 lignes coûte **18 à 22 ms** sur cette machine, pour
  **752 nœuds DOM** et 12 950 px de hauteur défilable ; et ce coût n'est payé qu'au rendu complet,
  pas au défilement. Une virtualisation JS casserait la recherche du navigateur, l'ancrage du
  défilement et les en-têtes collants, et le §8 de l'architecture exclut les composants tiers.
  `content-visibility: auto` était le repli prévu : **il n'a pas été jugé nécessaire non plus**.
  À rouvrir si la liste devient nettement plus longue, avec un chiffre à l'appui.
- **La recherche et les filtres vivent dans l'URL** (`?q=`, `?muscle=`, `?equipment=`), écrits en
  `replace`. Sans ça, ouvrir un exercice puis revenir remet la liste à zéro — l'annulation de ce
  qu'on venait de chercher. Le `replace` évite que chaque frappe crée une entrée d'historique et
  rende le bouton retour inutilisable. Les valeurs lues de l'URL sont **validées contre
  `MUSCLE_GROUPS` / `EQUIPMENT`**, jamais castées : une URL est saisissable à la main.
- **Les en-têtes de lettre disparaissent pendant une recherche.** Ils existent pour découper une
  liste trop longue à lire d'un coup ; sur six résultats ils ne découpent rien. L'initiale est
  calculée sur le **nom normalisé**, donc « Élévations » se range sous E — vérifié.
- **`FilterChip` n'a pas de croix d'effacement.** Une cible de 20 px collée à une cible de 48 px
  est ce qu'on rate les doigts moites. Retirer un filtre se fait par la première ligne du
  sélecteur (« Tous les muscles »), ou par le bouton pleine largeur de l'état vide — au moment
  précis où c'est urgent.
- **Les états vides de cet écran utilisent la variante `title`, pas `reading`.** L'écran porte déjà
  son propre relevé : un `0` de 72 px juste dessous dirait deux fois la même chose. La variante
  `reading` du Lot 1 reste la bonne pour les écrans qui n'ont pas de compteur (Accueil, Routines,
  Historique).
- **Trois impasses, trois sorties différentes.** Recherche infructueuse → *Créer « ce que tu as
  tapé »*, avec le nom déjà pré-rempli dans le formulaire. Filtres trop serrés → *Retirer les
  filtres*. Catalogue réellement vide → l'explication du Lot 1.
- **Les records sont dérivés de l'historique, pas lus dans `personalRecords`.** Cette table reste
  vide jusqu'au Lot 6 : écrire un moteur incrémental maintenant serait du Lot 6 fait à moitié,
  sans la validation de série qui l'alimente. `lib/records.ts` définit **une fois** ce qui compte
  comme un record ; le Lot 6 (détection en direct) et le Lot 13 (recalcul complet) consomment ces
  mêmes fonctions au lieu de redire les règles.
- **`isWorkingSet` est exporté**, pas seulement utilisé en interne : le nombre de séries d'une
  ligne d'historique et la valeur affichée à côté doivent parler des mêmes séries. « 4 séries ·
  100 kg × 5 » où le 4 compte l'échauffement et le 100 kg ne le compte pas, ce sont deux réponses
  à une seule question. **Trouvé en regardant l'écran avec de vraies données.**
- **Les reps maximales ne s'affichent que s'il n'y a aucune charge à battre.** Sur un développé
  couché, le maximum de répétitions est une série légère : l'appeler « record » est un mensonge.
  Pour une traction au poids du corps, c'est le seul record qui existe.
- **`labels.ts` vit dans `i18n/`, pas dans `features/exercises/`** comme le plan le disait. Les
  routines (Lot 4) et la séance (Lot 5) nomment les mêmes muscles et le même matériel ; une
  feature qui importe une autre feature est le bug de découpage que le §7 signale. Les types
  *template literal* font **échouer le typecheck** si une valeur est ajoutée à `MUSCLE_GROUPS`
  sans son libellé — vérifié en essayant.
- **Les listes de muscles et de matériel restent dans l'ordre du schéma**, pas alphabétique.
  `MUSCLE_GROUPS` suit l'anatomie (poussée, tirage, épaules, bras, jambes, gainage) et `EQUIPMENT`
  la fréquence d'usage. Trier par libellé français rangerait quadriceps et ischio-jambiers aux
  deux bouts de la feuille.
- **`NavIcons.tsx` est devenu `ui/icons.tsx`.** Un jeu d'icônes est un composant générique
  réutilisable : sa place est `ui/`. Un composant de `ui/` qui remonte chercher un glyphe dans
  `app/` serait une dépendance à l'envers. Trois tracés ajoutés sur la même grille : chevron bas,
  coche, plus.
- **`Card` et `ConfirmAction` sortent de l'écran de diagnostic vers `ui/`.** Ils y étaient locaux
  et servent maintenant quatre écrans. `ConfirmAction` prend un `confirmLabel` : le bouton de
  confirmation reprend le verbe du bouton qui l'a armé (« Supprimer » confirme « Supprimer »).
- **Un exercice du catalogue ne se modifie ni ne se supprime, mais ses notes et son repos, si.**
  C'est la ligne de partage retenue au Lot 2, écrite noir sur blanc dans l'interface.

### Le défaut trouvé en mesurant — les placeholders

Le placeholder du champ de recherche mesurait **2,02:1 en thème clair** et 3,44:1 en sombre. Ce
n'est pas un détail : le label du champ est en `sr-only`, donc **le placeholder est le seul nom
visible du contrôle principal de l'écran**.

Le Lot 1 rangeait les placeholders avec la « valeur précédente » du Lot 5 sous `--text-3`. Les deux
ne demandent pourtant pas la même chose : une valeur précédente est un **écho de donnée** qu'on
peut réutiliser, un placeholder est une **consigne qu'il faut lire**. Seule la première reste en
`--text-3`. Après correction : **6,49:1 en sombre, 6,09:1 en clair** (commit `ee1ac2c`).

**La règle du Lot 1 est donc amendée**, et `index.css` le dit maintenant explicitement.

### Le défaut trouvé par l'utilisateur — la fiche n'avait pas de sortie

Remonté au premier essai en ligne : « il n'y a pas de bouton pour valider l'exo, c'est pas très
ergonomique, car ça ne ferme pas la page de configuration ».

**C'est une contrainte du Lot 1 que j'avais laissée passer** : « les actions primaires en bas
d'écran, jamais en haut ». La fiche n'avait qu'une sortie, le lien « Exercices » en haut à droite —
le seul endroit d'un téléphone qu'une main seule n'atteint pas, et qui défile hors de l'écran dès
qu'on descend.

Deux choses ont été trouvées **en mesurant**, pas en regardant, et la première correction ne
suffisait pas :

1. Un bouton simplement placé en fin de flux tombait à **86 px sous la ligne de flottaison** sur un
   exercice fraîchement créé, et serait à un millier de pixels sur un exercice avec des mois
   d'historique. Il est donc **collant**, épinglé au-dessus de la barre de navigation. Vérifié :
   visible sans défiler (`top: 699` dans une fenêtre de 812) **et** une fois défilé tout en bas,
   avec 49 px de dégagement au-dessus — rien n'est masqué dessous.
2. **`navigate(-1)` ne faisait rien** après une création. La garde reposait sur
   `location.key === 'default'` ; or arriver ici par un `replace` forge une clé neuve tout en
   laissant l'index d'historique à 0. La clé disait donc « tu peux revenir » alors qu'il n'y avait
   rien à dépiler. La garde lit maintenant `window.history.state.idx`.

Le bouton dit **« Terminé »** et non « Enregistrer » : il n'y a rien à enregistrer, chaque frappe
est déjà en base. Il ramène là d'où on vient, donc **la recherche survit au trajet** — vérifié sur
les deux chemins (`?q=curl` et `?q=tirage+bulgare+xy`).

### Checkpoint Lot 3 — ✅ validé le 2026-07-22

Validé par l'utilisateur **sur le site déployé**, après la correction du bouton de sortie.

- [x] Tu cherches « squat » : tu trouves. Tu tapes « developpe » **sans accent** : tu trouves quand
      même.
- [x] Tu filtres sur « Haltères » : la liste se réduit et le relevé en haut à droite décompte.
- [x] Tu crées un exercice à toi, il apparaît dans la liste et survit à un rechargement complet.
- [x] Tu écris une note sur une machine (« siège position 4 »), tu quittes l'écran, tu reviens :
      elle est là.
- [x] Tu fais défiler les 168 exercices d'un coup de pouce : c'est fluide, sans à-coups.
- [x] Tu ouvres un exercice depuis une recherche puis tu reviens : **ta recherche est toujours là**.
- [x] Sur une fiche d'exercice, le bouton **Terminé** est toujours sous ton pouce, sans défiler, et
      il referme bien l'écran.

**Un seul défaut remonté sur tout le lot**, et c'était le bon : l'absence de sortie sur la fiche.
Corrigé, redéployé, revérifié.

---

## Lot 2 — Couche de données

### Definition of Done — vérifiée le 2026-07-21

- ✅ `npm run typecheck`, `npm run lint`, `npm run test:run` (**65 tests**), `npm run build`
  passent tous les quatre.
- ✅ **168 exercices** au catalogue. Un test vérifie la couverture des **18 groupes musculaires**,
  des **10 équipements** et des **6 types de mesure** — aucun trou.
- ✅ **Seed idempotent vérifié dans un vrai navigateur**, pas seulement en test : 168 → relance →
  168, message « Seed terminé. ».
- ✅ **Cycle complet vérifié** : 168 → *Réinitialiser la base* → 0 (état vide affiché) → *Relancer
  le seed* → 168. **Zéro erreur console.** `useLiveQuery` survit bien à `db.delete()` + `db.open()`,
  ce qui était le point risqué de l'écran.
- ✅ Contrastes **mesurés** sur l'écran de diagnostic, thème sombre **et** clair : toutes les paires
  texte/fond ≥ 4,5:1 (min. relevé 6,63:1). Un échec trouvé et corrigé, cf. ci-dessous.
- ✅ Mise en page mesurée en 375×812 : aucun débordement horizontal, 32 px de marge sous le dernier
  élément une fois défilé tout en bas. Cibles tactiles : boutons 48 px, ligne « Diagnostic » 90 px.

### Catalogue d'exercices — verdict de licence

> ⚠️ **Corrigé le 2026-07-22 — cette section affirmait plus que ce qui avait été vérifié.**
> Le contrôle a porté sur la **licence du dépôt** (Unlicense, confirmée deux fois via l'API
> GitHub), **pas sur la provenance des images qu'il contient**, que son README ne documente nulle
> part. La distinction n'est pas théorique : `hasaneyldrm/exercises-dataset` est sous MIT tout en
> contenant des images © Gym Visual qu'il n'a le droit de redistribuer que sous conditions. Un
> dépôt peut être libre et contenir des œuvres que le déposant n'avait pas le droit d'y mettre.
> **La phrase « sans aucune réserve » ci-dessous ne vaut donc que pour le JSON.**

`yuhonas/free-exercise-db` est sous **The Unlicense** (domaine public), vérifié via l'API GitHub.
**Juridiquement utilisable sans aucune réserve.** Il a quand même été **écarté**, pour deux raisons
qui n'ont rien à voir avec la licence :

1. Le jeu est **entièrement en anglais**. L'interface est en français (ADR-007). Traduire 800 noms
   d'exercices est un projet en soi, et un catalogue à moitié traduit est pire que pas de catalogue.
2. Les images sont référencées par **URL distante** — incompatible avec la règle non négociable
   n°2 (100 % hors-ligne, une salle = un sous-sol sans 4G).

**Option 2 retenue** : 168 exercices écrits à la main en français. Largement au-dessus des ~150
visés, et l'utilisateur peut créer les siens sans limite (RF-08).

### Décisions et écarts par rapport au plan

- **`getLastPerformance` ne suit pas le §5.1 de l'architecture à la lettre.** Le plan lit la
  dernière série de l'index puis filtre les supprimées. Conséquence **vérifiée en remettant le code
  du plan** : supprimer une séance mal saisie **vide** l'affichage de la valeur précédente au lieu
  de faire réapparaître la séance d'avant. L'implémentation retenue remonte l'index et s'arrête sur
  la première série vivante. Un test fige la différence — et il échoue bien avec la version du plan.
- **`MUSCLE_GROUPS` / `EQUIPMENT` / `MEASUREMENT_TYPES` sont des tableaux `const`**, les unions en
  sont dérivées. `exercises.json` n'est pas typé à la compilation : sans ça, une faute de frappe
  dans un `primaryMuscle` produit un exercice qu'**aucun filtre du Lot 3 ne trouvera jamais**, et
  rien dans la pile ne le signale. Un test valide chaque ligne du catalogue contre ces tableaux.
  Les chips de filtre du Lot 3 s'en serviront aussi.
- **`softDelete` prend une interface structurelle étroite**, pas un `EntityTable<T, 'id'>`. La
  fonction ne lit jamais `T`, et TypeScript ne sait pas prouver que `IDType<T, 'id'>` vaut `string`
  tant que `T` est un paramètre de type. Typer au plus juste évite un double cast.
- **`touch` prend `NoInfer` sur ses changements.** Sans ça, un appelant passant un type de
  changement plus étroit fait inférer `T` à `Syncable` et l'écriture est rejetée.
- **`addSet` dérive `exerciseId` et `workoutId` de la ligne parente** au lieu de les accepter de
  l'appelant : ils sont dénormalisés pour l'index, et une copie qui peut diverger de sa source est
  un bug en attente.
- **`createCustomExercise` n'attribue pas de slug** (le slug est la clé du catalogue) et
  **`updateExercise` interdit d'écrire les champs `Syncable`** — signatures plus strictes que celles
  du plan.
- **Un exercice du catalogue supprimé n'est pas ressuscité** par un seed suivant : il garde son
  slug. Supprimer un exercice qu'on ne fait jamais est une décision, pas un accident à annuler.
- **`\p{M}` au lieu de la plage `[U+0300-U+036F]` écrite littéralement** pour retirer les accents.
  Écrite en clair, cette plage est une suite de **caractères invisibles** qu'aucun relecteur ne voit
  et qu'un éditeur peut manger : le fichier a effectivement été écrit deux fois avant que ce soit
  repéré.
- **`SectionTitle` extrait dans `ui/`** (il était dupliqué dans Réglages), **`ChevronRightIcon`
  dessiné à la main** dans `NavIcons.tsx` plutôt qu'un caractère `›` emprunté à la police courante —
  §8 de l'architecture exclut les composants tiers, et le Lot 1 dessine déjà ses icônes.
- **Le quota de stockage est en `--text-2`, pas `--text-3`.** Mesuré : `--text-3` sur une carte en
  thème clair donne **2,33:1**, et 3,81:1 en sombre. `--text-3` reste réservé aux valeurs qui sont
  volontairement des échos (la valeur précédente du Lot 5, les placeholders) — un quota est un
  chiffre qu'on lit. **Trouvé en mesurant, pas en regardant**, encore une fois.
- **Sur l'écran de diagnostic, l'explication est au-dessus du bouton**, et à la confirmation
  « Annuler » est le bouton **rempli**, placé en premier. Les variantes `danger` et `ghost` sont
  toutes deux transparentes par charte : côte à côte, effacer la base ressemblait exactement à
  renoncer à l'effacer.

### Checkpoint Lot 2 — ✅ validé le 2026-07-21

**Validé sur PC**, pas sur téléphone : c'est équivalent ici (le Lot 2 ne livre aucune interaction
tactile), mais le Lot 3 devra bien être vérifié au doigt.

- [x] `npm run test:run` : 65 tests passent (le plan en annonçait ~20).
- [x] Sur `#/settings/debug` : **168** exercices, la liste s'affiche.
- [x] Navigateur entièrement fermé puis rouvert : les données sont toujours là.
- [x] Trois rechargements de suite : le nombre ne bouge pas.
- [x] *Réinitialiser la base* vide réellement la base, et le catalogue revient au rechargement
      suivant. Le bouton *Relancer le seed* a été vérifié côté agent : 168 → 168, sans doublon.

**Un point relevé par l'utilisateur pendant le checkpoint** : « si j'efface tout, les exos se
wipent, mais si je fais Ctrl+F5 ils reviennent ». Comportement **correct** — le seed tourne à chaque
démarrage — mais le message de l'écran **mentait** en laissant croire que le bouton était le seul
chemin de retour. Réécrit (commit `17ef1cf`). La bonne ligne de partage à retenir pour toute la
suite : **le catalogue appartient à l'app et revient toujours ; les séances et les exercices
personnalisés appartiennent à l'utilisateur et ne reviennent jamais.**

**Deuxième point relevé** : `GET /favicon.ico 404` à chaque chargement, réclamé à la racine du
domaine. Corrigé par une icône SVG inline de 305 octets (commit `5b6d7ca`) — pas cosmétique, ce
bruit permanent aurait masqué de vraies erreurs pendant les Lots 3 à 8.

---

## Lot 1 — Design system & coquille

### Definition of Done — vérifiée le 2026-07-21

- ✅ `npm run typecheck`, `npm run lint`, `npm run test:run` (11 tests), `npm run build` passent.
- ✅ Les 5 écrans répondent en mode hash, l'onglet actif porte `aria-current="page"`.
- ✅ Contrastes mesurés dans le navigateur, **thème sombre et thème clair** : chaque paire
      texte/fond de l'app est ≥ 4,5:1. Aucun échec.
- ✅ Cibles tactiles vérifiées en pixels réels : onglets 56 px, boutons ± 48×48, segments de
      thème 48 px.
- ✅ Vérifié en descendant tout en bas de Réglages sur un écran court (375×520) : rien n'est
      masqué par la barre de navigation, 32 px de marge restent sous le dernier élément.
- ✅ Saisie décimale vérifiée dans un vrai navigateur : `102,5` et `102.5` donnent tous deux
      102,5 ; les boutons ± affichent `102,5`.

### Décisions et écarts par rapport au plan

- **`--accent-ink` ajouté** (absent du plan). Le plan n'override pas l'accent en thème clair :
  `#c7f252` en **texte** sur blanc vaut **1,3:1**, invisible. D'où la scission
  **fill / ink** : `--color-accent` reste le vert acide et n'est jamais qu'un *remplissage*
  portant `--color-accent-fg` par-dessus ; `--accent-ink` est tout ce qui doit se lire *contre*
  une surface (texte, icônes, barre d'onglet actif, anneau de focus) et vaut `#46660a` en clair.
  **Trouvé en mesurant, pas en regardant** — la barre d'onglet actif était à 1,18:1.
- **`--text-3` n'est plus utilisé pour les micro-libellés.** `#a1a1aa` sur blanc = 2,3:1. Tous
  les libellés gravés (unités, titres de section) sont en `--text-2`. `--text-3` est réservé aux
  valeurs volontairement atténuées : la « valeur précédente » du Lot 5, les placeholders.
- **`@utility` au lieu de classes CSS nues** pour `tabular`, `safe-bottom`, `safe-top`. Une règle
  `.safe-bottom` hors couche bat silencieusement tous les `pb-*` avec lesquels on la combine.
- **`NumberInput` : resynchronisation pendant le rendu, pas dans un `useEffect`.**
  `react-hooks` v7 (installé ici) interdit `setState` synchrone dans un effet
  (`set-state-in-effect`) et l'accès aux refs pendant le rendu (`refs`) — les deux snippets du
  plan échouent au lint. Motif React officiel « ajuster un état quand une prop change ». Même
  comportement, une frame de moins. **L'état `draft` — le vrai garde-fou — est intact.**
- **`NumberInput` affiche la virgule pour les valeurs venues de l'extérieur.** Après `+2,5` le
  plan affichait `102.5` (point) alors que la frappe clavier donne `102,5`. Le séparateur
  décimal est du texte d'interface, et l'interface est en français. **Une assertion du plan a été
  changée** en conséquence (`toHaveValue('102,5')`), et un test a été ajouté pour figer le fait
  qu'on **ne réécrit jamais ce que l'utilisateur vient de taper**.
- **Barre de navigation en frère flex, pas en `position: fixed`.** Elle est épinglée en bas de la
  même façon, mais aucun écran ne peut plus cacher sa dernière ligne derrière elle — le bug que
  l'étape 4.4 du plan signale devient structurellement impossible.
- **`#root { height: 100dvh }`** en plus du `height: 100%` du plan : avec `100%`, la barre
  d'URL rétractable des navigateurs mobiles laisse la barre de navigation sous le chrome.
- **Script bloquant dans `index.html`** pour poser `data-theme` avant le premier rendu. Le module
  principal est différé : sans lui, un utilisateur en thème clair voit un flash noir à chaque
  démarrage. `applyTheme` met aussi à jour `<meta name="theme-color">`.
- **`Screen.tsx` ajouté** (hors plan) : cadre commun h1 + gouttières + `max-w-[36rem]`, pour
  qu'aucun écran ne redérive ses marges.
- **Icônes dessinées à la main**, pas de librairie : §8 de l'architecture exclut les composants
  UI tiers, et le vocabulaire de la salle (barre, disque, curseurs de charge) est plus juste
  qu'un jeu générique. Zéro dépendance ajoutée.
- **Tâche 5 (i18n) faite avant la tâche 4 (écrans)** : écrire les écrans puis remplacer les
  chaînes en dur aurait été deux fois le travail.

### Parti pris visuel (à respecter dans les lots suivants)

Le plan fixe la palette. Les axes qu'il laissait libres ont été tranchés ainsi :

- **Deux registres typographiques, pas trois.** Cette app n'a presque pas de prose. Le couple
  n'est donc pas « display / texte courant » mais **chiffres tabulaires** (`.metric`, serrés à
  −0,03em) **vs micro-libellés gravés** (`.label-xs` : 11 px, capitales, +0,12em). Le texte
  courant est l'exception. **Exception à `.label-xs` : jamais sur un symbole SI** — c'est `kg`,
  pas `KG`.
- **L'état vide est un relevé à zéro**, pas un échec. `EmptyState` affiche le compteur de la
  collection (`0` + unité) dans exactement la typo qu'il aura une fois plein. Le type l'impose :
  une collection fournit `reading` + `unit`, tout le reste fournit `title`.
- **Mouvement mécanique** : une courbe (`--ease-mech`), deux durées (`--dur-1`, `--dur-2`), et
  seulement deux usages (barre d'onglet actif, montée du Sheet). Rien d'élastique, rien d'autre
  n'est animé. `prefers-reduced-motion` neutralise tout.

### Checkpoint Lot 1 — ✅ validé le 2026-07-21

- [x] Les 5 onglets du bas fonctionnent, l'onglet actif est visuellement évident.
- [x] Ça ressemble à une application : pas de zoom au double-tap, pas de rebond
      « pull to refresh », les cibles se touchent sans viser.
- [x] La bascule clair/sombre (Réglages → Apparence) marche et survit à un rechargement.
- [x] Tu descends tout en bas d'un écran : rien n'est caché derrière la barre de navigation.
- [x] Réglages → Saisie : tu tapes `102,5`, la virgule reste affichée et « valeur retenue »
      indique bien 102,5 kg.

Validé par l'utilisateur sur téléphone. **La charte visuelle et les primitives sont donc figées :
les lots suivants s'appuient dessus au lieu de les redécider.** La section « parti pris visuel »
ci-dessus fait foi.

---

## Lot 0 — Bootstrap & déploiement

### Definition of Done du Lot 0 — vérifiée le 2026-07-21

- ✅ `npm run typecheck`, `npm run test:run` (1 test), `npm run build`, `npm run lint` passent en local.
- ✅ Le workflow passe sur le runner Ubuntu : `npm ci`, typecheck, tests, build, `configure-pages`,
  `upload-pages-artifact`, `deploy-pages` — tous verts (run #2 après correctif de branche).
- ✅ `https://hugo-burnet.github.io/FITTRACK-RELOADED/` répond **HTTP 200**, les deux assets
  (`index-*.js` 190 793 o, `index-*.css` 10 751 o) répondent **200** — donc `base` est correct,
  pas de 404 sur `assets/`.
- ✅ Rendu réel vérifié dans un navigateur : React monté, `<h1>FitTrack</h1>`, fond
  `oklch(0.145 0 none)` (Tailwind v4 compile bien).
- ✅ Les versions d'actions du plan (`checkout@v4`, `setup-node@v4`, `configure-pages@v5`,
  `upload-pages-artifact@v3`, `deploy-pages@v4`) sont acceptées telles quelles, aucune obsolescence.

### Checkpoint Lot 0 — ✅ validé le 2026-07-21

- [x] L'URL s'ouvre et affiche « FitTrack » sur fond sombre (vérifié par l'utilisateur).
- [x] Modifier un texte de `src/App.tsx` → pousser → site à jour. Mesuré : **~40 s** entre le push
      et la fin du job `deploy`. Le hash du bundle change bien
      (`index-8UZIjSV8.js` → `index-Bvk5C3d_.js`), donc c'est un vrai redéploiement.

## Avancement

| Lot | Titre | État | Session(s) | Checkpoint validé |
|-----|-------|------|-----------|-------------------|
| 0 | Bootstrap & déploiement | ✅ terminé | 1 | ✅ |
| 1 | Design system & coquille | ✅ terminé | 2 | ✅ |
| 2 | Couche de données | ✅ terminé | 3 | ✅ |
| 3 | Bibliothèque d'exercices | ✅ terminé | 4 | ✅ |
| 4 | Routines | ✅ terminé | 5 | ✅ |
| 5 | Séance en direct (cœur) | ✅ terminé | 6 | ✅ **en salle** |
| 5bis | Schéma musculaire | ✅ terminé | 2026-08-11 | ✅ 2026-08-12 |
| 6 | Outils de séance | ✅ terminé | 6–7 | ✅ **en salle** |
| 7 | Historique & calendrier | ✅ terminé | 07A–07C | ✅ 2026-08-12 |
| 8 | Réglages & export/import | ✅ terminé | — | ✅ 2026-08-12 |
| 9 | PWA & installation | ✅ terminé | 2026-08-02 | ✅ 2026-08-12 |
| 10 | Android (Capacitor) | ✅ terminé | 2026-08-09 | ✅ 2026-08-12 |
| 11 | Mesures & photos | 🟨 en cours | — | ⬜ |
| 12 | Statistiques | 🟨 en cours | 2026-08-11 | ✅ 2026-08-12 (courbe en attente d'historique) |
| 13 | Records & notifications | 🟨 en cours | 2026-08-11 | ✅ 2026-08-12 |
| 14 | Sync cloud (optionnel) | ⬜ à faire | — | ⬜ |
| 15 | Health Connect | ⬜ à faire | — | ⬜ |
| 16 | Widgets | ⬜ à faire | — | ⬜ |
| 17 | Périodisation | 🟨 en cours | 2026-08-13 | 🟨 checkpoint téléphone |
| 18 | Auto-progression | 🟨 en cours | 2026-08-11 → 08-12 | 🟨 **partiel** (carte en séance à revoir) |
| 19 | Assistant IA | ⬜ à faire | — | ⬜ |
| 20 | Voix & accessibilité | ⬜ à faire | — | ⬜ |

Légende : ⬜ à faire · 🟨 en cours · ✅ terminé · ⏭️ sauté

> **Reprise du 2026-08-11.** Le tableau était en retard de trois lots entiers : 7, 8 et 12
> étaient marqués « à faire » alors que le code les contient. La colonne **État** est désormais
> établie à la lecture du code ; la colonne **Checkpoint** ne l'est pas et ne peut pas l'être —
> **seul l'utilisateur valide un checkpoint**, donc les lots dont le code est là mais dont la
> validation n'a jamais été consignée portent « à confirmer » plutôt qu'un ✅ deviné. C'est le
> raisonnement posé au Lot 9, appliqué cette fois sans laisser l'État en souffrance avec.

### Les trois lots partiels, et ce qui leur manque exactement

- **Lot 11 — Mesures & photos.** Livré : le poids de corps (`bodyMeasurements`,
  `HomeBodyWeightCard`, `resolveBodyWeightsAt` pour la tonnage au poids de corps). Manquant :
  **toute autre mesure** (tour de taille, masse grasse…) alors que `BodyMeasurement.type` est
  une chaîne libre qui les accepte déjà, et **les photos de progression** — `progressPhotos` et
  `photoBlobs` sont dans le schéma depuis le Lot 2 et **aucun code ne les écrit**.
- **Lot 12 — Statistiques.** Livré : progression par exercice (RF-41), volume hebdomadaire et
  répartition des séries par groupe musculaire (RF-42), séances par semaine, le **1RM estimé
  (RF-46)** — formule configurable en réglages, traçable comme métrique et filtrable dans le rail
  des records — et la **carte de chaleur musculaire (RF-43)**, rendue par le schéma du Lot 5bis
  sur l'écran d'équilibre. Manquant, vérifié dans le code : le **rapport mensuel (RF-44)** —
  `PERIOD_KEYS` ne connaît que des fenêtres en semaines — et l'**export PNG d'un graphique**.
- **Lot 13 — Records & notifications.** Livré le 2026-08-11 : les records sont **persistés**
  dans `personalRecords`, écrits dans la même transaction que la série, réconciliés à chaque
  mutation, avec une page « mes records » filtrable par exercice et par type, un rail de
  progression, et une réparation manuelle idempotente. Manquant : les **rappels d'entraînement
  programmables (RF-53)** — `nativeNotifications` ne planifie que la fin du repos — et la
  **notification système quand un record tombe**, la détection restant à l'écran.

## Décisions prises en cours de route

_(Toute décision qui contredit ou complète `docs/plans/01-ARCHITECTURE.md` est consignée ici,
avec la date et la raison.)_

### 2026-08-11 — Les muscles secondaires entrent dans l'instantané (`version(4)`)

**Ce qui change.** `WorkoutExercise` gagne `exerciseSecondaryMuscles?: MuscleGroup[]`, écrit par
`snapshotOf` et rattrapé par une migration `version(4)` sans `.stores()` — le champ n'est pas
indexé, donc le schéma est inchangé, exactement comme `version(2)`.

**Pourquoi ça ne rouvre pas 08B, contrairement à ce que j'avais annoncé.** 08B interdit de lire
la bibliothèque **au moment de l'affichage** pour interpréter une séance passée : c'est ainsi
que la même séance s'est retrouvée avec deux noms sur un même écran, l'export lisant
l'instantané et l'historique la bibliothèque. Écrire la bibliothèque d'aujourd'hui **une fois**
dans l'instantané fait l'inverse : à partir de là, la ligne répond d'elle-même et ne dépend plus
du catalogue. C'est le marché que `version(2)` a déjà fait et documenté.

**Le seul cas ambigu, et comment il est tranché.** Une ligne instantanée qui ne porte aucun
secondaire est soit antérieure au champ, soit celle d'un exercice qui n'en a réellement aucun.
Impossible de distinguer les deux. `resolveExerciseIdentity` ne retombe donc sur la bibliothèque
que si la ligne **n'a aucun instantané du tout** — emprunter les secondaires d'aujourd'hui à une
ligne déjà instantanée serait la réécriture que 08B interdit. Un test garde ce comportement.

**Ce qui ne change pas : les chiffres.** `muscleBalance` continue de ne compter que le muscle
principal. Son argument tient et n'est pas rouvert : « 48 » doit rester un nombre de séries
qu'on peut recompter dans l'historique, et une attribution pondérée en ferait un score qu'on ne
peut que croire. Seul le **dessin** est pondéré — il ne se lit pas, il se regarde, et un
développé couché qui laisse les triceps éteints est faux à ce qu'on a senti. D'où deux
vocabulaires distincts : `MuscleCount.sets` pour ce qui se compte, `MuscleInvolvement.value`
pour ce qui se dessine.

### 2026-08-11 — Les photos de progression sont reportées, pas abandonnées

**Décision de l'utilisateur.** Le Lot 11 est scindé : les **mesures corporelles** restent au
programme, les **photos** sortent du périmètre courant. Le verrouillage biométrique de la section
sort avec elles — il n'existe que pour les protéger.

**Pourquoi elles étaient le mauvais candidat au regroupement.** Les trois autres chantiers courts
(records persistés, 1RM estimé, mesures corporelles) sont dans du code déjà construit : les règles,
le schéma et les repositories existent, il manque du câblage. Les photos, non — elles ouvrent trois
fronts neufs à elles seules :

1. **une dépendance native** — `@capacitor/camera` n'est pas installé ; permissions Android,
   manifeste, rebuild de l'APK, et un checkpoint qui ne peut être validé **que** sur le téléphone ;
2. **du binaire en base** — blobs, vignettes, visionneuse, pression mémoire : aucun code partagé
   avec le reste du lot ;
3. **la réouverture du format d'export du Lot 8** — l'export JSON ne contient aujourd'hui aucun
   binaire. Avec des photos, soit il gonfle de plusieurs mégaoctets, soit on les exclut et l'export
   cesse d'être complet. Le roadmap avait déjà tranché (« pas dans l'export par défaut, case à
   cocher séparée »), mais c'est du travail de conception, pas une ligne de code.

**À rouvrir** quand le besoin se fait sentir, ou avec le Lot 15 (Health Connect) qui rouvre de
toute façon les permissions Android. Rien n'est à défaire d'ici là : `progressPhotos` et
`photoBlobs` restent dans le schéma, inutilisées, comme depuis le Lot 2.

### 2026-07-22 — RF-06 n'était pas complet, et le roadmap prétendait le contraire

Question posée par l'utilisateur : « des schémas d'exo comme dans Hevy, avec un mouvement + le
muscle ciblé, c'est prévu ? » Réponse après vérification : **non, et c'était un trou non consigné**.

RF-06 demande « nom, groupe musculaire principal, groupes secondaires, équipement, type de mesure,
**image ou démonstration animée** ». Le Lot 2 a écarté `free-exercise-db` pour deux bonnes raisons
(noms anglais, images en URL distante), mais **la conséquence n'a jamais été écrite** : le champ
`imageUrl` a été déclaré dans `types.ts` puis oublié — rien ne le remplit, rien ne l'affiche — et le
tableau de couverture du roadmap annonçait « M2 Exercices : complète ».

**La demande contient deux choses de coûts incomparables**, et les séparer est toute la décision :

- **Le muscle ciblé** : la donnée existe déjà sur chaque exercice depuis le Lot 2. Il ne manque
  qu'un dessin. Aucune dépendance, aucun octet réseau, et **le même composant est la carte de
  chaleur du Lot 12** (RF-43) à une prop près. → **Lot 5bis créé**, après le Lot 5.
- **L'illustration du mouvement** : 336 images à sourcer et à apparier à la main, un poids de
  bundle qui menace la règle du hors-ligne. Problème d'approvisionnement, pas de développement.
  → **Explicitement hors périmètre**, consigné comme tel dans le roadmap.

**Numéroté 5bis et non inséré par renumérotation** : décaler les Lots 6 à 20 invaliderait chaque
référence croisée déjà écrite dans ce fichier, dans les plans et dans les messages de commit. Un
numéro laid coûte moins cher qu'une renumérotation.

**Placé après le Lot 5, pas avant** : l'app ne sait toujours pas enregistrer une série. De la
finition avant la fonction, c'est le meilleur moyen d'avoir une belle app qu'on n'utilise pas.

**Révision du même jour, après enquête sur les sources.** L'utilisateur a contesté le « dessiné à
la main » — à raison, deux fois :

- **La carte musculaire ne sera pas dessinée.** `vulovix/body-muscles` (Apache-2.0, SVG,
  70+ régions, zéro dépendance) fournit une anatomie crédible. On reprend la géométrie, on la
  ré-indexe sur nos `MuscleGroup`, on la restyle avec nos jetons, et **on porte l'attribution**.
  Reprendre la géométrie et non le composant reste compatible avec le §8.
- **Les animations de mouvement ne sont pas introuvables : elles sont vendues.** Le jeu qu'on
  reconnaît dans Hevy vient de Gym Visual, ~150 $ pour nos 168 exercices. Le dataset GitHub à
  16 400 ★ qui les héberge est MIT **sur les données seulement** ; les images restent © Gym Visual.
  **Décision de l'utilisateur : pas d'achat.** Tableau complet dans `00-ROADMAP.md`.

**Et « c'est juste pour moi » ne change rien tant que le dépôt est public** — vérifié :
`"visibility": "public"`, site à HTTP 200 pour n'importe qui. Tout ce qui est commité est
redistribué, quelle que soit l'intention. C'est la règle non négociable n°3 (« le code est déployé
sur un site statique public ») appliquée aux images au lieu des clés d'API. À rouvrir seulement si
le dépôt passe en privé.

### 2026-07-21 — Lot 0

- **Le dépôt s'appelle `FITTRACK-RELOADED`, pas `fittrack`.** Le remote existait déjà
  (`hugo-burnet/FITTRACK-RELOADED`, public, vide). Conséquence :
  `base: '/FITTRACK-RELOADED/'` dans `vite.config.ts`. C'est le **seul** endroit où le nom
  apparaît. Si le dépôt est un jour renommé, c'est la seule ligne à changer — et une erreur ici
  produit une page blanche avec des 404 sur `assets/`.
- **Alias `@` : `fileURLToPath`, pas `.pathname`.** Le snippet du plan
  (`new URL('./src', import.meta.url).pathname`) est cassé sous Windows : il produit
  `/C:/Users/.../FITTRACK%20RELOADED/src` — préfixe `/C:` invalide **et** espace encodé en `%20`
  à cause de l'espace dans le nom du dossier. `fileURLToPath()` règle les deux. Nécessite
  `@types/node` (ajouté en devDep et dans `types` du tsconfig).
- **`baseUrl` supprimé du tsconfig.** TypeScript 6 le refuse (`TS5101: deprecated`). Depuis TS 5,
  `paths` se résout relativement à l'emplacement du `tsconfig.json` — `baseUrl` est inutile.
- **`src/vite-env.d.ts` ajouté** (absent du plan). Sans lui, TS 6 rejette l'import à effet de bord
  `import './index.css'` dans `main.tsx` (`TS2882`).
- **`tsconfig.node.json` non créé.** Listé dans les fichiers de la Tâche 1 mais jamais spécifié, et
  inutile ici : `vite.config.ts` est directement dans le `include` du tsconfig principal.
- **ESLint + Prettier ajoutés.** Livrable annoncé du Lot 0 dans `00-ROADMAP.md` et commande
  documentée dans `CLAUDE.md`, mais absents du plan détaillé. Config plate
  (`eslint.config.js`) avec `typescript-eslint`, `react-hooks`, `react-refresh`, et
  `@typescript-eslint/no-explicit-any: error` pour tenir la règle « pas de `any` ».
  **`npm run lint` n'est volontairement pas dans le workflow CI** : le plan ne fait bloquer le
  déploiement que sur le typecheck et les tests. Un warning de style ne doit pas empêcher une mise
  en ligne.
- **`*.tsbuildinfo` ajouté au `.gitignore`** : `tsc -b` le génère à la racine.

**Versions réellement installées** (le plan ne les fixe pas ; à connaître si un comportement
diverge de la doc) : Vite **8.1.5**, Vitest **4.1.10**, Tailwind **4.3.3** (bien la v4, plugin Vite,
sans `tailwind.config.js`), React **19.2.8**, TypeScript **6.0.3**, Node 24.18. Les versions
d'actions GitHub du plan (`checkout@v4`, `setup-node@v4`, `configure-pages@v5`,
`upload-pages-artifact@v3`, `deploy-pages@v4`) ont été gardées telles quelles — non encore
vérifiées à l'exécution.

## Pièges rencontrés / à ne pas refaire

_(Ce que la prochaine session doit savoir pour ne pas perdre du temps.)_

- **`github-pages` était verrouillé sur la branche `main` alors qu'on travaille sur `master`.**
  Symptôme : le job `build` est **entièrement vert**, le job `deploy` échoue en **1 seconde avec
  0 étape exécutée**. Ce n'est ni le `base`, ni les permissions, ni les versions d'actions — c'est
  une *deployment branch policy* sur l'environnement. Cause : Pages a été activé alors que le dépôt
  était encore vide, donc GitHub a créé l'environnement épinglé sur son nom de branche par défaut
  (`main`), qui n'existe pas ici. Correctif : Settings → Environments → `github-pages` →
  *Deployment branches and tags* → remplacer `main` par `master`.
  **Pour les prochains projets : pousser `master` d'abord, activer Pages ensuite.**
- **Le push SSH ne marche pas sur cette machine** : `Host key verification failed`. Contourné en
  passant le remote en HTTPS (`git remote set-url origin https://github.com/hugo-burnet/FITTRACK-RELOADED.git`).
  Git Credential Manager exige une fenêtre interactive : le push ne part que si la commande est
  lancée avec `GIT_TERMINAL_PROMPT=1` et `credential.interactive=true`. Les identifiants sont
  maintenant mémorisés par GCM.
- **Le serveur de dev n'est pas sur `/`** mais sur `http://localhost:5173/FITTRACK-RELOADED/`,
  à cause du `base`. Ouvrir la racine donne une 404 — ce n'est pas un bug.
- **Après un déploiement, le navigateur sert un `index.html` périmé** pendant quelques minutes
  (cache HTTP de GitHub Pages). Constaté pendant le test de la boucle : le fetch direct renvoyait
  déjà le nouveau bundle alors que l'onglet affichait encore l'ancien. Un `Ctrl+Shift+R` ou un
  `?cachebust=1` suffit. Ce n'est pas un bug **mais c'est exactement le problème que le Lot 9
  devra traiter** : les assets sont hashés donc sûrs, c'est `index.html` qui est le point faible.
  Raison de plus pour `registerType: 'prompt'` et l'écran « nouvelle version disponible ».
- **Le chemin du projet contient un espace** (`FITTRACK RELOADED`). Tout code qui manipule des
  chemins doit passer par `fileURLToPath` / `path.join`, jamais par de la concaténation de chaînes
  ou `URL.pathname`.
- **TypeScript 6 est nettement plus strict que ce que supposent les plans** (`baseUrl` déprécié,
  imports à effet de bord typés). Si un snippet de plan écrit avant cette session ne compile pas,
  regarder d'abord de ce côté avant de le réécrire.
- **`eslint-plugin-react-hooks` v7 rejette deux motifs très présents dans les plans** :
  `setState` synchrone dans un `useEffect` (`react-hooks/set-state-in-effect`) et lecture d'un
  `ref.current` pendant le rendu (`react-hooks/refs`). Ce ne sont pas des avertissements de
  style, ce sont des `error` qui font échouer `npm run lint`. Le remplacement est toujours le
  même : ajuster l'état **pendant le rendu** derrière un `if (prop !== lastProp)`, ou passer le
  ref en `useState` s'il pilote l'affichage.
- **Un commentaire JSX `{/* … */}` ne peut pas être placé entre `{cond && (` et l'élément.**
  Dans cette position `{}` est un littéral objet, pas un commentaire, et le fichier ne compile
  plus. Le commentaire va **au-dessus** de la ligne `{cond && (`. (`// …` juste après `return (`
  est en revanche parfaitement valide.)
- **Le cache de dépendances de Vite survit mal à l'ajout d'un gros paquet.** Après le premier
  import de `react-router-dom`, la page a servi trois pré-bundles de hash `?v=` différents →
  deux copies de React → « Invalid hook call » sur `RouterProvider`. `npm ls react` confirmait
  pourtant une seule version dédupliquée. `rm -rf node_modules/.vite` puis redémarrage du
  serveur suffit. **Ne pas chercher le bug dans le code.**
- **Dans DevTools, la base s'appelle `fittrack` en version `10`, pas `1`.** Dexie multiplie le
  numéro de `version(n)` par 10 en interne pour pouvoir intercaler des versions plus tard. Ce n'est
  pas un schéma parti en vrille — ne pas « corriger » ça.
- **Réinitialiser la base ne fait pas disparaître le catalogue durablement**, et c'est voulu : le
  seed tourne à chaque démarrage, donc un simple rechargement réinstalle les 168 exercices. Seules
  les données de l'utilisateur (séances, routines, exercices personnalisés) sont réellement perdues.
  Le message de l'écran a dû être réécrit : il laissait croire que le bouton « Relancer le seed »
  était le seul chemin de retour.
- **`git commit -m` avec un here-string PowerShell casse si le message contient des guillemets
  doubles.** Le here-string est pourtant littéral côté PowerShell, mais l'exécutable `git` reparse
  ses arguments à la mode Windows et coupe le message au premier `"` : le symptôme est une pluie de
  `error: pathspec '...' did not match any file(s)`. **Écrire le message dans un fichier et faire
  `git commit -F fichier`.** C'est la seule forme fiable ici, d'autant que les messages sont en
  français avec des apostrophes typographiques.
- **PowerShell et Bash partagent le répertoire courant dans cette session.** Un `cd` fait depuis
  l'outil Bash déplace aussi l'outil PowerShell — un `npm run typecheck` a fini par échouer en
  `Missing script` parce qu'il tournait dans `node_modules/dexie/dist`. Préfixer les commandes
  longues d'un `Set-Location` sur la racine du projet.
- **`useLiveQuery` ne distingue pas « pas encore répondu » de « rien trouvé » : les deux valent
  `undefined`.** Sur un écran de détail, le résultat est un « cet exercice n'existe plus » qui
  clignote à chaque ouverture. Le contournement tient en une ligne :
  `useLiveQuery(async () => (await getExercise(id)) ?? null)` — `null` veut dire absent,
  `undefined` veut dire en cours. Même piège pour une liste : afficher l'état vide sur `undefined`
  fait clignoter « rien ne correspond » à chaque frappe.
- **Vite ignore la variable `PORT`.** Quand le port 5173 est déjà pris (une autre session Claude
  Code dans le même dossier), Vite prend 5174 tout seul, alors que l'outil de prévisualisation
  croit le serveur sur le port qu'il a attribué. Symptôme : « navigation denied or failed » sur un
  port où personne n'écoute. Lire le port réel dans les logs du serveur et naviguer dessus à la
  main. L'onglet peut être ramené de force sur le mauvais port entre deux appels — refaire la
  navigation avant chaque script.
- **Vérifier un champ, c'est vérifier le focus, pas seulement la valeur.** Le bug le plus grave du
  Lot 4 — le clavier qui se fermait à la première frappe, rendant `102,5` impossible à saisir — est
  passé sous mes vérifications parce que je posais les valeurs par `dispatchEvent` sans jamais lire
  `document.activeElement`. **Une écriture programmatique ne perd pas le focus comme un doigt.**
  Tout contrôle de saisie doit désormais assurer trois choses : la valeur, `document.activeElement`,
  et `selectionStart`.
- **Un effet React qui dépend d'un `onClose` passé en flèche inline se rejoue à chaque rendu du
  parent.** Inoffensif d'ordinaire ; destructeur quand l'effet appelle `focus()`, `scrollTo()` ou
  ouvre quelque chose. Deux bugs du Lot 4 viennent de là (`Sheet` volait le focus ; `ActionSheet`
  effaçait la feuille qu'une action venait d'ouvrir). **Un effet qui prend le focus ne doit dépendre
  que de `open`.**
- **Différer une fonctionnalité « faute de budget » sans le dire à l'utilisateur, c'est décider à sa
  place.** J'avais écarté le glisser-déposer des routines dans les dossiers ; c'est le deuxième
  retour qu'il a fait. Annoncer les renoncements **dans le résumé de fin de lot**, pas seulement
  dans le plan qu'il ne relira pas.
- **Un contournement écrit en silence est un bug qu'on s'interdit de voir.** En écrivant les modèles
  de routine, j'ai constaté que `RoutineSet` n'avait pas de champ de durée — et j'ai **évité les
  exercices chronométrés dans les modèles** au lieu de le signaler. Le trou est resté entier
  jusqu'à ce que l'utilisateur le trouve. Quand une donnée manque pour écrire un jeu de test,
  **c'est le schéma qu'il faut interroger, pas le jeu de test qu'il faut rétrécir.**
- **Un champ déclaré et lu par personne ne se voit qu'à l'usage.** `measurementType` existait depuis
  le Lot 2 sur 168 exercices et n'était consommé par **aucun** écran hors du formulaire de création.
  Rien ne le signale : ni le typecheck, ni les tests, ni le lint. Contrôle à faire en fin de lot —
  **lister les champs du §4 de l'architecture qu'aucun écran ne lit encore**, et dire lesquels sont
  en attente d'un lot et lesquels sont oubliés.
- **Le panneau navigateur ne compose jamais : `requestAnimationFrame` ne se déclenche pas et les
  transitions CSS ne démarrent pas.** Mesuré au Lot 4 : `0 frame en 1 s`,
  `document.visibilityState === 'hidden'`. Conséquences vues en vrai — une boucle `rAF` (défilement
  automatique du drag) ne tourne pas du tout, et un `getComputedStyle` sur une propriété en
  transition renvoie la valeur **de départ**, indéfiniment. Les deux ressemblent trait pour trait à
  des bugs du code. **Avant de « corriger » quoi que ce soit qui dépende d'une frame, vérifier
  `visibilityState` et compter les frames.** Pour trancher sur une transition :
  `element.style.transition = 'none'` puis relire — si la valeur saute, le CSS était juste.
  Corollaire de méthode : ce qui ne peut pas être exercé dans ce panneau doit être extrait en
  fonction pure et testé unitairement, sinon c'est la seule partie du code sans aucune vérification.
- **Les feuilles empilées ne se démontent pas ici** (le `transitionend` de `Sheet` n'arrive jamais).
  `document.querySelector('[role=dialog]')` renvoie donc la feuille **précédente**, encore dans le
  DOM. Viser `document.querySelectorAll('[role=dialog]')` **et prendre la dernière**.
- **`textContent` ignore `text-transform`.** Les libellés en `.label-xs` s'affichent en capitales
  mais `textContent` rend « reps », pas « REPS » (`innerText`, lui, rend les capitales). Un sélecteur
  de test qui cherche « REPS » ne trouve rien.
- **Les captures d'écran du panneau navigateur ont encore expiré** (30 s, systématiquement), alors
  que `javascript_tool` répondait normalement. Contournement confirmé et suffisant : tout vérifier
  par JS — `element.click()` pour les interactions, `getBoundingClientRect()` pour la mise en page,
  et un calcul de ratio de contraste maison sur les styles calculés. Ouvrir un onglet neuf **n'a pas
  suffi** cette fois.
- **Mesurer la boîte d'un bouton, ce n'est pas mesurer son libellé.** « Démarrer la séance »
  passait à la ligne **dans** son bouton ; j'avais relevé `168x56` et conclu que tout allait. La
  hauteur valait 56 parce que `min-h-14` vaut 56, et le texte cassait à l'intérieur. Le contrôle
  qui manquait tient en trois lignes — un `Range` sur le nœud de texte, `getClientRects().length`
  > 1 — et il doit accompagner tout relevé de cible tactile. C'est la même famille d'erreur que
  « vérifier la valeur d'un champ sans vérifier son focus ».
- **Ne jamais inventer un composant visuel : la charte est figée depuis le Lot 1.** Le Lot 5 a
  posé une boîte en pointillés pour « Ajouter un exercice ». `border-dashed` n'existait **nulle
  part ailleurs** dans le dépôt — toutes les surfaces d'ici sont pleines et sans bordure, donc un
  contour vide se lit comme un emplacement à remplir. Deux « + » cohabitaient sur le même écran
  en deux langues. Réflexe à prendre : **avant de dessiner une commande, chercher le geste qui
  fait déjà ce travail ailleurs** (`grep` sur la classe ou l'icône) et le nommer dans `ui/` s'il
  est dupliqué. Deux motifs l'étaient déjà — `AddRow` et `HeaderAction` — et c'est justement
  parce qu'ils n'avaient pas de nom que j'en ai inventé un troisième.
- **Avant d'ajouter une commande, chercher celle qui fait déjà ce travail.** Trois défauts du
  retour sur les boutons sont le même : un contrôle en double. « Terminé » doublait la flèche de
  l'en-tête ; « Reprendre » doublait la barre de reprise ; « Partir d'une routine » doublait
  l'onglet Routines. Aucun n'a été ajouté par étourderie — chacun avait une bonne raison **au
  moment où il a été écrit**, et la raison a disparu ensuite sans que le bouton parte avec elle.
  Contrôle à faire en fin de lot : **lister les commandes qui appellent la même chose**, et
  vérifier que chaque écran n'a qu'une action primaire.
- **Une règle de charte survit à la raison qui l'a fait naître.** « La vraie sortie vit dans la
  zone du pouce » (Lot 3) a été écrite quand une fiche n'avait pour seule sortie qu'un mot en haut
  à droite. La flèche du Lot 4 a supprimé le problème ; la règle est restée et a continué de
  produire des boutons « Terminé » pendant deux lots. **Quand un lot corrige la cause, relire les
  règles que cette cause avait justifiées.**
- **Un relevé n'est pas une commande, et l'inverse non plus.** Le chronomètre de la séance
  occupait le coin haut-droit — la place que tous les autres écrans réservent à une icône
  d'action — et cachait le seul accès à « Renommer » et « Notes ». En prime il était en
  `--accent-ink`, qui dans cette charte veut dire *engagé* : une horloge en vert accent se lit
  comme un témoin d'état. Les relevés descendent **au-dessus de la liste qu'ils comptent**
  (règle posée au Lot 4) ; le coin haut-droit est aux actions.
- **Du code que rien n'exerce n'est pas du code qui marche.** Les quatre défauts du Lot 5 étaient
  dans du code écrit et *testé* au Lot 2 — `getLastPerformance` avait sept tests verts. Ils
  décrivaient tous un historique **déjà clos** ; aucun ne mettait une séance en cours et un passé
  dans la même base, parce qu'aucun écran ne savait encore créer une séance en cours. **Quand un
  lot livre les premières écritures d'une table, relire les lectures qui existaient déjà** — leurs
  tests prouvent ce qu'on savait faire, pas ce qui va arriver.
- **Un jeton de charte réservé à un usage futur est un jeton dont personne n'a vérifié l'usage.**
  Le Lot 1 gardait `--text-3` pour « la valeur précédente du Lot 5 », en la supposant décorative.
  Arrivé au Lot 5, cette valeur s'est révélée être **ce que la coche enregistre** — le nombre le
  plus lourd de conséquence de l'écran — et `--text-3` y mesurait 2,02:1. Un usage écrit à l'avance
  décrit une intention, pas un besoin ; le besoin ne se connaît qu'à l'écran.
- **Un emplacement d'affichage qui porte deux contrats finit par mentir sur l'un des deux.** Le
  fantôme du champ de saisie veut dire partout « la coche enregistre ça ». Sur une série prescrite
  en fourchette il voulait dire « regarde, mais la coche ne prend rien » — même position, même
  gris, deux sens. Le défaut **signalé** était la largeur : « 8 – 12 » ne rentre pas dans une case
  taillée pour deux chiffres, et « 12 – 20 » se faisait couper **des deux côtés**, donc se lisait
  « 2 – 2 ». Le défaut **trouvé en creusant** était une perte de données : la coche validait une
  série sans aucune répétition. Élargir la case aurait réparé le symptôme signalé et laissé
  l'autre en place. Réflexe à prendre : **quand un texte ne rentre pas dans une case, se demander
  d'abord s'il a le droit d'y être** — un débordement est souvent la première manifestation
  visible d'un emplacement qui sert à deux choses. Et : la largeur d'un texte dépend de la police
  système du téléphone, jamais de celle mesurée ici — 54 px sur 56 « passait » sur cet écran et
  nulle part ailleurs.
- **Écrire en base par IndexedDB brut ne réveille pas `useLiveQuery`.** Dexie n'émet ses événements
  que sur ses propres écritures : une table modifiée par `indexedDB.open()` direct laisse l'écran
  afficher l'ancien état indéfiniment, ce qui ressemble exactement à un bug de requête. Recharger
  la page après un montage de données fabriqué à la main — ou passer par les repositories.
- **Le panneau navigateur intégré perd parfois l'injection d'événements** (clics et captures
  d'écran expirent) alors que l'exécution JavaScript continue de répondre. Le contournement :
  vérifier par `javascript_tool` (styles calculés, rectangles, clics `element.click()`), et
  ouvrir un onglet neuf pour retrouver les captures. Les messages de console peuvent aussi être
  ceux de la session précédente — toujours confirmer l'état réel du DOM avant de diagnostiquer.
- **Le balayage de contraste parcourt les nœuds de texte, et un filet n'en est pas un.** « 934
  nœuds de texte, zéro échec » au Lot 4 : le chiffre est exact et il ne prouve rien sur le filet de
  superset, qui mesurait 1,29:1 à ce moment-là. Le balayage n'a pas échoué, **il n'a pas regardé**
  — et un rapport qui annonce un dénombrement rassure d'autant plus qu'il est précis. WCAG 1.4.11
  couvre les éléments **non textuels** porteurs d'information (filets, jauges, pastilles d'état,
  bordures qui distinguent), tous invisibles à un parcours de `Node.TEXT_NODE`. Deux réflexes :
  **dire ce que le balayage n'a pas couvert** quand on en annonce le résultat, et étendre le
  parcours aux éléments dont la couleur *est* l'information — sinon le prochain filet repassera au
  travers. Le repère qui trie : si l'élément porte du texte par-dessus, c'est un aplat et seul son
  `--*-fg` compte ; s'il ne porte rien, c'est de l'encre et il se mesure contre la surface.
- **Dans une colonne flex, `overflow-hidden` change la taille minimale automatique.** La recherche
  d'exercices coupait le regroupement alphabétique et rendait alors directement une `Card`
  (`overflow-hidden`) comme enfant du corps flex de `Screen`. Cette carte pouvait rétrécir à 0 px :
  ses 139 lignes existaient dans le DOM, mais le conteneur ne voyait que 160 px de contenu et
  n'avait donc rien à faire défiler. Un wrapper `shrink-0` sur la liste filtrée restaure sa hauteur
  intrinsèque ; vérifié en navigateur mobile avec 9 846 px de course et un `scrollTop` passé de 0
  à 600. Le `h-full` de la coquille transmettait seulement la contrainte, il n'était pas la cause.

## Dette technique assumée

_(Raccourcis pris volontairement, à rembourser plus tard.)_

- **Assumée le 2026-08-10 — l'accueil lit tout l'historique pour afficher trois lignes.**
  `getHomeDashboard` charge toutes les séances terminées et relit les trois tables de routines
  en entier, à chaque écriture dans l'une des six tables observées. Mesurée à ~71 ms sur
  2 000 séances (`npm run bench:home`), dont 57 % pour la seule lecture non bornée. **Sous le
  seuil d'action** : le remboursement demande l'index `[status+startedAt]`, un parcours arrière
  avec arrêt anticipé et une migration `version(4)`. À rouvrir si le banc dépasse la centaine de
  millisecondes **sur un vrai téléphone**, pas sur `fake-indexeddb`.

- **Remboursée le 2026-07-27 — les deux repositories dépassaient la règle des ~300 lignes.**
  `workouts.ts` avait atteint 682 lignes et `routines.ts` 504 avant la reprise de l’édition
  rétroactive. Ils sont désormais des façades de 32 et 39 lignes. Cycle de vie, exercices, séries
  et lectures composées vivent dans huit modules spécialisés ; le plus long, `workoutSets.ts`,
  fait 266 lignes. Les imports publics, les tests et les transactions Dexie sont restés inchangés.
