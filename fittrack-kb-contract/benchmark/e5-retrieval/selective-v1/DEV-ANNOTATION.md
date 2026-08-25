# Annotation exhaustive DEV — couverture du corpus et correction d'instrument

Date : 2026-08-26

Partition : DEV uniquement (59 questions). CAL et TEST n'ont été ni lus, ni exécutés,
ni ouverts à aucun moment.

Empreinte du jeu de questions : `sha256:a118fcca61ff662d74ef1c8e53eee19b691988918f7749d570f6a796aed0812b`

## 1. Ce que cette annotation corrige dans le constat précédent

`DEV-RUN.md` concluait que « le pipeline ne passe pas encore un seuil de fiabilité produit »
en s'appuyant sur des échecs observés : deload, ordre biceps/dos, volume hebdomadaire, tempo
excentrique, reprise après pause, priorité des muscles.

L'annotation montre que ce diagnostic mélangeait deux choses. Ces six échecs ne sont pas des
ratés de recherche : **ce sont des lacunes du corpus**. Aucun réglage de récupération ne les
corrigera, parce que l'information n'est pas dans le corpus.

## 2. Procédure

Deux feuilles remplies séparément, avec deux procédures délibérément différentes.

| Feuille | Procédure | Biais attendu |
|---|---|---|
| A | **Descendante.** La question est réduite à ses éléments indispensables ; `ANSWERABLE` seulement si chaque élément a un appui direct. `supportingClaimIds` = ensemble décisif minimal. | Stricte, tend vers `UNANSWERABLE` |
| B | **Ascendante.** Balayage lexical des 408 affirmations (top-10 dédupliqué par contexte) puis scan manuel des sections voisines ; `ANSWERABLE` si l'ensemble réuni permet une réponse substantiellement correcte et non trompeuse. `supportingClaimIds` = ensemble réuni. | Permissive, tend vers `ANSWERABLE` |

### Limite d'indépendance — à consigner

Les deux feuilles ont été remplies par **le même annotateur** (agent), avec deux procédures
distinctes et sans consulter la feuille jumelle pendant le remplissage. **Cela ne satisfait pas
l'exigence de deux personnes du protocole sélectif v1.** L'accord inter-feuilles mesuré ci-dessous
borne la stabilité de la procédure, pas la reproductibilité inter-annotateurs. Une relecture
humaine reste requise avant d'ouvrir CAL. La limite est également inscrite dans les deux fichiers
de feuilles, champ `annotator.independence`.

### Règle d'adjudication

`ANSWERABLE` si le corpus soutient une réponse substantiellement correcte, **y compris** une
réponse dont le contenu est « la preuve ne tranche pas » — à condition que cette négation porte
sur la variable demandée ou sur une variable strictement plus grossière.

Une **mise en garde épistémique générique** ne suffit jamais seule. « L'EMG ne prouve pas
l'hypertrophie », « la sensation n'est pas une mesure d'activation », « la biomécanique ne prédit
pas la douleur » traversent tout le corpus ; les accepter comme réponse rendrait presque toute
question répondable et viderait la mesure de son sens. Il faut du contenu qui caractérise
réellement les entités de la question.

Exemples d'application :

- **Q2 (angle du banc incliné)** → `ANSWERABLE`. Le corpus porte une négation *propre à la
  question* : à volume égal, certaines études ne trouvent pas de différence claviculaire entre
  plat et incliné. Si la distinction grossière n'est pas fiable, le choix entre 15° et 30° ne
  l'est pas davantage.
- **Q5 (reverse pec deck vs face pull)** → `UNANSWERABLE`. Aucune comparaison de cette paire,
  et aucune négation la concernant. Ne restait que la mise en garde générique sur l'EMG.
- **Q24 (séances pour retrouver ses perfs)** → `UNANSWERABLE`. Le corpus dit *comment* reprendre
  et nie tout pourcentage universel de reprise, mais ne parle jamais du délai de récupération
  des performances. La négation porte sur une autre variable que celle demandée.

## 3. Résultats

### Accord inter-feuilles

| Mesure | Valeur |
|---|---|
| Accord brut | 49/59 = **83,1 %** |
| Kappa de Cohen | **0,670** |
| Désaccords | Q2, Q5, Q6, Q24, Q37, Q39, Q45, Q53, Q54, Q55 |

