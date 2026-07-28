# Jalon G3 — séries par muscle

> Spec de conception. Suite de
> `docs/superpowers/specs/2026-07-28-analytics-exercise-progress-design.md` (G0 + G1)
> et de `docs/superpowers/specs/2026-07-28-analytics-weekly-sessions-design.md` (G2),
> qui l'annonçaient hors périmètre en §5 et §10.
> Cadrage arrêté avec l'utilisateur : aucune nouvelle requête, **l'instantané ne
> porte que le muscle principal**, G3 est une **troisième forme** et non une
> variante, et les trois `MuscleGroup` sans région anatomique doivent être
> explicites.
>
> RF-42 (répartition des séries par groupe musculaire), Lot 12 avancé.
> **RF-43 (carte de chaleur) est hors périmètre** : `src/ui/BodyMap.tsx` n'existe
> pas, le Lot 5bis n'a jamais été fait, et ce jalon ne le fait pas non plus.

---

## 1. Ce que ce jalon montre, et la question à laquelle il répond

**Combien de séries de travail chaque muscle a reçues sur la période, du plus
servi au moins servi.** Le checkpoint du Lot 12 le dit dans les termes de
l'utilisateur : « la répartition par groupe musculaire révèle un déséquilibre
réel et vérifiable ».

Deux mots comptent dans cette phrase.

**« Réel »** : le chiffre doit être celui qu'on retrouve en comptant à la main
dans l'Historique. C'est ce qui exclut toute pondération (§3).

**« Déséquilibre »** : ce que l'écran doit rendre visible n'est pas ce qui est
beaucoup travaillé — ça, on le sait déjà — mais **ce qui ne l'est pas**. Un
muscle absent d'une liste ne se remarque pas ; c'est toute la difficulté du
jalon, et c'est ce que §5 tranche.

Pas de sélecteur de métrique : **une seule quantité, la série de travail.** Le
tonnage par muscle serait une autre lecture (une série de mollets et une série
de squat ne pèsent pas pareil) et il appartient à G4, comme le tonnage par
semaine. Un seul sélecteur, donc, `PERIOD_KEYS`, déjà écrit et déjà traduit.

---

## 2. Aucune requête neuve — troisième fois, même porte

`listExportSources({ kind: 'period', from, to })`, avec `periodBounds()` pour
les bornes. Exactement le couple de G1 et G2.

Un troisième fichier de requêtes ferait **une troisième définition de « séance
qui compte »** — la faute que le jalon 08B a passé une session à réparer entre
l'écran d'historique et l'export, et que G0 a refusé de rouvrir. `ExportSource`
porte déjà tout ce dont ce jalon a besoin : le `WorkoutExercise` (donc son
instantané), l'`Exercise` d'aujourd'hui (donc le repli), et les séries.

À noter, et c'est une différence avec G2 : **`hasEarlierHistory` ne dit rien de
la répartition.** Il existait parce que l'axe de G2 est le temps et qu'une
semaine vide *avant* le premier enregistrement n'est pas une mesure. Une
répartition n'a pas d'axe temporel : il n'y a pas de « muscle antérieur à
l'historique ».

**Correction apportée à l'implémentation, et elle rattrape une erreur de cette
spec :** la moyenne hebdomadaire de l'en-tête (§8.2), elle, est un chiffre *par
semaine*, et elle hérite donc mot pour mot du défaut que G2 a payé en usage —
trois semaines d'historique divisées par une fenêtre de douze annoncent un tiers
du rythme réel. `listCompletedWorkoutTimestamps()` est donc lu ici aussi, pour
la seule question à laquelle il sert : « y a-t-il quelque chose *avant* cette
fenêtre ». Et le nombre de semaines n'est pas `WEEKS[period]` mais
**`weeklySessionCounts(...).length`**, le moteur de G2 lui-même : cet écran et
celui des séances ne peuvent pas diviser par deux nombres différents.

