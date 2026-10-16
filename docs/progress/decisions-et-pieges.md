# Décisions, pièges et dette

> Archive extraite de PROGRESS.md le 2026-08-30. Le journal vivant est PROGRESS.md.

## Décisions prises en cours de route

_(Toute décision qui contredit ou complète `docs/plans/01-ARCHITECTURE.md` est consignée ici,
avec la date et la raison.)_

### 2026-10-16 (suite de la v2.15.0) — « Oui et oui » : un pas pour toute l'appli, et le coach par en dessous

**Demande.** Le compte rendu de la v2.15.0 laissait deux questions ouvertes : « veux-tu un pas global à 1,125 dans les Réglages ? » et « veux-tu que le coach te
remette aussi dans la fourchette quand tu es en dessous ? » — « Oui et oui. » (Publié en v2.16.0.)

**Le pas de toute l'appli.** Spec benchmark §3 (arrondi), tâche 12 du plan, recette § 3 ter.

- **Un réglage, vide d'office.** `defaultLoadStepKg`, Réglages › Coach › « Pas de charge par défaut ». Vide = la table du matériel, comme avant : poser 1,125 d'office à
  la mise à jour aurait changé en silence la montée de toutes les barres. La personne le pose une fois (« 1,125 »), et « Selon le matériel » le retire.
- **Il vaut pour toute fiche sans incrément, barre comprise** — « de façon générale ». **À relire** : sur une barre ou des haltères, 1,125 n'existe pas (les petits
  disques donnent 2,5 kg au total) ; pour cet exercice-là, on saisit son pas sur la fiche, qui passe avant les Réglages. Limiter le réglage aux machines et aux poulies
  était possible, mais la phrase de la personne n'en parlait pas.
- **Ajouté tel quel, hors grille**, comme un pas saisi sur la fiche : c'est la parole de la personne sur sa salle, pas une estimation du matériel. Le benchmark et les
  cibles comptent donc depuis la charge essayée (37,5 → 38,625), et le coach depuis la charge du jour.
- **`resolveLoadStep(exercice, pasDeLAppli)` : second argument obligatoire**, qui peut valoir `undefined`. Un argument facultatif aurait laissé un appelant futur lire
  la table du matériel sans que rien le dise ; l'obligatoire a listé les cinq appelants à la compilation (coach, benchmark, revue des cibles, prescription d'un
  programme, sa décharge). Les dépôts lisent le réglage une fois et le passent ; les fonctions pures n'importent rien.
- **La fiche d'un exercice** montre le pas des Réglages dans son champ vide (« Vide = le pas des Réglages (1,125 kg) ») quand il y en a un.

**Le coach par en dessous.** Spec coach v2, amendement du 2026-10-16 (suite) de R3, tâche 13 du plan, recette § 3 ter.

- **Le moins de crans possible, pas la charge d'un benchmark.** Premier jet : le symétrique exact du plafond — quand un cran ne suffit pas, la charge qu'un benchmark
  aurait proposée. Rejeté sur les chiffres avant d'être écrit : cette charge garde deux répétitions de réserve à la dernière série, donc 100 kg à 8 · 8 · 7 sur un 8 – 12 passaient
  à 90 kg pour une répétition de manque (et 13 · 12 · 12 sur un 15 – 20 à 32,5 au lieu de 37,5). Le plafond, lui, veut la charge du bas de la fourchette : la personne y est
  loin au-dessus. Par en dessous, c'est une **correction** : on enlève des crans, un par un, jusqu'à ce que la pire série retombe au bas.
- **La porte et la cible sont une seule et même question** : « avec ce nombre de crans de moins, la pire série atteint-elle le bas ? ». Un cran garde la main quand oui
  (14 · 13 · 13, 8 · 8 · 7) ; sinon on continue. Pas de seuil de plus, donc pas de falaise entre « un cran » et « la charge du benchmark ».
- **Ce qu'un cran rend** : `(30 + capacité) × (charge / charge allégée − 1)` répétitions, où la capacité est la meilleure série plus la réserve du RPE moyen. C'est la
  lecture d'Epley du benchmark, et du plafond. **À une demi-répétition près** : des répétitions, c'est un compte entier.
- **30 % de moins au plus** (`BENCHMARK_MAX_JUMP`, comme dans l'autre sens). Un cran déjà plus loin que ça — 5 kg, un pas de 2,5 — reste ce qu'il était.
- **Un test existant a changé de sens** : « 7 puis 6 à 80 kg sur un 8 – 12 → 77,5 (un cran) ». Un cran ne rend que 1,2 répétition à la pire série (6 → 7,2) ; le bas est 8 :
  c'est maintenant 75. Le test garde son titre (« un cran ») avec 7 puis 7, et « 7 puis 6 → deux crans » a le sien.
- **Pas touché** : une pyramide, une cible unique (sans fourchette où remettre), une assistance ou un lest — un cran de moins, comme avant. Les deux séances doivent toujours
  manquer le bas, à la même charge ; une seule mauvaise journée ne déclenche rien.
- **Deux cibles différentes, voulues.** Au-dessus, la charge du bas de la fourchette avec réserve (la personne a de la marge, et on veut lui laisser des répétitions à
  gagner) ; en dessous, le moins de crans qui remet la pire série au bas. **À juger à l'usage** : sans RPE, la capacité est lue à l'échec (réserve zéro) — la lecture qui allège le plus.

**Pièges rencontrés.**

- **Un `db.settings.get` dans une transaction qui ne déclare pas `settings`** : `NotFoundError: an object store did not exist`. Lire le réglage du pas dans
  `resolveProgramWorkoutPlan`, que deux transactions de `programWorkout` enveloppent, a cassé le démarrage d'une séance de programme — seul le test de câblage l'a vu.
  Toute nouvelle lecture de réglage dans un dépôt appelé depuis une transaction ajoute `db.settings` à sa liste de tables.
- **`useLiveQuery` réserve `undefined` à « pas encore répondu »** : le pas absent se lit `null` (`(await getDefaultLoadStepKg()) ?? null`), sinon la ligne ne sait pas
  distinguer « charge » de « aucun pas posé ».
- **Un test qui comptait des appels en croyant compter des écritures** : « n'écrit qu'une fois sur un double appui » (`BenchmarkScreen.test.tsx`) a rougi le build Android du push de la
  v2.16.0 (1 test sur 3 788, vert en local trois fois). L'écran ne verrouille « Appliquer » que pendant l'écriture ; sur un exécuteur chargé, le second appui arrive après la fin de la
  première, avant que le bilan soit relu, et redemande la même acceptation — `applyBenchmarkProposals` est appelé deux fois. **Reproduit sans toucher au code** (un rafraîchissement du
  bilan ralenti, un second appui séparé du premier : « called 2 times », le message exact de la CI). Les données ne risquaient rien : le dépôt ne décale pas deux fois une acceptation rejouée
  (`repositories/benchmark.test.ts`), la seconde demande n'écrit rien. Le test tient maintenant la première écriture en l'air, ce qui rend la course impossible, et échoue sans les deux gardes de
  l'écran. **Reste, volontairement** (pas touché le jour d'une release) : après une écriture réussie et avant la relecture du bilan, un second appui redemande l'acceptation et l'écran dit alors
  « La routine a changé depuis le bilan : rien n'a été écrit » — vrai mais déroutant juste après un succès. Le correctif propre serait de ne plus proposer ce qui vient d'être écrit sans attendre
  la relecture. Un changement du chemin de lecture du bilan (ici : un `await` de plus pour le pas de l'appli) suffit à élargir cette fenêtre.

### 2026-10-16 (suite de la v2.14.0) — « Il faut que le coach te rebalance dans une range 15-20 »

**Demande.** « Ça se passe comment si je choisis une séance légère et que je tape plus de 20 rep ? » (réponse : rien ne bloque la saisie ; au bilan, 21 à
26 reps proposaient plus lourd, 27 à 30 étaient « approximatives » et éteintes, au-delà de 30 rien) — « Eh oui mais il faut que le coach te rebalance dans une
range 15-20. » Deux questions posées, deux réponses : **au bilan et en séance normale** ; **appliqué d'office** pour un essai très au-dessus.

**Ce qui a changé.** Spec benchmark §3 ter, tâche 10 du plan, amendement R3 du coach v2. En trois lignes : « approximatif » au-dessus de la capacité exigée
se juge au saut de charge (30 %), plus à l'écart de répétitions ; plus de 30 répétitions donnent un minimum (« au moins 47,5 kg ») ; la règle de fourchette du
coach propose la charge qui remet dans la fourchette quand un cran ne suffit pas.

**Choix de détail, à relire.**

- **30 % de saut maximal** (`BENCHMARK_MAX_JUMP`), pour le bilan comme pour le coach. Le léger n'y arrive jamais (19 % à 30 reps sur trois séries) ; un 8 – 12
  testé à 30 reps (44 %) et un 5 – 8 testé à 25 (44 %) restent approximatifs. Un chiffre à juger à l'usage.
- **Le côté « trop lourd » n'a pas bougé** : sous la capacité exigée, six répétitions d'écart restent le seuil. Les deux côtés ne sont plus jugés de la même
  façon : au-dessus, la consigne est claire (plus lourd) ; en dessous, la formule extrapole mal.
- **Le minimum est appliqué comme une charge** (interrupteur allumé, objectif du coach « au moins »), parce que c'est la réponse « d'office » choisie ; il ne
  promet rien (pas de « tu tiendras »).
- **Le RPE ajoute de la réserve à la capacité** du coach en séance normale (25 reps à RPE 7 → capacité 28). Sans RPE, un plancher. Le RPE moyen de la
  séance, comme R1.
- **Seulement si un cran ne suffit pas.** Un premier jet visait le bas de la fourchette dès le plafond atteint ; un test existant (100 × 12 sur un 5 – 12 →
  102,5) l'a refusé à raison — sur une large fourchette, c'était trois crans d'un coup pour quelqu'un qui vient d'atteindre le haut.
- **Le cas inverse n'est pas touché** : sous le bas de la fourchette, « bas manqué deux fois » descend toujours d'un cran. À rouvrir si la personne le demande.

**L'arrondi, tranché dans la foulée.** Sa séance du 16 octobre (un benchmark léger, des machines, « de façon générale le pas est de 1,125, car il y a des
petits poids de 1,125 ») a montré que l'arrondi vers le bas coûtait un cran entier pour une fraction de kilo : le calcul disait 34,94 kg pour une leg extension
faite à 35 × 20, le bilan proposait 33,875. J'avais proposé « au cran le plus proche quand l'écart est de moins de 1 % » ; sa réponse : « on arrondit simplement au
pas renseigné dans l'App, ça sera bien plus simple ». Donc `roundLoad` : le multiple du pas de l'exercice **le plus proche**, depuis la charge essayée quand le pas est
saisi (l'ancrage de R3 ne change pas), depuis zéro sur la grille du matériel, sans tolérance ni règle de plus. `loadForRange` s'en sert : le bilan et le coach.

- **Ce que ça change.** La proposition est à un demi-pas au plus du calcul : 0,56 kg avec 1,125, **2,5 kg avec le 5 kg d'une machine dont le pas n'est pas saisi**
  (52,5 × 13 en classique passe de 50 à 55 kg, dont on ne tient que 11 · 9 · 8 : moins de réserve que les deux répétitions visées). Le principe « le benchmark ne
  propose jamais plus que ce que le maximum autorise » est abandonné ; le seul arrondi vers le bas qui reste est le **plafond du saut de 30 %** du coach
  (`floorLoad`), qui ne doit pas le dépasser. Les répétitions qu'on « tiendra » restent arrondies vers le bas.
- **Un minimum se dit « à un demi-pas près »** (« au moins 47,5 kg » pour un plancher de 47,07 kg).
- **Seul le pas se règle exercice par exercice** (fiche › Incrément de charge, « Vide = défaut selon le matériel ») : il n'y a pas de pas par défaut global, et
  « de façon générale 1,125 » veut dire le saisir sur chaque machine. Un réglage global est une décision qui attend l'utilisateur (PROGRESS.md).
- **Une vingtaine d'attendus du lecteur recalculés à part** (le 8 – 12 sur 1 à 6 séries : 77,5 · 75 · 72,5 · **72,5** — trois et quatre séries donnent la même charge —,
  les repos, la cible unique, les seuils de 30 %).