Les dix désaccords vont tous dans le même sens (A stricte `UNANSWERABLE`, B permissive
`ANSWERABLE`), ce qui est le comportement attendu des deux procédures et non un bruit
d'annotation. Six ont été adjugés `ANSWERABLE`, quatre `UNANSWERABLE`.

### Couverture exhaustive

| Verdict | Nombre |
|---|---|
| `ANSWERABLE` | **31** |
| `UNANSWERABLE` | **28** |
| `AMBIGUOUS` | 0 |

**Couverture = 31/59 = 52,5 %**, pour un seuil de continuation fixé à 20 % par le protocole.

La couverture n'est déduite d'aucun top-1 : elle vient de l'examen de chaque question contre
l'ensemble des 408 affirmations indexées.

## 4. Séparation des erreurs de récupération et des lacunes du corpus

Mesure sur le run hybride existant (`hybrid-bge-m3-dev.json`), en confrontant les quatre
candidats de chaque question à l'union des `supportingClaimIds` des deux feuilles.

| | hybride | lexical |
|---|---|---|
| Questions répondables | 31 | 31 |
| Top-1 pertinent | 17 | 16 |
| Top-4 contient au moins un appui | **22** | 20 |
| **Erreurs de récupération** | **9** | 11 |
| Non répondables ayant tout de même des candidats | **28/28** | **28/28** |

Trois faits en découlent.

1. **9 erreurs de récupération** sur 31 questions répondables, soit 29 % d'échec là où le corpus
   contenait la réponse. Questions concernées : Q6, Q8, Q13, Q14, Q20, Q28, Q32, Q39, Q46.
2. **28 lacunes réelles du corpus**, dont les six échecs cités par `DEV-RUN.md`. Elles se
   concentrent sur un domaine entier et absent : **la programmation**. Le corpus couvre
   l'anatomie, la biomécanique, la sélection d'exercices et le versant clinique ; il ne contient
   rien sur le volume, la fréquence, le tempo, l'ordre des exercices, la pré-fatigue, le deload,
   les plages de répétitions, le RIR, la gestion des plateaux ou la priorisation musculaire.
3. **Le moteur renvoie quatre candidats pour 28 questions sur 28 auxquelles le corpus ne peut pas
   répondre.** Taux de faux positifs de 100 % sur l'answerability. C'est la confirmation
   expérimentale de ce que le protocole affirmait : la présence de candidats ne peut pas servir
   de décision d'answerability, et un seuil de refus devra être calibré sur CAL.

## 5. Correction d'instrument unique

**Défaut.** La recherche embarquée `src/features/knowledge/searchEvidence.ts` ne retient qu'une
affirmation par `displayContext` : deux extraits découpés dans le même passage ne sont pas deux
preuves indépendantes, et les présenter comme telles fabrique une corroboration qui n'existe pas.
`scripts/run-selective-hybrid-benchmark.mjs` ne le faisait pas — il tronquait la fusion RRF à
`TOP_K` sans déduplication.

Le banc mesurait donc **un pipeline différent de celui qui est livré**.

**Ampleur mesurée sur DEV, avant correction :**

- 44 des 59 questions remontaient **moins de quatre contextes distincts** ;
- 60 des 236 emplacements de candidats (25,4 %) étaient consommés par un passage déjà affiché ;
- une question ne remontait qu'**un seul** contexte distinct sur ses quatre emplacements ;
- sur les 9 questions en échec de récupération, 8 gaspillaient au moins un emplacement
  (11 emplacements sur 36).

**Correction.** Déduplication par `displayContext` appliquée à la fusion avant la troncature à
`TOP_K`, à l'identique de `searchEvidence.ts`. Le run enregistre désormais
`retrieval.contextDeduplication` et `retrieval.alignedWith`, pour que l'artefact dise lui-même
quel pipeline il a mesuré.

C'est une correction de **conformité**, pas un réglage : elle n'introduit aucune stratégie de
récupération nouvelle et n'a aucun paramètre libre. Le protocole n'autorisant qu'une seule
correction d'instrument, c'est la seule qui a été faite — le reste du pipeline (RRF, `k = 60`,
limite lexicale 60, `TOP_K = 4`, modèle, corpus) est inchangé.

