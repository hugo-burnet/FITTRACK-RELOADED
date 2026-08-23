# Migration du schéma clinique existant

> **Document généré** par `tools/build-migration-doc.mjs` depuis
> `mappings/clinical-schema-migration.json`. Ne pas éditer à la main.

Le schéma clinique existant est migré, pas utilisé comme squelette. Chacun de ses champs est repris, renommé, déplacé, scindé, promu, étendu ou explicitement dissous — jamais abandonné en silence.

## Preuve d'absence de perte

`tests/invariants.mjs` (INV-013) énumère les chemins de champs **depuis le fichier réel** et exige que chacun apparaisse exactement une fois comme `sourcePath` de ce mapping, sans chemin surnuméraire. La validation échoue sinon.

- champs d'origine couverts : **98**
- hash du fichier d'origine : `sha256:c5b04da70c69246ec2a7a95063d7c49518867f5076a67e9fe6f6353f8c2595c5`

## Répartition des actions

| Action | Nombre | Sens |
|---|---|---|
| `KEEP` | 32 | Champ conservé tel quel, éventuellement avec une contrainte assouplie ou durcie. |
| `RENAME` | 16 | Même sens, nom différent. |
| `MOVE` | 9 | Le champ change d'espace : il quitte la KB pour le runtime utilisateur. |
| `SPLIT` | 18 | Le champ portait deux choses distinctes ; il en devient deux. |
| `PROMOTE` | 11 | Le champ était imbriqué ; il devient une entité identifiée, versionnée et référençable. |
| `EXTEND` | 10 | Champ conservé et enrichi d'une contrainte ou d'un sous-champ qui manquait. |
| `DEPRECATE` | 2 | Conteneur dissous ; son contenu est intégralement repris ailleurs. |

## Les trois transformations qui comptent

**`toleranceDimension` portait deux choses.** La définition générale d'un axe et l'observation datée d'une personne cohabitaient dans le même objet. Une base de connaissances scientifique ne peut pas changer parce qu'un utilisateur a soulevé une barre : les champs `status`, `basis`, `testedRange`, `testedLoad`, `symptomDuring`, `symptomAfter24h` et `notes` partent au runtime, la KB ne garde que la définition et les valeurs admissibles.

**`irritability` n'avait pas sa place dans une condition.** L'irritabilité change d'une semaine à l'autre chez une même personne ; au niveau d'une condition générale, elle n'a pas de valeur. Elle devient `IrritabilityState`, datée et argumentée par les indices qui l'ont produite.

**`expert_practice` n'était pas un niveau de preuve.** Le laisser dans l'échelle A/B/C/D permettait de le comparer à `A_high`, ce qui n'a pas de sens. Il devient `knowledgeType: EXPERT_PRACTICE` avec un niveau clinique nul. C'est la seule modification de valeur de toute la migration, et le seul changement majeur du contrat.

## Destination des champs runtime

| Champ d'origine | Destination |
|---|---|
| `testedLoad` | `runtime/tolerance-observation.testedLoad` |
| `testedRange` | `runtime/tolerance-observation.testedRange` |
| `symptomDuring` | `runtime/tolerance-observation.symptomDuring` |
| `symptomAfter24h` | `runtime/tolerance-observation.symptomAfter24h et runtime/delayed-response` |
| `irritability` | `runtime/irritability-state.level` |

## Règles de priorité des red flags

- Un red flag actif interrompt le flux normal de coaching : aucune AdaptationRule ne s'exécute par-dessus (yieldsToActiveRedFlag constant à true, vérifié par INV-007).
- urgency emergency_now impose action stop_and_emergency_assessment ; les deux champs étaient indépendants dans F4.
- Un red flag d'urgence immédiate doit être couvert par au moins une ReferralRule, sinon la publication échoue.
- La zone RED impose haltsNormalCoaching et au moins une voie d'orientation ; proposer une séance alternative comme réponse principale est interdit par F3 §2.2.
- En cas de red flags multiples, le plus urgent l'emporte ; à urgence égale, le champ priority (1 = premier) départage.
- Un red flag n'est jamais diagnostique : isDiagnostic est constant à false et le message d'orientation ne peut pas nommer de pathologie (namesADiagnosis constant à false).

## Table complète, champ par champ

### KEEP — 32 champs