Coût accepté, identique à G2 : pour `'52w'` on charge les séries d'un an pour les
compter. ~150 séances, ~1 500 séries, lecture indexée sur `startedAt`. Le jour où
ça se sent, la réponse n'est pas un second fichier de requêtes mais une
projection plus étroite derrière le **même** `ExportScope`.

---

## 3. Décision arrêtée d'avance : **le muscle principal seul**

C'est le point que le cadrage demandait de trancher explicitement plutôt que de
découvrir à mi-parcours. Tranché : **muscle principal seul, aucune migration v3,
aucune pondération.** Trois raisons, indépendantes, et chacune suffirait.

### 3.1 Lire les muscles secondaires repeindrait le passé

`WorkoutExercise` fige quatre champs depuis le jalon 08A :
`exerciseName`, `exerciseMeasurementType`, **`exercisePrimaryMuscle`**,
`exerciseEquipment`. `secondaryMuscles` en a été **exclu exprès** — la note du
type le dit : « nothing reads them from history, and the library still has them ».

Les muscles secondaires n'existent donc que dans la bibliothèque
**d'aujourd'hui**. Une répartition qui les lirait changerait rétroactivement à
chaque édition d'un exercice : ajouter « triceps » en secondaire au développé
couché redistribuerait six mois de séries passées. C'est mot pour mot le bug que
08B a réparé, transposé du nom au muscle.

La lecture du muscle principal, elle, passe par `resolveExerciseIdentity(row,
exercise)` — l'instantané, puis la bibliothèque, puis rien, champ par champ. On
ne réécrit pas cette règle, on l'appelle, comme `sessions.ts` le fait déjà.

### 3.2 Étendre l'instantané ne réparerait rien

L'option « migration v3 qui copie `secondaryMuscles` » a été examinée et écartée.
Une migration ne peut remplir les lignes existantes qu'avec la bibliothèque
d'aujourd'hui : elle **inventerait** le passé au lieu de le conserver, ce que 08A
avait précisément refusé de faire en laissant l'absence être le seul signal. On
paierait une migration, un test de migration sur une vraie base v2, et un champ
de plus dans quatre points de création — pour des données fabriquées.

Et cela ne réglerait pas le point suivant, qui est le plus fort.

### 3.3 Une série est une série — la pondération casse la vérification à la main

L'attribution fractionnaire (1 au principal, 0,4 aux secondaires, ce que le
Lot 5bis prévoit pour **colorer** une silhouette) ne peut pas devenir une unité
de comptage. « 48 » cesserait d'être un nombre de séries pour devenir un score
sans nom, dont le total ne vaut plus le nombre de séries faites, et qu'aucun
comptage manuel dans l'Historique ne peut retrouver.

Or le seul critère de validation de cet écran est justement celui-là : le chiffre
doit être vérifiable. **Un compte se vérifie, un score se croit.**

### 3.4 Ce que ça coûte, dit en français, une fois

Le développé couché compte pour les pectoraux et pour rien d'autre, alors qu'il
travaille aussi les triceps. C'est une approximation, et elle doit être **écrite
sur l'écran**, pas cachée : une ligne sous le graphique dit ce qui est compté.

