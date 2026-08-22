# Exercices unilatéraux — une ligne, deux côtés — design

> **Date :** 22 août 2026 · **Branche :** `codex/tutorial-v2-p1-tail`
> **Statut :** contrat fixé par l'utilisateur, complété par deux décisions prises
> après la livraison du chrono.
> **Socle :** `docs/superpowers/specs/2026-08-22-hold-chrono-design.md` — la
> cadence d'une ligne est déjà soit des répétitions, soit un maintien, et le
> cycle deux côtés doit fonctionner sur les deux.

## 1. Le contrat

`isUnilateral` existe sur `Exercise` depuis le Lot 2 et **n'est lu par personne** :
c'est le contrôle « champ déclaré et lu par personne » ouvert au Lot 4, consigné
depuis comme *en attente*. Ce lot le ferme.

Pour un exercice porteur du drapeau :

1. **Une ligne représente les deux côtés.** Une seule saisie, une seule
   validation, un seul enregistrement.
2. **Première cadence pour le premier côté.**
3. À la fin du premier côté, annoncer **exactement** :
   « Changement de côté. Reprise dans dix secondes. »
4. **Attendre réellement dix secondes**, puis reprendre la cadence pour le
   second côté.
5. Le premier côté ne déclenche **ni validation durable, ni repos, ni RPE, ni
   record, ni volume supplémentaire**.
6. La série n'est terminée qu'après le second côté.
7. **Le `setId` ne change pas.** Les deux côtés sont la même série.
8. **Silence reste silencieux** ; le mode sons ne produit pas de voix.
9. **Aucune voix n'est générée dans ce lot.**

## 2. Ce qui a été décidé en plus

- **Les répétitions saisies valent par côté**, et la série s'enregistre **une
  fois**. Tu saisis 10 : la cadence bat dix fois à gauche, dix fois à droite, et
  la série vaut 10 × la charge. Doubler le tonnage créerait une rupture dans les
  courbes avec toutes les séances unilatérales déjà enregistrées, pour un gain
  de fidélité qu'aucun écran ne demande.
- **Sur une ligne unilatérale chronométrée, la coche finit le côté, pas la
  série.** Une cadence de répétitions sait compter jusqu'à la fin ; un maintien
  ne sait pas quand il s'arrête — la coche est le seul signal disponible. La
  première coche change de côté, la seconde valide.
- **La durée écrite est celle du côté qu'on vient de finir**, c'est-à-dire le
  second. C'est le geste qui la demande et c'est ce que l'écran affichait ; il
  n'existe pas de bonne réponse à un côté sur deux sans un second champ, et ce
  lot n'en ouvre pas.
- **Aucun échauffement n'entre dans le cycle.** `prepareNextPace` refuse déjà les
  échauffements, donc aucune horloge ne s'y ouvre et il n'y a rien à ajouter.
- **La coche pendant le premier côté d'une ligne à répétitions valide toute la
  ligne et annule le cycle.** L'utilisateur est l'autorité : reposer la barre
  plus tôt doit avoir une sortie.

## 3. Données — l'instantané de `isUnilateral`

Une séance passée doit rester lisible telle qu'elle a été faite. Le drapeau
rejoint donc l'instantané que `WorkoutExercise` porte déjà :

- `WorkoutExercise.exerciseIsUnilateral?: 0 | 1` — optionnel, **non indexé**,
  absent sur les lignes antérieures.
- `snapshotOf` l'écrit, `exerciseSnapshotOfRow` le recopie,
  `resolveExerciseIdentity` le résout — instantané d'abord, bibliothèque
  ensuite, exactement comme les cinq autres champs.
- **`db.ts` gagne `version(10).upgrade()`** qui remplit le drapeau sur les lignes
  **déjà instantanées**, depuis la bibliothèque — même geste et même garde que la
  version 4 pour les muscles secondaires. Une ligne sans instantané du tout
  continue de retomber sur la bibliothèque en bloc, ce que
  `resolveExerciseIdentity` attend d'elle.
- **`lib/backup/backfill.ts` gagne `toVersion10`** et
  `CURRENT_SCHEMA_VERSION` passe à **10**. `data/schemaVersion.test.ts` échouera
  tant que ce ne sera pas fait — c'est voulu, et c'est le garde-fou qui empêche
  une sauvegarde ancienne de revenir sans avoir vu la migration.

**`WorkoutSet.side` n'est pas touché.** Il reste `'both'` : une ligne représente
les deux côtés, et écrire `'left'` puis `'right'` demanderait deux lignes — ce
que le contrat interdit explicitement.