**Conditions de comparabilité du nouveau run** : même corpus, même index de preuves, même jeu de
questions, même modèle `bge-m3:latest`, digest vérifié identique
(`7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab`).

## 6. Nouveau run DEV et comparaison

Sortie : `hybrid-bge-m3-dev-corrected.json`. Le run d'origine (`hybrid-bge-m3-dev.json`) est
conservé intact pour que la comparaison reste vérifiable.

| Mesure | Avant | Après | Δ |
|---|---|---|---|
| Contextes distincts par question (moyenne) | 2,98 | **4,00** | +1,02 |
| Emplacements de candidats gaspillés | 60 | **0** | −60 |
| Top-4 contient au moins un appui (sur 31 répondables) | 22 | **26** | **+4** |
| Top-1 pertinent | 17 | 17 | 0 |
| Erreurs de récupération | 9 | **5** | −4 |
| Non répondables ayant tout de même des candidats | 28/28 | 28/28 | 0 |
| Durée | 528 s | 421 s | −107 s |

**Questions récupérées : Q13, Q14, Q20, Q46. Aucune régression.**

Trois lectures s'imposent.

Le rappel monte de 71 % à 84 % sur les questions répondables, sans qu'aucun paramètre n'ait été
réglé : les quatre réponses récupérées étaient déjà dans le classement fusionné, mais un extrait
du même passage occupait leur place.

La précision au rang 1 ne bouge pas, et c'est attendu : le premier résultat n'est jamais évincé
par une déduplication, puisqu'il n'a rien devant lui. Une correction qui aurait déplacé le top-1
aurait été un réglage déguisé, pas une mise en conformité.

**Le taux de faux positifs sur l'answerability reste à 100 %** — 28 questions sur 28 sans réponse
possible reçoivent quand même quatre candidats. La correction ne pouvait pas y toucher, et ne
devait pas : décider de refuser est le travail du seuil calibré sur CAL, pas de la déduplication.

Cinq erreurs de récupération subsistent : **Q6, Q8, Q28, Q32, Q39**. Elles ont un trait commun —
la réponse existe mais se construit en assemblant des affirmations dispersées qui n'emploient
jamais le vocabulaire de la question. Les traiter demanderait une expansion de requête ou un
reclassement, c'est-à-dire une seconde correction d'instrument, que le protocole n'autorise pas
à ce stade. Elles sont consignées, pas corrigées.

## 7. Décision

Le seuil du protocole (couverture > 20 %) est franchi avec 52,5 % : **la bifurcation continue**.

Le blocage n'est pas là où `DEV-RUN.md` le situait. Le corpus est plus riche que ce que le
pipeline en extrait, et le vrai défaut de fiabilité produit est l'incapacité à refuser : quatre
candidats sortent pour toutes les questions, y compris les 28 auxquelles le corpus ne peut pas
répondre.

**CAL et TEST restent fermés.** Ils n'ont été ni lus, ni exécutés, ni inspectés. La correction
autorisée est consommée ; il n'en reste plus pour ce cycle.

### Ce qui devrait venir ensuite, dans cet ordre

1. **Relecture humaine des deux feuilles.** C'est la condition qui manque : l'annotation tient
   pour l'instant sur un seul annotateur. Tant qu'elle n'est pas relue, la couverture de 52,5 %
   est une mesure de procédure, pas un chiffre inter-annotateurs.
2. **L'ajout de sources unique**, ciblé par les lacunes observées — et elles désignent un seul
   domaine : la programmation (volume, fréquence, tempo, ordre des exercices, pré-fatigue,
   deload, plages de répétitions, RIR, plateaux, priorisation). Les 28 questions non répondables
   y tombent presque toutes. C'est le seul levier qui augmente la couverture ; aucun réglage de
   récupération ne le fera.
3. **Puis seulement CAL**, pour calibrer le seuil de refus — le défaut restant après correction,
   et celui qui décide si l'application peut sortir du mode `UNCALIBRATED`.

Un fine-tuning génératif ne figure pas dans cette liste, et le protocole le verrouille déjà
(section 3) : pas de formulation générative avant un test d'au moins 100 réponses acceptées avec
borne basse à 95 % de fidélité ≥ 95 %. Entraîner un modèle à répondre pendant que 47 % des
questions réalistes n'ont pas de réponse dans le corpus rendrait invisibles les échecs
actuellement visibles.