Ce n'est pas une notice. Une notice explique **comment lire le dessin** ; cette
phrase déclare **ce qui est mesuré**, ce que `metricHint` fait déjà sous chaque
courbe de G1 (« Ne compte ni l'assistance ni le poids du corps »). La distinction
tient à une question : si on retire la phrase, le dessin reste-t-il lisible ?
Ici oui — il devient seulement moins honnête.

---

## 4. La troisième forme — et pourquoi `ChartSurface` ne sert pas

**Une répartition n'a pas d'axe temporel.** Ni courbe, ni histogramme : c'est un
**classement**, et sa forme est **une barre horizontale par muscle, décroissante,
avec le nom du muscle sur la même ligne**.

### 4.1 Pourquoi horizontal, et pourquoi pas les deux autres formes

| Forme | Pourquoi non |
|---|---|
| Barres verticales (G2) | Quinze étiquettes françaises sous quinze colonnes de 375 px : illisible ou tourné à 45°, ce qu'aucun écran de cette app ne fait. |
| Camembert / anneau | On compare des angles au lieu de longueurs, et quinze parts demandent une **légende** — donc une notice, donc raté (§4.4). |
| Radar | L'ordre des axes est arbitraire et la surface obtenue dessine une forme qui ne veut rien dire. Quinze axes sur 375 px. |

La barre horizontale est la seule forme où **le nom tient à côté de sa mesure**,
en toutes lettres, à taille lisible, sur 375 px. Ce n'est pas un choix de style :
c'est la contrainte de largeur qui décide.

### 4.2 Le dessin **est** la liste — et c'est ce qui fait tomber `ChartSurface`

Vérifié plutôt que supposé. `ChartSurface` possède exactement trois choses : le
`<svg>` et son `viewBox`, le contrat d'accessibilité (`role="img"` + résumé, hors
ordre de tabulation), et **« la marque la plus proche en x »**. Les trois tombent
ici :

- **Pas de `<svg>`.** Les étiquettes sont du texte français à taille de lecture.
  Dans un `viewBox` mis à l'échelle, un `<text>` ment sur sa taille — c'est
  exactement pourquoi G1 et G2 gardent *tout* leur texte en HTML **hors** du SVG.
  Si le texte est en HTML et que la barre est sur la même ligne, la barre est en
  HTML aussi.
- **Pas de « plus proche en x ».** Les marques sont empilées en y, et il n'y a
  rien à sélectionner (§4.3).
- **Pas de résumé à part.** En G1 et G2, le `<svg>` était muet pour un lecteur
  d'écran et il fallait une liste jumelle en dessous. Ici **le graphique est déjà
  la liste** : chaque ligne porte son nom et son nombre en texte. Il n'y a pas de
  doublon accessible à écrire, parce qu'il n'y a pas d'original inaccessible.

Le tordre pour le faire servir aurait été le premier `variant` — celui que la
spec de G2 nomme comme « le début du composant que plus personne n'ose toucher ».
**`ChartSurface` n'est pas touché par ce jalon**, ce qui est aussi la
vérification que ce qui y a été extrait en G2 était bien le bon morceau.

### 4.3 Aucune sélection, et c'est une conséquence, pas un oubli

G1 et G2 ont un curseur et une grande lecture au-dessus parce qu'**une marque
posée sur un axe partagé ne peut pas porter son étiquette** : un point de courbe
et une colonne d'histogramme n'ont ni la place ni l'orientation pour dire « 82,5
kg le 25 mai ». Le geste existait pour combler ce manque.

Une ligne classée porte déjà son nom et son nombre. Une sélection ne révélerait
**rien** — elle ajouterait un état à comprendre pour une information déjà écrite.
Donc : pas de curseur, pas de fente allumée, pas de grande lecture pilotée par le
doigt. La grande lecture de l'en-tête est le **total**, qui ne dépend d'aucun
geste.

Et les lignes ne sont **pas des boutons** : pas de chevron, pas de retour
d'appui. Une affordance qui ne mène nulle part est un mensonge tactile. La leçon
de G2 (« un emplacement vide doit rester visible et tapable ») visait le cas où
taper *fait* quelque chose et où la case vide en était exclue ; ici plus rien ne
se tape, donc le cas ne se pose pas — et le muscle à zéro est **entièrement lu**
(son nom, « 0 série »), ce que la colonne vide de G2 n'a jamais été.

### 4.4 Les règles de dessin, reprises telles quelles

- **Aucune grille.** Les barres partent toutes du même bord gauche et le nombre
  est écrit au bout de chaque ligne : l'échelle est portée par les chiffres, pas
  par des repères.
- **Aucune animation d'entrée.**
- **Le vocabulaire visuel existe déjà** : le rail proportionnel de la carte
  Régularité (`HistorySummaryCard`) est exactement cette barre — une piste en
  `--surface-2`, un remplissage à `scaleX(fraction)`. On le réutilise au lieu
  d'en inventer un.