**Pièges rencontrés.**

- **`git merge` ne lit pas son message sur l'entrée standard** (`-F -` : « could not read file '-' »), contrairement à `git commit`. Le shell de l'outil ne
  s'arrête pas à la première erreur : la suite du script a tourné sur un `master` non fusionné. Le message va dans un fichier, et on relit les parents du commit.
- **Un `origin/master` périmé** : un clone de session garde les références distantes de son démarrage. `git log origin/master..HEAD` disait 67 commits d'avance
  avant un `git fetch origin master`, 10 après. Fetch d'abord.

### 2026-10-15 (revue de code, puis les styles) — Six défauts du benchmark, et un benchmark qui a un style

**Demande.** Une revue de code de la feature et de son intégration au coach, puis : « tu as fait 40×18, je te propose 40×14 trois fois ; en classique
8-12, 52,5 kg, échec à la 13e, je te propose 50×12 trois fois ; la force, je connais pas ; si on doit choisir le type de benchmark, on peut avoir
l'option ; c'est particulièrement pertinent pour commencer les programmes ; à toi de définir les calculs. » Spec : `docs/design/specs/2026-10-15-benchmark-design.md`
(§3, §3 bis, §4, §5) ; exécution : tâche 9 de `docs/design/plans/2026-10-15-benchmark.md`.

**La revue : six défauts, tous reproduits, aucun couvert par un test.** Chacun a maintenant un test vu rouge avant le correctif.

1. **Le bilan retrouvait sa ligne de routine par le rang.** La séance renumérote ses rangs dès qu'on retire, déplace ou remplace un exercice, et l'édition
   de l'historique aussi. Un curl 15 – 20 remonté d'un rang se lisait en 8 – 12 sans ligne de routine, et le coach posait « démarre à 40 kg » (32,5 avec sa
   vraie fourchette, et alors « approximatif »). Avec le même exercice deux fois, les lignes se croisaient. → `WorkoutExercise.routineExerciseId`, posé au lancement.
