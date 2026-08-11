# Lot 18 — Auto-progression transparente (M9, RF-48, sans IA)

> Plan rédigé le 2026-08-11, après la release v0.2.0, à partir du code réellement
> existant. Le cadrage figé est dans `00-ROADMAP.md § Lot 18`.

**Objectif :** que l'app te dise quelle charge mettre la prochaine fois, **et
pourquoi**.

**Dépend de :** rien de ce qui reste à faire. Le roadmap le fait dépendre du
Lot 17 (périodisation) — **c'est faux et cette dépendance est levée** : aucune
règle ci-dessous ne lit un bloc ni une semaine planifiée. Ce dont il dépend
vraiment est livré depuis la v0.2.0 : les records persistés et le 1RM estimé.

**Budget :** le roadmap dit 2 sessions. Compter **3 à 4**, en quatre tranches
livrables séparément.

---

## Tranche 0 — la mesure à faire avant d'écrire une ligne

**Combien de tes séries portent un RPE ?**

Ce n'est pas une formalité, c'est ce qui décide du contenu de la tranche 2. La
moitié des détections envisagées — « charge trop lourde », « signes de deload » —
a besoin de savoir à quelle distance de l'échec la série s'est terminée. Le RPE
existe (RF-30) mais il vit **derrière une feuille**, donc il coûte un tap de plus
par série.

```
séries de travail enregistrées  /  celles qui portent un rpe
```

- **Au-dessus de ~50 %** : les règles de fatigue sont fondées, la tranche 2 les
  inclut.
- **En dessous** : elles sont écartées de la V1. Le vrai lot suivant devient
  « rendre le RPE saisissable sans ouvrir de feuille », pas « deviner la fatigue
  sans donnée ». Livrer quatre règles bien testées sur une donnée absente serait
  du travail propre et inutile.

**Ne pas contourner ce résultat.** C'est le seul garde-fou contre un moteur qui
invente ce qu'il ne peut pas savoir.

---

## Ce qui existe déjà — à lire, pas à réécrire

| Endroit                                   | Ce que c'est, et pourquoi le coach en dépend                                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/records.ts`                          | `isWorkingSet` (RF-20, l'échauffement ne compte pas), `setVolume`, la projection des records. **La règle de ce qui compte est là et nulle part ailleurs.**                                     |
| `lib/oneRepMax.ts`                        | `estimateOneRepMax(formula, …)`. C'est ce qui permet de comparer 100 × 5 et 90 × 8 — sans lui, aucune règle de progression n'est comparable d'une séance à l'autre.                            |
| `lib/deload.ts`                           | `DELOAD_PERCENT = 80`, `calculateDeloadWeight`, `isDeloadEligibleMeasurement`. Le deload **existe déjà** et s'applique à la main en séance. Le coach le _suggère_, il ne le réimplémente pas.  |
| `lib/plates.ts`                           | `DEFAULT_PLATES_KG`, `computePlateLoad`. Sait ce qui est chargeable sur une barre — donc sait dire qu'un +1,25 kg est impossible avec ton stock.                                               |
| `lib/measurement.ts`                      | `measurementShape`, `weightRole`. Une charge est un poids, un lest ou une **assistance** : sur des tractions assistées, progresser c'est _baisser_ le nombre. Aucune règle ne doit ignorer ça. |
| `WorkoutSet.targetReps` / `targetRepsMax` | La fourchette prescrite, **copiée sur la série au démarrage**. C'est ce qui rend la double progression calculable sans relire la routine d'aujourd'hui.                                        |
| `WorkoutSet.performedAt`                  | L'horodatage de validation. Les écarts entre séries successives donnent le **repos réel**, gratuitement. Personne ne le lit encore.                                                            |
| `workoutExerciseIdentityOf`               | La résolution instantané → bibliothèque. Toute lecture d'une séance passée passe par là, sans exception.                                                                                       |

---

## Le trou dans le modèle de données

**`Exercise` n'a aucun champ d'incrément de charge.** Vérifié le 2026-08-11.