- **Route différée** en `React.lazy`, quatrième du genre.
- **Pas de squelette** au changement de période : le rendu précédent tient à
  opacité réduite.

### 4.5 Une seule chose colorée — et ici, ce n'est **rien**

La charte réserve l'accent aux actions primaires, aux séries validées et aux
records. G1 colore le point du record ; G2 colore la semaine qui tient son
objectif, parce qu'un engagement tenu est une série validée à une autre échelle.

**G3 n'a ni record ni engagement.** Il n'existe pas d'objectif par muscle dans
cette app, et en inventer un serait exactement la faute que G2 a refusée :
« féliciter quelqu'un pour une cible qu'il n'a pas choisie ». Restent deux
tentations, écartées toutes les deux :

- colorer le muscle le plus travaillé en accent — ce serait **féliciter un
  déséquilibre**, l'inverse exact de ce que l'écran sert à voir ;
- colorer le moins travaillé en alerte — l'app n'a aucun seuil pour dire qu'un
  muscle est en retard, et une alerte sans critère est une opinion déguisée.

Donc **aucune barre n'est colorée**, toutes en `--text-2`. Zéro chose colorée
plutôt qu'une : la règle dit « une seule chose colorée **et c'est une
information** », pas « il en faut une ». Ce jalon n'a pas d'information à mettre
en vert, et l'accent reste ce qu'il est ailleurs.

---

## 5. Un muscle à 0 série : information ou bruit ? — **information, sauf trois**

C'est la transposition de la leçon de G2 que le cadrage demandait d'argumenter.

### 5.1 La transposition

G2 : une semaine vide **avant** le premier enregistrement n'est pas une mesure,
une semaine vide **dans** l'historique en est une. Ce qui départage n'est pas
« vide » : c'est **ce que l'app sait**. Pour une semaine d'avant l'historique,
elle ne sait rien. Pour une semaine du milieu, elle sait, et complètement.

Appliqué ici : sur une période donnée, l'app a la couverture **complète** de ce
qui a été fait. « Zéro série de mollets sur douze semaines » n'est pas une donnée
manquante — c'est un fait observé, et c'est précisément le fait que cet écran
existe pour donner. Il n'y a pas d'équivalent du « avant l'historique » : un
muscle ne commence pas d'exister à une date.

**Donc la liste des lignes vient de l'anatomie, pas des données** — même
conséquence structurelle qu'en G2, où les seaux venaient de la période et non des
séances. Un muscle négligé qui disparaît de la liste est un muscle qu'on ne
remarque pas : ce serait le seul vrai échec possible de cet écran.

### 5.2 Sauf trois — et c'est ainsi que le type devient explicite

Trois des dix-huit `MuscleGroup` n'ont aucune région anatomique : `cardio`,
`full_body`, `other`. Le cadrage exige que le type rende ce cas explicite plutôt
que de les laisser silencieusement invisibles.

Le critère qui tranche est celui du §5.1 : **un zéro sur ce groupe est-il un
manque ?** « 0 série de Corps entier », « 0 série d'Autre » ne disent rien à
personne — ce ne sont pas des muscles, ce sont des cases de rangement. Les mettre
à zéro dans le classement, c'est trois lignes de bruit permanent au milieu de
l'information.

Mais les faire disparaître serait l'autre faute, celle que le Lot 5bis nomme
(« ça existe, mais rien ne le montre ») : quarante séries de cardio ne doivent
pas s'évaporer d'un écran dont le titre est « séries par muscle ».

D'où **deux classes, et une table exhaustive qui force le choix à la compilation** :

```ts
export type MuscleScope =
  /** Une région du corps. Un zéro dessus est un manque à nommer. */
  | 'region'
  /** cardio, full_body, other : aucune région, et aucun manque à signaler. */
  | 'unscoped';

/**
 * `Record<MuscleGroup, …>` et non une liste : ajouter une valeur à
 * MUSCLE_GROUPS sans la classer **casse le typecheck**, au lieu de la laisser
 * silencieusement hors du dessin. Même mécanique que `muscle.*` dans `fr.ts`.
 */
export const MUSCLE_SCOPE: Record<MuscleGroup, MuscleScope>;
```

