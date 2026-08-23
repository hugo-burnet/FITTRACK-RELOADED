# Prompt de reprise — Construction de la Knowledge Base FitTrack

Je poursuis la construction de la **Knowledge Base FitTrack**, destinée à devenir la source de vérité d’une IA locale de coaching en musculation, hypertrophie, programmation, sélection d’exercices et adaptation prudente aux douleurs ou contraintes de santé.

Quatre fichiers sont joints à cette conversation :

1. `Programmation hypertrophie — État des connaissances.md`
2. `Anatomie, biomécanique et sélection d'exercices (hypertrophie).md`
3. `Base de connaissances — coaching musculation adaptatif.md`
4. `Schéma de données IA coaching.json`

## Mission

Analyse intégralement ces quatre fichiers avant de proposer quoi que ce soit. Ils constituent le **corpus de référence et la source de vérité de ce travail**.

- Les trois fichiers Markdown portent le contenu scientifique, biomécanique, pratique et clinique à structurer.
- Le fichier JSON contient un schéma clinique existant à auditer, préserver lorsque pertinent, puis intégrer ou faire évoluer dans une architecture unifiée.
- N’ajoute pas silencieusement de connaissances générales extérieures au corpus.
- Si une information, une relation ou une métadonnée nécessaire manque, marque-la explicitement comme manquante, inconnue ou à valider.
- Si tu proposes un élément d’architecture qui n’est pas directement présent dans les fichiers, identifie-le clairement comme une **décision de modélisation**, et non comme un fait scientifique.

L’objectif immédiat n’est pas de générer des conversations, des scénarios utilisateur, des trajectoires de tools, du SFT ou du LoRA. Il faut d’abord concevoir une KB fiable, versionnée, auditable et exploitable par plusieurs sorties.

## Architecture cible

La chaîne visée est :

```text
4 FICHIERS SOURCE
Markdown scientifique + schéma JSON clinique
                  ↓
        EXTRACTION STRUCTURÉE
                  ↓
       KNOWLEDGE BASE UNIFIÉE
          ↙          ↓          ↘
       WIKI      MOTEUR IA     DATASET FUTUR
```

La KB doit être indépendante de ses usages. Le wiki public, le moteur de raisonnement de l’IA et le futur dataset doivent être des **projections dérivées** de la même source structurée, sans devenir des sources de vérité concurrentes.

## Travail demandé

### 1. Cartographier le corpus réel

Pour chacun des quatre fichiers :

- décrire sa structure, son rôle et sa granularité ;
- inventorier les types d’informations qu’il contient ;
- repérer les tableaux, listes, règles, claims, sources, classifications et schémas déjà présents ;
- identifier les champs explicitement disponibles et ceux seulement implicites ;
- relever les chevauchements, complémentarités, divergences de vocabulaire et incompatibilités de structure ;
- distinguer contenu scientifique, interprétation pratique, logique de sécurité et proposition de modèle de données.

Produis une matrice indiquant où chaque type d’information apparaît et quel fichier en est la provenance.

### 2. Proposer une architecture unifiée de Knowledge Base

Définis une architecture canonique suffisamment profonde pour représenter les nuances du corpus, mais suffisamment stable pour être validée et maintenue.

Précise notamment :

- les domaines et sous-domaines ;
- les entités canoniques ;
- leurs responsabilités ;
- les relations entre entités ;
- les identifiants stables ;
- les vocabulaires contrôlés et enums ;
- la stratégie de versionnement ;
- la gestion des traductions, synonymes et alias ;
- la séparation entre données normatives, observations du corpus et projections destinées au wiki ou à l’IA.

Évalue explicitement les choix suivants :

- fichiers JSON ou JSONL versionnés comme source canonique ;
- JSON Schema pour la validation ;
- index relationnel, graphe ou moteur vectoriel comme projections secondaires ;
- séparation entre contenu brut extrait, contenu normalisé et contenu validé.

Ne choisis pas une base vectorielle comme seule KB : la traçabilité, les relations et les contraintes de schéma doivent rester explicites.

### 3. Définir les entités et relations

Propose au minimum les entités nécessaires pour représenter :

- `Claim` ;
- `Source` / `Publication` ;
- `EvidenceAssessment` ;
- `Contradiction` ou `EvidenceConflict` ;
- `Population` ;
- `Outcome` ;
- `TrainingVariable` ;
- `PracticalRule` / `DecisionRule` ;
- `Exercise` ;
- `ExerciseVariant` ;
- `MovementPattern` ;
- `Muscle` et région musculaire ;
- `JointAction` ;
- `Equipment` ;
- `ResistanceProfile` ;
- `ExerciseConstraint` et critères de substitution ;
- `Condition` / pathologie ou problème de santé ;
- `Symptom` ;
- `RedFlag` ;
- `ToleranceDimension` ;
- `SafetyZone` ;
- `Adaptation` / modification d’entraînement ;
- `Contraindication` ou action interdite, lorsque le corpus la justifie réellement ;
- `CorpusFragment` ou provenance textuelle ;
- `ReviewDecision` / validation humaine.