2. **Un vieux bilan réécrivait la routine**, interrupteur allumé : 90 kg ramenés à 72,5. → l'interrupteur est éteint quand la routine a changé depuis.
3. **Une pyramide ascendante montait son sommet à 94 % du max** (60 / 70 / 80 → 77,5 / 87,5 / 97,5). → chaque série se dimensionne seule, l'écart le plus prudent.
4. **Une dégressive à la fin faisait une « pyramide »** et montait la charge de 5 kg. 5. **Un échauffement coché sans la série à l'échec devenait l'essai.**
6. **La carte du coach restait proposée pendant un benchmark** (« Appliquer » y écrasait la charge d'essai).

Deux autres constats de la revue étaient des messages faux sur des cas rares : des répétitions décimales (« 12,5 ») donnent
« trop léger » — la règle entière est celle de `lib/oneRepMax.ts` pour toute l'app, c'est le message qui est faux ; **corrigé le 2026-10-16** (verdict
`unreadable`, voir l'entrée du jour) —, et une charge arrondie à zéro sur une machine au pas de 5 réutilise « aucune charge exploitable » (**non corrigé**). Hors périmètre, constatés en passant (R6) : `DAY_MS` redéfini dans `lib/coach/volume.ts`,
deux `effectiveCeiling` (`sets.ts`, `volume.ts`), `coachEvaluate.ts` à 505 lignes sans entrée ici.

**Le style.** Léger 15 – 20, classique 8 – 12, lourd 5 – 8 : une fourchette nommée, choisie à la feuille de lancement (« Comme ma routine » d'office), qui
remplace celle de la routine pour dimensionner la charge ; l'acceptation écrit la charge **et** la fourchette. Le bilan se lit en une phrase (« 52,5 kg pour
3 séries de 8 – 12 reps ») et dit ce que chaque série tient à fond (« 13 · 11 · 10 »). La fiche d'un programme propose « Calibrer les charges » : une
séance de programme se construit depuis sa routine, les charges d'un bloc sont celles de ses routines.

**Choix de détail, à relire.**

- **La réserve de deux répétitions n'a pas bougé.** Les exemples de la demande (40×14, 50×12) correspondent à une dernière série menée jusqu'à l'échec ;
  avec la réserve, le léger propose 37,5 kg et non 40. Si les charges paraissent trop basses : `BENCHMARK_RESERVE_REPS`, un seul endroit.
- **Les fourchettes sont celles de l'utilisateur.** Proposé d'abord : « force » 3 – 5 (« la force, je connais pas »). Sa réponse : « lourd 5 – 8, normal
  8 – 12, léger entre 15 et 20 ». Le style est devenu **lourd** (clé `heavy` ; un 5 – 8 n'est pas de la force pure) ; jamais publié, rien à migrer.
  « Classique » garde son nom : « Normal » à côté de « Comme ma routine » (d'office) se lirait comme le choix par défaut — un mot dans `fr.ts`
  (`benchmark.goalChoice.classic`, `goalName.classic`) si l'utilisateur préfère. Même réserve, même fatigue du repos prévu pour l'exercice.
- **Pas d'objectif du coach pour une pyramide** : un objectif est un seul chiffre, que « Appliquer » met sur toutes les séries restantes (60 / 70 / 80 devient
  77,5 trois fois — constaté). Le bilan, lui, garde la forme.
- **« Périmé » se juge à la date de modification des séries de la ligne de routine**, comparée à la fin du benchmark. Une modification faite *pendant* la séance
  n'en est pas une : le bilan la lit déjà.
- **Le nom de la séance dit le style** (« Benchmark léger · Push »), pour le retrouver dans l'historique.

**Pièges rencontrés.**

- **L'édition de l'historique recopie une liste fixe de champs et renumérote les rangs** (`saveArchivedWorkout`). Tout champ ajouté à `WorkoutExercise` doit y
  être recopié, sans quoi une correction l'efface. `repSeconds` (le tempo propre à un exercice) n'y est pas recopié non plus : **constaté, non corrigé** —
  corriger une séance passée en efface le tempo.
- **Une requête par texte supposait qu'un nom de routine n'apparaît qu'une fois à l'écran** (`ProgramFlow.integration.test.tsx`). La carte « Calibrer les
  charges » le répète : l'unicité à l'écran n'est pas un contrat, les assertions se lisent par rôle (nom + état), ce qui les rend plus strictes.
- **Un test d'absence est vrai trop tôt** tant que les requêtes vives ne se sont pas posées : celui de la carte du coach attend, et a été vu rouge.
- **Le dépôt n'impose pas Prettier** (les fichiers commités ne le passent pas non plus) : ne pas reformater en bloc, corriger l'indentation de ce qu'on touche.

**Publié en v2.14.0**, après son accord (« fusionne et publie ») : rien n'est fusionné ni versionné sans demande explicite.

### 2026-10-15 (release) — Un test qui gardait un nœud périmé

**Constat.** La première tentative de la run de release a échoué à l'étape `test:run` : un test sur 3 604 —
`WorkoutScreen.integration.test.tsx › garde la question d'effort visible quand la dernière série replie la carte`. Le même commit avait passé
ce test dans le déploiement Pages et dans le build Android du push ; la tentative relancée a réussi. La version n'y était pour rien : le test et
le code qu'il couvre n'avaient pas bougé.

**Cause.** `EffortStrip` est rendue à deux endroits de `WorkoutExerciseCard` : sous la série (carte ouverte), puis sous la carte repliée — le
repli démonte l'une et monte l'autre. Le test faisait `expect(await findByRole('group')).toBeVisible()` : `findByRole` rend le premier nœud vu,
et si le repli tombe dans la passe suivante, ce nœud n'est plus dans le document quand `toBeVisible` le lit (« element is not in the document »).
Une course entre deux rendus, que seule une machine lente (la CI, deux cœurs) laisse voir ; **non reproduit en local**, 81 passes sur 81 sous
charge, sur le code de la version et sur celui de la v2.12.2 — le défaut est donc ancien, pas introduit par cette version.

**Et le test ne gardait pas ce qu'il disait.** Il ne vérifiait la question qu'*avant* le repli, puis le repli à part : supprimer la barre
d'après le repli — exactement ce que le commentaire du composant dit qu'il ne faut pas faire (« the one effort reading most likely to matter is
also the only one the person can never enter ») — le laissait vert. Mutation vue : l'ancien test survit, le nouveau la tue.

**Ce qui est fait.** Le test relit la barre à chaque essai (`waitFor`) et la veut **repliée et visible en même temps**. Rien n'a été changé dans
le composant. **Ce qui n'est pas prouvé** : que la course ne revienne plus — faute de la reproduire, la nouvelle assertion est vraie par
construction (plus de référence à un nœud périmé), pas par une série de passes.

**Pièges.** Relancer le job pour obtenir un vert aurait suffi à publier, et aurait laissé un test qui ne gardait pas sa promesse. La relance a
été faite, *après* avoir su pourquoi.

### 2026-10-15 (après la v2.13.0) — « Tu as tout merge et oublié ? » : le « ? » du bilan expliquait l'accueil

**La question.** Posée par l'utilisateur après la publication. Réponse en deux temps : le dépôt d'abord (`master` = `origin/master`, tag
`v2.13.0` sur `df1709e`, aucune branche distante non fusionnée hors les trois `archive/*`, ni stash, ni fichier non suivi) ; puis ce que la
version n'avait ni dit ni fait.

**Ce qui manquait.**

1. **Le « ? » de l'écran de bilan** (`/benchmark/:workoutId`, ajouté à la v2.12.0). Le didacticiel range les routes par préfixe
   (`tutorialTopicForPath`) et renvoie `home` pour toute autre : le bilan proposait « Expliquer cette page : Accueil ». Aucun test ne regardait
   le « ? » d'un écran, et aucun de mes parcours ne l'ouvre : ce trou a traversé trois versions. **Corrigé par un renoncement**
   (`showTutorialHelp={false}` sur les trois états de l'écran), pas par un chapitre : un chapitre demande une narration (voix, clips), et le
   bilan dit lui-même ce qu'il fait (`benchmark.intro`). Une aide qui parle d'un autre écran est pire que pas d'aide.
2. **Un garde-fou plutôt qu'un correctif de plus** (`tutorialRoutes.test.ts`) : toute route déclarée qui retombe sur l'accueil doit renoncer à
   l'aide *et* entrer dans une courte liste, avec sa raison. Aujourd'hui : le Guide (`/knowledge`, dont le cadre retire déjà le « ? ») et le
   bilan. Vu rouge sans l'entrée du bilan : il nomme exactement `/benchmark/:workoutId`.
3. **Le checkpoint téléphone de la version était à jour** (§3 ter de `docs/recette-telephone.md`) **mais pas annoncé** à l'utilisateur, ce que
   le rituel de fin de session demande. Il l'est maintenant, avec la ligne du « ? ».

**Publié en v2.13.1**, après son accord (« Publier ») : rien n'est fusionné ni versionné sans demande explicite.

### 2026-10-15 (release) — La feuille de saisie des mensurations repartait du brouillon d'avant

**Constat.** À la fusion de la v2.13.0, un parcours E2E des mensurations — `corriger puis supprimer une mesure refait la courbe` — a
atteint son délai de 60 s. **C'était la deuxième fois** : la v2.12.1 l'avait vu une fois, « non reproduit en 12 relances, donc non
expliqué », avec la consigne de garder la trace s'il revenait. La trace a été gardée avant toute relance.

**Cause.** `Sheet` garde son contenu monté 250 ms après sa fermeture (sa sortie ; en mouvement réduit, ce délai est le seul qui la démonte).
Une feuille rouverte dans ce délai ne démonte donc rien, et `MeasurementSheet` lui passait le formulaire d'avant — **date comprise**.
Dans le parcours : 84 cm datés d'il y a vingt jours, puis 82,5 cm « sans date » → 82,5 cm daté d'il y a vingt jours, qui **remplace** le
84 (une mesure par jour). La capture de l'échec le montre : une seule mesure, 82,5 cm, au 25 septembre ; la trace donne 130 à 200 ms
entre la fermeture de la première feuille et l'ouverture de la seconde. Le commentaire du composant promettait « monté avec la feuille,
démonté avec elle » ; la feuille ne le tenait pas.

**Pourquoi « non reproduit ».** La course ne se perd que si le navigateur enchaîne plus vite que 250 ms : les relances précédentes, à
trois en parallèle, étaient plus lentes. **Un seul worker la reproduit : 7 échecs sur 40** sur l'ancien build.

**Ce qui est fait.** Une clé sur le formulaire : un brouillon par cible (les écrans en posent une neuve à chaque geste). Un test
(`MeasurementSheet.test.tsx`) qui rouvre la feuille avant la fin de sa sortie — vu rouge sans la clé — et un second qui garde la promesse
voisine (le contenu ne s'efface pas pendant que la feuille redescend) ; quatre mutations, quatre tuées. Les mêmes 40 passes sur le build
corrigé : **40 réussites sur 40, aucun échec** (5,2 min).

**Pour une personne.** Il faut rouvrir la feuille en moins d'un quart de seconde : rare, mais le coût est une mesure écrasée en silence,
ce qui est la règle n° 4 de ce projet. D'où le correctif dans la release, bien que le défaut date de la v2.12.0 et soit sans rapport avec
le benchmark.

**Ce qui n'est pas fait, et pourquoi.**

- **Pas de correctif dans `Sheet` lui-même** (remonter les enfants à chaque ouverture). Là où `open` suit une requête qui clignote, il
  effacerait un brouillon qui survit aujourd'hui. Le correctif est local, là où le contrat est écrit.
- **`VolumeBoundsSheet` a le même motif** (`last` + formulaire sans clé, initialisé depuis la ligne) : rouvert pour un autre muscle dans
  les 250 ms, il garderait les bornes du précédent. Non touché : aucun échec observé, et la release n'avait pas à s'élargir sans preuve.
  `HomeBodyWeightSheet` se réinitialise explicitement à chaque ouverture (`wasOpen`) ; les autres feuilles ne sont pas auditées.

### 2026-10-15 (fin) — La charge du benchmark tient les séries de la routine

**Demande.** « Moi je voyais ça comme ça : je veux estimer les meilleures charges, je pense que je peux faire 80 kg × 15, on teste, je varie à
17, 20 ou 12… 1 série de chaque exo. Le coach récupère ces infos, et extrapole la meilleure charge sur x séries. Par exemple, je sais pas,
3 séries sur les poly-articulaires, 2 sur les isolations. C'est un exemple au pif, attention. » Spec :
`docs/design/specs/2026-10-15-benchmark-design.md` (§3).

**Ce que j'avais mal lu.** La question d'avant (« le benchmark a l'air de donner des charges à respecter, alors pourquoi pas, mais on va
sur le plus de reps possible ») m'avait fait proposer deux variantes, dont un essai à charge imposée. La personne voulait autre chose : elle
choisit **sa** charge d'essai (« je pense que je peux faire 80 × 15 »), va à l'échec, et c'est le coach qui en déduit la charge de travail.
Le benchmark ne change pas de forme ; ce qui manquait, c'est que la charge qu'il propose **tienne plusieurs séries**.

**Le défaut que cela a fait voir.** Le calcul « bas + 2 » dimensionnait la charge pour **une** série à l'échec moins deux répétitions. Posée
sur trois séries à charge égale, elle est trop lourde : pour un 8 – 12, 80 kg × 9 donnait 77,5 kg, alors que 72,5 kg tiennent les trois.
Mes tests ne posaient que des routines à une ou deux séries et des essais proches de la référence ; aucun ne comptait les séries.

**Ce qui est fait.**

- `lib/benchmarkModel.ts` (le modèle) : la première série doit pouvoir faire `(bas + 2) / (1 − φ)^(x − 1)` répétitions pour que la dernière
  tienne le bas de la fourchette avec deux répétitions en réserve ; la charge est celle de cette capacité sur le max (Epley, inverse exact,
  capacité non entière admise). φ = 10 % par série pour un polyarticulaire reposé deux minutes, 8 % pour une isolation, ×(120 / repos) borné
  entre 0,6 et 2. `x` = les séries de travail de la routine, six au plus ; une pyramide compte pour une ; sans série de travail, 3
  (polyarticulaire) ou 2 (isolation).
- `lib/exerciseClass.ts` : polyarticulaire ou isolation, lu sur la famille de mouvement du catalogue — aucune table à tenir. « Autre » ou
  absente (exercice personnel) : le corps entier ou deux muscles secondaires et plus font un polyarticulaire ; sans rien, polyarticulaire.
- `lib/benchmark.ts` (la lecture) : le calcul passe par ce modèle ; « approximatif » se juge sur la capacité exigée de la première série
  (plus de six répétitions d'écart) et non plus sur « bas + 2 ». Le signal du coach porte `planned_sets` et `reference_reps`.
- `loadBenchmarkReport` donne à la ligne le repos de l'exercice dans la séance et sa classe ; le bilan dit « Pour 3 séries : environ 12
  répétitions à fond à la première, 2 en réserve à la dernière » ; le coach « Pour 3 séries de 8 – 12 reps, démarre à 72,5 kg » (« pour ta
  fourchette » quand il n'y en a qu'une).
- L'exemple de la demande, chiffré : 80 kg × 17 sur un 15 – 20, trois séries → 72,5 kg (polyarticulaire) ou 75 kg (isolation) ; 65 kg avec une
  minute de repos, 75 kg avec trois.

**Choix de détail, à relire.**

- **`x` est le nombre de séries de la routine**, pas « 3 et 2 » d'office. La demande disait « x » et « par exemple » ; le 3 / 2 ne sert que
  quand la routine n'en dit rien. **Tranché avec l'utilisateur** à qui j'ai demandé si le coach devait aussi *proposer* le nombre de séries
  par type d'exercice et l'écrire dans la routine : « JSP, tu proposes quoi ? » — proposition : 3 / 2 en défaut seulement, rien d'écrit,
  parce que le nombre de séries d'un muscle est déjà l'affaire de R6 et qu'une série à l'échec ne dit pas combien de séries on récupère.
  Il a répondu « oui, publie la v2.13.0 ».
- **Les constantes de fatigue sont au pif**, comme les « 3 et 2 ». 10 % de répétitions en moins par série est un ordre de grandeur courant,
  pas une mesure de la personne. Elles sont nommées, en un seul fichier ; le jour où un bilan paraît faux, on corrige là.
- **Une pyramide compte pour une série** (la première est dimensionnée pour elle-même, les autres suivent du même écart). Pour une montée
  de charge c'est la lecture qui ne promet rien de plus que ce que la première série dit.
- **Un plafond de six séries et de 30 répétitions exigées** : au-delà, la formule n'est plus une estimation. Six séries de 20 se heurtent
  au plafond de 30 — la charge est alors la plus légère que le benchmark sache proposer, la dernière série garde moins que la réserve.
- **Le repos est celui qui est prévu**, pas un repos mesuré : le benchmark n'a qu'une série par exercice.

**Pièges rencontrés.**

- **Une graine de test qui ne portait pas ce que le code venait d'apprendre à lire.** Les tests de dépôt et d'écran semaient un
  « Développé couché » sans famille de mouvement et sans muscle secondaire : `exerciseClass` le lisait en isolation, et les charges
  attendues tombaient de quelques kilos. La graine était fausse, pas le code — elle porte maintenant une famille de poussée et deux
  muscles secondaires, comme le catalogue.
- **Une mutation a survécu à un test qui ne la visait pas.** « Pyramide : plus de 2 charges au lieu de plus d'1 » passait : mon test de
  pyramide posait trois charges. Un cas à deux charges (montée, ou série lourde suivie de séries légères) l'a tuée. 32 mutations, 0
  survivante.
- **Un fichier de 498 lignes qui faisait deux métiers** (le modèle de charge et la lecture d'un benchmark) : coupé en `benchmarkModel.ts` et
  `benchmark.ts` plutôt que consigné comme écart.

### 2026-10-15 (suite) — Le benchmark suit la fourchette, et le coach le lit

**Demande.** « Attends, le coach doit lire ce benchmark et te proposer des charges adaptées. Ça met à jour les routines. Par contre ça
doit bien prendre en compte la fourchette. Un mec qui fait des séries de 8, 12, 15, 18, 20… » Spec :
`docs/design/specs/2026-10-15-benchmark-design.md` (§2 bis, §3).

**Trois défauts, dont deux que cette demande a fait voir.**

1. **La fourchette n'était prise en compte que jusqu'à 12.** La charge de travail se dimensionnait sur « bas + 2, plafonné à 12 » avec les
   formules de 1RM de 1 à 12 répétitions. Un 15 – 20 recevait la charge d'une série de 12 — **bien trop lourde** — et un essai à 15
   répétitions était déclaré « trop léger ». Pour quelqu'un qui travaille à 15, 18 ou 20, le benchmark ne servait à rien. Il ne l'avait
   pas dit : mes tests ne posaient que des fourchettes de 5 à 12.
2. **Le coach n'en lisait rien.** Voir l'entrée du benchmark ci-dessous : écarté en bloc, il passait seulement par les cibles de la routine.
3. **La coche enregistrait les répétitions de la dernière fois comme le maximum.** Un benchmark efface la cible de répétitions de sa série ;
   le fantôme de la case retombait alors sur la dernière séance de l'exercice, et « Valider » l'enregistrait sans que rien ne soit tapé.
   L'E2E ne l'avait pas vu : sa base est vide, donc pas de « dernière fois ». **Un E2E de « un exercice a un historique » aurait dû exister
   dès le départ** ; il existe maintenant, et a été vu rouge quand la garde est retirée.

**Ce qui est fait.**

- La **fourchette** est celle de la première série de travail de la routine (cible unique = fourchette d'un point ; 8 – 12 par défaut) ;
  la référence est son bas + 2 répétitions de réserve (10, 17, 22 pour 8 – 12, 15 – 20, 20), plafonnée à 30. **Epley seul, de 1 à 30
  répétitions**, quelle que soit la formule d'affichage : c'est le seul des trois qui reste lisible au-delà de 12, et c'est déjà la
  règle du coach pour le cran. Au-delà de 30 : « trop léger ».
- Un essai à **plus de six répétitions de la référence** est une extrapolation : proposée, dite approximative, **interrupteur éteint
  d'office**, et le coach n'en tire rien.
- Le coach **lit** le benchmark : signal `benchmark_calibrated`, posé à l'enregistrement de la séance par le chemin des objectifs
  (`recordCoachSignals`, « un objectif vivant à la fois »), avec les chiffres qui l'ont produit. La carte de l'exercice l'affiche à la
  séance suivante. L'écriture dans la routine reste l'acceptation du bilan, qui **suit** l'objectif posé par ce benchmark et remplace
  tout autre objectif de l'exercice.
- Les `amrap` : les répétitions d'une série de benchmark ne sont jamais proposées.

**Choix de détail, à relire.**

- **Epley pour tout, y compris l'affichage du bilan.** Un utilisateur qui a réglé Brzycki lira un 1RM de bilan différent de celui de la
  page des records, de quelques pour cent. Mélanger les formules selon le nombre de répétitions aurait créé une marche d'escalier à 12.
- **Le seuil de six répétitions d'écart** est un jugement, pas une mesure (à six répétitions d'écart, autour de 17, la conversion table sur 13 % d'écart entre
  deux charges, avec la précision d'Epley) ; une constante (`BENCHMARK_ROUGH_GAP`), à ajuster si le bilan crie « approximatif » trop souvent.
- **Rien dans une séance de programme** : un bloc possède ses charges, et `useActiveWorkout` retire déjà les objectifs numériques de sa
  carte. Le benchmark d'une routine qui sert à un programme écrit la routine (acceptation) ; la carte du coach n'y dit rien.
- **La fourchette n'est pas affichée pendant la séance de benchmark** : elle se lit sur la feuille de lancement et sur le bilan. La poser
  sur la ligne (la cible de répétitions) rouvrait le défaut 3.

**Pièges rencontrés.**

- **Une assertion qui ne prouvait rien, encore.** « Le coach n'enregistre aucun objectif pour un benchmark » était un test vert — et le
  contraire de ce que l'utilisateur voulait. Un test qui décrit l'implémentation plutôt que le besoin se corrige avec elle ; ceux-ci ont été
  réécrits (`n'évalue pas la séance…`, `ne prend pas la charge d'un benchmark pour un objectif suivi`) en disant ce qui reste vrai : aucune
  règle de séance, et rien de « suivi » par la charge d'un essai à fond.
- **Le `;` n'est pas un `&&`.** Un lint en erreur est passé dans un commit parce que la commande enchaînait `eslint | tail` et `git commit` ;
  corrigé par un `--amend` avant le push. Enchaîner les portes avec `&&`.

### 2026-10-15 — Le benchmark : une série à l'échec par exercice, qui cale les charges de la routine

**Demande.** « Une séance avec une série, le plus de répétitions possible, ça nous calibre notre coach, une série
par exo. » Spec : `docs/design/specs/2026-10-15-benchmark-design.md` ; exécution :
`docs/design/plans/2026-10-15-benchmark.md`.

**Ce qui est fait.** `Workout.kind: 'benchmark'` (optionnel, validé par la sauvegarde, aucune version de schéma) ;
une séance construite depuis la routine puis réduite à une série `failure` par exercice, sans cible de répétitions
ni de RPE ; un module pur (`lib/benchmark.ts`) qui lit le maximum (formule des réglages, 1 à 12 répétitions) et
en tire la charge où le bas de fourchette laisse deux répétitions en réserve ; un écran de bilan
(`/benchmark/:id`) qui propose, exercice par exercice, d'écrire cette charge dans la routine.

**« Calibrer le coach » veut dire : poser le bon point de départ, pas ouvrir un canal vers le moteur.** Le coach
progresse à partir des cibles de la routine et de ce qui a été fait ; un départ faux se rattrape en un cran par
séance, pendant des semaines. Le benchmark écrit la charge juste dans la routine — **sur acceptation** — et
rien d'autre. Aucun état « calibré » n'est stocké, aucune donnée nouvelle n'est lue par le moteur.

**Ce que le coach lit du benchmark — état de la v2.12.2, changé ensuite : voir l'entrée « le benchmark suit la fourchette, et le coach le lit ».**
Le moteur (`lib/coach`) ne lit **aucune charge cible de routine** : il juge des séries *faites*. En v2.12.2 le benchmark ne lui
apportait rien d'autre que les cibles de la routine, une fois acceptées, et la résolution d'un objectif déjà posé à l'acceptation. La
question de l'utilisateur — « le coach doit lire ce benchmark et proposer des charges adaptées » — a montré que ce n'était pas ce qu'il
attendait.

**Ce que le benchmark nourrit, et ce qu'il n'alimente pas.** Une série à l'échec est une vraie performance : records,
volume par muscle, régularité, courbes, historique la comptent. Elle n'est pas le modèle d'une série de travail,
donc tout ce qui **prescrit** l'écarte : les valeurs fantômes (`getLastPerformance`), l'historique du coach et son
rejeu de sauvegarde, l'évaluation et le suivi d'objectifs de fin de séance, la revue des cibles (les deux
fenêtres), la rotation de la routine suggérée à l'accueil. Chaque garde a été retirée une à une : chacune fait
échouer un test. Un index sur `kind` aurait coûté une version de schéma pour une question posée sur quelques
séances à la fois — `benchmarkIdsAmong` lit ces séances par lot.

**L'écriture est un décalage, donc elle se rejoue mal — et c'est ce qui a été protégé.** Écrire « +7,5 kg » deux
fois (double appui, ou deux onglets) fait 85 kg. Chaque proposition porte la série qu'elle a lue et la charge
qu'elle y a vue ; elle ne s'applique que si cette série porte encore cette charge. Une routine modifiée entre le
bilan et l'appui n'est pas écrasée, une série de référence supprimée annule la proposition. Le compte annoncé est
celui des **exercices** réécrits : l'écran disait « 2 exercices » pour un seul, parce que le chemin d'écriture
qu'il réutilise compte des séries.

**Choix de détail, à relire.**

- **Bas de fourchette + 2 répétitions de réserve** (`BENCHMARK_RESERVE_REPS`). Une série de travail commence deux
  répétitions avant l'échec ; la double progression a ensuite la place de monter. À juger sur le terrain : si les
  charges proposées paraissent trop basses ou trop hautes, c'est une constante.
- **Arrondi vers le bas, toujours** *(remplacé le 2026-10-16 par l'arrondi au plus proche du pas renseigné — entrée du jour)*. Sur la grille du matériel ; à partir de la charge essayée quand le pas est
  celui que la personne a saisi (un cran de 1,125 kg ne tombe pas sur un multiple de 1,125).
- **Seul `weight_reps` reçoit une charge.** Pour un lest ou une assistance, la charge n'est qu'une part de ce qui
  est soulevé ; pour un temps, il n'y a pas de charge. Leur résultat est noté, rien n'est proposé.
- **Au-delà de 12 répétitions, pas d'estimation** : « trop léger, refais-le plus lourd ». Les formules
  extrapolent au-delà ; un chiffre inventé ferait pire que rien.
- **Pas de comparaison entre deux benchmarks.** Une série à l'échec est un point bruité ; une courbe de points
  bruités fabrique des tendances.

**Une porte qu'on ne trouve pas n'existe pas (v2.12.1).** Livré, le benchmark n'était qu'une ligne du menu ⋮ d'une
routine dans la liste — un menu qu'on n'ouvre que pour dupliquer ou supprimer. L'utilisateur a regardé et ne l'a pas vu ;
rien n'était cassé. Une seconde porte, **dans l'éditeur de la routine** (là où on regarde ses exercices, sous « Mettre à
jour les cibles »), ouvre la même feuille (`BenchmarkLaunchSheet`, partagée : les deux portes ne peuvent pas dériver). Avant
d'ajouter une fonctionnalité derrière un menu, se demander où l'on irait la chercher. L'autre cause possible — une PWA qui
ne se met pas à jour (`registerType: 'prompt'`), un APK pas réinstallé — se lit au numéro d'en-tête.

**Pièges rencontrés.**

- **Une assertion qui ne prouvait rien.** L'E2E vérifiait que le champ de charge de la séance suivante affichait
  105 (la cible calibrée) : la cible de la routine passe avant la « dernière fois », donc l'assertion passait
  avec ou sans l'exclusion du benchmark. Celle qui la prouve est la colonne « Précédent » vide (vue rouge quand
  la garde est retirée). Une assertion se mute comme le code.
- **Un test unitaire cassé deux commits plus tôt.** `HomeScreen.test` remplace `useLiveQuery` par `() => null`
  et mocke chaque carte qui lit ses propres tables ; la carte « Volume bas » (R6) n'y était pas, et `lows.length`
  tombait sur `null`. Le défaut était dans le test, mais il n'avait pas été vu parce que la passe complète des
  tests unitaires n'avait pas été refaite après R6. **Une passe complète avant chaque commit de fonctionnalité,
  pas seulement les tests du dossier touché.**
- **`pkill -f` tue le shell qui l'invoque** : le motif figure dans sa propre ligne de commande. Terminer un
  serveur par son PID.

### 2026-10-14 — R6, le volume par muscle : ce que le coach n'ajoute plus, ce que la personne demande à entendre

**Constat.** La tranche 5 du coach v2 attendait son plan depuis le 4 octobre. Le coach raisonne exercice par
exercice : en semaine de surcharge il propose d'ajouter une série à un muscle déjà au plus haut de ce que la
personne a tenu. Spec, décisions d'ouverture et leurs raisons : `docs/design/plans/2026-10-04-coach-v2.md`.

**Ce qui est fait.** Des règles pures (`lib/coach/volume.ts`) ; un plafond qui retire `add_set` ; une note de
carte qui dit pourquoi ; un réglage `coachVolumeBounds` ; un écran « Volume par muscle » (Réglages › Coach) ;
une carte d'accueil « Volume bas » pour un plancher que la personne a posé.

**Le plafond ne change presque rien tant qu'on ne le relève pas — et c'est la décision, pas un défaut.**
`add_set` n'est choisi qu'en phase de surcharge, et un pratiquant régulier est à son maximum par
construction : à 10 séries de pecs par semaine, le plus haut des six semaines est 10, la semaine glissante
l'égale, la série en plus est retirée. La spec (Q3) le veut ainsi : le coach ne propose pas d'aller au-delà de
ce qui a déjà été tenu. L'écran rend la décision visible, et c'est lui qui la porte : pour progresser en
volume, on relève son plafond. **À juger sur le terrain** — si la règle bloque trop souvent, c'est le défaut de
`effectiveCeiling`, un seul endroit.

**Pourquoi rien n'est journalisé, et pas de version de schéma.** Un constat de semaine n'a ni suite à suivre
ni objectif à refuser : `coachRecommendations` ne lui sert à rien, donc pas d'`exerciseId` facultatif. La
valeur du réglage n'est pas validée par la sauvegarde (une clé et une date lui suffisent) : elle est relue
défensivement, et une valeur abîmée à la main ne casse ni l'écran ni le coach.

**Pièges rencontrés.**

- **Un espace de noms déjà pris.** `volume` existait dans `fr.ts` (le volume d'entraînement, `volume.link`).
  Une seconde clé du même nom dans l'objet n'a pas fait d'erreur *à l'écriture* : la dernière gagnait, et
  les chaînes de l'écran « Volume par muscle » disparaissaient (affichées `volume.reading`). Renommé
  `muscleVolume`. Avant d'ouvrir un espace de noms, le chercher.
- **La semaine glissante d'un test dans le passé.** L'évaluation d'une séance ouverte lit « maintenant » ;
  un test qui sème des séances d'août ne voit alors aucune semaine glissante. Les tests figent `Date` seul
  (`vi.useFakeTimers({ toFake: ['Date'] })`) — les minuteries que Dexie utilise restent réelles.
- **Un test attendait le mauvais libellé.** « Ischios » est un raccourci d'écriture, le muscle s'appelle
  « Ischio-jambiers » : un test d'affichage lit l'écran, pas la tête de celui qui l'écrit.

**Ce qui n'est pas fait.** Le rejeu sur l'historique réel (`npm run coach:replay`) : la sauvegarde n'est pas
dans le dépôt. R6 n'a d'effet que pour un pratiquant en phase de surcharge ayant au moins trois semaines
d'un muscle — le rejeu dirait combien de propositions réelles elle aurait retirées. R7 reste reportée.

### 2026-10-14 — Les mensurations : le Lot 11 sans les photos

**Constat.** Le Lot 11 avait été scindé le 2026-08-11 (« les mesures restent, les photos sortent »), mais
seul le poids avait été livré, par une tuile de l'accueil : ni courbe, ni saisie datée, ni autre mesure.
Le schéma attendait pourtant du câblage et rien d'autre (`type` libre, `[type+measuredAt]`, `measuredAt`
rétrodatable, table déjà validée par la sauvegarde). Spec : `docs/design/specs/2026-10-14-mensurations-design.md`.

**Ce qui est fait.** Progression › Mensurations : quinze mesures (poids, masse grasse, tours, paires gauche
et droite), des champs libres, une saisie à n'importe quelle date, une courbe par mesure, un historique où
l'on corrige et supprime. Le poids de l'accueil est **la même mesure** et sa feuille mène à la courbe.

**Les choix qui engagent.**

- **Le poids reste le poids.** Il nourrit le tonnage au poids du corps, donc les records : toute écriture
  (saisie, rétrodatage, correction) passe par `saveBodyWeight`, et la suppression par un `deleteBodyWeight`
  neuf, qui refait les records des séances que la mesure couvrait. Vérifié contre une reconstruction
  complète des records (première, médiane, dernière et unique mesure). Les autres types n'ont aucun effet
  sur les records et ont un dépôt plus simple.
- **Un champ libre est rangé sous `custom:<nom>`**, pas sous son nom nu : un champ appelé « body_weight »
  se serait rangé sous la clé du poids — et aurait touché aux records — avec l'unité qu'on lui aurait
  donnée. Le préfixe est invisible à l'écran.
- **Une mesure par type et par jour**, la règle du poids étendue : saisir un jour déjà mesuré remplace la
  valeur et garde l'instant. La feuille le dit **avant** l'enregistrement.
- **Aujourd'hui = maintenant, un autre jour = début de ce jour local.** La tuile de l'accueil écrit à
  l'instant présent ; le poids du 3 octobre doit valoir pour toutes les séances du 3, pas celles d'après
  midi. Jamais demain, jamais un jour que le calendrier n'a pas (`new Date(2026, 1, 30)` glisse au 2 mars).
- **L'abscisse de la courbe est la date.** Une séance se compte, une mesure se date : trois semaines sans
  pesée doivent se voir. `plotTimedPoints` ne remplace que le x de `plotPoints`.
- **Aucun point n'est « le record »** : un tour de taille plus petit n'est pas meilleur qu'un tour de bras
  plus grand. Au-delà de trente points, seul le point touché reste dessiné ; le trait dit la tendance.
- **Plausible, pas arbitraire.** 825 cm de tour de taille écraserait l'échelle d'une courbe dont les bornes
  sont celles des données : pourcentage sous 100, longueur jusqu'à 300 cm, kilos jusqu'à 1 000. **Le poids de
  corps garde « aucun maximum » (spec du 2026-08-10)**, parce que c'est la règle de `saveBodyWeight`.
- **Le type se choisit avant la saisie, pas dedans** : deux feuilles empilées se disputent le focus et le
  défilement. « Quelle mesure ? », puis la feuille de saisie.

**Pièges rencontrés.**

- **L'échelle gravée tombait à côté des dates.** La borne basse (« 81,7 kg ») s'alignait sur la ligne
  « 11 août » au lieu du bas de la courbe, parce que la colonne de l'échelle s'étirait sur la hauteur du
  graphique **et** des dates. Vu sur une capture, pas à la lecture du code ; corrigé par une grille.
  `ProgressCard` (la courbe d'un exercice) a la même construction : **à vérifier sur son écran, non
  touchée**.
- **`−0`.** `Math.round(-5.5e-15) / 100` vaut −0, que `toBe(0)` refuse et que l'écran aurait écrit « −0 » :
  un écart nul est nul. Et `1,005 × 100` vaut `100,49999999999999` en flottants : l'arrondi passe par la
  chaîne (`1.005e2`) pour donner 1,01.
- **Un test attendait un record qui n'existe plus.** La projection est une *progression* de records : une
  séance qui ne fait qu'égaler la précédente n'en porte plus. Les chiffres du test ont changé, pas le code.

**Ce qui n'est pas fait.** Les photos (RF-39) et leur verrouillage ; Health Connect (RF-40) ; une tendance
lissée du poids (c'est une règle à juger, pas un défaut) ; l'indice de masse corporelle (il demande une
taille) ; un objectif chiffré.

### 2026-10-14 — La coche écrasait le poids qu'on venait de taper

**Constat.** Trouvé par l'E2E du 5×5, qui échouait une fois sur trente sans qu'on sache pourquoi : l'écran
de fin disait « 1 × 5 a atteint le haut de la fourchette » sans proposer de charge. La série était
validée **sans poids**. Rejoué cent fois, jamais reproduit ; trouvé en lisant le code, puis reproduit
**sans délai** avec un test.

**Le mécanisme.** `WorkoutSetRow` calculait les chiffres de la coche à partir des propriétés de la
ligne (`valueOf(champ) ?? valeurFantôme`), et ces propriétés viennent d'une requête vivante : elles
arrivent un instant **après** l'écriture. `isSetRecordable` exclut la charge (« la seule valeur qu'une
série peut ne pas avoir »), donc la coche est active alors que la saisie n'est pas encore revenue. Un
poids tapé puis validé aussitôt était déjà en base quand `completeSet` écrivait par-dessus — avec
`undefined` (la série partait sans charge) ou, après une première séance, avec la **valeur grise de la
séance d'avant** (le mauvais poids, enregistré sans que rien ne le dise). C'est la règle n° 4.

**Pourquoi c'est rare sur un téléphone, et pourquoi ça ne rassure pas.** Entre la dernière frappe et le
toucher de la coche il y a le temps d'un doigt, plus de 150 ms ; la requête vivante répond en 10 à 30 ms.
Mais l'écriture fait la queue derrière la transaction de records de la série précédente, qui grandit avec
l'historique : sur un vieux téléphone et des années de séances, la marge n'est plus celle qu'on croit.

**Le correctif est dans le dépôt, pas dans l'écran.** `completeSet(id, valeurs, { proposed })` relit la
série **dans sa transaction** ; `proposed` — ce que l'écran propose : la cible, la séance d'avant — ne
comble que les cases vides de cette ligne-là, et une valeur `undefined` ne signifie plus « effacer »
(c'est `updateSetValues` qui efface, volontairement). Seul ce que l'appelant **décide** remplace : la
durée du chrono, qui prime sur une durée tapée. La ligne n'envoie plus que ses propositions. Un test
écrit dans la base par une seconde connexion (que Dexie n'entend pas) reproduit la course sans délai ;
chacune des trois variantes du défaut — propositions qui écrasent, `undefined` qui efface, chiffres de
l'écran renvoyés comme décisions — a été **vue rouge** en la réintroduisant.

**À retenir.** Une valeur lue sur l'écran n'est jamais une donnée : c'est une photo, et la base a pu
bouger depuis. Toute écriture qui part d'une photo doit se réduire à ce qu'elle décide, et relire le
reste là où la transaction le garantit. Les autres écritures de la ligne (`updateSetValues`, frappe par
frappe) ne partent pas d'une photo et n'étaient pas concernées.

### 2026-10-14 — Remplacer l'exercice en séance : une place qui change d'occupant

**Constat.** « La machine est prise » est le cas le plus ordinaire d'une salle, et l'app n'offrait que
deux sorties : retirer l'exercice (et perdre son rang, son superset, ses notes, ses séries à faire) ou
l'ajouter ailleurs en fin de séance. Hevy a la fonction ; le cahier des charges ne la numérote pas.

**Ce qui est fait.** Menu ⋮ d'un exercice › « Remplacer l'exercice » › la bibliothèque, où l'on **touche**
l'exercice (un seul, pas de case à cocher ni de bouton de confirmation : entre deux séries, un appui de
trop). Le noyau est `replaceWorkoutExercise`, dans une transaction sur les tables de la projection des
records ; la logique pure (ce qui reste d'une série quand l'exercice change) est dans
`src/lib/exerciseReplacement.ts`.

**La règle : on remplace ce qu'il reste à faire, jamais ce qui a été fait.**

- **Aucune série validée** : la ligne devient le nouvel exercice, sur place — même rang, même superset,
  mêmes notes.
- **Des séries validées** : elles restent sur l'ancienne ligne, sous le nom de l'exercice qui les a vues ;
  une **nouvelle ligne** (même groupe de superset) prend la suite, juste dessous, avec les séries
  restantes. Un squat dont deux séries sont faites ne devient pas un leg press rétroactivement.
- **Tout est validé**, **même exercice**, **exercice inconnu ou supprimé** : refusé, sans rien écrire. Le
  menu dit pourquoi (« Toutes les séries sont validées : rien à remplacer. ») au lieu d'une entrée muette.

**Ce qui est effacé, et pourquoi.** Les chiffres saisis et **la charge visée** : « 100 kg » est un chiffre
de développé couché, pas de la place. La fourchette de répétitions, la durée et la distance visées
survivent **si le nouvel exercice les mesure** (8–12 répétitions ne valent pas pour un gainage chronométré).
L'instantané (nom, muscles, matériel, unilatéral, facteur de poids du corps), la cadence en répétitions et
le repos sont **recalculés** pour le nouvel exercice : les clés de l'ancien sont retirées et non écrasées,
sinon un exercice sans muscle secondaire hériterait de ceux du précédent.

**Ce que ça ne touche pas.** Les records (aucune série validée n'est modifiée ; la projection est dans la
même transaction par prudence), le schéma (`version` inchangée), la routine d'origine (la séance seule
change : « remplacer » n'est pas « modifier ma routine »).

**Ce qui n'est pas fait.** Proposer des exercices proches (même muscle, autre matériel) en tête de liste :
c'est une recommandation, donc une règle à juger — la recherche et les filtres de la bibliothèque
suffisent pour l'instant. Remplacer dans l'éditeur de routine : la routine se modifie déjà en
supprimant puis ajoutant, sans état à préserver.

### 2026-10-14 — Un E2E enfin commité, qui ne garde pas le déploiement, et la police du système

**Constat.** CLAUDE.md affirmait « l'E2E Playwright couvre les parcours » ; le dépôt n'avait ni
dépendance, ni configuration, ni test — la spec du skin TTY1 le disait elle-même (« le dépôt n'a pas de
Playwright : il n'y a pas de test visuel automatique »). Les sessions refaisaient donc à la main les
mêmes contrôles Chromium à 390 px, et un libellé qui déborde en TTY1 a été redécouvert **trois fois le
même jour** (4 octobre).

**Ce qui est fait.** `e2e/` (17 parcours, `npm run test:e2e`, 1 min 30) : le vrai build servi comme Pages,
390 × 844 tactile, mouvement réduit, service worker bloqué sauf pour le test hors-ligne. Chacun a été
**vu rouge** en réintroduisant le défaut qu'il garde. Deux passes complètes sans instabilité ; une seule
instabilité rencontrée, et elle venait du test (un « Accueil » touché pendant la navigation tardive vers
l'éditeur de routine) — `createRoutineFromTemplate` attend maintenant l'éditeur.

**Pourquoi il ne garde pas le déploiement.** Les portes de `deploy.yml` et d'`android.yml` sont
déterministes ; un navigateur ne l'est jamais tout à fait, et un parcours qui flanche ne doit pas
empêcher un correctif d'être publié. `.github/workflows/e2e.yml` tourne à part, sur chaque push et
chaque PR. **À promouvoir en porte** (ajouter `npm run test:e2e` à `deploy.yml`) quand il aura fait ses
preuves. Il n'a pas encore tourné sur GitHub : seulement en local, y compris avec `CI=1` et un serveur
démarré par Playwright lui-même.

**La police du système.** Android applique sa taille de police à `rem`, donc aux cibles en `size-12`
(3 rem) : 48 px à 100 %, 96 px à 200 %. À 200 %, trois cibles de l'en-tête de la séance repoussaient le
bouton d'aide hors de l'écran (+13 px de défilement latéral, le titre écrasé à zéro). Une cible tactile
est un nombre de pixels CSS, pas de rem : `Screen` (retour) et `HeaderAction` passent à `size-[48px]`.
**Le reste de l'app garde `size-12` / `min-h-12`**, qui n'a pas posé de problème mesuré à 200 %.

**Ce qui n'est pas corrigé : TTY1 à 200 %.** Son texte est une police bitmap à tailles fixes (12, 16, 24,
32 px) ; à 200 % elle est étirée et la barre du bas déborde de 160 px (« Progression », « Exercices »).
Un thème rétro dont le charme est la grille de pixels n'a pas de sens à deux fois sa taille : le test s'y
arrête à 130 %. Si on veut le tenir, la sortie est de fixer en pixels les libellés de la barre du bas
sous TTY1 (`tty1.css`, la règle `.text-[11px]` qui les passe en `0.75rem`).

**Le piège de la session.** `pgrep -f "<motif>"` s'est une nouvelle fois trouvé dans sa propre ligne de
commande et a tué le shell (déjà consigné le 2026-10-03 et le 2026-10-04). Arrêter un serveur par son
PID relevé avec `ss -ltnp`, ou avec le motif entre crochets (`[v]ite`).

### 2026-10-14 — Protéger l'historique : un rappel qui compte les séances, pas un export silencieux

**Constat.** La règle n° 4 garde une séance d'un crash, pas d'un téléphone perdu, réinitialisé ou
d'une app désinstallée (« Désinstaller l'app les efface », dit le README). La seule parade était un
export JSON à la main, et rien dans l'app ne se souvenait de l'avoir fait : ni date, ni rappel.

**Ce qui est fait.**

- **`lib/backupNudge`** (pur, testé, mutation vérifiée) : le rappel part de **trois séances** que la
  dernière sauvegarde ne contient pas, ou d'**une** quand elle date de quatorze jours ; rien à
  protéger, rien à dire, quel que soit l'âge du fichier ; « Plus tard » le fait taire sept jours.
  Quinze jours sans séance ne mettent rien en danger, trois séances jamais sauvegardées si.
- **`stores/backupMemory`** : deux dates dans `localStorage`, **hors sauvegarde** (préfixe
  `fittrack.` et non `fittrack:`, comme le déblocage de TTY1). Une date de sauvegarde dans la
  sauvegarde dirait toujours la précédente.
- **`data/repositories/backupStatus`** : une séance terminée compte si elle a été **créée ou finie**
  après la dernière sauvegarde — pas « modifiée » : `updatedAt` bouge au recalcul des records et
  annoncerait des dizaines de séances qui n'ont pas changé. Une séance Hevy importée aujourd'hui,
  de date ancienne, compte (`createdAt`).
- **Une seule porte d'export** (`features/settings/exportBackup`) pour les Réglages et la carte de
  l'accueil : la date retenue ne dépend pas de la porte empruntée. On retient l'instant où le
  fichier a été **construit** (`exportedAt`), pas celui où la feuille se referme ; rien quand elle
  est fermée sans choix ou que l'écriture échoue. Une **restauration** retient « maintenant » : le
  téléphone est alors exactement ce fichier, qu'il ait une date, qu'elle manque ou qu'elle soit
  dans le futur.
- **La carte de l'accueil** (`HomeBackupNudge`) : sous la séance à lancer, jamais au-dessus ; rien
  n'est rendu sans séance à protéger. Une ligne d'état dans Réglages ; le stockage persistant
  est demandé au démarrage (`platform/storagePersistence`) et son état lu dans Dépannage.

**Ce qui n'est pas fait, et pourquoi.** Un **export automatique silencieux**. Sur Android une web-app
n'écrit pas où elle veut : ses propres dossiers disparaissent **avec** elle (précisément la panne à
couvrir), l'écriture dans les dossiers publics demande le Storage Access Framework — un sélecteur de
dossier natif, donc un plugin que le projet n'a pas et qu'une session sans téléphone ne peut pas
essayer — et la feuille de partage réclame un geste. Le rappel suivi d'un seul appui est le
compromis qui marche partout. **À rouvrir** avec un plugin SAF et un essai sur appareil.

**À savoir.** `AndroidManifest.xml` déclare `allowBackup="true"` sans règle : la sauvegarde
automatique d'Android peut déjà restaurer les données à la réinstallation. Rien ne le vérifie
(IndexedDB est un LevelDB ouvert pendant la copie) — ne pas s'y fier, l'essayer un jour avec un
téléphone de test.

### 2026-10-14 — Dépendances : le minimum corrigé en production, et un outil de moins

**Constat.** `npm audit` : 23 avis, dont 3 en production (`@capacitor/android` 8.5.0, critique,
CVSS 9.3 ; `react-router` / `react-router-dom` 7.18.1, élevé). Presque tout le reste venait de
`@capacitor/assets`, un outil de dev qui n'a servi qu'**une fois** (générer les icônes, commande
déjà écrite en `npx` dans le plan Android) et qui embarquait `sharp`, `tar@6`, `xmldom` et un
`@capacitor/cli@5`.

**Ce qui est fait.**

- **`@capacitor/android`, `@capacitor/core`, `@capacitor/cli` → 8.5.1**, le correctif de l'avis
  (la navigation ne peut plus atteindre le chemin du proxy HTTP interne), les trois alignés.
  **Pas 8.5.2** : il touche aux zones sûres et au plugin SystemBars sur Android, que la session
  ne peut pas essayer sur un téléphone — à prendre avec son propre checkpoint (icône, barres du
  système, bas de l'écran de séance). 8.5.3 ne change que le CLI iOS.
- **`react-router-dom` → 7.18.2**, la première version corrigée. L'avis ne concerne que les API
  RSC instables ; l'app est en routeur hash côté client, donc exposée à rien — le correctif est là
  pour que `npm audit` redevienne lisible. Production : **0 vulnérabilité**.
- **`@capacitor/assets` retiré** des dépendances (292 paquets en moins). Les ressources générées
  sont versionnées dans `android/app/src/main/res`, la CI ne l'appelle pas ; la commande `npx`
  est dans `docs/ANDROID.md`, § 9.
- **`vitest` → 4.1.11** (chemin de lecture arbitraire via `@vitest/mocker`, en dev) et les paquets
  transitifs de build (`postcss`, `browserslist`, `nanoid`, `fast-uri`, `undici`…) mis à jour
  dans le lock.

**Ce qui reste, accepté.** Trois avis modérés, une seule chaîne, en outil de dev, rien dans le
bundle : `uuid` < 11.1.1 via `xcode` via `@capacitor/cli` (en amont ; npm propose « un correctif »
qui est un retour à 8.4.3).

**Le piège.** `npm audit fix` et `npm install -D vitest@4.1.11` plantent avec npm 10.9.4
(`Cannot read properties of null (reading 'edgesOut')`, dans la résolution des pairs optionnels de
vitest). `--legacy-peer-deps` « marche » mais **retire `@testing-library/dom`**, pair requis de
`@testing-library/react` : un lock qui passe et des tests qui ne se lancent plus. Ce qui a
fonctionné : `npx npm@11 install -D vitest@4.1.11`, dont la différence de lock ne montre que la
famille vitest. Toujours regarder le diff du lock après un `npm install`.

### 2026-10-04 — Le cadenas d'ordre revient dans le bandeau de la séance

**Ce qui a été dit.** « Et fais réapparaître le cadenas quand la routine est en cours. »

**Ce que le code répond.** Le cadenas n'avait pas disparu par accident : le 2026-09-06, « alléger la séance »
(`660fc61`) l'a sorti du bandeau avec la commande de deload pour le ranger dans le menu « Options de la séance »,
sous son libellé. La raison valait pour le deload — un geste qu'on fait presque jamais, qui pouvait être grisé et
devait dire pourquoi — et pas pour le cadenas : on s'aperçoit **en cours de séance** qu'on a pris les exercices
dans le mauvais ordre, jamais en dehors, et un geste qu'on cherche dans un menu est un geste dont on a oublié
l'existence. Le cadenas n'avait d'ailleurs aucun état grisé à expliquer (`OrderLockButton` n'a pas de `disabled`).

**Décision.** Le cadenas retrouve sa place d'avant, entre l'état « 80 % » et le bouton de repli, à 48 px ; le
deload reste dans le menu, où personne n'a demandé de le reprendre. **L'entrée du menu est conservée** : un seul
verrou (`useExerciseOrderLock`), deux commandes, la seconde pour qui ne sait pas lire l'icône. À retirer si la
redondance gêne — une ligne dans `WorkoutSheets`, plus la clé `workout.reorderMenuHint`. **Le piège :** ranger une
commande dans un menu parce qu'elle est rare suppose de savoir *quand* elle sert. Avant d'en sortir une de l'écran
où on l'emploie, regarder à quel moment on la cherche.

### 2026-10-04 — « Ajouter une série » recopiait l'échauffement, et ses chiffres devenaient la suggestion du travail

**Ce qui a été dit.** « Quand tu as fait une série d'échauffement, à la séance d'après tu vois les poids de ta
série d'échauffement en suggestions (place order) d'une série normale. » Puis, à la question de savoir s'il
marque ses échauffements : « Je mets systématiquement le marqueur échauffement. » Message dicté : je l'ai lu
« à la **série** d'après », la seule lecture que le code confirme (ci-dessous) — **confirmée ensuite** par
l'utilisateur.

**Ce que le code répond.**

- **Ce n'était pas la colonne « Précédent ».** `matchPreviousSets` apparie les échauffements entre eux et les
  séries de travail entre elles, par rang **dans leur type** (`lib/previousSets.ts`, testé depuis la v2.5.0).
  Rejoué dans Chromium — séance 1 avec une montée marquée, séance 2 ouverte — la première série normale
  affiche « Précédent 100 × 5 », pas 40 × 5.
- **La première lecture était juste et hors sujet.** Un échauffement **non marqué** fuit bel et bien : une
  première série plus légère laissée en « normale » est, pour l'app, la série 1 de la dernière fois, et rien
  ne la distingue d'une série de travail légère voulue (une pyramide). Deviner par la charge reste écarté,
  l'app préférant un type explicite à une heuristique. Mais l'utilisateur marque toujours : ce n'était pas
  son cas, et cette note l'avait pris pour la cause.
- **La cause : l'ajout recopiait la dernière série, quelle qu'elle soit.** `duplicateLastSet` (« Ajouter
  une série » en séance) et `addRoutineSet` (l'éditeur de routine) prenaient `siblings.at(-1)` : son type
  **et** ses chiffres. Après un échauffement validé à 40 × 5, la série ajoutée était « Série 2 —
  Échauffement » avec 40 / 5 en gris. La repasser en normale ne touche pas aux chiffres (changer le type
  n'y touche jamais, voulu), donc les 40 / 5 restaient, offerts comme suggestion d'une série de travail. Et
  une cible passe **devant** la suggestion de la séance précédente (`ghost = cible ?? précédent`,
  `WorkoutSetRow`) : le bon chiffre, 100 × 8, n'apparaissait jamais.
- **Dans une routine c'est pire** : la copie s'écrit en base et se rejoue à chaque séance, au lieu de
  disparaître avec la séance.
- **Pourquoi les tests ne l'ont pas vu.** Ceux de `programWorkout` et de `routineExport` la contournaient —
  type posé explicitement, ordre d'ajout inversé « parce que `addRoutineSet` recopie le type » — au lieu de
  s'étonner qu'il le recopie. Un contournement écrit dans un test est une question qu'on n'a pas posée.

**Décision.** Corrigé. `lastWorkingSet` (`lib/records.ts`, à côté d'`isWorkingSet`) rend la dernière série qui
compte ; `duplicateLastSet` et `addRoutineSet` recopient celle-là. Après un échauffement seul, la série ajoutée
est une série **normale, vierge**, et la séance précédente suggère le reste. Un échauffement posé après le
travail est sauté ; une série de travail d'un autre type (dégressive) se recopie comme avant, type compris.
Ce qu'on y perd : ajouter un second échauffement identique en un appui — rare, une montée change de charge, et
la montée calculée de l'exercice existe.

**Voisin, corrigé ensuite.** « Appliquer à toutes les séries » (éditeur de routine) envoyait **tout le brouillon
de la feuille, type compris** (`RoutineSetSheet`, `onApplyToAll(draft)`) à `applyToAllSets`, qui l'écrivait sur
chaque série. Constaté : une routine `[échauffement 40 × 5, travail 100 × 8]`, « Appliquer à toutes » depuis la
série de travail à 105 kg donnait `[normal 105 × 8, normal 105 × 8]` — l'échauffement planifié aplati en série de
travail. L'utilisateur a demandé qu'on le corrige ; le choix de sens, c'était : appliquer aux séries **du même
genre** que celle qu'on ouvre, **ne jamais écrire le type**, dire le genre dans le libellé. `applyToAllSets` lit
donc le `setType` du brouillon comme le genre de la source et non comme un chiffre à copier ; des chiffres sans
type sont des chiffres de travail. Depuis un échauffement, seuls les autres échauffements changent (« Appliquer
aux échauffements »). Le plan du Lot 4 disait « n'écrase que les champs fournis » : la feuille en fournissait six.

### 2026-10-04 — Une relecture externe du schéma d'entraînement : un point juste, deux à ne pas suivre

**Ce qui a été dit.** Le 29 septembre, un lecteur du dépôt a relu les index de `workouts`,
`workoutExercises` et `workoutSets` (`db.ts`, `version(1)` et `version(3)`) et en a tiré trois
remarques : `workoutSets` porte un `workoutId` qu'on retrouve par `workoutExerciseId` ; `[workoutId+order]`
ne lui dit pas à quoi il sert, puisque l'ordre « se calcule sans le stocker » ; et `workoutSets` pourrait
se passer d'`id` en prenant `[workoutExerciseId+order]` pour clé.

**Ce que le code répond.**

- **`workoutSets.workoutId` est lu, partout.** Douze requêtes font
  `db.workoutSets.where('workoutId')` — l'historique, l'export CSV, la décharge, les records
  (`recordSources`, `recordTimeline`), la fin et l'abandon d'une séance. C'est une redondance de
  normalisation voulue pour la lecture : toutes les séries d'une séance en **une** requête indexée, au lieu
  de deux (les lignes d'exercice, puis les séries par `anyOf`). Le retirer ajouterait du code et des
  lectures à chacun de ces endroits, pour rien gagné.
- **Les deux index composés `[workoutId+order]` et `[workoutExerciseId+order]` ne sont lus par aucune
  requête.** Le code lit par `workoutId` ou `workoutExerciseId` et **trie en mémoire** (`byOrder`,
  `sortBy('order')`). Seuls `db.ts`, une fixture de migration et le plan d'architecture les nomment. La
  remarque est juste ; la raison ne l'est pas : `order` n'est pas calculable, c'est une donnée de
  l'utilisateur (réordonner, supersets, verrou d'ordre). Ce qui est inutile, c'est **l'index**, pas le
  champ.
- **Une clé `[workoutExerciseId+order]` sans `id` casserait l'app.** Toute table est `Syncable` (UUID,
  ADR-005). `personalRecords.workoutSetId` désigne une série par son `id`. La sauvegarde identifie et
  dédoublonne les lignes par `id`. La suppression douce garde une série effacée à sa place : une clé de
  position entrerait en collision avec celle qui la remplace. Et renuméroter après un retrait deviendrait un
  changement de clé (supprimer puis réécrire) au lieu d'un champ qu'on met à jour — au milieu d'une séance
  où chaque série validée est écrite aussitôt (règle n° 4).

**Décision.** Aucune. Aucun changement de schéma n'a été fait, ni demandé. Retirer les deux index
inutilisés économiserait un index à maintenir par écriture sur chacune des deux tables : négligeable
pour une base personnelle, et non mesuré sur un vrai téléphone (le banc `fake-indexeddb` n'y dit rien).
Le coût, lui, est réel : une version de schéma fait monter `db.verno`, et une sauvegarde écrite ensuite
est **refusée** par une version plus ancienne (`unsupported-schema`) — alors que la PWA et l'APK peuvent
ne pas être sur la même construction. **À rouvrir seulement** dans une version de schéma qu'une autre
raison rend nécessaire, jamais seule.

### 2026-08-28 — Le mouvement de l'app a désormais des sorties, et un mode réduit qui réduit

**Ce qui change.** Toute navigation passe par `startViewTransition` (`app/navigation.ts`,
`useAppNavigate`), et le sens du déplacement vit sur `<html data-nav>`. `Screen` perd ses
`animate-rise` / `animate-fade` de montage : la transition porte l'arrivée **et** le départ.

**Pourquoi.** L'app n'avait que des entrées. Aller et revenir produisaient exactement la même
animation, donc l'app ne disait jamais dans quel sens on se déplaçait — et c'était ça, la
cause de « les transitions manquent de fluidité », pas la qualité des gestes eux-mêmes.

**Le pas fait 18 px, et ça se défend.** Une largeur d’écran coûterait 400 ms pour la même
information. On navigue ici entre deux séries (règle n° 5) : il suffit de dire d'où ça vient.
L'écran qui part recule moins loin (11 px) que celui qui arrive n'avance, donc il passe dessous
au lieu d'être poussé dehors — c'est le décalage qui fait la profondeur, pas la distance.

**Le mouvement réduit ne coupe plus, il réduit.** La règle globale reste comme filet, mais
chaque geste porteur de sens a sa version : déplacement, échelle et flou partent, opacité et
couleur restent. `flash` récupère au contraire sa durée entière — une couleur qui s'efface n'a
rien de spatial. WCAG 2.3.3 demande de désactiver le mouvement *non essentiel* ; un retour
d'état n'en est pas un.

**Ce qui reste ouvert.** Les micro-interactions des moments de la séance (série validée, record,
minuteur à zéro) ne sont pas faites : elles demandent de l’état dans `WorkoutScreen`, et elles
doivent se juger à l'œil sur le téléphone, pas au relevé de géométrie. `animate-flash` reste
donc déclaré et utilisé zéro fois — son emploi naturel serait la ligne de la série suivante
quand le repos tombe à zéro.

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

- **Pour les déclarations `!important`, l'ordre des couches CSS est INVERSÉ.** Une règle dans
  `@layer base` bat une règle hors couche, quelle que soit sa spécificité. Un override de
  `prefers-reduced-motion` écrit plus bas dans `index.css`, avec `!important` et un sélecteur de
  classe, était donc **silencieusement inerte** face à la règle globale sur `*` — aucune erreur,
  aucun avertissement, juste un correctif qui ne corrige rien. Le repère : à couche égale la
  spécificité tranche normalement, c'est le franchissement de couche qui s'inverse. D'où le
  regroupement de tout le mouvement réduit **dans** `@layer base`. Vérifiable en trois lignes
  dans la console : deux règles `!important` sur la même classe, une dans `@layer`, une dehors.
- **Un `var()` dans un `@keyframes` ne se résout pas pour `animation-timing-function`.** Le levé
  de l'écran d'ouverture déclarait `animation-timing-function: var(--ease-mech)` sur un palier :
  la valeur est ignorée et le segment repart en `linear`. Rien ne le signale — il faut échantillonner
  la position dans le temps pour le voir. Écrire la `cubic-bezier` en clair, et dire en commentaire
  de quel jeton elle est la copie. Plus généralement : **une animation se vérifie en la figeant.**
  `document.getAnimations().forEach(a => { a.pause(); a.currentTime = T })` puis un
  `getBoundingClientRect()` par élément donne toute la chorégraphie sans compositer une frame —
  utile quand le panneau navigateur est replié et que `screenshot` échoue.
- **`github-pages` était verrouillé sur la branche `main` alors qu'on travaille sur `master`.**
  Symptôme : le job `build` est **entièrement vert**, le job `deploy` échoue en **1 seconde avec
  0 étape exécutée**. Ce n'est ni le `base`, ni les permissions, ni les versions d'actions — c'est
  une _deployment branch policy_ sur l'environnement. Cause : Pages a été activé alors que le dépôt
  était encore vide, donc GitHub a créé l'environnement épinglé sur son nom de branche par défaut
  (`main`), qui n'existe pas ici. Correctif : Settings → Environments → `github-pages` →
  _Deployment branches and tags_ → remplacer `main` par `master`.
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
  > « vérifier la valeur d'un champ sans vérifier son focus ».
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
  `--accent-ink`, qui dans cette charte veut dire _engagé_ : une horloge en vert accent se lit
  comme un témoin d'état. Les relevés descendent **au-dessus de la liste qu'ils comptent**
  (règle posée au Lot 4) ; le coin haut-droit est aux actions.
- **Du code que rien n'exerce n'est pas du code qui marche.** Les quatre défauts du Lot 5 étaient
  dans du code écrit et _testé_ au Lot 2 — `getLastPerformance` avait sept tests verts. Ils
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
  parcours aux éléments dont la couleur _est_ l'information — sinon le prochain filet repassera au
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

- **Remboursée le 2026-10-14 — `lib/coach/evaluate.ts` (1 051 lignes) n'a jamais été consigné.** Il avait
  grandi tranche après tranche du coach v2 (994 lignes au 13 octobre, la plus grosse source hors
  dictionnaire) sans que l'écart figure ici — « un écart non consigné est le seul qui pose problème »,
  dit CLAUDE.md. Il faisait pourtant plusieurs métiers : lire les séries, remettre l'historique en
  ordre, huit détecteurs, arbitrer, orchestrer ; et il a déjà coûté à un lecteur (« dans quelle
  situation est-on ? », d'où `situation.ts`). Il est découpé en `constants`, `sets`, `history`,
  `rules/{range,drop,plateau,returning}`, `arbitrate` (53 à 284 lignes) et `evaluate` (138), **sans un
  caractère de corps de fonction changé** — vérifié par un script qui compare chaque déclaration à
  l'original — et sans toucher aux 444 tests du coach et de ses consommateurs, qui passent tels quels. Une doc de
  `plateauSignal` s'était séparée de sa fonction (trois helpers glissés entre les deux) : remise
  au-dessus. L'API publique de `evaluate.ts` est inchangée (ses exports d'avant y sont ré-exportés).

- **Assumée le 2026-10-04 — `workoutSets.ts` (dépôt) est remonté à 399 lignes**, après avoir été remboursé à
  266 le 2026-07-27 : il a grandi depuis, jusqu'à 393, sans que l'écart soit consigné (l'historique de ce clone
  est trop court pour dire ajout par ajout), et le correctif de l'échauffement y a ajouté six lignes — surtout
  du commentaire — et un import. Il garde **une**
  responsabilité — les séries de la séance en cours — et ses écritures partagent la même machinerie privée
  (`appendSet`, `mutateWithRecordsIfCompleted`, `liveSetsOf`) : les séparer obligerait à l'exporter. **À rouvrir**
  si une capacité de plus s'y ajoute : `completeFirstSide` et `resetUnilateralProgress` (une quarantaine de lignes,
  sans aucun des assistants privés) sont la sortie toute désignée.

- **Assumée le 2026-10-04 — quatre fichiers touchés par le cycle des programmes et le contexte
  multi-dossiers restent au-dessus des ~300 lignes** : `programSchedules.ts` (412), `ProgramDetailScreen.tsx`
  (502), `ProgramEditorScreen.tsx` (411) et `home.ts` (312, dépôt). Chacun garde **une** responsabilité —
  les écritures d'un split, la fiche d'un bloc, l'éditeur d'un bloc, la projection de l'accueil — et les
  trois premiers l'étaient déjà avant ce travail. Ce qui faisait deux métiers a été découpé :
  `ProgramSplitStep` (245 → 269 lignes, sous le repère) a rendu la séance du split à son propre composant
  (`ProgramSplitSession`, 173) ; le modèle du split a quitté `programEditorModel` (309 lignes) pour
  `programSplitModel` (182) quand l'ajout d'un dossier l'a fait dépasser 300 ; et la forme du contexte de
  dossiers, sa lecture et ses conversions vivent dans un module pur (`lib/routineContext.ts`, 101) plutôt que
  dans le dépôt. **À rouvrir** si l'un d'eux reçoit une
  troisième capacité : la lecture de la projection du bloc, dans `ProgramDetailScreen`, est la première
  candidate à sortir en module.

- **Assumée le 2026-10-03 — `src/styles/tty1.css` dépasse la règle des ~300 lignes (environ 790).**
  Une feuille de style qui habille un thème est une seule responsabilité, comme `index.css`
  (833 lignes) et `fr.ts` : ses sections suivent l'ordre où le skin se lit (jetons, tailles, formes,
  commandes, jauges, ouverture) et chacune cite l'écran de la maquette qu'elle reproduit. L'ouverture
  y a grandi de 60 lignes avec le démarrage complet (la fenêtre, la frappe, la porte) sans changer de
  nature : c'est toujours le même thème, et ses règles ne servent qu'à lui. La couper
  en plusieurs fichiers ferait lire un même thème en cinq endroits et obligerait `tty1.test.ts` et
  `Boot.test.tsx`, qui lisent ce fichier par ancres, à en connaître la carte. **À rouvrir** si un
  second thème de ce genre arrive : c'est alors la structure commune qui se dégagera, pas avant.

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