C'est le seul vrai manque, et il bloque tout : « passe à 47,5 kg » suppose de
connaître le plus petit saut utilisable **pour cet exercice**. Une barre monte de
2,5 kg, des haltères sautent de 18 à 20, une machine a le pas de sa colonne, une
poulie va par 5 lb. Sans ce champ, chaque recommandation est fausse dès qu'on
quitte la barre — et le catalogue est plein d'haltères et de machines.

C'est la tranche 1, et elle ne contient pas une ligne d'intelligence.

---

## Tranche 1 — l'incrément de charge

**Livrables :**

- `Exercise.loadIncrementKg?: number`, non indexé, donc migration Dexie sans
  `.stores()` — même patron que `version(2)` et `version(4)`.
- Un défaut par `Equipment` dans un module pur (`lib/loadIncrement.ts`), typé
  `Record<Equipment, number>` pour qu'ajouter un équipement sans lui donner
  d'incrément **casse le typecheck**.
- La saisie sur la fiche exercice, dans « Tes réglages », à côté du repos.
- `nextLoad(current, increment, measurementType)` : arrondit au multiple, et
  **inverse le sens pour `assist`** — sur une machine à tractions assistées,
  progresser c'est retirer de l'assistance.

**Tests :** les six types de mesure, les trois rôles de charge, un incrément
absent qui retombe sur le défaut de l'équipement, et le cas assisté qui descend.

**✅ Checkpoint :** ouvrir un exercice à la barre, un aux haltères et une machine
assistée : chacun propose un incrément crédible, et il se modifie.

---

## Tranche 2 — le moteur

`src/lib/coach/`, **pur par construction** (§7) : des séries en entrée, des
signaux en sortie. Rien n'y lit Dexie, rien n'y écrit de français.

### La forme de la sortie

```ts
interface CoachSignal {
  code: 'range_completed' | 'intra_session_drop' | 'plateau' | 'long_rest';
  exerciseId: string;
  /** Ce que la règle propose, quand elle propose quelque chose. */
  nextLoadKg?: number;
  /** Les chiffres qui ont déclenché la règle, pour que l'UI les montre. */
  evidence: { label: string; value: number }[];
  severity: number;
}
```

**Des signaux typés, jamais des phrases.** L'UI les rend via `fr.ts`. C'est ce
qui laisse le français dans un seul fichier, et ce qui rendrait un LLM
branchable plus tard sans réécrire le moteur.

### Les quatre règles de la V1 — pas cinq

1. **Fourchette validée** — toutes les séries de travail atteignent
   `targetRepsMax` → proposer `nextLoad`. C'est RF-48, et c'est la seule règle
   qui produit un chiffre.
2. **Chute intra-séance** — les répétitions s'effondrent à partir de la série
   N. Ne propose rien, **constate**. Le seuil se calibre sur ton historique, pas
   sur la littérature.
3. **Plateau** — N séances consécutives sans progression du 1RM estimé. C'est
   `estimateOneRepMax` qui rend les séances comparables ; sans lui la règle
   n'existe pas.
4. **Repos réel** — dérivé des écarts de `performedAt`. Signalé seulement quand
   il corrèle avec la règle 2 : un repos court seul n'est pas un défaut.

**Rien d'autre.** Chaque règle ajoutée est une occasion de se tromper avec
assurance, et la valeur d'un coach se juge à ce qu'il tait.

### Le comparateur

Les signaux sont **classés**, et l'UI n'en montre qu'un par exercice. Vingt
lignes, testables — c'est la fonction que le brief initial voulait confier à un
LLM.

**Tests :** table de vérité par règle, plus les cas qui doivent rester muets —
une seule séance d'historique, un exercice sans fourchette prescrite, une séance
en deload (les charges baissent **exprès**, aucune règle ne doit crier au
plateau).

**✅ Checkpoint :** sur ton historique réel, le moteur ne dit rien d'absurde. À
ce stade il n'y a pas encore d'écran : la vérification se fait sur les signaux.

---

## Tranche 3 — le journal des recommandations

Une table `coachRecommendation` : le signal, la date, **si tu l'as suivie**, et
ce qui s'est passé la séance d'après.

