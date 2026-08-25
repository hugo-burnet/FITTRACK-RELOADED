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
