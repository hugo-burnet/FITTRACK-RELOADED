# Jalon G2 — séances par semaine

> Spec de conception. Suite de
> `docs/design/specs/2026-07-28-analytics-exercise-progress-design.md` (G0 + G1),
> qui l'annonçait hors périmètre en §5.
> Cadrage arrêté avec l'utilisateur : aucune nouvelle requête, le moteur de
> régularité du Lot 07 est réutilisé, et **c'est ici qu'on décide ce que G1 et G2
> partagent réellement** — la spec de G1 interdisait d'abstraire avant d'avoir
> deux cas.

---

## 1. Ce que ce jalon montre, et ce qu'il ne montre pas

Un histogramme : **une barre par semaine, sa hauteur est le nombre de séances**,
et l'objectif hebdomadaire décide lesquelles sont validées.

Ce n'est pas un écran de métriques. **Il n'y a pas de sélecteur de métrique**, et
c'est un choix, pas un oubli : le tonnage par semaine et la durée par semaine
sont G4, nommés comme tels en §5 de la spec G1. Une barre « séances » et une
barre « tonnage » ne se lisent pas de la même façon — l'une est un compte de
petits entiers, l'autre une somme de kilos à quatre chiffres — et les mêler
demanderait exactement l'abstraction que ce jalon a pour mission de ne pas
inventer trop tôt.

Un seul sélecteur, donc : **la période**, `PERIOD_KEYS` déjà écrit et déjà
traduit.

---

## 2. Aucune requête neuve — et la raison est plus forte qu'en G0

`listExportSources({ kind: 'period', from, to })`, comme en G1. `periodBounds()`
donne déjà `from` / `to` sur des débuts de semaine locale, ce qui est
précisément la granularité de cet écran.

L'alternative existait pourtant, et elle est plus légère : `listCompletedWorkoutTimestamps()`
(`repositories/history.ts`, Lot 07) rend exactement une liste d'instants de
séances terminées, c'est ce que la carte Régularité consomme. **On ne la prend
pas**, pour une raison de fond et non de style : elle ne rend **que** des
`number`. Or une séance porte son propre `startedTimezoneOffsetMinutes` (jalon
08A), et sans lui il est impossible de dire dans quelle semaine civile elle
tombe (§4). `listExportSources` rend le `Workout` entier, donc l'offset vient
avec.

**Conséquence à signaler plutôt qu'à glisser sous le tapis :** la carte
Régularité de l'Historique, elle, groupe encore par l'offset du téléphone
d'aujourd'hui. Sur une seule zone elle donne le même résultat que cet écran ;
après un voyage, non. Hors périmètre de G2 — le corriger veut dire changer la
signature d'une lecture du Lot 07 et le rejeu de ses 15 tests — mais c'est
**une contradiction connue, consignée ici comme E2 l'avait été.**

Le coût accepté : pour `'52w'`, on charge toutes les séries d'un an pour en
compter les séances. Sur une app mono-utilisateur c'est ~150 séances et ~1 500
séries, une lecture indexée sur `startedAt`. Le jour où ça se sent, la réponse
n'est pas un second fichier de requêtes : c'est une projection plus étroite
derrière le **même** `ExportScope`.

---

## 3. Le moteur de régularité est réutilisé, pas réécrit — ni déplacé

`src/lib/history.ts` (Lot 07) sait déjà trois choses dont ce jalon a besoin :

| Fonction | Ce qu'elle sait |
|---|---|
| `startOfLocalWeek(at)` | lundi 00:00 dans le calendrier local |
| `addLocalWeeks(weekStart, n)` | traverser un changement d'heure sans supposer 168 h |
| `resolveWeeklyGoal(history, weekStart)` | l'objectif **applicable à cette semaine-là** |

`periods.ts` importe déjà les deux premières. G2 importe la troisième.

