# Jalons G0 + G1 — la couche d'analyse et la progression d'un exercice

> Spec de conception. Périmètre : `docs/plans/00-ROADMAP.md` (Lot 12, avancé), et
> `FITTRACK_01_RESTANT_EXPORTS_GRAPHIQUES.md` §9, §10.1, §12.
> Décidé avec l'utilisateur : SVG maison sans dépendance, G0 + G1 ensemble,
> §3.2 (validation numérique) reporté à son propre jalon.

---

## 1. Ce qui existe déjà, et qui change le périmètre de G0

Le document de finition demande en §9.1 trois requêtes bornées neuves :

```ts
listCompletedWorkoutsBetween(from, to)
listCompletedSetsForExerciseBetween(exerciseId, from, to)
listCompletedSetsBetween(from, to)
```

**Les trois existent déjà, sous un autre nom.** `listExportSources(scope)`
(`src/data/repositories/exportQueries.ts`, jalon E1) applique exactement les
règles que le §9.1 énumère : séances archivées seulement, lignes et séries
vivantes, **séries validées seulement**, `from` inclusif et `to` exclusif, et le
bornage passe par l'index `startedAt` au lieu de charger la table. Ses quatre
périmètres couvrent les trois signatures demandées :

| §9.1 demande | Ce qu'on appelle |
|---|---|
| `listCompletedSetsForExerciseBetween` | `listExportSources({ kind: 'exercise', exerciseId, from, to })` |
| `listCompletedWorkoutsBetween` / `listCompletedSetsBetween` | `listExportSources({ kind: 'period', from, to })` |

Son en-tête l'annonçait : « the bounded reads the exports **and, later, the
charts** are built on ». **G0 n'ajoute donc aucune requête.** Écrire
`analyticsQueries.ts` en doublon de `exportQueries.ts` créerait deux portes vers
la même table avec deux définitions possibles de « séance qui compte » — la faute
exacte que le jalon 08B vient de réparer entre l'écran d'historique et l'export.

**Écart assumé n°1 : pas de `src/data/repositories/analyticsQueries.ts`.** Le
jour où un graphique aura besoin d'une lecture que les quatre périmètres ne
savent pas exprimer, il ajoutera un périmètre à `ExportScope` — pas un second
fichier.

G0 se réduit donc à ce qui manque vraiment : **la couche d'agrégation pure**.

---

## 2. `src/lib/analytics/` — ce que vaut une séance

