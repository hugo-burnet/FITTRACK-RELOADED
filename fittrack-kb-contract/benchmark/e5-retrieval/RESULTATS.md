# Recherche — ce que les 30 questions gelées ont montré

Mesuré le 2026-08-25 sur `candidates/e5-corpus.json` (410 affirmations) et les 30 questions
gelées **avant** toute exécution (`questions-30.json`). Aucun appel API : BM25 est en JS pur,
le modèle d'embedding tourne dans le navigateur.

## Le résultat qui compte

**Ni BM25 ni les embeddings ne savent dire « je ne sais pas ».** C'est le point bloquant,
et il est plus important que la qualité du classement.

| | BM25 | Embeddings (multilingual-e5-small) |
|---|---|---|
| Écart de score sur 30 questions | 3,9 → 15,6 (×4) | 0,842 → 0,896 (**+6 %**) |
| Questions renvoyant « rien » | 0 / 30 | 0 / 30 |
| Affirmations distinctes en tête | — | 22 / 30 |
| Pire « hub » | — | une affirmation gagne **5** questions |

Testé aussi le détachement relatif du premier résultat, qui aurait pu servir de seuil :

| | Dans le périmètre | Hors périmètre |
|---|---:|---:|
| Écart-type au-dessus de la moyenne | 3,25 | 3,12 |
| Marge entre le 1er et le 10e | 11,8 | 10,2 |

**Les deux distributions se chevauchent entièrement.** Aucun seuil ne les sépare.

## Le périmètre du corpus

Le corpus ne couvre que deux sections : *anatomie, biomécanique et sélection d'exercices*
(310 claims) et *base clinique pour coaching adaptatif* (100 claims). Sur la programmation
— séries, répétitions, fréquence, volume, échec — il y a 25 claims sur 410, et de façon
incidente.

Neuf des trente questions portent exactement là-dessus. **Ce n'est pas un défaut de la
recherche, c'est le périmètre des sources.** Décision prise : on valide l'approche sur ce
corpus, la programmation viendra dans un second temps, éventuellement avec un modèle dédié.

## Ce que la recherche trouve bien

Là où le corpus a de la matière, les deux méthodes visent juste, et pas sur les mêmes
questions :

- « je sens surtout mes épaules sur les pecs » → *la sensation subjective peut se dissocier
  de l'activation EMG mesurée* (embeddings, aucun mot en commun)
- « mal au coude sur les extensions overhead » → *les extensions au-dessus de la tête…*
  (BM25)
- « douleur : je continue ou j'arrête » → *arrêter immédiatement si douleur brutale…*
- « je sens jamais mes pecs sur les dips » → *aucune étude d'hypertrophie régionale dédiée
  aux dips n'a été identifiée* — le corpus répond honnêtement qu'on ne sait pas

## Un défaut du corpus, révélé par la recherche

Sept des trente meilleurs résultats en embeddings sont des **fragments très courts** —
« ni obligatoires », « non un test binaire », « ni dangereuses par principe ». Ce sont les
claims sur-produites par l'extracteur : sans contexte, elles se placent au milieu de
l'espace sémantique et attirent n'importe quelle question.

Les écarter de l'index (longueur ≥ 60 caractères, soit 337 affirmations sur 410) supprime
ces faux positifs et fait tomber le pire hub de 5 à 3. **Mais l'écart de score reste à 6 %** :
le problème de calibration est intrinsèque, pas dû aux fragments.

## Conséquence pour la suite

Le « je ne sais pas » ne peut pas venir d'un score de recherche. Il devra venir d'ailleurs —
la piste la plus plausible étant de retrouver généreusement puis de demander au modèle
génératif lui-même si les affirmations retrouvées répondent réellement à la question, avec
le droit de refuser. C'est un mécanisme différent, à écrire et à mesurer.

---

# Le refus par le modèle — première mesure

Puisque aucun score de recherche ne distingue une question couverte d'une question hors
périmètre, la piste restante était de laisser le **modèle génératif** trancher : on lui
donne les 4 affirmations les plus proches et le droit explicite de répondre
`HORS_CORPUS`.