Tu peux renommer, fusionner ou ajouter des entités si cela produit un modèle plus cohérent. Pour chaque entité, donne sa fonction, ses champs clés et ses relations entrantes/sortantes. Fournis ensuite un diagramme conceptuel lisible, par exemple en Mermaid.

### 4. Définir un schéma atomique de claims

Les articles ou sections entières ne doivent pas devenir l’unité principale de connaissance. La KB doit stocker des **claims atomiques**, chacun compréhensible et vérifiable isolément.

Le schéma d’un claim doit au minimum pouvoir représenter :

- identifiant stable ;
- formulation canonique ;
- domaine et sujet ;
- type de connaissance : `EVIDENCE`, `EXPERT_PRACTICE`, `HYPOTHESIS` ou autre catégorie justifiée ;
- statut épistémique : établi, probable, incertain, controversé, mécanistique, empirique, etc. ;
- niveau de confiance ;
- type et hiérarchie des preuves ;
- caractère direct ou indirect de la preuve ;
- population, niveau d’entraînement et contexte ;
- intervention, comparaison et outcome lorsqu’ils existent ;
- conditions d’application ;
- exceptions ;
- limites ;
- interprétation pratique ;
- ce qu’on ne peut pas conclure ;
- sources favorables, contradictoires et contextuelles ;
- liens vers les fragments exacts du corpus d’origine ;
- relations avec d’autres claims : soutien, contradiction, nuance, spécialisation, dépendance ;
- état de validation ;
- version, date de revue et historique de modification.

Un claim ne doit jamais gagner artificiellement en certitude pendant la normalisation.

### 5. Définir le schéma des sources et la provenance

Le modèle des sources doit préserver, lorsqu’ils sont disponibles :

- titre ;
- auteurs ou organisation ;
- année ;
- revue ou éditeur ;
- DOI ;
- PMID ;
- URL officielle ;
- type d’étude ou de document ;
- population ;
- objet étudié ;
- ancienneté ou obsolescence potentielle ;
- notes et limites ;
- emplacement exact de la citation dans le fichier source.

Définis une provenance à plusieurs niveaux :

```text
entité normalisée
  → claim extrait
    → fragment Markdown ou JSON
      → fichier d’origine
        → publication citée, si disponible
```

Prévois les cas de citation incomplète, dupliquée, ambiguë ou non résolue. Ne fabrique jamais de DOI, PMID, URL, auteur ou référence manquante.

### 6. Définir le schéma des exercices

Le schéma doit permettre de comparer et substituer les exercices selon davantage que le muscle ciblé. Il doit pouvoir représenter, avec un niveau de certitude par champ si nécessaire :

- nom canonique, alias et variantes ;
- famille et pattern de mouvement ;
- articulations et actions articulaires ;
- muscles principaux, secondaires et régions musculaires ;
- matériel ;
- position du corps et points d’appui ;
- stabilité externe et demande de stabilisation ;
- profil de résistance ;
- amplitude et position de longueur musculaire ;
- charge axiale ;
- demande lombaire ;
- contraintes articulaires documentées ;
- potentiel de progression ;
- compétences ou installation requises ;
- objectifs pertinents ;
- critères et axes de substitution ;
- limites, inconnues et niveau de preuve ;
- claims et sources justifiant chaque caractéristique non triviale.

Sépare les faits d’anatomie, les observations biomécaniques, les preuves directes d’hypertrophie, les signaux EMG, les hypothèses et la pratique empirique.

### 7. Définir le schéma clinique : conditions, symptômes et sécurité

Pars du fichier `Schéma de données IA coaching.json`, notamment de ses concepts de sources, évaluation de preuve, red flags, zones de sécurité, dimensions de tolérance, modifications et fiches de conditions. Réalise une revue de compatibilité avec les trois Markdown et propose une migration vers le modèle unifié sans perdre l’information existante.

Le modèle ne doit pas réduire une condition à une interdiction rigide du type « diagnostic X = exercice Y interdit ». Il doit représenter :

- condition déclarée ou contexte clinique, sans diagnostic produit par l’IA ;
- symptômes et évolution ;
- irritabilité ;
- tolérance à la charge, aux amplitudes et aux mouvements ;
- réponse pendant la séance, après la séance et à distance ;
- charge axiale, demande de stabilisation et contraintes pertinentes ;
- historique et instructions d’un professionnel ;
- red flags ;
- zones `GREEN`, `ORANGE`, `RED` ;
- adaptations autorisées, adaptations prudentes et actions interdites ;
- seuils de réévaluation ou d’orientation vers un professionnel ;
- niveau de preuve, limites et sources de chaque règle.

