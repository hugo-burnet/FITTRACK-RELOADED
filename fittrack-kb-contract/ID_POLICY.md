# Politique d'identifiants

## La règle

```json
{
  "id": "claim.training.volume.0001",
  "slug": "volume-hebdomadaire-dose-reponse-decroissante",
  "revision": 1,
  "contentHash": "sha256:4f0671dda07b20e696a858c3492e6b17041a1a294d9ec552e8175b253e2e0db5"
}
```

| Champ | Rôle | Peut changer ? |
|---|---|---|
| `id` | Identité. Attribué une fois, enregistré, jamais réattribué. | Jamais |
| `slug` | Libellé lisible. Rien ne le référence. | Librement |
| `revision` | Trace l'évolution du contenu. | À chaque modification approuvée |
| `contentHash` | Détecte un changement de fond. | Automatiquement |

## Ce que le hash n'est pas

Le `contentHash` **détecte** un changement. Il ne **constitue pas** l'identité et n'entre dans aucune clé de
déduplication.

La proposition initialement examinée faisait de l'identité une fonction du hash de la formulation et des
sources. Elle a été écartée pour une raison mesurable sur ce corpus : une reformulation, une correction de
coquille ou une mise à jour bibliographique changeraient l'identifiant, et donc casseraient toutes les
relations qui pointaient vers l'entité. Le corpus contient précisément ce cas — le même essai de Wolf y est
cité sous trois libellés et trois URL différents.

Trois champs sont exclus du calcul du hash (`tools/canonical.mjs`) :

- `contentHash` lui-même ;
- `slug`, parce qu'il peut évoluer librement ;
- `lifecycle`, parce qu'une approbation ou une date de revue ne modifie pas le contenu.

Sans ces exclusions, renommer un slug ferait croire à une modification de fond. Un signal qui crie pour
rien finit par ne plus être lu.

## Forme des identifiants

```text
<kind>.<domaine>[.<sous-domaine>].<séquence>
```

Exemples réels du golden set :

```text
claim.training.volume.0001
claim.exercise.triceps-longhead.0001
source.currier-2026-acsm-position-stand
resolution.s3.haugen-vs-heidel
redflag.cauda-equina.0001
policy.safety.pain-guardrail.0001
```

La séquence numérique n'est pas obligatoire quand un libellé stable suffit et qu'il ne dépend pas du texte
de l'entité — c'est le cas des sources, dont le libellé auteur-année est bibliographique et non rédactionnel.

## Trois espaces d'identifiants, volontairement incompatibles

| Préfixe | Espace | Attribué par |
|---|---|---|
| `corpus.` | Fichiers du corpus | La configuration, une fois pour toutes |
| `frag.` | Fragments | La spécification de fragmentation |
| `rt.` | Runtime utilisateur | L'application, avec un UUID |
| *(autre)* | KB canonique et politiques | Le registre `governance/id-registry.json` |

Le préfixe `rt.` n'est pas cosmétique : il rend une entité runtime **inréférençable** depuis `curated/`, et
INV-015 échoue si une entité de la KB pointe vers un identifiant runtime. La frontière entre connaissance
générale et état d'une personne est ainsi portée par les identifiants eux-mêmes, pas par une convention de
rangement.

## Le registre

`governance/id-registry.json` est amorcé une fois par `tools/build-derived.mjs`, puis **append-only**.

- Un identifiant qui y figure ne sera jamais réattribué, même après retrait de l'entité.
- Le registre conserve `slugHistory` : un slug abandonné reste retrouvable.
- INV-010 vérifie que chaque entité présente dans le jeu figure au registre avec le bon type, le bon slug
  courant et la bonne révision.

C'est ce registre, et non le texte ni le hash, qui porte l'identité.

## Cycle de vie : aucune suppression physique

| Statut | Signification | Exigence |
|---|---|---|
| `draft`, `candidate`, `in_review` | En cours | — |
| `approved` | Dans la source de vérité | — |
| `superseded` | Remplacée par une autre entité | `supersededBy` obligatoire |
| `retired` | Sortie de la KB | `retiredAt` **et** `retirementDecisionRef` obligatoires |

Une entité validée ne peut pas disparaître sans décision de retraite tracée. Le schéma l'impose et INV-012
le vérifie ; le cas est testé (`INV-CASE-16`).

## Ce qui arrive lors d'une reformulation

1. `id` — inchangé.
2. `revision` — incrémentée.
3. `contentHash` — recalculé, donc différent.
4. `rawStatement` — **jamais** remplacé. La reformulation va dans `canonicalStatement`.
5. Les `EvidenceAssessment` existantes — conservées telles quelles.

Attribuer un nouvel identifiant à une simple reformulation est une erreur, testée par `INV-CASE-19` : la
claim reformulée n'existe pas au registre, et l'invariant échoue.