Comportement des deux classes :

| Classe | Dans le classement | À zéro |
|---|---|---|
| `region` (15) | oui, ordre décroissant | **la ligne reste**, « 0 série » |
| `unscoped` (3) | non | **la ligne n'apparaît pas** |

Une quatrième situation existe et ne doit pas être avalée : **une ligne dont le
muscle ne se résout pas** (aucun instantané *et* exercice introuvable —
improbable, `deleteExercise` étant un soft delete, mais pas impossible). Ses
séries vont dans la section hors classement sous « Muscle inconnu », jamais dans
`other` : `other` est un choix de l'utilisateur, l'inconnu est un trou de l'app,
et les confondre effacerait le trou.

**`neck` n'est pas un cas spécial.** Il restera à zéro chez presque tout le
monde. Il reste quand même : décider quels muscles méritent une ligne serait
l'app décidant à la place de l'utilisateur ce qu'il a le droit de négliger.

### 5.3 Le zéro doit rester visible — la seconde leçon de G2

En G2, une semaine à zéro ne dessinait rien, l'œil lisait un espacement
irrégulier, et « une fois le rythme des colonnes cassé toutes les hauteurs
paraissent arbitraires ». Réponse d'alors, validée en usage : 4 px dans le ton de
l'axe.

Même réponse ici, tournée de 90° : une barre de longueur nulle reçoit **un moignon
de 4 px en `--border`**, dans la piste. Ce n'est pas une quantité, c'est l'origine
qui s'épaissit là où une ligne existe et ne vaut rien. Et le symétrique, que G2
n'avait pas rencontré : **une petite quantité non nulle ne doit pas se lire comme
zéro** — 1 série sur un plafond de 60 fait 1,7 % de la piste, soit deux pixels.
D'où un **plancher** dans le calcul (§6).

---

## 6. `plot.ts` gagne une troisième géométrie — et pas une généralisation

`plot.ts` porte déjà `plotBounds`/`plotPoints` (la courbe, bornée par les
données) et `barLayout` (les colonnes, depuis zéro), côte à côte et **sans
drapeau** — parce qu'une ligne et une barre ne sont pas d'accord sur ce que veut
dire le bas de la boîte. On ajoute la troisième au même titre, on ne fusionne
rien.

```ts
/** Part de la piste, de 0 à 1. Pas des coordonnées : cf. le commentaire. */
export function barFractions(values: readonly number[], ceiling: number): number[];
```

**Pourquoi une fraction et non des pixels**, alors que les deux autres fonctions
rendent des coordonnées : parce que ces marques-là portent des étiquettes HTML
(§4.2), donc la piste est fluide et sa largeur n'est connue qu'au rendu. Une
fraction est aussi ce que le rail de `HistorySummaryCard` consomme déjà
(`scaleX(progress)`).

Ce n'est donc pas `barLayout` transposé : `barLayout` place N colonnes **le long**
d'une boîte (`slot`, `centerX`, `BAR_FILL`) parce que l'axe des abscisses est à
lui ; ici la mise en page des lignes appartient au DOM, et il ne reste **qu'une
seule quantité par ligne**. Quatre des cinq champs de `BarSlot` seraient ignorés.

Ce que la fonction possède vraiment, et qui se teste :

- `ceiling` fourni par l'appelant, comme pour `barLayout` : c'est **le plus grand
  compte** (aucun objectif à intégrer ici, §4.5) ;
- `ceiling` à zéro (fenêtre vide) → que des zéros, aucune division par zéro ;
- une valeur nulle → **exactement 0**, jamais le plancher : l'absence n'est pas
  une petite quantité, et c'est le moignon `--border` qui la dit (§5.3) ;
- une valeur non nulle → au moins `MIN_FRACTION`, pour que 1 sur 60 reste une
  barre et pas rien ;