**Rien n'est déplacé, et c'est délibéré.** « Déplacer dans `lib/analytics/` »
aurait l'air plus rangé et coûterait un renommage à travers `HistoryScreen`,
`HistorySummaryCard`, `settings.ts` et leurs tests, pour zéro comportement
gagné : `lib/` est déjà LA couche pure (§7 de l'architecture), et la régularité
n'appartient pas plus aux analyses qu'à l'historique. Un module partagé se
partage là où il est.

`resolveWeeklyGoal` est le point important : l'objectif **change dans le temps**.
Le premier est rétroactif (`effectiveFromWeek: 0`, cf. `setWeeklyTrainingGoal`),
les suivants prennent effet au lundi. Une barre de mars doit donc être jugée sur
l'objectif de mars, pas sur celui d'aujourd'hui. Repeindre l'histoire à l'aune
de l'objectif courant est exactement la faute que le jalon 08 a passé une
session à réparer ailleurs.

---

## 4. Le fuseau — dans quelle semaine tombe une séance

Une séance porte `startedTimezoneOffsetMinutes`. La politique du dépôt est déjà
écrite dans `lib/timezone.ts` : **une séance appartient au jour civil de son
propre offset**. Une séance de 23 h 30 ne doit pas changer de jour — donc pas de
semaine — parce qu'on la relit depuis un autre fuseau.

```ts
export function weekStartOf(startedAt: number, offsetMinutes?: number): number;
```

Le chemin, en trois pas, sans nouvelle arithmétique de dates :

1. `localDateKey(startedAt, offset)` → `'2026-07-27'`, le jour civil **de la
   séance** ;
2. ce jour reconstruit à **midi** dans le calendrier du lecteur ;
3. `startOfLocalWeek(...)`.

Midi et non minuit : dans certains fuseaux minuit n'existe pas le jour d'un
passage à l'heure d'été, et `new Date(y, m, d)` glisse alors d'un jour. Midi ne
glisse jamais.

Le pas 2 est ce qui fait tomber le résultat **exactement** sur l'un des seaux
énumérés par `addLocalWeeks` depuis `from` — sans lui, une séance et son seau
seraient exprimés dans deux référentiels et ne se rencontreraient jamais.

Offset absent (séances d'avant la migration v2) → l'offset du lecteur, ce qui
redonne le comportement du Lot 07, à l'identique.

---

## 5. Zéro est une mesure — l'axe vient de la période, pas des données

**C'est la règle de G1 retournée, et il faut le dire fort.** G1 : « une séance
sans valeur pour la métrique ne produit aucun point, jamais un zéro », parce
qu'un zéro inventé fait plonger la courbe.

Ici, **une semaine sans séance n'est pas une donnée manquante : c'est une
semaine où on ne s'est pas entraîné.** C'est même l'information que l'écran
existe pour donner. Les deux règles ne se contredisent pas, elles disent la même
chose : *on ne trace que ce qu'on sait*. En G1 on ne savait rien de cette
séance-là ; en G2 on sait très bien ce qui s'est passé cette semaine-là.

D'où la conséquence structurelle : **la liste des seaux est dérivée de la
période, pas des séances.** De `from` à `to`, une semaine à la fois via
`addLocalWeeks`. Pour `'all'` (pas de `from`), du lundi de la plus ancienne
séance jusqu'à la semaine courante — pas de date de naissance inventée pour
l'app, même règle qu'en G0.

### 5.1 Correctif après usage — jamais avant la première séance

**La règle ci-dessus était appliquée trop loin, et le défaut est sorti dès le
premier usage réel :** un historique de trois semaines dessinait **neuf barres
vides devant lui**, et la moyenne annonçait 0,5 séance par semaine au lieu
de 1,5.

La qualification manquante : « une semaine sans séance est une semaine où on ne
s'est pas entraîné » n'est vraie **qu'à partir de la première séance
enregistrée**. Avant elle, un zéro n'est pas une mesure — c'est une semaine dont
l'app ne sait rien, donc exactement le zéro inventé que G1 interdit. Et il coûte
deux fois : il écrase les vraies barres pour ne rien montrer, et il fausse toute
moyenne calculée sur le nombre de seaux.

La distinction à tenir, et elle est fine :

| Semaine vide | Verdict |
|---|---|
| **Avant** la première séance de l'historique | N'existe pas. L'app n'en sait rien. |
| **Dans** l'historique (un trou, une blessure, un déménagement) | Reste. C'est l'information. |

`weeklySessionCounts` reçoit donc un quatrième argument, `hasEarlierHistory`.
**Il ne peut pas être déduit à l'intérieur** : `sessions` ne contient que ce que
la fenêtre a rendu, et vu de l'intérieur « rien avant la fenêtre » et « rien
pendant la fenêtre » sont indiscernables. L'écran répond à la question avec
`listCompletedWorkoutTimestamps()` — des `number` nus, la lecture que §2 avait
écartée pour le comptage et qui est ici exactement au bon niveau : on ne lui
demande qu'un booléen.

Et c'est aussi ce qui rend la moyenne honnête : « 3,2 séances par semaine »
calculée en sautant les semaines vides ne veut rien dire.

```ts
export interface WeekBucket {
  weekStart: number;      // lundi 00:00, local
  sessions: number;
  goal: number | null;    // celui applicable à CETTE semaine
}

export function weeklySessionCounts(
  sessions: readonly { startedAt: number; timezoneOffsetMinutes?: number }[],
  bounds: PeriodBounds,
  goals: readonly WeeklyTrainingGoal[],
): WeekBucket[];
```

Pur, aucune base, aucune chaîne française. Deux dérivés du même tableau, purs
eux aussi, parce qu'ils sont le titre de l'écran :

```ts
export function weeklyAverage(buckets: readonly WeekBucket[]): number;
export function goalWeeksReached(buckets: readonly WeekBucket[]): { reached: number; judged: number };
```

`judged` et pas `buckets.length` : une semaine sans objectif applicable n'est
pas une semaine ratée, elle est une semaine **non jugée**.

---

## 6. Une barre n'est pas une ligne — ce qu'on factorise, et ce qu'on ne factorise pas

Le deuxième cas concret est là ; c'est le moment de décider. La réponse honnête
est que **le dessin ne se partage pas et l'interaction se partage entièrement.**

### 6.1 Ce qui ne se partage pas : l'échelle

`plotBounds` borne l'échelle **par les données, pas par zéro**, et G1 a payé ce
choix comptant en gravant le min et le max (80 → 85 kg sur un axe partant de
zéro est plat, donc muet).

Pour un histogramme c'est exactement faux. **La longueur d'une barre *est* la
quantité** : une barre qui ne part pas de zéro ment sur son rapport à sa
voisine. 2 séances et 4 séances doivent faire du simple au double, pas « la
petite et la grande ».

Donc `plot.ts` gagne une seconde géométrie, sans toucher la première :

```ts
export interface BarSlot { x: number; centerX: number; width: number; y: number; height: number }
export function barLayout(values: readonly number[], box: PlotBox, ceiling: number): BarSlot[];
```

`ceiling` est fourni par l'appelant, et c'est **le maximum entre le plus grand
compte, le plus grand objectif de la fenêtre, et 1**. Inclure l'objectif est ce
qui remplace une ligne de repère en pointillés : si l'objectif est 5 et qu'on a
fait 2, les barres montent à deux cinquièmes de la boîte et **le manque se voit
sans qu'on l'écrive**. Le `1` évite la division par zéro d'une fenêtre
entièrement vide.

Deux étiquettes gravées, comme en G1 mais pas les mêmes : **le plafond et le
zéro**. G1 grave le min et le max parce que sa base est arbitraire ; ici la base
n'est pas arbitraire, elle est zéro, et il faut donc la montrer plutôt que la
supposer.

**Un filet de base de 1 px** sous les barres (`--border`). Ce n'est pas une
grille — c'est le zéro dont les barres partent, et sans lui une semaine à zéro
est du vide impossible à distinguer d'une marge.

### 6.2 Ce qui ne se partage pas non plus : la marque et la sélection

Un point porte un anneau de surface pour ne pas fusionner avec son voisin ; une
barre n'a pas ce problème, elle a un intervalle. Un anneau de sélection autour
d'une barre de hauteur **zéro** n'entoure rien — or une semaine à zéro doit
rester sélectionnable, c'est même la barre qu'on veut taper.

La sélection est donc **la fente allumée** (`--surface-2`), dessinée avant tout
le reste, et elle **franchit la ligne de base en haut comme en bas** : aucune
barre ne fait ça, donc le bloc ne peut pas être lu comme une valeur.

Comme en G1, la sélection n'est **pas** une couleur : l'accent est déjà pris.
**Et pas non plus la couleur de la barre.** Premier jet corrigé après usage : la
barre sélectionnée passait de `--text-2` à `--text-1`, ce qui contredisait la
phrase ci-dessus sans qu'on s'en aperçoive et se lisait comme une *troisième
catégorie* à côté du vert et du gris — « je comprends pas ce qu'est la colonne
blanche ». Une barre porte une seule règle de couleur : accent si l'objectif est
atteint, `--text-2` sinon, quoi qu'il arrive.

### 6.2 bis — une semaine à zéro doit se voir

Toujours après usage : une semaine sans séance ne dessinait **rien**, donc l'œil
lisait un espacement irrégulier plutôt qu'une colonne vide. Et une fois le
rythme des colonnes cassé, toutes les hauteurs paraissent arbitraires — d'où la
seconde question, « pourquoi la hauteur est comme ça ».

Une semaine à zéro reçoit donc **4 px dans le ton de l'axe** (`--border`). Ce
n'est pas une quantité : c'est l'axe qui s'épaissit là où une colonne existe et
ne vaut rien. Dire « il n'y a pas eu de séance » et ne rien dessiner du tout ne
sont pas la même chose.

### 6.3 Ce qui se partage, et c'est tout : la surface

Identique, mot pour mot, entre les deux graphiques :

- le `<svg>`, son `viewBox` calculé depuis la boîte et une marge ;
- `role="img"` + `aria-label` résumé, et **rien dans l'ordre de tabulation** ;
- `touch-none`, `setPointerCapture`, et le glissé qui continue de sélectionner ;
- **on tape, on ne survole pas** : un appui n'importe où choisit la marque la
  plus proche en x, donc aucune cible ponctuelle à viser et la règle des 48 px
  est satisfaite par la surface entière.

D'où un seul composant neuf partagé, `src/features/analytics/ChartSurface.tsx` :

```tsx
<ChartSurface box={BOX} pad={PAD} label={summary} xs={centers} onSelect={setIndex}>
  {/* le dessin, en coordonnées de la boîte */}
</ChartSurface>
```

Il reçoit **les abscisses des marques**, pas les données : il ne sait ni ce
qu'est un point, ni ce qu'est une semaine. `ProgressChart` est réécrit par-dessus
sans changer un pixel de son rendu — c'est la garantie qu'on a extrait ce qui
existait, et pas dessiné du neuf.

`PAD` devient une prop : G1 a besoin de 12 px pour l'anneau de sélection de
`r = 9` + 1,5 px de trait (défaut mesuré et corrigé sur capture d'écran) ; un
histogramme ne déborde pas latéralement, et son repère de sélection tient sous
la base.

**Ce qu'on ne fait pas :** pas de `<Chart>` générique à `type: 'line' | 'bar'`,
pas de couche « série ». Deux cas ne font pas une bibliothèque, et le premier
paramètre `variant` est toujours le début du composant que plus personne n'ose
toucher.

---

## 7. Une seule chose colorée : la semaine validée

La charte réserve l'accent aux actions primaires, **aux séries validées** et aux
records — « rien d'autre ».

**Une semaine qui atteint son objectif est une semaine validée**, au sens exact
où une série cochée est une série validée : un engagement pris, puis tenu. C'est
le même vert, pour le même fait, à une autre échelle. L'accent reste donc une
information, et l'écran se lit d'un coup d'œil à bout de bras — les semaines
vertes sont le rythme, les grises sont les trous.

Les autres barres sont en `--text-2`, comme la courbe de G1.

Cas particulier, et il faut le traiter : **aucun objectif n'a jamais été défini.**
`resolveWeeklyGoal` rend alors `null` pour toutes les semaines. Aucune barre
n'est verte — inventer un objectif serait féliciter quelqu'un pour une cible
qu'il n'a pas choisie. La carte porte à la place une phrase et un renvoi vers
l'Historique, où l'objectif se règle déjà (Lot 07). On ne duplique pas ce
réglage ici.

---

## 8. L'écran — `/analytics/weekly`

### 8.1 Où on entre

`/analytics` devient deux sections au lieu d'une liste :

```text
VUE D'ENSEMBLE
  Séances par semaine                    →

EXERCICES
  Développé couché                       →
  Squat                                  →
```

C'est le seul changement à cet écran. **Pas de sixième onglet** (la barre en
compte cinq depuis le Lot 1) et pas de nouvelle entrée depuis l'Historique :
l'icône de courbe y mène déjà.

### 8.2 Composition

```text
┌─────────────────────────────────────────┐
│ ←  Séances par semaine                  │
├─────────────────────────────────────────┤
│ [12 semaines ▾]                         │   ← une seule pastille
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ SEMAINE DU 20 JUILLET      4 séances│ │   ← la lecture, sur la semaine tapée
│ │ Objectif 3 · atteint                │ │
│ │                                     │ │
│ │  5 ┄                                │ │   ← le plafond, gravé
│ │      ▂  ▅  █  ▅  ▂  ·  ▅  █  █  ▅   │ │   ← vert = objectif atteint
│ │  0 ┄──────────────────────────────  │ │   ← le filet de base, et le zéro
│ │       3 juin            27 juil.    │ │
│ ├─────────────────────────────────────┤ │
│ │ 3,2 séances par semaine · 7 semaines│ │   ← ce que la fenêtre dit vraiment
│ │ sur 12 à l'objectif                 │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ SEMAINES                                │
│ Semaine du 20 juillet      4 séances    │
│ Semaine du 13 juillet      0 séance     │
└─────────────────────────────────────────┘
```

Rien de neuf en vocabulaire : `Screen`, `Card`, `ListRow`, `SectionTitle`,
`FilterChip`, `OptionSheet`, `label-xs`, `metric`. Le seul composant inédit est
le dessin des barres.

La liste dessous est le tableau accessible, comme en G1 : **elle porte chaque
semaine, y compris celles à zéro**, et rien n'est atteignable par le seul
graphique. Plus récente en haut.

Pas de squelette au changement de période : le rendu précédent tient à opacité
réduite. Aucune animation d'entrée.

### 8.3 États

| Situation | Ce qui s'affiche |
|---|---|
| Aucune séance terminée, jamais | La ligne « Séances par semaine » n'est pas proposée sur `/analytics` — même règle que « Voir la progression » sur un exercice jamais fait. |
| Aucune séance **dans la période** | La carte le dit et propose la période la plus large, comme en G1. Pas d'histogramme de douze barres à zéro. |
| Une seule semaine | La barre, la lecture, et une phrase : un rythme demande plusieurs semaines. |
| Aucun objectif défini | Aucune barre verte, et une phrase renvoyant vers l'Historique (§7). |

### 8.4 Chargement différé

Troisième route en `React.lazy` dans `features/analytics/routes.tsx`, comme les
deux autres. La séance en direct ne paie pas le JavaScript des graphiques.

---

## 9. Tests — purs, sans base

Sur `lib/analytics/weeks.ts` :

- **fuseau** : une séance à 23 h 30 portant son propre offset reste dans **sa**
  semaine quand on la relit depuis un autre fuseau — fixtures où l'offset de la
  séance et celui du lecteur divergent **exprès** (deux valeurs concordantes ne
  peuvent pas dire laquelle a été lue, leçon du jalon 08B) ;
- **offset absent** → l'offset du lecteur, comportement du Lot 07 inchangé ;
- **changement d'heure** : la semaine qui contient le passage à l'heure d'été
  compte ses séances comme les autres ;
- **semaine vide** → un seau à `sessions: 0`, jamais un seau manquant ;
- **la fenêtre décide** : une période de 12 semaines rend 12 seaux, quel que
  soit le nombre de séances ;
- **`'all'`** part de la semaine de la plus ancienne séance, et rend un tableau
  vide s'il n'y a aucune séance ;
- **deux séances le même jour** → une semaine à 2 ;
- **objectif changeant** : une semaine de mars est jugée sur l'objectif de mars ;
  un objectif défini plus tard ne repeint pas les semaines antérieures, sauf le
  premier qui est rétroactif par construction (`effectiveFromWeek: 0`) ;
- **aucun objectif** → `goal: null` partout, et `goalWeeksReached` rend
  `judged: 0` et non `reached: 0` sur 12.

Sur `lib/analytics/plot.ts` (`barLayout`) :

- une valeur à zéro → hauteur zéro, colonne conservée ;
- toutes les valeurs à zéro → aucune division par zéro ;
- le plafond est honoré : un objectif supérieur au maximum réel **écrase** les
  barres vers le bas, le manque est visible ;
- une seule barre → une largeur de colonne, pas toute la boîte ;
- les colonnes ne se chevauchent pas et tiennent dans la boîte.

`plotBounds` / `plotPoints` ne changent pas, et leurs tests non plus : c'est la
vérification que la factorisation du §6 n'a rien déplacé sous G1.

---

## 10. Hors périmètre de ce jalon

- G3 (séries par muscle), G4 (tonnage et durée par semaine) ;
- E3 (CSV), E4 (JSON) ;
- le réglage de l'objectif hebdomadaire depuis cet écran — il vit dans
  l'Historique (Lot 07) et n'a pas à exister deux fois ;
- la correction de l'offset dans la carte Régularité de l'Historique (§2) —
  consignée, pas traitée ;
- 1RM estimé, allure, radar, prédiction.
