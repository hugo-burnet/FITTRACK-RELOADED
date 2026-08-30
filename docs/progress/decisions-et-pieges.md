# Décisions, pièges et dette

> Archive extraite de PROGRESS.md le 2026-08-30. Le journal vivant est PROGRESS.md.

## Décisions prises en cours de route

_(Toute décision qui contredit ou complète `docs/plans/01-ARCHITECTURE.md` est consignée ici,
avec la date et la raison.)_

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