**Trois usages, et le troisième est le plus important :**

- ne pas répéter une recommandation refusée ;
- afficher l'historique des recommandations sur la fiche exercice ;
- **répondre un jour à « est-ce que ce moteur sert à quelque chose »**. Sans ce
  journal, la question restera une impression. C'est aussi le seul jeu de données
  qui rendrait un LLM évaluable plus tard.

**Réinjection :** au démarrage d'une séance, la dernière recommandation non
suivie de chaque exercice devient l'objectif proposé. Elle **ne pré-remplit
jamais** la série — elle s'affiche en objectif, et c'est ta coche qui décide.

---

## Tranche 4 — l'UX

**Trois surfaces, aucune bloquante.**

- **En séance** : une carte Coach sous l'exercice, quand un signal le mérite.
  Elle ne vole jamais le focus, ne se met jamais entre le doigt et la coche, et
  se referme d'un « Ignorer » qui est enregistré dans le journal.
- **Fin de séance** : les signaux de la séance, groupés, sous le corps qui existe
  déjà.
- **Séance suivante** : l'objectif repris, sur la ligne de l'exercice.

**Contrainte de charte :** l'accent est réservé aux actions principales, aux
séries validées et aux records. Une carte Coach n'est aucune des trois — elle
vit en texte et en surface, comme le reste des lectures.

**Transparence, et c'est la recommandation transverse n°2 :** chaque
recommandation affiche **le chiffre qui l'a produite**. « +2,5 kg car 3 × 12
atteint la dernière fois » — jamais « +2,5 kg » seul. C'est ce que l'audit
reproche à la boîte noire de Hevy, et c'est la seule chose qui te permettra de
dire que le moteur a tort.

---

## Ce qu'il ne faut pas construire maintenant

Tranché le 2026-08-11, après une demi-journée de cadrage.

- **Un LLM, local ou distant.** Le moteur produit des chiffres justes ; un modèle
  qui les reformule est un `print()` coûteux. Le seul rôle qui lui reviendrait —
  répondre à une question ouverte — est le Lot 19, il est marqué optionnel, et il
  ne peut rien recevoir tant que les tranches 1 à 3 n'existent pas.
- **Une base de connaissances / RAG.** La « connaissance » du coach, ce sont des
  règles, des fourchettes, des incréments et des garde-fous : un fichier
  TypeScript typé, versionné et testé. Pas un magasin de vecteurs.
- **La détection de fatigue sans RPE.** Cf. tranche 0.
- **Une cinquième règle.** Y revenir quand les quatre premières auront tourné un
  mois.

---

## Les pièges connus

- **Le deload fausse tout.** `Workout.deloadPercent` existe : une séance en
  deload a des charges volontairement basses. Toute règle qui compare deux
  séances doit l'exclure, sans quoi le coach diagnostique un plateau à chaque
  décharge.
- **L'assistance s'inverse.** Cf. `weightRole === 'assist'`.
- **Les séances importées de Hevy** portent `importSource: 'hevy_csv'` et n'ont
  pas de fourchette prescrite. Elles nourrissent le plateau et le 1RM, jamais la
  double progression.
- **Un exercice repris deux fois dans la même séance** est deux lignes. Le moteur
  doit les recoller, comme `muscleInvolvement` le fait déjà.

---

## ✅ Checkpoint final — en salle, pas au navigateur

- [ ] Une séance où tu valides toute ta fourchette : la charge proposée à la
      suivante est atteignable avec tes disques, et l'explication est juste.
- [ ] Une séance en deload : le coach ne parle pas de plateau.
- [ ] Un exercice aux haltères : l'incrément proposé existe vraiment dans ta
      salle.
- [ ] Tu refuses une recommandation : elle ne revient pas la fois d'après.

**Et la vraie mesure vient après :** contrairement au schéma musculaire, qu'une
capture suffisait à juger, la qualité d'un coach ne se voit qu'après trois ou
quatre semaines d'usage réel. Le « terminé » de ce lot sera long à prononcer, et
c'est normal.
