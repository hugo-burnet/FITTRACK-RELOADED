# Lot 6, tranche 1 — Minuteur de repos (M5, RF-22 + RF-27)

> Plan rédigé le 2026-07-22, à la fin de la session du Lot 5, à partir du code réellement existant.
> Le cadrage figé est dans `00-ROADMAP.md § Lot 6`.

**Objectif :** que l'app cesse d'obliger à en sortir toutes les deux minutes.

**Périmètre : le minuteur de repos, seul.** Le Lot 6 contient aussi le calculateur de plaques, le
calculateur d'échauffement, le RPE, la détection de record en direct et les types de séries.
**Rien de tout ça ici.** C'est une tranche, décidée comme telle : sans minuteur l'app n'est pas
exploitable en salle, le reste peut attendre.

**Dépend de :** Lot 5, terminé et déployé.
**Références obligatoires :** `00-ROADMAP.md § Lot 6` (l. 314-342), `01-ARCHITECTURE.md` ADR-004.

## Le besoin, dans les mots de l'utilisateur

> « le seul truc qui manque pour que ce soit vraiment exploitable c'est le chrono de pause. Si je
> dois sortir de l'app toutes les 2 min c'est incroyablement relou. »

Il sort aujourd'hui de FitTrack pour utiliser l'horloge de son téléphone entre chaque série.

---

## Décidé — ne pas rouvrir