Mesuré le 2026-08-25, entièrement dans le navigateur. Modèle : `Qwen2.5-0.5B-Instruct`
quantisé en q4, index de 337 affirmations (fragments courts écartés).

## Résultat : le 0,5 B ne sait pas le faire

| | |
|---|---|
| Refuse à raison (hors périmètre) | **4 / 9** |
| Refuse à tort (dans le périmètre) | **8 / 21** |
| Répond quand il le doit | 13 / 21 |
| Aurait dû refuser | 5 / 9 |

Il refuse 44 % des questions hors périmètre et 38 % des questions couvertes. **C'est à
peine mieux que le hasard** : la décision ne porte pas d'information.

Deux exemples qui montrent le mode d'échec :

- « je sens surtout mes épaules sur les pecs » → **HORS_CORPUS**, alors que la recherche
  lui avait donné *la sensation subjective peut se dissocier de l'activation EMG mesurée*,
  qui répond exactement.
- « entre 6-8 reps et 10-15 reps » → répond en citant *le retour est un continuum :
  participation modifiée, retour à l'entraînement…*, une affirmation sur la reprise après
  blessure. Hors sujet, affirmé avec assurance.

## Ce que ça prouve, et ce que ça ne prouve pas

Ça prouve qu'un modèle de 0,5 milliard de paramètres est trop petit pour cette décision.

Ça ne dit **rien** sur Qwen3-1.7B, la cible réelle — trois fois plus gros. Le mécanisme
lui-même n'est pas invalidé : il est écrit, mesurable, et la mesure est reproductible en
une commande.

## Ce qui bloque la suite

Tester la vraie cible demande un runtime local. Aucun n'est installé sur la machine — ni
llama.cpp, ni ollama. En WebAssembly, les 30 jugements ont pris une vingtaine de minutes
avec un 0,5 B ; un 1,7 B en prendrait plus d'une heure.

Avec un runtime local, la même mesure prend deux minutes et devient itérable.

## Comment rejouer

```bash
node fittrack-kb-contract/tools/e5-retrieval/serve-lab.mjs 5210
# puis ouvrir http://localhost:5210/judge-lab.html
# ?model=... pour changer de modèle
```

Le serveur est volontairement minimal et sans dépendance : le serveur de dev Vite
rechargeait la page dès qu'un fichier bougeait, et a tué un index à 320 sur 337.

---

# Le refus sur la cible réelle — quatre configurations, quatre échecs

Un runtime local (ollama) ayant été installé, la mesure passe de vingt minutes à deux et
devient itérable. Embeddings `bge-m3`, index de 337 affirmations, 4 affirmations fournies
par question, température 0.

| Configuration | Refus justes | Refus à tort | Précision du refus |
|---|---:|---:|---:|
| `qwen3:1.7b` v1, sans réflexion | 2 / 9 | 1 / 21 | 0,67 |
| `qwen3:1.7b` v2, sans réflexion | 0 / 9 | 1 / 21 | — |
| `qwen3:1.7b` v1, **avec réflexion** | 3 / 9 | 6 / 21 | 0,33 |
| `gemma4:e2b` v1 | 9 / 9 | **20 / 21** | 0,31 |

La seule métrique qui décide est la dernière : **quand le modèle refuse, a-t-il raison ?**
Aucune configuration ne dépasse 0,67, et celle qui l'atteint ne refuse que trois fois sur
trente.

## Ce que chaque essai a appris

**La réflexion aide à décider, pas à décider juste.** Activer le mode hybride de Qwen3
fait passer les bons refus de 2 à 3, et les mauvais de 1 à 6. Il refuse davantage, pas
mieux.

Note de méthode : le premier jet avait `think: false`, exactement la même erreur que le
`reasoningEffort: minimal` de GPT-5 corrigé le matin même — deux fois dans la même journée,
sur une tâche de pur jugement. L'utilisateur l'a signalé avant que la mesure ne le montre.

**Décomposer la décision l'a aggravée.** La v2 demandait d'abord quelles affirmations sont
pertinentes, puis de répondre ou refuser. Résultat : zéro refus sur neuf. Un petit modèle
qui doit produire une étape intermédiaire s'engage dans une réponse et ne revient plus.

