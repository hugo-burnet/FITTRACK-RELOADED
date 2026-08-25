# KB phase 3 — Restituer : faire parler le corpus sur le téléphone

> Écrit le 2026-08-25, à la fin de la session qui a produit le corpus. Aucun cadrage
> préalable dans `00-ROADMAP.md` : la phase 2 s'arrêtait au contrat exécutable, et la
> demande est venue en cours de session — « donc MTN entraînement ? »
>
> Ce fichier est un plan, pas un compte rendu. Rien n'a été implémenté.

**Objectif :** que l'application réponde à une question de musculation en s'appuyant sur
le corpus, sans jamais inventer d'étude ni franchir la ligne clinique. Sur le téléphone,
hors ligne, avec Qwen3-1.7B.

## Ce qu'on a réellement

`fittrack-kb-contract/candidates/e5-corpus.json` — **410 affirmations sur 207 fragments**,
produit pour 14,23 USD.

| | |
|---|---:|
| Affirmations annotées par des humains | 186 |
| Affirmations extraites par le modèle | 224 |

Mesuré sur 227 affirmations tentées pendant le benchmark : **0 hallucination, 0 citation
ou source inventée, 2 débordements cliniques tentés et filtrés tous les deux, négation
jamais perdue ni inversée**. Chaque affirmation est ancrée à l'octet dans le corpus
source.

Ce qui n'est **pas** fiable, et qui est marqué comme tel dans le fichier : le statut
épistémique hors `refuted` (exactitude 0,46), le type de connaissance (0,689), et
l'attribution des citations (précision 0,766). Ces champs sont vides côté modèle — pas
par oubli, parce qu'ils ont été mesurés faux.

## La décision : chercher d'abord, entraîner ensuite

**Le fine-tuning n'apporte pas la propriété recherchée.** Entraîner un modèle sur des
textes lui enseigne un style, un format, un comportement — pas la restitution fidèle de
faits précis. Un Qwen3-1.7B entraîné sur 410 affirmations se mettrait à *sonner* comme le
corpus tout en continuant à inventer les détails. C'est exactement le défaut que toute la
phase 2 a servi à éliminer.

410 exemples est par ailleurs mince pour un fine-tuning, et il faudrait d'abord les
transformer en paires question/réponse — donc une passe de modèle payante de plus.

**La recherche documentaire donne la propriété directement.** Le modèle ne récite pas : il
retrouve l'affirmation pertinente et répond à partir d'elle, en la citant. Le corpus est
taillé pour ça — des affirmations courtes, autonomes, ancrées.

Et l'échelle est dérisoire : 410 textes courts font quelques centaines de kilo-octets
d'embeddings. Pas de base vectorielle, pas d'infrastructure. Un produit scalaire sur 410
vecteurs est instantané, y compris sur un téléphone, à côté du Qwen sans le gêner.

**Le fine-tuning garde sa place, mais plus tard et pour autre chose** : apprendre au
modèle *comment* répondre — dire « c'est une pratique, pas une preuve », dire « je ne sais
pas », ne jamais franchir la ligne clinique. Du comportement, pas du savoir. À ce
moment-là on saura à quoi ressemblent les bonnes réponses, ce qu'on ignore aujourd'hui.

Entraîner d'abord reviendrait à payer pour un style avant de savoir si le fond est
accessible.

## Architecture visée

```text
question de l'utilisateur
  → embedding local de la question
  → produit scalaire sur les 410 affirmations
  → les k plus proches, avec leur ancrage source
  → Qwen3-1.7B : « réponds UNIQUEMENT à partir de ces affirmations »
  → réponse + les affirmations citées, cliquables vers le texte source
```

Trois propriétés non négociables, héritées de la phase 2 :

1. **Monde fermé.** Si aucune affirmation ne répond, le modèle dit qu'il ne sait pas. Il
   n'improvise jamais depuis sa mémoire d'entraînement.
2. **Traçabilité.** Toute réponse affiche les affirmations qui la fondent. L'utilisateur
   peut remonter au texte source à l'octet près.
3. **Ligne clinique.** Les garde-fous de la phase 2 — pas de diagnostic, pas de
   contre-indication universelle, pas de saut biomécanique → danger — s'appliquent à la
   restitution comme ils s'appliquaient à l'extraction.

## Étapes

1. **Choisir le modèle d'embedding.** Contraintes : multilingue ou français, petit
   (≤ 100 Mo quantisé), exécutable sur téléphone. À évaluer sur des questions réelles de
   musculation, pas sur un classement générique.
2. **Construire l'index.** Embedder les 410 affirmations, sérialiser. Déterministe et
   reproductible, comme tout le reste du contrat.
3. **Mesurer la recherche seule**, sans modèle génératif : pour un jeu de questions
   écrites à la main, l'affirmation correcte est-elle dans les k premiers ? C'est
   mesurable hors ligne et sans un centime.
4. **Assembler la restitution** avec Qwen3-1.7B en local (llama.cpp — l'adaptateur existe
   déjà dans le contrat, et `config.qwen3-1.7b.json` aussi).
5. **Mesurer la fidélité** : sur un jeu de questions, la réponse contient-elle uniquement
   ce que les affirmations retrouvées permettent d'affirmer ? Le même principe que les
   gates de la phase 2, appliqué à la sortie.
6. **Fine-tuning comportemental**, seulement si l'étape 5 montre que le modèle dérape sur
   la forme et non sur le fond.

## Ce qui reste à trancher

- **Quelles questions servent de référence ?** Il en faut une trentaine, écrites avant de
  voir les réponses, sinon la mesure ne vaut rien. C'est le même piège que le holdout de
  la phase 2 — et cette fois il faut le tenir.
- **Que fait l'app quand la recherche ne trouve rien ?** Silence, ou renvoi vers le
  corpus brut ? C'est une décision produit.
- **Le corpus contient 224 affirmations aux métadonnées vides.** Faut-il les afficher
  comme les autres, ou signaler qu'elles n'ont pas été relues par un humain ?

## Coût

Les étapes 1 à 5 ne demandent **aucun appel API payant** : l'embedding et le Qwen tournent
en local. Seule une éventuelle génération de questions de référence par un modèle
coûterait — et il vaut probablement mieux les écrire à la main, précisément pour qu'elles
ne ressemblent pas à ce qu'un modèle attendrait.