- proportionnalité stricte au-dessus du plancher : 20 et 10 font du simple au
  double, la longueur **est** la quantité, exactement comme `barLayout`.

---

## 7. `lib/analytics/muscles.ts` — le comptage, pur

```ts
/** Une ligne de séance, réduite à ce qu'un comptage par muscle demande. */
export interface MuscleRow {
  /** Résolu par `resolveExerciseIdentity` : instantané, puis bibliothèque. */
  primaryMuscle?: MuscleGroup;
  sets: WorkoutSet[];
}

export interface MuscleCount {
  /** `undefined` = muscle non résolu, cf. §5.2. */
  muscle: MuscleGroup | undefined;
  sets: number;
}

export interface MuscleBalance {
  /** Les 15 régions, **toutes présentes**, décroissantes. */
  ranked: MuscleCount[];
  /** cardio / full_body / other / inconnu, **seulement s'ils portent quelque chose**. */
  unscoped: MuscleCount[];
  /** Toutes séries de travail confondues — les deux listes réunies. */
  total: number;
}

export function muscleBalance(rows: readonly MuscleRow[]): MuscleBalance;
export function toMuscleRows(sources: readonly ExportSource[]): MuscleRow[];
```

Pur, aucune base, aucune chaîne française. Deux règles héritées, ni l'une ni
l'autre réécrite :

- **les échauffements sortent par `isWorkingSet`** — RF-20, la règle de
  `records.ts`, jamais restatée ailleurs ;
- **l'identité vient de `resolveExerciseIdentity`** (08B), dans `toMuscleRows`,
  exactement comme `sessions.ts` le fait pour la courbe.

Et une règle propre à ce jalon : **un exercice pratiqué deux fois dans la même
séance additionne ses séries.** En G1, une séance vaut un point et un exercice
repris en fin de séance ne fait pas deux points ; ici l'unité est la série, pas la
séance, donc on additionne. Ce n'est pas une incohérence, c'est la même règle —
compter ce qui a été fait — appliquée à deux unités différentes.

**Égalités :** à compte égal, l'ordre canonique de `MUSCLE_GROUPS` départage. Il
est déjà anatomique de haut en bas, il est stable, et il évite qu'un tri
instable fasse danser les lignes d'un rendu à l'autre.

---

## 8. L'écran — `/analytics/muscles`

### 8.1 Où on entre

`/analytics`, section **VUE D'ENSEMBLE**, seconde ligne sous « Séances par
semaine », sous la même garde `hasHistory` : sans aucune séance terminée, la
ligne n'est pas proposée. Aucun sixième onglet, aucune entrée nouvelle depuis
l'Historique — l'icône de courbe y mène déjà.

```text
VUE D'ENSEMBLE
  Séances par semaine                    →
  Séries par muscle                      →

EXERCICES
  Développé couché                       →
```

### 8.2 Composition

```text
┌─────────────────────────────────────────┐
│ ←  Séries par muscle                    │
├─────────────────────────────────────────┤
│ [12 semaines ▾]                         │   ← une seule pastille
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ SÉRIES DE TRAVAIL              312  │ │   ← le total, il ne dépend d'aucun geste
│ │ 26 par semaine                      │ │
│ │                                     │ │
│ │ Pectoraux      ███████████████   48 │ │
│ │ Grand dorsal   █████████████     42 │ │
│ │ Quadriceps     ██████████        34 │ │
│ │ Épaules        ████████          27 │ │
│ │ …                                   │ │
│ │ Trapèzes       ▍                  2 │ │   ← plancher : 2 reste une barre
│ │ Mollets        ▍                  0 │ │   ← moignon --border : la ligne existe
│ │ Cou            ▍                  0 │ │
│ ├─────────────────────────────────────┤ │
│ │ Comptées sur le muscle principal de │ │   ← ce qui est mesuré, pas comment lire
│ │ chaque exercice. Échauffements exclus.│ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ HORS RÉPARTITION                        │   ← seulement si non vide
│ Cardio                             12   │
└─────────────────────────────────────────┘
```

