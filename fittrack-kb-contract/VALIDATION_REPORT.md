# Rapport de validation

**Date d'exécution :** 23 août 2026
**Commande :** `npm run build && npm run validate`
**Résultat :** succès, 0 échec.

Ce rapport transcrit la sortie réelle de `tests/validate.mjs`. Les chiffres sont ceux du fichier
`tests/validation-results.json`, écrit par le validateur lui-même à chaque exécution.

## Résumé

| Contrôle | Résultat |
|---|---|
| Fichiers JSON analysés | 101, 0 erreur de syntaxe |
| Schemas compilés en draft 2020-12 | 48, tous les `$ref` résolus localement |
| Vocabulaires | 29, 212 termes, enums et fichiers cohérents avec la source |
| Instances valides | 208, toutes validées contre leur schéma |
| Cas devant échouer | 20, tous rejetés **pour la raison attendue** |
| Invariants exécutés | 15 sur 15, 0 échec, 0 non exécutable |

## 1. Syntaxe JSON

101 fichiers analysés, 0 erreur.

## 2. Schemas

48 schemas compilent en JSON Schema draft 2020-12 avec `ajv` 8. Chaque `$id` est unique et tous les `$ref`
résolvent **localement**, sans accès réseau. Répartition :

| Espace | Nombre |
|---|---|
| `schemas/common/` | 4 |
| `schemas/core/` | 14 |
| `schemas/anatomy/` | 11 |
| `schemas/clinical/` | 9 |
| `schemas/policies/` | 2 |
| `schemas/runtime/` | 7 |
| `extraction-contract/` | 1 |

Toutes les entités minimales demandées sont schématisées. `schemas/entity-catalog.json` fait correspondre
chaque `kind` à son schéma et à son espace de stockage ; c'est ce catalogue qui rend INV-002 et INV-015
vérifiables.

## 3. Vocabulaires

29 vocabulaires, 212 termes. Chacun déclare son origine — corpus, schéma clinique existant, ou décision de
modélisation — et chaque terme déclaré issu du corpus porte une référence au corpus, contrainte imposée par
`vocabulary-file.schema.json`.

Les enums des schemas sont **générés** depuis la même source que les fichiers de vocabulaire
(`tools/build-vocabularies.mjs`), et le validateur vérifie en plus leur égalité stricte. Une divergence
entre un schéma et un vocabulaire est impossible par construction, et détectée si elle survenait quand
même.

## 4. Instances valides

208 instances validées. Ce total inclut les 4 `CorpusFile` et 77 `CorpusFragment` réels : les schemas de
provenance sont donc exercés sur des données authentiques, pas sur un exemple fabriqué pour passer.

### Provenance : ce qui a été réellement vérifié

Les 77 fragments portent des offsets **en octets** calculés sur les fichiers réels du corpus, puis vérifiés
par **relecture du fichier aux offsets** et comparaison au texte. Une erreur d'indexation aurait fait
échouer la génération plutôt que de produire une provenance fausse en silence.

Les quatre fichiers du corpus sont identifiés par leur hash :

| Fichier | Octets | Hash |
|---|---|---|
| F1 — Programmation hypertrophie | 71 455 | `sha256:c50b0a31…21a65b` |
| F2 — Anatomie et biomécanique | 96 689 | `sha256:a3fcad7a…5e26f685` |
| F3 — Coaching clinique | 47 236 | `sha256:f704cae4…ea441202` |
| F4 — Schéma de données IA coaching | 8 638 | `sha256:c5b04da7…8c2595c5` |

Chaque objet canonique possède une provenance vers un fragment existant : INV-002 et INV-001 le vérifient.

## 5. Cas devant échouer

Les 20 cas de `fixtures/invalid/` échouent tous, et le validateur vérifie que **l'échec vient bien de la
contrainte visée** : une fixture qui échouerait pour une coquille ne testerait rien.

17 cas sont refusés par le schéma, 3 par un invariant. Les trois derniers sont justement ceux que JSON
Schema ne peut pas exprimer — une référence orpheline, un identifiant absent du registre, une hausse de
confiance sans preuve nouvelle — et c'est la raison d'être des invariants exécutables.

| Cas | Ce qu'il protège | Refusé par |
|---|---|---|
| Claim sans provenance | INV-002 | schéma |
| DOI sans provenance déclarée | Aucune métadonnée sans provenance | schéma |
| `EXPERT_PRACTICE` promue en fait établi | Contrainte non négociable | schéma |
| Observation EMG déclarée établie | INV-005 | schéma |
| Évaluation EMG à confiance élevée sur l'ampleur | INV-005 | schéma |
| Disparition de `cannotConclude` | INV-004 | schéma |
| Charge mécanique convertie en risque démontré | INV-006 | schéma |
| Contre-indication sans énoncé cité ni source | INV-008 | schéma |
| Red flag sans action ni urgence | INV-007 | schéma |
| Substitution sans critère justificatif | Critères obligatoires | schéma |
| Propriété d'exercice non triviale sans attestation | Attestation par champ | schéma |
| Politique produit présentée comme vérité médicale | Séparation KB / policy | schéma |
| Règle normative sans justification | Justification obligatoire | schéma |
| Règle qui ne cède pas devant un red flag | INV-007 | schéma |
| Condition portant l'état d'un utilisateur | INV-015 | schéma |
| Entité retirée sans décision de retraite | INV-012 | schéma |
| Fusion de sources sur simple similarité | INV-009 | schéma |
| Référence interne orpheline | INV-001 | invariant |
| Identifiant changé lors d'une reformulation | INV-010 | invariant |
| Hausse de certitude sans preuve nouvelle | INV-003 | invariant |

## 6. Invariants

Les 15 invariants ont été **exécutés**, aucun n'est resté non exécutable.