- **À la fin du repos, il a l'écran allumé, le téléphone en main ou posé devant lui.** Son +
  vibration + décompte visible suffisent. Pas besoin de réveiller un écran éteint : le PWA ne sait
  pas le faire de façon fiable, et la roadmap le dit déjà (« ⚠️ en PWA il ne sonnera pas de façon
  fiable écran éteint — c'est attendu, le Lot 10 le corrige »). **Ne pars pas dans les
  notifications système ni le service worker.**
- **Wake Lock : en attente, ne pas l'implémenter.** L'utilisateur ne sait pas encore si son écran
  qui s'éteint le gêne. À reposer après sa prochaine séance, pas avant.
- **Superset : le minuteur ne part qu'après le dernier exercice du groupe**, jamais entre A et B.
  Et la durée retenue est **la plus longue configurée parmi les exercices du groupe**.
- **Une série d'échauffement ne déclenche rien.**
- **Défaut global quand ni l'exercice ni la routine ne donnent de durée : 120 s.** La résolution
  actuelle rend `0`, et un minuteur à 0 s n'a pas de sens.

### Pourquoi ces trois derniers choix

Tranchés sur la littérature plutôt que par l'utilisateur, qui fait peu de supersets et a délégué.

Ce qui **définit** un superset, c'est le repos minimal entre ses membres — sinon ce sont deux
exercices séparés. Les travaux sur les paires agoniste-antagoniste (Robbins, Paz, Maia) montrent
qu'un enchaînement à repos très court maintient la performance, parfois l'améliore, tout en
réduisant nettement la durée de séance ; à l'inverse, enchaîner deux exercices du **même** muscle
dégrade la performance sur le second. D'où : rien entre A et B, un vrai repos après le tour. Et la
durée la plus longue du groupe, parce que la récupération d'un tour est gouvernée par le mouvement
le plus exigeant — pas par celui qui se trouve être arrivé en dernier.

Les séries d'échauffement sont sous-maximales et non fatigantes : les minuter ralentit la séance
sans rien apporter.

120 s est le milieu de la fourchette que soutiennent Schoenfeld (2016) et les méta-analyses de
Grgic sur l'intervalle de repos, qui penchent vers ≥ 2 min pour l'hypertrophie et la force. C'est
un **défaut de produit, pas une prescription** : il se règle **par exercice** (Lot 3) et **par
routine** (Lot 4), et l'utilisateur peut le changer si sa pratique dit autre chose. Il n'y a pas
d'ajustement en séance — cf. « Ce que la roadmap demande ».

---

## Ce qui existe déjà (à ne pas réécrire)

| Endroit | Ce que c'est |
|---|---|
| `src/data/types.ts:104` | `Exercise.defaultRestSeconds?: number` — le défaut par exercice |
| `src/data/types.ts:133` | `RoutineExercise.restSeconds: number` — **0 = utiliser le défaut de l'exercice** |
| `src/features/routines/RoutineExerciseCard.tsx:145` | **La règle de résolution existe déjà** : `row.restSeconds > 0 ? row.restSeconds : (exercise?.defaultRestSeconds ?? 0)`. Elle est sur le point d'être dupliquée une troisième fois — l'extraire plutôt que la recopier. |
| `src/features/workout/ElapsedTime.tsx` | **Le patron à suivre.** Il dérive d'un timestamp et fait battre un `now` local à la seconde. Ne jamais compter à rebours dans une variable. |
| `src/data/repositories/workouts.ts` → `completeSet` | Le point de déclenchement : le minuteur part **à la validation d'une série**. |
| `src/features/workout/WorkoutScreen.tsx:155-160` | Le bandeau relevé au-dessus de la liste. Il reçoit **le seul texte** du minuteur (`REPOS 1:30`) — pas le minuteur lui-même, qui vit sur la ligne de série. Ne rien mettre dans l'en-tête : le Lot 5 l'a vidé parce que rien n'y disait que c'était un menu. |
| `src/features/workout/WorkoutSetRow.tsx` | **La ligne qui porte le filet.** Elle n'est pas `relative` aujourd'hui — c'est le seul changement de structure qu'elle demande. Et **aucun de ses pixels n'est libre** : rang, précédent, cellules et coche sont tous des commandes. |
| `src/lib/routineOrder.ts` → `toBlocks` | Regroupe déjà les lignes par superset. C'est ce qui répond à « suis-je le dernier de mon groupe ? ». |

## Le trou dans le modèle de données

`WorkoutExercise` (`src/data/types.ts:168-174`) **n'a aucun champ de repos**, et
`startWorkoutFromRoutine` ne recopie rien. Une séance en cours ne peut donc pas connaître la durée
prescrite par sa routine.

Ajouter `restSeconds: number` à `WorkoutExercise` et le recopier au démarrage. C'est cohérent avec
la dénormalisation déjà assumée dans cette table (« DENORMALISED on purpose — cf. architecture
§5 ») : la routine peut être modifiée ou supprimée pendant la séance, et une séance libre n'a pas
de routine du tout. Champ non indexé ⇒ pas de migration Dexie à écrire, **mais le vérifier** plutôt
que de croire ce plan.

---

## Les deux pièges techniques qui coûteront une heure chacun

1. **Stocker la date de fin, jamais un compteur qui décrémente.** `restEndsAt: number` (epoch ms),
   et `restant = restEndsAt - Date.now()`. Un onglet en arrière-plan voit ses timers étranglés à
   ~1/minute par Chrome Android : un compteur dérive, une soustraction sur l'horloge murale non.
   C'est aussi ce qui rend le minuteur juste quand il revient au premier plan.

   Ça reste **compatible ADR-004** : Zustand y est explicitement désigné pour « l'état du minuteur
   de repos », et un `restEndsAt` en store est éphémère et jetable. Ne pas le persister en base
   sans raison — ADR-004 dit que le store « peut être vidé à tout moment sans dégât ».

2. **Le son sera bloqué.** Sur mobile, lire un son exige un geste utilisateur ; un `Audio.play()`
   déclenché par un `setTimeout` sans interaction est refusé silencieusement. Débloquer un
   `AudioContext` au premier appui de la séance et le réutiliser. `navigator.vibrate()` n'a pas ce
   problème — le Lot 5 s'en sert déjà (pastille de 10 ms) — mais **vérifier les deux sur le
   téléphone**, pas sur le bureau.

## Ce que la roadmap demande, à respecter

- Déclenché à la validation d'une série, durée par exercice. ✅
- Son + vibration à zéro. ✅
- ~~Ajustement **±15 s** en cours de repos.~~ **Abandonné, sur décision de l'utilisateur** —
  il ne s'en sert jamais sur Hevy. Et le repos par défaut est réglable par exercice depuis le
  Lot 3 : ajuster à chaque série rustine un défaut mal réglé, au lieu de le corriger une fois.
  À rouvrir si une séance en salle le réclame.
- ~~Visible **en haut** de l'écran de séance.~~ **Déplacé sur la ligne de la série**, après trois
  jets écartés au doigt. Cf. « La forme retenue ».

---

## La forme retenue — le filet, seul

> Dessinée et **mesurée** le 2026-07-22, avant d'écrire une ligne de composant. Cinq jets, quatre
> écartés au doigt par l'utilisateur. Critique complète archivée dans `.impeccable/critique/`.

### La forme, en une phrase

**Le minuteur est un filet de 6 px sur le bord bas de la série qu'on vient de cocher.** Il avance,
il se remplit, il sonne. C'est tout.

```
 ┌────────────────────────────────────────────┐
 │ ←   Poussée                            ⋮   │
 │ 12:34  4 / 18 SÉRIES   REPOS 1:30          │ ← +1 mot, +0 pixel de hauteur
 │ ┌────────────────────────────────────────┐ │
 │ │ Développé couché (barre)             ⋮ │ │
 │ │      PRÉCÉDENT     kg    reps          │ │
 │ │ 1    97,5 × 5     100     5      ✓     │ │
 │ │▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                       │ │ ← 6 px, --accent-ink
 │ │ 2    97,5 × 5     100     5      ○     │ │
 │ └────────────────────────────────────────┘ │
 └────────────────────────────────────────────┘
```

**Aucune ligne ajoutée. Aucune commande. Aucun appui. Aucun décalage. Jamais.** Hors repos, l'écran
est celui du Lot 5 au pixel près.

### Comment on en est arrivé là — quatre jets écartés

| Jet | Pourquoi il est mort |
|---|---|
| **1 — bandeau de 56 px permanent** (`−15 s · décompte · +15 s`) | « Un peu fat. » Et **un défaut fonctionnel** : le décompte remplaçait le chrono de séance, donc on ne voyait plus depuis combien de temps on s'entraîne pendant la moitié de la séance. |
| **2 — bande bord à bord sous l'en-tête** | Corrigeait les deux, restait un objet ajouté : « ça fait posé, pas intégré à l'app ». **Conservé comme repli** si le défilement gêne en salle. |
| **3 — filet sur la ligne, commandes sur la ligne de relevés** | Les `±15 s` se retrouvaient à 100 px de la jauge qu'ils pilotent, hors zone du pouce, et la ligne de relevés passait de 28 à 48 px — 20 px de décalage, 60 fois par séance. |
| **4 — une ligne de repos avec pas-à-pas** (`−15 s · 1:30 · +15 s`) | Correct sur tous les plans, mais il restait 56 px et trois commandes **pour un réglage que l'utilisateur n'utilise jamais**. |

### Les deux décisions qui font tout

**1. `±15 s` est abandonné.** Décision de l'utilisateur, sur son usage réel : il ne s'en sert jamais
sur Hevy. Et l'argument tient sans lui — **le repos par défaut est déjà réglable par exercice depuis
le Lot 3**. Ajuster à chaque série, c'est rustiner un défaut mal réglé au lieu de le corriger une
fois. Une fonctionnalité qu'on retire est une fonctionnalité qui ne peut pas mal se comporter.

**2. Le filet n'est pas un bouton — il ne peut pas l'être.** L'idée d'un filet qu'on touche pour
faire apparaître les réglages a été examinée et écartée sur deux blocages :

- **Arithmétique.** 6 px contre 48 px de cible minimale : il faudrait une zone de touche huit fois
  plus haute que le trait, posée sur une ligne où **aucun pixel n'est libre**. Dans
  `WorkoutSetRow.tsx`, le rang est un bouton, « précédent » est un bouton, les deux cellules sont
  des champs, la coche est un bouton. De bord à bord, tout est déjà une commande.
- **Charte.** Un relevé qui cache une commande, c'est le défaut n°3 du Lot 5 — « le chronomètre
  était un menu secret ». Trouvé par l'utilisateur lui-même. Un trait de 6 px n'annonce rien.

### Pourquoi le filet, et pas autre chose

- **La jauge *est* la ligne.** Rien n'est ajouté à l'écran, donc rien ne peut « faire posé ».
- **C'est la suite du geste.** La coche se remplit d'accent, puis la ligne se remplit d'accent. Le
  repos est la fin de la série, pas un événement à part.
- **Il pointe la bonne série.** Sur vingt lignes quasi identiques, le filet dit *laquelle* repose —
  ce qu'un bandeau en haut d'écran ne peut pas dire.
- **Il n'y a rien à lire.** « Bientôt » est ce qu'on demande à un repos. Le nombre exact ne servait
  qu'à décider d'ajuster, et on n'ajuste plus.

### Trois choix tranchés par la mesure

**Le filet, pas l'aplat.** Un surlignage plein (la ligne entière qui passe en accent) a été monté et
mesuré : **le bord coupe une cellule de chiffres sur 65 % de la course**, et un `9` tranché à la
verticale se lit comme un bug de rendu. Le filet ne traverse aucun texte.

**`--accent-ink`, jamais `--color-accent`.** Mesuré : `--color-accent` sur `--surface-2` en thème
clair = **1,02:1**. Le filet serait purement invisible. En encre : **5,23:1 en clair, 12,87:1 en
sombre**, au-dessus du seuil 3:1 des éléments non textuels.

> ⚠️ **La même mesure a trouvé un défaut existant** : le rail de superset du Lot 4
> (`WorkoutExerciseCard.tsx:98`) est en `--color-accent` sur `--surface-0` → **1,29:1 en thème
> clair**, donc quasi invisible aujourd'hui. Le balayage de contraste des Lots 3/4/5 parcourt les
> **nœuds de texte** ; un filet n'en est pas un. **Le balayage doit s'étendre aux éléments non
> textuels porteurs de sens.**

**6 px, pas 3.** C'est le seul indicateur de progression et il n'est doublé par rien — contrairement
au rail de superset, qui a ses lettres A/B/C. À 5,23:1 en thème clair, 3 px est mince pour une basse
vision.

### `REPOS 1:30` sur la ligne de relevés

La durée configurée, dans le registre gravé, en `--accent-ink`. Elle répond une fois à « combien
dure cette pause » et ne bat pas.

Elle est là pour deux raisons. C'est **du texte, donc elle ne coûte aucune hauteur** — mesuré, la
ligne de relevés fait 25,6 px dans les six états, repos compris. Et c'est le **canal redondant** que
la règle du Lot 4 exige : un accent seul ne peut pas porter du sens (plein soleil, daltonisme), donc
un mot double le filet.

Le format reste `1:30` : l'app a son format de durée depuis le Lot 4 (`1:30 min · 20 kg`).

### Ce qui arrive quand — les cas d'ancrage

Le filet est ancré à **une position**, pas à un objet.

| Il se passe ça | Le repos |
|---|---|
| Tu coches une autre série | Redémarre, le filet suit. **Un repos à la fois.** |
| Tu décoches la série qui repose | **Continue.** Corriger une faute de frappe ne doit pas coûter ta récupération. |
| Tu supprimes la série qui repose | **S'arrête.** Le filet est ancré à une ligne ; sans hôte, il n'a pas d'endroit honnête où aller. Un filet qui saute sur la série suivante lui attribuerait un repos qu'elle n'a pas mérité. |
| Tu retires l'exercice | S'arrête : sa carte n'existe plus. |

Les deux derniers passent par le **même filet de sécurité** : si l'identifiant qui repose ne
correspond plus à aucune série affichée, le repos est arrêté. Sans lui le store garderait un
identifiant mort et la ligne de relevés afficherait « Repos 1:30 » jusqu'à la fin de la séance.
| L'app est tuée | Perdu, et c'est voulu : ADR-004 dit le store jetable, et la règle n°4 protège **des données**, pas un décompte de deux minutes. |

### Mesuré

- **Contraste : 0 échec, minimum 5,23:1** aux deux thèmes.
- Filet **68 px à 20 %**, **188 px à 55 %**, **341 px à zéro** — pleine largeur de la ligne.
- **Ligne de relevés à 25,6 px dans les six états.** Aucun décalage, nulle part.
- Aucun débordement horizontal, aucune cible tactile ajoutée ni modifiée.

### Accessibilité

Le filet porte `role="progressbar"` avec `aria-valuetext` : **le temps restant devient
interrogeable** sans qu'aucune annonce ne parte à la seconde. `aria-live` reste muet ; seules les
deux bascules sont annoncées (départ avec la durée, fin).

### Le reste

- **La jauge ne s'anime pas** : un cran par seconde. Rien à vérifier en frames dans un panneau qui
  n'en compose pas, et un onglet en arrière-plan n'a rien à rattraper.
- **Le son est synthétisé** (deux brèves à l'oscillateur sur l'`AudioContext` débloqué au premier
  appui) : zéro octet, zéro question de licence sur un dépôt public, hors-ligne.
- **Vibration de fin en motif** `[80, 60, 80]` ; le 10 ms existant reste « tu as franchi un seuil ».
- **À zéro, le filet tient pleine largeur pendant la grâce**, puis disparaît. L'absence n'est jamais
  une information.
- **Pas de « Passer »** : rien à passer.

### Ce que ça coûte, honnêtement

**La fin est discrète à l'œil.** Un filet qui passe de 95 % à 100 % ne fait pas d'événement : ce
sont le son et la double vibration qui portent le moment. C'est cohérent avec la section « Décidé »
(téléphone en main, écran allumé), mais c'est un pari.

**Le filet défile avec la carte.** Descendre voir un autre exercice pendant le repos le fait sortir
du champ. Prix de « rien d'ajouté à l'écran ». Repli documenté : le jet 2.

**6 px est un pari sur la lisibilité bras tendu.** Si ça ne se voit pas en salle, ce n'est pas
l'épaisseur qu'il faut changer — c'est la forme.

### La variante, si `±15 s` finit par manquer

Une ligne de repos insérée sous la série cochée (la place et le mécanisme d'`UndoRow`), portant un
pas-à-pas `−15 s · 1:30 · +15 s`, le filet sur son bord bas, un filet de carte au-dessus et des
touches en `--surface-1`. **Dessinée et mesurée** : 341 × 56, contraste 0 échec / min 5,23:1,
aucune cible sous 48 × 44. À reprendre telle quelle, sans re-décider.

### Chaînes à ajouter à `fr.ts`

`workout.restLabel` (« Repos {duration} », la ligne de relevés) · `workout.restRemaining`
(l'`aria-valuetext`) · `workout.restStarted` · `workout.restOver`. **Aucune chaîne de commande** —
il n'y a pas de commande.

## Contraintes de charte

- **Aucune chaîne en dur** — tout dans `src/i18n/fr.ts`.
- `--color-accent` est un **aplat** (une forme qui porte `--color-accent-fg`) ; `--accent-ink` est
  ce qui doit être **lisible sur** une surface. `index.css` explique pourquoi.
- Une seule courbe (`--ease-mech`), deux durées (`--dur-1`, `--dur-2`). Pas de dégradé, pas
  d'ombre décorative.
- **Réutiliser le vocabulaire visuel avant d'en inventer.** Regarder ce que `ui/` contient déjà.
  C'est la régression la plus fréquente sur ce projet, et elle ne fait échouer ni typecheck, ni
  lint, ni tests — elle se voit seulement à l'écran.

## Vérification — la limite de l'environnement

**Le panneau navigateur intégré ne compose pas de frames** : les captures d'écran expirent au bout
de 5 s et les transitions CSS n'avancent jamais. Vérifier par **mesure** (`getComputedStyle`,
`getBoundingClientRect`, lectures en base via `javascript_tool`), pas à l'œil. Le serveur de dev
tourne avec le base path `/FITTRACK-RELOADED/` et prend un port libre si 5173 est pris.

Trois réflexes gagnés au Lot 5, qui valent ici :

- **Ne jamais conditionner une écriture en base à un événement d'animation** (`transitionend` peut
  ne jamais arriver : onglet en arrière-plan). Un timer borné, toujours.
- **Ne jamais coder en dur une largeur de texte** — l'app n'embarque aucune police, mesurer le
  rendu.
- **Un callback passé en flèche inline ne va pas dans un tableau de dépendances** : l'épingler dans
  une ref mise à jour par un effet (le lint `react-hooks/refs` refuse l'affectation pendant le
  rendu).

## ✅ Checkpoint — à faire en salle

- [ ] Valider une série → le filet part seul et ça sonne à la fin, app au premier plan.
- [ ] **Le filet se lit d'un coup d'œil, bras tendu, sans le chercher.** C'est le point le plus
      fragile : 6 px, c'est un pari. S'il ne se voit pas, la forme est à revoir, pas l'épaisseur.
- [ ] **Tu descends voir un autre exercice pendant un repos.** Tu perds le filet de vue — est-ce
      que ça gêne ? Si oui, le jet 2 (bande bord à bord sous l'en-tête) est déjà dessiné et mesuré.
- [ ] **Est-ce que `±15 s` te manque ?** Il est volontairement absent. Si la réponse est oui une
      seule fois, on le remet — la variante est écrite plus bas.
- [ ] Mettre l'app en arrière-plan 30 s pendant un repos, revenir → **le filet est à la bonne
      position**. C'est ce qui casse si le minuteur compte au lieu de soustraire.
- [ ] Une série d'échauffement ne déclenche rien.
- [ ] Un superset ne déclenche qu'après son dernier exercice.

## Fin de session

`npm run typecheck && npm run test:run && npm run build` — les trois doivent passer. TDD sur la
logique métier : résolution de la durée, règle du superset, formatage du décompte. Puis commit,
`PROGRESS.md` à jour, et annonce du checkpoint manuel.