**Un modèle qui refuse toujours n'est pas prudent.** `gemma4:e2b` obtient 9/9 sur les
questions hors périmètre — et refuse 20 des 21 questions que le corpus couvre. Sa précision
de refus (0,31) est proche du taux de base : la décision ne porte aucune information.

## Le mode d'échec qui compte

En v1 sans réflexion, sur « les séries jusqu'à l'échec c'est utile pour la masse ? » —
question hors périmètre — Qwen3 a répondu :

> « Les séries jusqu'à l'échec sont utiles pour la masse, **car elles favorisent la fatigue
> nécessaire pour améliorer la masse musculaire**, conformément à l'affirmation [1]. »

Le mécanisme causal est inventé, et attribué à une affirmation du corpus. **Fabriquer en
citant** est précisément ce que toute la phase 2 servait à empêcher. C'est pire que ne pas
refuser : la citation donne à l'invention l'apparence de la traçabilité.

## État

Trois mécanismes de refus éliminés par la mesure : le seuil de score de recherche, un
modèle de 0,5 B, et le modèle cible sous quatre configurations. Ce n'est pas un échec du
projet — c'est le travail d'élimination qui précède la solution.

Ce qui reste ouvert : la piste des rappels anti-hallucination formulés d'une manière
précise, que l'utilisateur dit efficace chez lui, et qui n'a pas encore été testée à
l'identique.

## Comment rejouer

```bash
node fittrack-kb-contract/tools/e5-retrieval/judge-local.mjs \
  --model qwen3:1.7b --prompt v1 --think true \
  --output benchmark/e5-retrieval/judge-run-think.json
```

Nécessite ollama avec `qwen3:1.7b` et `bge-m3`. Aucun appel payant.

---

# La cause racine : le corpus est illisible hors contexte

## Le constat

**61 % des affirmations commencent en minuscule** — ce sont des morceaux de phrases
amputés de leur sujet.

> « conclut à l'**absence de différence significative d'hypertrophie** entre les deux
> approches »

Entre quelles deux approches ? L'information est restée dans le texte source.

Le point décisif : **56 % des affirmations écrites par les annotateurs humains sont dans
le même cas** (65 % côté modèle). Ce n'est donc pas la sur-production de l'extracteur.

## Le mécanisme

Le schéma exige que `rawStatement` soit un extrait **verbatim** du corpus, ancré à
l'octet. Pour être exact, on extrait la portion exacte — qui commence souvent au milieu
d'une phrase.

**La propriété qui garantit « rien n'est inventé » est celle qui rend les affirmations
inutilisables seules.** Le corpus est optimisé pour la traçabilité, pas pour la lecture.

Donner quatre fragments de ce type à un modèle et lui demander une réponse cohérente le
force à combler les trous. Combler un trou, c'est fabriquer. Les 15 % d'invention mesurés
n'étaient pas un défaut du modèle : c'était sa seule issue.

## Le correctif testé

`--context true` rend à chaque affirmation sa phrase d'origine, prise dans le fragment
source — rien n'est reconstruit, seulement re-lu.

| | Fragments bruts | Phrases entières |
|---|---:|---:|
| Longueur moyenne fournie | 146 car. | 330 car. |
| Vocabulaire absent des sources (normalisé) | 42 % | 44 % |
| Réponses qui recopient la question | 5 / 27 | 4 / 28 |
| Refus justes | 2 / 9 | 1 / 9 |

## Ce que la mesure ne sait pas dire

**Aucune métrique automatique ici ne distingue une réponse fidèle d'une fabrication.**

Le premier proxy — tournure causale plus vocabulaire absent des sources — annonçait 15 %
contre 36 %, un effondrement. Normalisé par la longueur des réponses, l'écart disparaît :
42 % contre 44 %. Le proxy mesurait la dérive lexicale, et il était confondu par le fait
que les réponses avec contexte sont plus longues.

Qualitativement, l'écart penche pourtant nettement dans l'autre sens :

