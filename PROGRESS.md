# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session Claude Code. C'est la mémoire du projet entre les sessions.

**Dernière mise à jour :** 2026-07-22 (Lot 5 — code livré et mesuré, **checkpoint en salle à faire**)

## Lot en cours

**Lot 5 — Séance en direct.** Le code est livré, vérifié et commité ; **le lot n'est pas terminé**.
Il ne le sera qu'après une vraie séance en salle et l'aller-retour de correctifs qui suivra.

Plan détaillé : `docs/plans/lot-05-seance-en-direct.md`, généré en début de session comme aux
Lots 3 et 4. Le procédé tient sur quatre lots d'affilée.

**Site en ligne :** https://hugo-burnet.github.io/FITTRACK-RELOADED/ — poussé, à vérifier au doigt.

> ⚠️ **Ce lot n'est pas fini parce qu'il est vert.** Le Lot 4 était vert lui aussi — typecheck,
> lint, 148 tests, contrastes mesurés, cibles mesurées — et l'utilisateur a trouvé **sept défauts
> en deux essais au doigt**. Le Lot 5 confirme la règle : deux défauts trouvés en pilotant l'écran,
> puis **quatre passes de retours sur les boutons**, tous justes, aucun visible au typecheck, au
> lint ni aux tests. Il en reste certainement, et ils ne se trouveront qu'en salle.

---

## Lot 5 — Séance en direct (cœur)

### État vérifié le 2026-07-22

- ✅ `npm run typecheck`, `npm run lint`, `npm run test:run` (**213 tests**, +65), `npm run build`.
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
- ⬜ **Checkpoint en salle : à faire.**

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

### Ce que le Lot 5 ne fait pas — à savoir avant de tester

- **Le minuteur de repos** (Lot 6, RF-22/RF-27). Le repos par exercice est stocké et affiché, rien
  ne le déclenche.
- **Changer le type d'une série en séance** (Lot 6, RF-20). Le type est **repris de la routine** et
  affiché (« ÉCH. »), il ne se modifie pas ici.
- **Le RPE** (Lot 6, RF-30), **la détection de record en direct** (Lot 6, RF-23).
- **Relire ou corriger une séance passée** (Lot 7). Cet écran ne connaît que la séance `active`.
- **Une durée se saisit en secondes**, pas en `m:ss`. À rouvrir si ça gêne.
- **`isUnilateral` n'est toujours lu par personne.** Le champ existe depuis le Lot 2 ; ni le
  Lot 3, ni le 4, ni le 5 ne le consomment. C'est le contrôle de fin de lot institué au Lot 4 —
  consigné ici comme **en attente**, pas comme oublié.

### ✅ Checkpoint Lot 5 — **à faire en salle**

- [ ] **Une vraie séance complète avec l'app.**
- [ ] En pleine séance : tuer l'app depuis le gestionnaire de tâches, la rouvrir → la séance
      reprend où elle en était, aucune série perdue.
- [ ] Mode avion pendant toute la séance → aucune différence.
- [ ] Saisir une série sans lunettes, d'une main, en 3 secondes.
- [ ] Ajouter un exercice non prévu au milieu, et en réordonner deux au doigt.
- [ ] Se tromper de ligne, décocher, corriger.

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
| 5 | Séance en direct (cœur) | 🟨 code livré | 6 | ⬜ **en salle** |
| 5bis | Schéma musculaire | ⬜ à faire | — | ⬜ |
| 6 | Outils de séance | ⬜ à faire | — | ⬜ |
| 7 | Historique & calendrier | ⬜ à faire | — | ⬜ |
| 8 | Réglages & export/import | ⬜ à faire | — | ⬜ |
| 9 | PWA & installation | ⬜ à faire | — | ⬜ |
| 10 | Android (Capacitor) | ⬜ à faire | — | ⬜ |
| 11 | Mesures & photos | ⬜ à faire | — | ⬜ |
| 12 | Statistiques | ⬜ à faire | — | ⬜ |
| 13 | Records & notifications | ⬜ à faire | — | ⬜ |
| 14 | Sync cloud (optionnel) | ⬜ à faire | — | ⬜ |
| 15 | Health Connect | ⬜ à faire | — | ⬜ |
| 16 | Widgets | ⬜ à faire | — | ⬜ |
| 17 | Périodisation | ⬜ à faire | — | ⬜ |
| 18 | Auto-progression | ⬜ à faire | — | ⬜ |
| 19 | Assistant IA | ⬜ à faire | — | ⬜ |
| 20 | Voix & accessibilité | ⬜ à faire | — | ⬜ |

Légende : ⬜ à faire · 🟨 en cours · ✅ terminé · ⏭️ sauté

## Décisions prises en cours de route

_(Toute décision qui contredit ou complète `docs/plans/01-ARCHITECTURE.md` est consignée ici,
avec la date et la raison.)_

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
- **Écrire en base par IndexedDB brut ne réveille pas `useLiveQuery`.** Dexie n'émet ses événements
  que sur ses propres écritures : une table modifiée par `indexedDB.open()` direct laisse l'écran
  afficher l'ancien état indéfiniment, ce qui ressemble exactement à un bug de requête. Recharger
  la page après un montage de données fabriqué à la main — ou passer par les repositories.
- **Le panneau navigateur intégré perd parfois l'injection d'événements** (clics et captures
  d'écran expirent) alors que l'exécution JavaScript continue de répondre. Le contournement :
  vérifier par `javascript_tool` (styles calculés, rectangles, clics `element.click()`), et
  ouvrir un onglet neuf pour retrouver les captures. Les messages de console peuvent aussi être
  ceux de la session précédente — toujours confirmer l'état réel du DOM avant de diagnostiquer.

## Dette technique assumée

_(Raccourcis pris volontairement, à rembourser plus tard.)_

- **Deux repositories dépassent la règle des ~300 lignes** : `routines.ts` (504) et `workouts.ts`
  (522, après l'extraction de `workoutHistory.ts`). La règle de `CLAUDE.md` dit de découper ; la
  pratique du projet tolère cette taille depuis le Lot 4. Le vrai risque est la **trajectoire** :
  le Lot 6 (minuteur, records en direct, types de séries) et le Lot 7 (édition rétroactive)
  ajoutent tous deux à `workouts.ts`. **À découper au Lot 6**, avant qu'il ne grossisse encore —
  la couture naturelle est `workoutSets.ts` (exercices et séries de la séance) contre `workouts.ts`
  (cycle de vie de la séance).