Trois modules purs, dans `lib/` qui est LA couche pure du §7 de l'architecture
(même raisonnement que l'écart déjà argumenté pour `src/lib/export/` : un second
arbre `src/domain/` au contrat identique n'aurait aucune règle pour le départager).

```text
src/lib/analytics/
├── periods.ts   — quelle tranche de temps, et comment on la découpe
├── metrics.ts   — quelle métrique un type de mesure autorise, et sa valeur
└── plot.ts      — des points en coordonnées SVG
```

### 2.1 `periods.ts`

```ts
export type PeriodKey = '4w' | '12w' | '26w' | '52w' | 'all';
export function periodBounds(key: PeriodKey, now: number): { from?: number; to: number };
```

`from` absent pour `'all'` — et c'est volontaire : `{ kind: 'exercise' }` accepte
`from` optionnel, donc « tout l'historique » n'a pas à inventer une date de
naissance de l'application.

Les bornes tombent sur des **débuts de semaine locale** via `startOfLocalWeek`
(déjà écrit et testé au Lot 07 pour la régularité), jamais sur « il y a 28 × 24
heures » : une période qui commence un mardi à 14 h coupe une semaine en deux et
fait clignoter le premier point selon l'heure d'ouverture de l'écran. `to` est la
fin de la semaine courante, pas `now`, pour la même raison.

### 2.2 `metrics.ts` — le cœur du jalon

**Ne jamais proposer la même métrique à tous les types d'exercice** (§10.1). Le
type de mesure lu est **celui de l'instantané** (`resolveExerciseIdentity`), pas
celui de la bibliothèque : c'est tout l'acquis du jalon 08.

```ts
export type MetricKey =
  | 'topWeight'      // charge max d'une série de travail
  | 'bestSetVolume'  // meilleure série, poids × reps
  | 'sessionTonnage' // tonnage de la séance pour cet exercice
  | 'topReps'        // répétitions max d'une série
  | 'totalReps'      // répétitions de travail de la séance
  | 'workingSets'    // nombre de séries de travail
  | 'lowestAssist'   // assistance minimale — MOINS EST MIEUX
  | 'topDuration'
  | 'totalDuration'
  | 'topDistance'
  | 'totalDistance';

export interface MetricDefinition {
  key: MetricKey;
  unit: TargetUnit | 'sets';
  /** L'axe du progrès. `'lower'` pour l'assistance, et seulement pour elle. */
  betterWhen: 'higher' | 'lower';
}
```

`betterWhen` n'est pas décoratif : sur une machine assistée, **descendre est une
victoire**. Sans ce champ, la courbe d'une progression réelle plonge et l'écran
félicite le mauvais point. C'est l'avertissement explicite du §10.1, et c'est la
seule raison pour laquelle le « record » d'une courbe n'est pas toujours son
maximum.

Métriques par type de mesure :

| `measurementType` | Métriques offertes, dans l'ordre |
|---|---|
| `weight_reps` | `topWeight`, `bestSetVolume`, `sessionTonnage`, `totalReps`, `workingSets` |
| `weight_time` | `topWeight`, `totalDuration`, `topDuration`, `workingSets` |
| `reps_only` | `topReps`, `totalReps`, `workingSets` |
| `assisted_weight_reps` | `lowestAssist`, `topReps`, `totalReps`, `workingSets` |
| `time_only` | `topDuration`, `totalDuration`, `workingSets` |
| `distance_time` | `topDistance`, `totalDistance`, `totalDuration`, `workingSets` |

**Écart assumé n°2 : pas d'allure (min/km) en V1.** Le §10.1 la mentionne « quand
distance et temps sont valides ». Elle demande une seconde inversion de sens
(une allure basse est bonne) et une unité composite que rien d'autre dans l'app
n'écrit. Une inversion suffit à un premier jalon ; la seconde arrivera avec un
usage réel du rameur.

**Écart assumé n°3 : pas de 1RM estimé.** Le §10.1 le tolère « avec une
définition et un domaine de validité stricts ». C'est RF-46 et il appartient au
Lot 12, avec son `lib/oneRepMax.ts` en TDD et sa formule configurable. Une
estimation glissée ici sans son écran de réglage serait un chiffre sans auteur.

Règles de calcul, communes :

- **échauffements exclus** — via `isWorkingSet`, jamais réécrit ici ;
- **`sessionTonnage` réutilise `sessionTotals`**, donc la même règle qu'à l'écran
  de fin de séance et que dans l'export : une assistance et une ceinture ne sont
  pas du tonnage. Aucun troisième calcul du tonnage n'existe dans ce dépôt ;
- une séance dont la métrique n'a **aucune valeur** (une séance de gainage sous
  la métrique `topWeight` après un retypage) ne produit **pas** un point à zéro :
  elle ne produit pas de point. Un zéro inventé fait plonger la courbe ;
- la date d'un point est **`workout.startedAt`** (§3.3), jamais `set.performedAt`
  — l'import Hevy interpole les heures de séries.

### 2.3 `plot.ts`

```ts
export function plotPoints(values: number[], box: PlotBox): { x: number; y: number }[];
export function plotBounds(values: number[]): { min: number; max: number };
```

Pur, donc testable : c'est ce qu'une bibliothèque de graphiques rendrait
impossible à vérifier. Deux cas que les tests fixent :

- **une seule séance** → un point, centré horizontalement, pas une division par
  zéro ;
- **toutes les valeurs identiques** → une ligne horizontale au milieu de la
  boîte, pas une division par zéro ni un tracé collé au bord.

L'échelle verticale est **bornée par les données**, pas par zéro. Une progression
de 80 à 85 kg sur un axe partant de zéro est plate et donc muette. Le prix de
cette liberté est payé comptant : **le minimum et le maximum sont gravés aux deux
bouts de l'échelle**, toujours, si bien qu'aucune lecture ne dépend d'une
supposition sur l'origine.

---

## 3. L'écran — `/analytics/exercises/:exerciseId`

### 3.1 Où on entre

- **fiche exercice** → une ligne « Voir la progression », sous les records ;
- **Historique** → une action d'en-tête « Analyses » vers `/analytics`.

**Pas de sixième onglet** (§12.1) : la barre en compte cinq et c'est la coquille
du Lot 1.

`/analytics` en V1 est la liste des exercices réellement pratiqués — la même
source que le filtre de l'Historique (`listHistoryExerciseOptions`), donc aucun
écran vide à concevoir pour un exercice jamais fait.

### 3.2 Chargement différé

Le routeur importe tout statiquement et le build avertit déjà sur le chunk
principal. Les deux routes d'analyse passent en `React.lazy` + `Suspense`
(§12.2). **La séance en direct ne paie pas le JavaScript des graphiques** — même
si, sans bibliothèque tierce, la facture est de quelques kilo-octets : la règle
vaut pour ce qu'elle empêche demain.

### 3.3 Composition

