# Versionnement

## Trois horloges distinctes, jamais confondues

C'est le point sur lequel la proposition GPT a été corrigée : elle utilisait une version au format date en
la présentant comme du SemVer. Les deux ne se mélangent pas.

| Horloge | Champ | Format | Ce qu'elle mesure |
|---|---|---|---|
| Contrat | `KBRelease.contractVersion` | SemVer strict | Les schemas, vocabulaires et invariants |
| Contenu | `KBRelease.version` | SemVer strict | Les entités de la KB |
| Corpus | `KBRelease.corpusSnapshot[].corpusDate` + `contentHash` | Date + hash | L'état des sources qui ont produit la KB |

Le corpus n'a **pas** de SemVer, et c'est délibéré : il n'évolue pas par incréments décidés, il est
remplacé par une nouvelle recherche. Une date et un hash le décrivent honnêtement ; un numéro de version
laisserait croire à une continuité qui n'existe pas.

## SemVer du contrat

| Incrément | Quand |
|---|---|
| **Majeure** | Un champ obligatoire est ajouté, un champ est retiré ou renommé, un enum perd une valeur, une contrainte se durcit. Les données existantes cessent de valider. |
| **Mineure** | Un champ facultatif est ajouté, un enum gagne une valeur, une entité apparaît. Les données existantes continuent de valider. |
| **Corrective** | Description, commentaire, correction d'un `$ref` qui ne résolvait pas. Aucun effet sur la validation. |

Le retrait de `expert_practice` de l'échelle `clinical-evidence-level` est un changement **majeur** : c'est
une valeur d'enum qui disparaît, et les données du schéma clinique existant qui l'utilisaient cessent de
valider tant qu'elles n'ont pas été migrées. Cette rupture est assumée, tracée en `SPLIT` dans le mapping,
et c'est la seule modification de valeur de toute la migration.

## SemVer du contenu

| Incrément | Quand |
|---|---|
| **Majeure** | Une entité approuvée est retirée ou remplacée, une conclusion change de direction, une politique de sécurité se durcit. |
| **Mineure** | Des entités sont ajoutées, une évaluation datée s'ajoute à une claim existante. |
| **Corrective** | Coquille, reformulation d'un `canonicalStatement`, correction d'un slug. |

Une évaluation qui en remplace une autre est un incrément **mineur**, pas majeur : l'ancienne n'est pas
supprimée, elle reste interrogeable. C'est une addition, pas un remplacement.

## Immutabilité d'une release

`KBRelease.immutable` est une constante à `true`. Une release publiée n'est jamais modifiée : on en publie
une nouvelle.

Une release ne peut pas être publiée si un contrôle bloquant a échoué. Ce n'est pas une consigne : le
schéma contient une contrainte `if/then` sur `blockingChecks` qui refuse un contrôle déclaré bloquant et
non passé. La liste des contrôles bloquants est dans `tests/invariants.json`.

## Ce qui déclenche une nouvelle release

1. Un changement de corpus — un `contentHash` qui ne correspond plus. `tools/make-fragments.mjs` refuse
   alors de régénérer et invite explicitement à publier une nouvelle release, parce que les fragments
   existants deviennent périmés.
2. Une décision de revue qui approuve, fusionne, retire ou remplace une entité.
3. Un changement de contrat qui invalide des données existantes.

## Comment un changement de corpus se propage

```text
corpus modifié
  → contentHash différent
  → make-fragments.mjs REFUSE de régénérer et l'explique
  → décision humaine : mettre à jour expectedContentHash
  → régénération des fragments
  → les entités dont la provenance pointe un corpusFileContentHash périmé sont signalées
  → revue humaine ciblée sur ces seules entités
  → nouvelle KBRelease avec le nouveau snapshot
```

Le refus de régénérer en silence est le point important. Une régénération automatique sur un corpus modifié
produirait des fragments valides pointant vers un texte qui a changé, et personne ne s'en apercevrait.

## Versions des projections

Les projections — wiki, index de recherche, context packs, dataset futur — ne sont **pas** versionnées
indépendamment. Elles portent la version de la release dont elles dérivent et sont reconstructibles à
l'identique depuis elle. Une projection qu'on ne pourrait pas reconstruire serait devenue une source de
vérité par accident.