> **q.15, sans contexte** — « il faut vérifier si elle est due à une douleur de base ou à
> un red flag. Cela dépend du rapport entre le moment de force externe… » — incohérent,
> deux affirmations sans rapport soudées.
>
> **q.15, avec contexte** — « si elle est brutale, intense, ou accompagnée de symptômes
> neurologiques, il est préférable d'arrêter » — fidèle et utilisable.

Trancher demande un jugement humain sur les 30 réponses. C'est le protocole prévu depuis
le départ : la machine retrouve, la personne juge.

## Conséquence pour la phase 2

Si l'hydratation se confirme utile, elle change ce que le corpus doit exporter : pas
seulement l'extrait verbatim et ses coordonnées, mais aussi **la phrase porteuse**. Les
coordonnées sont déjà là (`supportSpans`), donc c'est une projection à ajouter, pas une
extraction à refaire — aucun appel payant.

---

# Verdict après revue humaine des réponses

L'hydratation a d'abord été testée avec un défaut : plusieurs claims extraites de la même
phrase deviennent identiques une fois hydratées. 120 affirmations récupérées ne donnaient
que **77 textes distincts**, et trois questions recevaient quatre fois la même. Le modèle
croyait disposer de quatre sources, il en avait une. Corrigé par déduplication sur le
texte réellement fourni.

| | Refus justes | Recopie la question | Dérive lexicale |
|---|---:|---:|---:|
| Fragments bruts | 2 / 9 | 5 / 27 | 42 % |
| Phrases entières, avec doublons | 1 / 9 | 4 / 28 | 44 % |
| Phrases entières, dédupliquées | 2 / 9 | 5 / 27 | 50 % |

**L'hydratation ne change rien.** L'hypothèse de la cause racine — des affirmations
illisibles hors contexte — était juste sur le constat et fausse sur la conséquence : leur
rendre leur phrase n'améliore aucune mesure.

## Ce que la revue humaine montre

Lecture des réponses avec les connaissances du domaine, ce qu'aucune métrique automatique
ici ne sait faire.

**Erreurs anatomiques inventées.** Le tirage vertical décrit comme sollicitant « principalement
le triceps » — c'est de la flexion de coude, donc biceps et brachial ; le triceps y est
antagoniste. Les élévations latérales expliquées par « les chefs latéral et médial », qui
sont ceux du triceps, sans rapport avec le deltoïde. Le « chef long » d'une extension
triceps attribué au biceps.

**Attribution croisée.** Une propriété décrite pour les haltères — « impose l'essentiel de
la difficulté externe en fin de course » — recopiée telle quelle à propos d'une machine
convergente.

**Recommandations fabriquées.** « Je laisse tomber l'exercice » n'est dans aucune
affirmation. Sur une douleur de coude, le corpus contient au contraire une affirmation sur
la substitution d'exercice ; elle n'a pas été retrouvée.

**Une réponse dangereuse**, dans la version non dédupliquée : l'affirmation « le développé
couché impose des charges musculo-squelettiques substantielles à l'épaule » — un constat de
risque — retournée en « il est recommandé de sortir la poitrine à fond pour maximiser la
charge musculo-squelettique ».

Sur les quinze premières réponses : **une fidèle et utile, un refus justifié, une
acceptable**. Les douze autres sont hors sujet, incohérentes ou fabriquées.

## La contrainte réelle

Ce n'est ni le prompt, ni le corpus, ni la recherche. **Qwen3-1.7B ne sait pas produire
une réponse fidèle en français à partir de ce matériel.** Il choisit mal parmi quatre
affirmations, transfère une propriété d'un sujet à un autre, se trompe d'anatomie, invente
des recommandations, ou recopie la question.

Six configurations mesurées — deux modèles, trois prompts, avec et sans réflexion, avec et
sans contexte — aucune n'approche l'utilisable.

## La conséquence architecturale

Si le modèle embarqué ne peut pas générer sans fabriquer, **il ne faut pas le faire
générer**. La recherche seule reste exploitable : afficher les affirmations retrouvées
telles quelles, avec leur ancrage source, sans reformulation.