```text
┌─────────────────────────────────────────┐
│ ←  Développé couché                     │   Screen, titre = nom de l'exercice
├─────────────────────────────────────────┤
│ [Charge max ▾]        [4 s][12 s][26 s]│   ← rangée de filtres, HORS de la carte
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ CHARGE MAX              102,5 kg    │ │   ← Reading : label gravé / lecture metric
│ │ 27 juillet 2026                     │ │   ← la date du point sélectionné
│ │                                     │ │
│ │  105 ┄                        ●     │ │   ← max gravé ; ● accent = record
│ │        ╭──○────○───╮      ╭──       │ │   ← courbe --text-2, 2px, joints ronds
│ │   80 ┄○            ╰──○───          │ │   ← min gravé
│ │       3 juin              27 juil.  │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ SÉANCES                                 │
│ 27 juillet 2026    5 séries   102,5 kg │ │   ← le tableau accessible, en ListRow
│ 20 juillet 2026    5 séries   100 kg   │ │
└─────────────────────────────────────────┘
```

Rien de neuf dans ce dessin : `Screen`, `Card`, `ListRow`, `SectionTitle`,
`FilterChip`, la forme `Reading` de la fiche exercice, `label-xs` et `metric`.
Le seul composant réellement inédit est le tracé lui-même.

### 3.4 Les décisions de dessin, et leur raison

**Une seule chose est colorée : le point qui détient le record.** La charte
réserve l'accent aux actions primaires, aux séries validées et aux records —
« rien d'autre ». Une courbe de séances passées n'est aucun des trois ; le
sommet, si. L'accent redevient donc une information au lieu d'un décor, et le
graphique se lit d'un coup d'œil à bout de bras : le seul pixel vert est celui
qu'on cherchait. Sous `betterWhen: 'lower'`, c'est le **minimum** qui porte
l'accent.

**Aucune grille, aucun axe.** `dataviz` : « labels directs avant grille, grille
avant second axe ». Le min et le max gravés portent l'échelle verticale, les deux
dates aux extrémités portent l'horizontale. Sur 375 px, une grille est du bruit
qui rend la courbe moins lisible, pas plus.

**Deux étiquettes, jamais une par point.** La dernière valeur et le record. Le
reste est dans la grande lecture et dans la liste.

**Les points portent un anneau de 2 px en couleur de surface** (`--surface-1`),
sinon deux séances rapprochées fusionnent en une tache.

**On tape, on ne survole pas.** Un appui n'importe où dans le tracé sélectionne
le point **le plus proche en x** : aucune cible ponctuelle à viser, toute la
surface du graphique est active, ce qui satisfait la règle des 48 px sans
dessiner une seule cible. La grande lecture bascule alors sur cette séance. Rien
n'est accessible **uniquement** par ce geste (§12.4) : la liste dessous contient
chaque valeur.

**Le graphique est `role="img"` avec un `aria-label` qui résume** — métrique,
unité, nombre de séances, min, max, évolution — et le contenu réel pour un
lecteur d'écran est la liste. Un `<svg>` de points n'a rien à faire dans un ordre
de tabulation.

**Pas de squelette au changement de métrique** : le rendu précédent tient à
opacité réduite. Un vidage puis un redessin fait sauter la carte.

**Aucune animation d'entrée.** Le registre produit l'interdit (« product loads
into a task »), la charte n'a qu'une courbe mécanique et deux durées, et une
courbe qui se dessine toute seule ferait attendre une réponse à quelqu'un
d'essoufflé. La seule transition est celle de la lecture qui change de valeur.

### 3.5 États vides — trois, pas un

| Situation | Ce qui s'affiche |
|---|---|
| Aucune séance sur cet exercice | La ligne « Voir la progression » n'existe pas sur la fiche. |
| Aucune séance **dans la période** | La carte le dit et propose la période la plus large. Pas de carte vide. |
| Une seule séance | Le point, la lecture, et une phrase : une courbe demande deux séances. **Pas de trait entre un point et rien.** |

---

## 4. Tests (§14)

Purs, sans base, sur `lib/analytics/` :

- groupement autour d'un changement d'heure, et depuis un autre fuseau ;
- période vide, une seule séance, valeurs toutes égales ;
- échauffements exclus ; `dropset` et `failure` comptés ;
- assistance : la progression est décroissante et le record est le minimum ;
- métriques non offertes par un type de mesure ;
- séance sans valeur pour la métrique → aucun point, jamais zéro ;
- instantané contredisant la bibliothèque → l'instantané gagne (fixtures où les
  deux divergent **exprès**, comme au jalon 08B : deux valeurs concordantes ne
  peuvent pas dire laquelle a été lue) ;
- plusieurs séances le même jour → deux points, pas un.

---

## 5. Hors périmètre de ce jalon

- G2 (séances par semaine), G3 (séries par muscle), G4 (tonnage et durée) ;
- E3 (CSV) et E4 (JSON) ;
- §3.2, la validation numérique centralisée ;
- 1RM estimé, allure, radar, prédiction — §11 les nomme un par un.