## 4. La machine du cycle

Un nouveau module pur, `features/workout/sideCycle.ts` :

```ts
export type SideStage = 'first' | 'transition' | 'second';

export type SideCycle =
  | { kind: 'idle' }
  | { kind: 'first'; setId: string }
  | { kind: 'second'; setId: string; resumesAt: number };
```

**Trois états visibles, deux états stockés.** `transition` n'est pas un état de
plus : c'est `second` avant son instant de reprise. Le stade se **dérive** d'un
instant absolu (`sideStageAt(cycle, setId, now)`) au lieu d'être avancé par un
minuteur — même règle que la barre de repos, le métronome et le chrono, et une
raison de moins pour que deux horloges se désynchronisent.

Les dix secondes ne sont pas comptées deux fois non plus : elles **sont** la
fenêtre de préparation de l'horloge du second côté. `resumesAt` et le
`startedAt` de l'horloge sont le même instant.

Opérations pures, toutes testées :

| Fonction | Rôle |
|---|---|
| `openSideCycle(setId, unilateral)` | ouvre le cycle au démarrage d'une horloge, ou rend `idle` |
| `sideStageAt(cycle, setId, now)` | le stade visible, `null` hors cycle |
| `turnSide(cycle, setId, now)` | `change` (premier côté fini) / `complete` (second) / `ignore` |
| `sideCycleWithoutSet(cycle, setId)` | referme le cycle d'une série validée, arrêtée ou supprimée |

## 5. Le geste, côté par côté

**Ligne à répétitions.** La cadence compte le premier côté et se termine toute
seule. Sa fin ouvre la transition : annonce, dix secondes, puis la cadence
repart **sur le même `setId`** pour le second côté. La fin du second côté arrête
l'horloge, comme aujourd'hui ; c'est la coche qui valide.

**Ligne chronométrée.** La première coche arrête le chrono, annonce le
changement de côté, attend dix secondes et relance le chrono. La seconde coche
valide la série et y écrit la durée du second côté.

**Dans les deux cas**, le bouton d'arrêt du bandeau annule le cycle avec
l'horloge : rien ne reste armé derrière.

## 6. Le son, et l'écran quand il n'y en a pas

Un cue `side-change`, tonalité `chime`, **sans clip** — comme les trente-six
repères du chrono. Le texte « Changement de côté. Reprise dans dix secondes. »
est figé ici et rejoint la validation des transcriptions avant génération.

**Le premier côté ne dit pas « Série terminée ».** Le cue de clôture d'une
cadence est `set-done`, dont les clips disent « Validé. » et « Série
terminée. » — faux au milieu d'une série. Sur le premier côté d'une ligne
unilatérale, `repBeats` ferme donc avec `side-change` à la place.

**En Silence, l'écran porte tout.** Pendant la transition, le relevé du bandeau
lit « Changement de côté · 7 » — la même forme que « Départ · 7 », parce que
c'est la même attente. Les côtés 1 et 2 gardent le relevé habituel : rien de
nouveau n'est inventé là où le vocabulaire existant suffit, et la place dans le
bandeau à 390 px est comptée.

## 7. Ce qui est testé

- Une ligne unilatérale produit **exactement deux côtés et une seule
  validation** — un test qui compte les séries en base après le parcours complet.
- Le `setId` est le même avant et après le changement de côté.
- Le premier côté n'écrit rien, ne démarre aucun repos, n'ouvre aucun RPE et ne
  crée aucun record.
- Les dix secondes sont réellement attendues : l'horloge du second côté démarre
  à `resumesAt`, pas avant.
- Le stade se dérive du temps : `sideStageAt` rend `transition` avant l'instant
  de reprise et `second` après.
- Un exercice **non** unilatéral n'ouvre aucun cycle — aucune régression sur le
  chemin de tous les jours.
- Un **échauffement** unilatéral n'ouvre aucun cycle.
- La coche pendant le premier côté d'une ligne à répétitions valide et referme
  le cycle.
- L'instantané : une ligne créée aujourd'hui porte `exerciseIsUnilateral`, une
  ligne ancienne le reçoit par la migration, et une sauvegarde ancienne le reçoit
  par le rattrapage.
- Le cue `side-change` n'a **aucun clip**.

## 8. Hors périmètre

- Enregistrer les deux côtés séparément (deux durées, deux séries).
- Doubler le tonnage d'une série unilatérale.
- Toute génération de voix.
- Le côté `left` / `right` dans `WorkoutSet.side`.