| ID | Résultat |
|---|---|
| INV-001 Intégrité référentielle | 208 entités, toutes les références résolvent |
| INV-002 Provenance obligatoire | toute entité canonique porte au moins un lien vers un fragment |
| INV-003 Monotonie de certitude | 1 chaîne de révision contrôlée |
| INV-004 `cannotConclude` en projection | 16 claims projetées, aucun contenu perdu |
| INV-005 EMG ≠ hypertrophie | aucune promotion détectée |
| INV-006 Biomécanique ≠ risque démontré | aucune conversion détectée |
| INV-007 Priorité des red flags | 4 red flags, 2 règles d'adaptation contrôlées |
| INV-008 Contre-indications justifiées | 1 contre-indication, fondement vérifié |
| INV-009 Aucune fusion automatique | aucune fusion non fondée |
| INV-010 Stabilité des identifiants | 119 identifiants au registre, tous cohérents |
| INV-011 Idempotence | 77 fragments recalculés à l'identique |
| INV-012 Conservation de l'historique | aucune entité remplacée ou retirée sans trace |
| INV-013 Aucune perte en migration clinique | **98 chemins de F4 énumérés depuis le fichier réel, tous couverts** |
| INV-014 Unicité des identifiants | 208 identifiants distincts |
| INV-015 Séparation KB / POLICY / RUNTIME | aucune fuite de couche |

## 7. Migration clinique

INV-013 énumère les chemins de champs du schéma clinique existant **depuis le fichier réel**, puis exige que
chacun apparaisse exactement une fois comme `sourcePath` du mapping, et qu'aucun chemin du mapping ne soit
absent du fichier.

**Résultat : 98 chemins d'origine, 98 couverts, 0 manquant, 0 surnuméraire.**

C'est la preuve exécutable qu'aucun champ n'est perdu en silence, et non une affirmation. Chaque entrée
porte sa justification. Répartition des 98 transformations :

| Action | Nombre |
|---|---|
| `KEEP` | 32 |
| `SPLIT` | 18 |
| `RENAME` | 16 |
| `PROMOTE` | 11 |
| `EXTEND` | 10 |
| `MOVE` | 9 |
| `DEPRECATE` | 2 |

Les 9 `MOVE` sont exactement les champs qui quittent la KB pour le runtime utilisateur, et les 2
`DEPRECATE` sont des conteneurs dissous dont le contenu est intégralement repris ailleurs.

## Contraintes NON testées à ce stade

Le prompt demande d'indiquer clairement toute contrainte non testée. Les voici, sans les présenter comme
validées.

| Contrainte | Pourquoi elle n'est pas testée |
|---|---|
| Idempotence du **pipeline complet** | Seules la fragmentation et la validation sont implémentées. Les étapes 3 à 10 et 15 du pipeline n'existent pas encore. INV-011 ne couvre que la fragmentation. |
| `cannotConclude` dans **toutes** les projections | Une seule projection existe. L'assertion est écrite pour être réutilisée par les projections futures, mais elle n'a rien d'autre à contrôler aujourd'hui. |
| Audit des sorties conversationnelles | `OutputPolicy` énumère 7 formulations interdites et 3 éléments obligatoires, mais aucun générateur de sortie n'existe. L'audit est une tâche de phase ultérieure. |
| Comportement d'un red flag actif **en exécution** | Le contrat garantit que la donnée ne peut pas être mal formée. Il ne peut pas garantir qu'un moteur de coaching non écrit la respectera. |
| Ergonomie d'`AttestedValue` à grande échelle | Éprouvée sur 5 variantes. Le coût de saisie ne devient réel qu'à plusieurs centaines de fiches. |
| Granularité des claims en prose dense | La règle d'amorce tient sur les tableaux. Elle n'a pas été éprouvée sur les sections en prose du rapport biomécanique. |

## Décisions restées ouvertes

| Décision | État |
|---|---|
| Attribution Haugen / Heidel | **Ouverte et escaladée.** Deux noms d'auteur, deux localisateurs sans recouvrement, aucun identifiant fort partagé. Non tranchable avec le corpus seul ; l'enrichissement bibliographique externe est hors périmètre. Deux entrées `Source` distinctes sont conservées. |
| Conflits de preuve du corpus | **Ouverts par conception.** Les 2 `EvidenceConflict` portent `resolutionState: open_by_design` : le corpus les présente comme irréductibles en l'état des connaissances, et les trancher serait une falsification. |
| Granularité des claims | Règle d'amorce énoncée, à éprouver en phase 3. |
| Ergonomie d'`AttestedValue` | À rejuger à grande échelle. |
| Quatre politiques produit non écrites | Listées dans `policies/README.md` plutôt que laissées se décider implicitement dans le code. |

## Limites connues du golden set

Le golden set est **destiné à la revue humaine, pas à la consommation par un coach**.

Plusieurs entités portent des rattachements provisoires, explicitement signalés en `unknownFields` avec la
raison `pending_human_review`. Le corpus cite bien plus de références que ce golden set restreint n'en
modélise en entités `Source` ; plutôt que de rattacher une affirmation à une source approximative — ce qui
aurait produit un jeu apparemment complet et faux — chaque cas dit ce qui manque et pourquoi.

Ces signalements ne sont pas des défauts de validation : ils sont la conséquence directe de la règle
« toute information absente du corpus reste absente ».

## Reproductibilité

```bash
npm install
npm run build      # régénère fragments, vocabulaires, hashes, registre, table de migration
npm run validate   # rejoue les 6 étapes et les 15 invariants
```

`npm run build` échoue explicitement si le corpus est introuvable ou si son hash ne correspond plus, plutôt
que de régénérer en silence à partir d'un contenu différent.