Les règles rouges doivent toujours prévaloir sur les adaptations normales. L’IA ne diagnostique pas et ne présente pas une adaptation d’entraînement comme un traitement médical.

### 8. Préserver les contradictions, incertitudes et niveaux de preuve

Définis une méthode explicite pour :

- conserver deux claims incompatibles sans en supprimer arbitrairement un ;
- enregistrer la nature probable du désaccord : population, protocole, outcome, volume non égalisé, durée, mesure, niveau d’entraînement, puissance statistique, etc. ;
- distinguer absence de preuve et preuve d’absence ;
- distinguer preuve directe, preuve indirecte, biomécanique, EMG, hypothèse et expertise pratique ;
- représenter plusieurs évaluations d’un même claim au lieu d’écraser l’historique ;
- empêcher les projections wiki et IA d’exprimer plus de certitude que la KB.

Propose des règles déterministes de conservation de la nuance et des tests automatiques associés.

### 9. Concevoir le pipeline Markdown/JSON vers KB

Propose un pipeline reproductible comprenant au minimum :

```text
ingestion
→ découpage structurel sans perte des repères
→ extraction des candidats
→ normalisation des entités et vocabulaires
→ résolution des sources
→ déduplication
→ création des relations
→ détection des contradictions
→ validation de schéma
→ contrôles de traçabilité
→ revue humaine ciblée
→ publication versionnée de la KB
```

Pour chaque étape, indique :

- les entrées et sorties ;
- ce qui peut être déterministe ;
- ce qui peut nécessiter un LLM ;
- les risques d’erreur ;
- les contrôles automatiques ;
- les cas envoyés en revue humaine ;
- les artefacts intermédiaires à conserver pour l’audit.

L’extraction doit être idempotente et incrémentale. Une nouvelle version d’un rapport ne doit pas casser les identifiants stables ni effacer l’historique sans décision explicite.

### 10. Préparer les projections futures

Explique comment dériver ensuite, sans dupliquer la source de vérité :

- un wiki lisible par un humain ;
- un index de recherche pour l’IA locale ;
- des paquets de contexte ou vues adaptées au raisonnement ;
- des règles exécutables de sécurité et de décision ;
- plus tard, des seeds de scénarios et un dataset d’entraînement.

À ce stade, définis seulement les interfaces et transformations nécessaires. **Ne génère aucune conversation, aucun scénario, aucune trajectoire de tools et aucun exemple de dataset conversationnel.**

## Contraintes non négociables

- Les quatre fichiers fournis priment sur les connaissances générales du modèle.
- Toute provenance doit être conservée jusqu’au fichier et au fragment d’origine.
- Toute affirmation scientifique importante doit rester reliée à ses sources lorsqu’elles existent.
- Les niveaux de preuve, populations, limites, contradictions, incertitudes et éléments `cannotConclude` ne doivent pas être aplatis.
- `EXPERT_PRACTICE` et `HYPOTHESIS` ne doivent jamais être présentés comme des faits établis.
- Une donnée absente reste absente : ne pas l’inventer pour compléter un schéma.
- Le schéma JSON existant doit être audité et migré, pas ignoré ni copié aveuglément.
- La sécurité clinique est non diagnostique et prioritaire.
- Le design doit être praticable pour un extracteur automatique, validable par JSON Schema et auditable par Git.
- Ne commence pas l’implémentation tant que l’architecture proposée et les décisions ouvertes n’ont pas été présentées.

## Livrables attendus dans cette première réponse

Fournis, dans cet ordre :

1. une cartographie synthétique des quatre fichiers ;
2. les chevauchements, conflits et lacunes observés ;
3. l’architecture recommandée de la KB ;
4. le catalogue des entités et relations ;
5. un diagramme conceptuel ;
6. les schémas proposés pour `Claim`, `Source`, `Exercise` et le domaine clinique, avec exemples JSON minimaux fondés uniquement sur le corpus ;
7. une table de correspondance entre le schéma JSON clinique actuel et le modèle unifié ;
8. le pipeline d’extraction et de validation ;
9. les contrôles de qualité et critères d’acceptation ;
10. les décisions encore ouvertes, avec recommandation et compromis pour chacune ;
11. un plan d’implémentation par étapes, sans encore écrire l’extracteur.

Termine par une proposition de **contrat de sortie de la phase suivante** : liste exacte des fichiers à produire pour pouvoir implémenter ensuite l’extracteur Markdown/JSON → Knowledge Base.