Cette architecture est sûre **par construction** : rien n'est produit, donc rien ne peut
être inventé. Elle ne demande plus qu'une chose fonctionne — la recherche — au lieu de
deux. Et elle rend au lecteur le rôle que le modèle exécute mal : décider si l'affirmation
répond à sa question.

## Ce qui manquait : un reclassement

Le constat ci-dessus a été tiré d'un pipeline incomplet. La pratique standard en
recherche augmentée comporte deux étages, et je n'en avais mesuré qu'un :

1. **Rappel** — retrouver vite un ensemble large de candidats (BM25, embeddings)
2. **Précision** — reclasser finement ce petit ensemble avec un modèle plus coûteux

Conclure « le modèle ne sait pas répondre » sans avoir monté l'étage 2 revenait à juger
le générateur sur des extraits que rien n'avait vérifiés.

Deux corrections ont été apportées ensemble : la **fusion hybride** de BM25 et des
embeddings par *reciprocal rank fusion* (k = 60 — on fusionne les rangs, pas les scores,
ce qui n'aurait aucun sens entre un BM25 étalé de 4 à 16 et un cosinus tassé sur 6 %), et
le **reclassement** des 12 meilleurs candidats pour n'en garder que 4.

### Reclassement par le modèle génératif — sans effet

`qwen3:1.7b` note chaque paire de 0 à 10. La fusion hybride change réellement ce qui est
retrouvé (**89 des 120 extraits du top-4 diffèrent** du dense seul), mais le reclassement
ne discrimine pas : **84 des 120 notes tombent sur 6 ou 8**. Les refus restent à 2/30.

C'est le même modèle qui échouait à répondre ; lui demander de juger ne pouvait pas
produire une information qu'il n'a pas.

### Reclassement par un vrai cross-encoder — le premier signal calibré

Un bi-encodeur réduit la question et l'affirmation chacune à un vecteur, **séparément** :
toute l'information est écrasée avant qu'elles ne se rencontrent, et le cosinus ne mesure
plus qu'une proximité de sujet. Un cross-encoder les lit **ensemble**, mot contre mot.

`bge-reranker-base` (278 M paramètres, quantifié en q8, dans le navigateur — ollama 0.32
n'expose aucun endpoint de reclassement, aucun modèle téléchargé n'y aurait changé quoi
que ce soit).

Le score du meilleur extrait, sur les 30 questions, s'étale de **−9,86 à +1,44**. C'est la
première fois qu'une mesure de cette chaîne n'est pas plate :

| | BM25 | cosinus | note qwen3 | cross-encoder |
|---|---|---|---|---|
| étendue | 4 → 16 | ~6 % | 84/120 sur {6,8} | −9,9 → +1,4 |
| sépare couvert / non couvert | non | non | non | **apparemment oui** |

En haut du classement : q.28 (amplitude réduite, +1,44) tombe sur un extrait qui traite
exactement de l'amplitude ; q.15 (douleur musculaire ou blessure, −0,28) sur les critères
d'arrêt ; q.18 (chef long du triceps, −0,53) sur les extensions au-dessus de la tête.

En bas : « tricher sur les dernières reps de curl » (−6,77), « un côté pousse plus fort »
(−5,65), « je stagne sur un seul mouvement » (−6,73), « garder 5-6 exercices » (−6,22).
Le corpus ne couvre aucun de ces sujets — et le score le dit, là où le cosinus les
plaçait au même niveau que les questions couvertes.

### La réserve qui compte

**J'ai lu quelles questions le corpus couvrait après avoir vu les scores.** L'accord
décrit ci-dessus est donc une hypothèse, pas une mesure : rien n'exclut que je lise la
couverture à travers le score. Deux exceptions visibles le montrent bien — q.21 (« trop de
volume ») et q.17 (« monter les reps ») obtiennent des scores hauts sur des extraits hors
sujet.

Le seuil de refus ne peut pas être fixé sur ces données. Il demande un étiquetage en
aveugle, question par question : *le corpus contient-il de quoi répondre, oui ou non*,
décidé sans voir le score.