| Champ d'origine | Destination | Changement de contrainte | Justification |
|---|---|---|---|
| `$defs.source.title` | `source.title` | required → optional | F2 cite une centaine de références sans titre structuré. Exiger le titre forcerait à l'inventer. |
| `$defs.source.year` | `source.year` | required → optional (nullable) | Même raison : de nombreuses citations de F2 n'ont pas d'année. |
| `$defs.source.isOld` | `source.isOld` | — | Signalement utile et déjà utilisé par F3 §16 pour SAPS 2014, NASS 2014 et Cochrane 2015. |
| `$defs.source.notes` | `source.notes` | — | Champ libre conservé. |
| `$defs.evidenceRating.rationale` | `evidence-assessment.confidenceByAspect[].rationale` | — | Le raisonnement descend au niveau de l'aspect, là où il est vérifiable. |
| `$defs.redFlag.question` | `red-flag.question` | — | Conservé tel quel. |
| `$defs.redFlag.positiveExamples` | `red-flag.positiveExamples` | — | Conservé tel quel. |
| `$defs.redFlag.action` | `red-flag.action` | — | Enum repris verbatim. |
| `$defs.zoneRule.criteria` | `safety-zone.criteria` | — | Conservé, avec minItems 1. |
| `$defs.zoneRule.allowedActions` | `safety-zone.allowedActions` | — | Conservé, avec minItems 1. |
| `$defs.zoneRule.forbiddenActions` | `safety-zone.forbiddenActions` | — | Conservé, avec minItems 1 : une zone qui n'interdit rien n'encadre rien. |
| `$defs.modification.trigger` | `adaptation-rule.trigger` | — | Conservé. |
| `$defs.modification.action` | `adaptation-rule.action` | — | Conservé. |
| `$defs.modification.doseChange.load` | `adaptation-rule.doseChange.load` | — | Conservé, type chaîne : le corpus décrit des directions, pas des pourcentages validés. |
| `$defs.modification.doseChange.sets` | `adaptation-rule.doseChange.sets` | — | Conservé. |
| `$defs.modification.doseChange.repetitions` | `adaptation-rule.doseChange.repetitions` | — | Conservé. |
| `$defs.modification.doseChange.rangeOfMotion` | `adaptation-rule.doseChange.rangeOfMotion` | — | Conservé. |
| `$defs.modification.doseChange.tempo` | `adaptation-rule.doseChange.tempo` | — | Conservé. |
| `$defs.modification.doseChange.frequency` | `adaptation-rule.doseChange.frequency` | — | Conservé. |
| `$defs.modification.doseChange.rest` | `adaptation-rule.doseChange.rest` | — | Conservé. |
| `$defs.modification.monitoring` | `adaptation-rule.monitoring` | — | Conservé. |
| `$defs.conditionRecord.aliases` | `condition.aliases` | — | Conservé. |
| `$defs.conditionRecord.description` | `condition.description` | — | Conservé. |
| `$defs.conditionRecord.scope` | `condition.scope` | — | Enum repris verbatim. |
| `$defs.conditionRecord.diagnosticCertaintyRequired` | `condition.diagnosticCertaintyRequired` | — | Enum repris verbatim, et désormais lié à scope : un état postopératoire impose postoperative_protocol_required. |
| `$defs.conditionRecord.diagnosticGuardrail` | `condition.diagnosticGuardrail` | — | Conservé. |
| `$defs.conditionRecord.contraindications[].action` | `contraindication.action` | — | Conservé. |
| `$defs.conditionRecord.progressionCriteria` | `condition.progressionCriteria` | — | Conservé. |
| `$defs.conditionRecord.regressionCriteria` | `condition.regressionCriteria` | — | Conservé. |
| `$defs.conditionRecord.expertPractice` | `condition.expertPractice` | — | Conservé : c'est précisément la séparation que F4 avait déjà bien vue. |
| `$defs.conditionRecord.expertPractice[].statement` | `condition.expertPractice[].statement` | — | Conservé. |
| `$defs.conditionRecord.expertPractice[].rationale` | `condition.expertPractice[].rationale` | — | Conservé. |

### RENAME — 16 champs

