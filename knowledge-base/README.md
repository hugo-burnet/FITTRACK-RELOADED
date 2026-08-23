# knowledge-base/ — le matériau de la Knowledge Base FitTrack

Ce dossier contient **les entrées** du chantier KB : la recherche source, les prompts qui l'ont
commandée, et les travaux d'architecture de la phase 1.

Le **contrat** qui en découle vit à côté, dans [`../fittrack-kb-contract/`](../fittrack-kb-contract/).
La séparation est délibérée : ici la matière première, là les règles qui la structurent.

## Pourquoi c'est versionné

Le corpus a disparu de son dossier deux fois en une seule journée pendant la construction du contrat,
et n'a été récupéré que parce que des copies temporaires subsistaient. Toute la provenance de la KB —
77 fragments, offsets en octets, hashes — pointe vers ces quatre fichiers. Les perdre rendrait la
moitié du contrat invérifiable.

Depuis leur versionnement, `fittrack-kb-contract` les lit par un chemin **relatif** : la régénération
complète fonctionne depuis un clone neuf, sans dépendre de l'arborescence d'un poste.

```bash
npm --prefix fittrack-kb-contract run build
npm --prefix fittrack-kb-contract run validate
```

## corpus/ — les quatre fichiers de référence

| Fichier | Rôle | Octets | sha256 (début) |
|---|---|---|---|
| `f1-programmation-hypertrophie.md` | Variables de programmation : volume, fréquence, charge, échec, repos, amplitude, périodisation | 71 455 | `c50b0a31…` |
| `f2-anatomie-biomecanique.md` | Ce qui se passe **à l'intérieur** de l'exercice : muscles, longueurs, profils de résistance, contraintes articulaires, substitutions | 96 689 | `a3fcad7a…` |
| `f3-coaching-clinique.md` | Adaptation prudente : zones, red flags, tolérances, règles de formulation | 47 236 | `f704cae4…` |
| `f4-schema-ia-coaching.json` | Schéma de données clinique existant, celui que la phase 2 migre | 8 638 | `c5b04da7…` |

Les hashes complets sont dans
[`../fittrack-kb-contract/corpus/corpus-manifest.json`](../fittrack-kb-contract/corpus/corpus-manifest.json),
calculés sur ces fichiers exacts.

### Sur les noms de fichiers

Ils ont été renommés en ASCII. Les noms d'origine contenaient virgules, parenthèses, apostrophes,
tirets cadratins et accents — hostiles aux scripts shell comme aux URL GitHub, et j'ai buté dessus
plusieurs fois pendant la construction. Le nom d'origine de chaque fichier est conservé dans le champ
`originalFilename` du manifest, et déclaré explicitement dans la configuration plutôt que déduit du
chemin, précisément pour qu'un renommage ne le fasse pas disparaître.

## rapports-phase-1/ — les trois architectures proposées

Trois modèles ont analysé le même corpus et proposé chacun une architecture. Les archives ZIP ont été
extraites : dans un dépôt, un document de conception qu'on ne peut pas lire sans télécharger une
archive n'est pas vraiment archivé.

| Dossier | Ce qu'il apporte | Ce qu'il fallait corriger |
|---|---|---|
| `claude/` | L'analyse la plus fine du corpus et de ses particularités | Sur-modélisation ; l'état de l'utilisateur logé dans la connaissance canonique |
| `gpt/` | La séparation KB / policy / runtime, correction la plus importante | Aucun schéma réel livré ; version au format date présentée comme du SemVer |
| `grok/` | Des fichiers directement exploitables : schemas, enums, migration | Fausse impression d'être prêt : provenance non obligatoire, confiance en chaîne libre, entités annoncées sans schéma |

Empreintes des archives d'origine, restées chez leur auteur :

```text
rapport Claude.zip  e6b800697d02c246685f5540b927a4c7e14eb0e1be9f8a42b8aa1205f71cb4b1
rapport GPT.zip     05b5255ad9496b017171523a01f7b6f11761d195af193aec4bf46a8461220b4a
rapport Grok.zip    901daf461e0bae9d3fb61875b97ccf989c7d1ab16dc4cb6ce821716917cb4099
```

## synthese-multi-ia.md — la comparaison

Le document qui tranche : Claude comme socle détaillé, GPT pour la séparation des espaces et les
identifiants, Grok comme matériel de prototype et de test. C'est l'autorité pour les décisions
d'architecture, au-dessus des trois rapports mais en dessous du corpus pour tout ce qui est
scientifique.

## prompts/

Les deux commandes qui ont produit ce travail. Conservées parce qu'un livrable dont on a perdu la
demande est difficile à juger : sans le prompt, on ne peut plus dire si le contrat répond à ce qu'on
lui demandait.

## Ordre d'autorité

En cas de désaccord entre ces documents :

1. **Le corpus** pour tout ce qui est scientifique, biomécanique ou clinique ;
2. **`synthese-multi-ia.md`** pour les décisions d'architecture ;
3. **Les trois rapports** comme propositions à récupérer ou corriger ;
4. Les connaissances générales uniquement pour expliquer une décision technique, jamais pour compléter
   silencieusement le contenu scientifique.

Toute information absente du corpus reste absente. Le contrat en fait une règle exécutable : un champ
non renseignable porte une note explicite disant **pourquoi**, plutôt qu'une valeur plausible.

## Avertissement

Le corpus décrit un état des connaissances à une date donnée. Il aide à **adapter une exposition**,
jamais à poser ou exclure un diagnostic, et ne remplace ni un médecin ni un kinésithérapeute.
