# Décisions, pièges et dette

> Archive extraite de PROGRESS.md le 2026-08-30. Le journal vivant est PROGRESS.md.

## Décisions prises en cours de route

_(Toute décision qui contredit ou complète `docs/plans/01-ARCHITECTURE.md` est consignée ici,
avec la date et la raison.)_

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