Rien de neuf en vocabulaire : `Screen`, `Card`, `ListRow`, `SectionTitle`,
`FilterChip`, `OptionSheet`, `label-xs`, `metric`, et le rail proportionnel de
`HistorySummaryCard`. Le seul élément inédit est la ligne « nom · barre ·
nombre », et elle est faite des trois.

Fichiers : `MuscleBalanceScreen.tsx` (lecture, période, états) et
`MuscleBalanceCard.tsx` (l'en-tête, les quinze lignes, la phrase). Sous 300
lignes chacun, règle du CLAUDE.md.

### 8.3 États

| Situation | Ce qui s'affiche |
|---|---|
| Aucune séance terminée, jamais | La ligne « Séries par muscle » n'est pas proposée sur `/analytics`. |
| Aucune série de travail **dans la période** | La carte le dit et propose la période la plus large, comme G1 et G2. Pas quinze barres à zéro. |
| Des séries, mais **aucune sur une région** (que du cardio) | Les quinze lignes à zéro seraient une lecture fausse d'un fait vrai. Une phrase le dit, et la section hors répartition porte le compte. |
| Un seul muscle non nul | Rien de particulier : une répartition à une ligne est une répartition. Pas de phrase « il en faut plusieurs » — contrairement à une courbe, elle est déjà lisible. |

---

## 9. Tests — purs, sans base

Sur `lib/analytics/muscles.ts` :

- **les quinze régions sortent toujours**, y compris à zéro, même sur une entrée
  vide ;
- **les trois `unscoped` ne sortent que non nulles**, et jamais dans `ranked` ;
- **muscle non résolu** → une entrée `muscle: undefined` dans `unscoped`, jamais
  fondue dans `other` ;
- **l'instantané gagne sur la bibliothèque** — fixtures où les deux divergent
  **exprès** (leçon 08B : deux valeurs concordantes ne peuvent pas dire laquelle a
  été lue) ; une séance enregistrée en « pectoraux » dont l'exercice est reclassé
  en « épaules » compte toujours pour les pectoraux ;
- **instantané absent** → repli sur la bibliothèque, comportement d'avant 08A ;
- **échauffements exclus**, `dropset` et `failure` comptés ;
- **le même exercice deux fois dans une séance** additionne ses séries ;
- **`total` = la somme des deux listes**, sur une fixture mêlant les deux classes ;
- **ordre décroissant**, et **égalité départagée par l'ordre canonique**.

Sur `lib/analytics/plot.ts` (`barFractions`) :

- proportionnalité : 20 et 10 sous plafond 20 → 1 et 0,5 ;
- valeur nulle → exactement 0, **jamais** le plancher ;
- petite valeur non nulle → au moins `MIN_FRACTION` ;
- `ceiling` à 0 → que des zéros, aucun `NaN` ;
- rien ne dépasse 1.

`plotBounds`, `plotPoints` et `barLayout` **ne changent pas, et leurs tests non
plus** : c'est la vérification que la troisième géométrie n'a rien déplacé sous
G1 ni sous G2. Idem pour `ChartSurface.tsx`, qui n'est pas touché (§4.2).

---

## 10. Hors périmètre de ce jalon

- **RF-43, la carte de chaleur musculaire** — elle demande `ui/BodyMap.tsx`, donc
  le Lot 5bis, donc une géométrie SVG reprise sous licence permissive avec son
  attribution. Nommé, pas fait ;
- les **muscles secondaires** et la migration v3 qui les porterait (§3) ;
- le **tonnage par muscle** et la durée par muscle — G4, même raison que le
  tonnage par semaine ;
- **taper un muscle pour voir les exercices qui l'ont nourri** — utile, mais c'est
  un second écran et une seconde lecture ; il n'entre pas dans un jalon qui en
  livre un ;
- un **objectif de séries par muscle** — il faudrait un référentiel que l'app n'a
  pas, et l'inventer serait la faute nommée en §4.5 ;
- E3 (CSV), E4 (JSON), 1RM estimé, allure, radar, prédiction.
