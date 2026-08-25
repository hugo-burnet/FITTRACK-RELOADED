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
