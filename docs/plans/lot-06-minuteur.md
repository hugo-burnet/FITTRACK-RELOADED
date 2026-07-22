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
un **défaut de produit, pas une prescription** : il est ajustable ±15 s en séance, et l'utilisateur
peut le changer si sa pratique dit autre chose.

---

## Ce qui existe déjà (à ne pas réécrire)

| Endroit | Ce que c'est |
|---|---|
| `src/data/types.ts:104` | `Exercise.defaultRestSeconds?: number` — le défaut par exercice |
| `src/data/types.ts:133` | `RoutineExercise.restSeconds: number` — **0 = utiliser le défaut de l'exercice** |
| `src/features/routines/RoutineExerciseCard.tsx:145` | **La règle de résolution existe déjà** : `row.restSeconds > 0 ? row.restSeconds : (exercise?.defaultRestSeconds ?? 0)`. Elle est sur le point d'être dupliquée une troisième fois — l'extraire plutôt que la recopier. |
| `src/features/workout/ElapsedTime.tsx` | **Le patron à suivre.** Il dérive d'un timestamp et fait battre un `now` local à la seconde. Ne jamais compter à rebours dans une variable. |
| `src/data/repositories/workouts.ts` → `completeSet` | Le point de déclenchement : le minuteur part **à la validation d'une série**. |
| `src/features/workout/WorkoutScreen.tsx:155-160` | Le bandeau relevé au-dessus de la liste. **C'est là que le minuteur va**, pas dans l'en-tête : le Lot 5 a retiré le chronomètre de l'en-tête parce que rien n'y disait que c'était un menu. |
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

- Déclenché à la validation d'une série, durée par exercice.
- Son + vibration à zéro.
- Ajustement **±15 s** en cours de repos.
- Visible en haut de l'écran de séance.

---

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

- [ ] Valider une série → le minuteur démarre seul et sonne à la fin, app au premier plan.
- [ ] ±15 s pendant le repos, d'une main.
- [ ] Mettre l'app en arrière-plan 30 s pendant un repos, revenir → **le décompte est juste**.
      C'est ce qui casse si le minuteur compte au lieu de soustraire.
- [ ] Une série d'échauffement ne déclenche rien.
- [ ] Un superset ne déclenche qu'après son dernier exercice.

## Fin de session

`npm run typecheck && npm run test:run && npm run build` — les trois doivent passer. TDD sur la
logique métier : résolution de la durée, règle du superset, formatage du décompte. Puis commit,
`PROGRESS.md` à jour, et annonce du checkpoint manuel.
