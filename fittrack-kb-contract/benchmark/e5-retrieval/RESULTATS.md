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