| Champ d'origine | Destination | Changement de contrainte | Justification |
|---|---|---|---|
| `schemaVersion` | `kb-release.contractVersion` | — | La version du contrat et la version du contenu de la KB évoluent séparément ; une seule valeur les confondait. |
| `$defs.source` | `core/source` | — | Devient une entité de premier plan du registre global, plus un type imbriqué. |
| `$defs.source.id` | `source.id` | string libre → identifiant attribué et enregistré | Un identifiant de source doit être unique dans tout le corpus, pas seulement dans une fiche. |
| `$defs.source.organizationAuthors` | `source.authors` | — | Le champ mélangeait organisme et auteurs ; le nom neutre reflète ce que le corpus fournit réellement, une chaîne brute non découpée. |
| `$defs.evidenceRating.sourceIds` | `evidence-assessment.sourceRefs` | — | Convention uniforme *Ref / *Refs, sur laquelle l'intégrité référentielle (INV-001) s'appuie automatiquement. |
| `$defs.redFlag.id` | `red-flag.id` | — | Identifiant enregistré au registre global. |
| `$defs.redFlag.sourceIds` | `red-flag.sourceRefs` | — | Convention uniforme. |
| `$defs.redFlag.warning` | `red-flag.isolatedSignalWarning` | — | Le nom dit ce que le champ contient réellement : l'avertissement de F3 §3 sur la faible précision d'un signal isolé. |
| `$defs.modification` | `clinical/adaptation-rule` | — | Entité identifiée et datée, référençable depuis plusieurs conditions. |
| `$defs.modification.evidence` | `adaptation-rule.evidence` | — | Même rôle, structure alignée sur les axes orthogonaux. |
| `$defs.conditionRecord.condition` | `condition.label` | — | Le champ portait le nom, pas la condition ; l'identité est désormais dans id. |
| `$defs.conditionRecord.redFlags` | `condition.redFlagRefs` | — | Références vers des entités RedFlag plutôt que chaînes libres. |
| `$defs.conditionRecord.contraindications[].sourceIds` | `contraindication.sourceRefs` | — | Convention uniforme. |
| `$defs.conditionRecord.evidenceLevel` | `condition.evidenceLevel` | — | Même rôle, structure alignée sur les axes orthogonaux. |
| `$defs.conditionRecord.expertPractice[].label` | `condition.expertPractice[].knowledgeType` | — | La constante expert_practice devient la valeur du vocabulaire knowledgeType, alignée sur le reste de la KB. |
| `$defs.conditionRecord.expertPractice[].sourceIds` | `condition.expertPractice[].sourceRefs` | — | Convention uniforme. |

### MOVE — 9 champs

| Champ d'origine | Destination | Changement de contrainte | Justification |
|---|---|---|---|
| `globalSafetyRules.disclaimer` | `output-policy.requiredElements[]` | — | Un avertissement n'est pas une donnée clinique : c'est une contrainte de sortie. Le placer dans policies/ empêche de le lire comme une vérité médicale. |
| `$defs.toleranceDimension.status` | `runtime/tolerance-observation.status` | — | Un statut de tolérance est vrai d'une personne à une date. La KB n'en conserve que la liste des valeurs admissibles. |
| `$defs.toleranceDimension.basis` | `runtime/tolerance-observation.basis` | — | Idem. |
| `$defs.toleranceDimension.testedRange` | `runtime/tolerance-observation.testedRange` | — | Amplitude testée par un utilisateur donné. |
| `$defs.toleranceDimension.testedLoad` | `runtime/tolerance-observation.testedLoad` | — | Charge testée par un utilisateur donné. |
| `$defs.toleranceDimension.symptomDuring` | `runtime/tolerance-observation.symptomDuring` | — | Symptôme ressenti pendant une exposition précise. |
| `$defs.toleranceDimension.symptomAfter24h` | `runtime/tolerance-observation.symptomAfter24h` | — | Symptôme à 24 h. Également repris par runtime/delayed-response, qui distingue soir, lendemain et 48 h comme le fait F3 §4.2. |
| `$defs.toleranceDimension.notes` | `runtime/tolerance-observation.notes` | — | Note d'observation, donc runtime. |
| `$defs.conditionRecord.irritability` | `runtime/irritability-state.level` | — | L'irritabilité change d'une semaine à l'autre chez une même personne. Elle n'a aucun sens au niveau d'une condition générale. |

### SPLIT — 18 champs

| Champ d'origine | Destination | Changement de contrainte | Justification |
|---|---|---|---|
| `lastEvidenceReview` | `*.lifecycle.reviewedAt` | — | F3 §16 exige que chaque règle conserve ses identifiants de sources ET sa date de revue. Une date globale ne dit pas laquelle des quarante règles a été relue. |
| `$defs.source.url` | `source.urls[]` | required, une seule → tableau, rôle par URL | Le corpus cite le même essai via PubMed, PMC et l'éditeur. Un champ unique obligeait à en choisir un et à perdre les autres — exactement le cas Wolf 2025. |
| `$defs.source.population` | `source.population (brut) + core/population` | — | La chaîne brute est conservée verbatim ; la version structurée devient une entité, parce que F1 §1.3 fait de la population une donnée de raisonnement et non un commentaire. |
| `$defs.evidenceRating` | `core/evidence-assessment + condition.evidenceLevel + adaptation-rule.evidence` | — | F4 utilisait le même objet pour une évaluation datée et pour un attribut figé d'entité. La première devient historisable, les secondes restent des attributs. |
| `$defs.evidenceRating.level` | `clinicalEvidenceLevel (A/B/C/D) + knowledgeType (EXPERT_PRACTICE)` | — | Seule modification de valeur de toute la migration. expert_practice n'était pas un niveau de preuve mais une nature de connaissance ; le laisser dans l'échelle permettait de le comparer à A_high, ce qui n'a pas de sens. |
| `$defs.evidenceRating.confidence` | `evidence-assessment.confidenceByAspect[]` | — | F1 porte des confiances composites (« Élevé pour la direction; modéré pour la forme de la courbe »). Un scalaire obligeait à aplatir vers le haut, ce qui gonfle la certitude, ou vers le bas, ce qui détruit de l'information. |
| `$defs.zoneRule.referralThreshold` | `safety-zone.referralThreshold + clinical/referral-rule` | — | Le texte du seuil est conservé ; la règle exécutable devient une entité partageable entre zones et conditions, avec sa propre date de revue. |
| `$defs.toleranceDimension` | `clinical/tolerance-dimension-definition (KB) + runtime/tolerance-observation (RUNTIME)` | — | Correction architecturale principale de cette migration. F4 mélangeait la définition générale d'un axe et l'observation datée d'une personne. Une base de connaissances scientifique ne peut pas changer parce qu'un utilisateur a soulevé une barre. |
| `$defs.conditionRecord` | `clinical/condition + entités promues + runtime` | — | L'objet portait à la fois des définitions générales, des règles normatives et l'état d'une personne. Les trois sont désormais séparés. |
| `$defs.conditionRecord.symptoms` | `condition.symptoms[] + condition.symptomRefs[]` | — | Les chaînes brutes sont conservées ; les symptômes qui apparaissent dans plusieurs conditions deviennent des entités partagées. |
| `$defs.conditionRecord.movementSensitivity` | `condition.commonlySensitiveAxes (KB) + runtime/tolerance-observation` | — | Ce qui est fréquemment sensible dans une population reste en KB, avec isProhibition constant à faux ; ce qu'un utilisateur a réellement toléré part au runtime. |
| `$defs.conditionRecord.loadSensitivity` | `condition.commonlySensitiveAxes[axis=charge_generale] + runtime/tolerance-observation` | — | Idem. |
| `$defs.conditionRecord.axialLoadTolerance` | `tolerance-dimension-definition[axis=charge_axiale] + runtime/tolerance-observation` | — | Idem. L'axe devient une valeur de vocabulaire au lieu d'une propriété nommée, ce qui permet d'en ajouter sans modifier le schéma. |
| `$defs.conditionRecord.flexionTolerance` | `tolerance-dimension-definition[axis=flexion] + runtime/tolerance-observation` | — | Idem. |
| `$defs.conditionRecord.extensionTolerance` | `tolerance-dimension-definition[axis=extension] + runtime/tolerance-observation` | — | Idem. |
| `$defs.conditionRecord.rotationTolerance` | `tolerance-dimension-definition[axis=rotation] + runtime/tolerance-observation` | — | Idem. |
| `$defs.conditionRecord.overheadTolerance` | `tolerance-dimension-definition[axis=overhead] + runtime/tolerance-observation` | — | Idem. |
| `$defs.conditionRecord.sources` | `condition.sourceRefs[] → registre global core/source` | — | F4 embarquait des objets Source complets dans chaque fiche tout en prévoyant un registre : double emploi garanti à diverger. Les fiches ne portent plus que des références. |

### PROMOTE — 11 champs

| Champ d'origine | Destination | Changement de contrainte | Justification |
|---|---|---|---|
| `globalSafetyRules.redFlags` | `clinical/red-flag[]` | — | Chaque red flag devient une entité avec identifiant stable, révision et date de revue, pour être référençable depuis plusieurs conditions sans duplication. |
| `globalSafetyRules.zoneLogic.green` | `clinical/safety-zone[zone=GREEN]` | — | Une zone doit pouvoir être révisée et datée indépendamment des deux autres. |
| `globalSafetyRules.zoneLogic.orange` | `clinical/safety-zone[zone=ORANGE]` | — | Idem. |
| `globalSafetyRules.zoneLogic.red` | `clinical/safety-zone[zone=RED]` | — | Idem, et la zone RED gagne haltsNormalCoaching et referralRuleRefs obligatoires pour que sa priorité soit structurelle. |
| `conditionRecords` | `curated/clinical/condition[]` | — | Collection d'entités identifiées plutôt que tableau anonyme dans un document racine. |
| `$defs.redFlag` | `clinical/red-flag` | — | Entité identifiée, versionnée et datée. |
| `$defs.zoneRule` | `clinical/safety-zone` | — | Entité identifiée et datée. |
| `$defs.conditionRecord.questionsToAsk` | `clinical/clinical-question via condition.clinicalQuestionRefs` | — | F3 §2.1 énumère un socle de questions communes à toutes les conditions ; les recopier dans chaque fiche garantissait des divergences. |
| `$defs.conditionRecord.recommendedModifications` | `clinical/adaptation-rule via condition.adaptationRuleRefs` | — | Une même règle s'applique souvent à plusieurs conditions ; l'imbriquer imposait de la dupliquer et de la faire diverger. |
| `$defs.conditionRecord.contraindications` | `clinical/contraindication via condition.contraindicationRefs` | — | Une interdiction doit être auditable seule, avec son propre fondement et sa propre date de revue. |
| `$defs.conditionRecord.referralThreshold` | `clinical/referral-rule via condition.referralRuleRefs` | — | Un seuil d'orientation est une règle normative ; F3 §16 exige qu'il porte sa date de revue. |

### EXTEND — 10 champs

| Champ d'origine | Destination | Changement de contrainte | Justification |
|---|---|---|---|
| `$defs.source.documentType` | `source.documentType` | required → optional ; enum étendu | Ajout de position_stand, umbrella_review, meta_regression, network_meta_analysis, within_participant_trial, cadaveric_study, emg_study, imaging_study, scoping_review, qualitative_study, unknown — tous présents dans les registres de F1 §20 et F3 §15. |
| `$defs.source.doi` | `source.doi + source.doiProvenance` | — | Un DOI lu dans un tableau et un DOI extrait d'une URL n'ont pas la même valeur probante. Sans provenance, le second se ferait passer pour le premier. |
| `$defs.source.pmid` | `source.pmid + source.pmidProvenance` | — | Idem. |
| `$defs.evidenceRating.directness` | `evidence-assessment.directness` | — | Les quatre valeurs de F4 sont conservées telles quelles ; sept valeurs sont ajoutées pour les types que F2 §0.3 distingue et que F4 ne pouvait pas exprimer, dont emg_only. |
| `$defs.redFlag.urgency` | `red-flag.urgency` | — | Enum repris verbatim, mais désormais lié à action : emergency_now impose stop_and_emergency_assessment. Les deux champs indépendants autorisaient un red flag urgent qui se contentait d'inviter à consulter. |
| `$defs.modification.doseChange` | `adaptation-rule.doseChange` | — | Ajout de proximityToFailure : F3 §2.3 place la proximité de l'échec au même rang que la charge dans la hiérarchie de modification, et F1 §22 en fait un levier de deload distinct du volume. |
| `$defs.modification.stopCriteria` | `adaptation-rule.stopCriteria` | optional → required, minItems 1 | Une règle d'adaptation sans critère d'arrêt ne peut pas être régressée. F3 §4.2 fait de la régression la moitié de l'algorithme. |
| `$defs.conditionRecord.contraindications[].scope` | `contraindication.scope` | — | Enum repris verbatim, mais absolute_until_assessed impose désormais liftedBy : sans critère de levée, une interdiction « jusqu'à évaluation » devient définitive. |
| `$defs.conditionRecord.contraindications[].reason` | `contraindication.reason + contraindication.basis + contraindication.quotedStatement` | — | F4 avertissait de ne pas convertir une sensibilité fréquente en interdiction absolue, mais n'importe quelle chaîne pouvait remplir reason. Le fondement est maintenant énuméré et chacun impose sa pièce justificative. |
| `$defs.conditionRecord.uncertainty` | `condition.uncertainty` | required, désormais y compris vide | Une condition clinique sans incertitude déclarée est plus suspecte qu'une condition qui en déclare trois. Le tableau vide reste une déclaration. |

### DEPRECATE — 2 champs

| Champ d'origine | Destination | Changement de contrainte | Justification |
|---|---|---|---|
| `globalSafetyRules` | `—` | — | Conteneur dissous : ses trois parties deviennent des entités identifiées et versionnées séparément. |
| `globalSafetyRules.zoneLogic` | `—` | — | Conteneur dissous au profit de trois entités SafetyZone. |

