# FITTRACK-RELOADED — E5 Design Review

**Statut :** proposition de conception, aucune implémentation E5 réalisée
**Branche inspectée :** `feat/knowledge-base-v1`
**Commit inspecté :** `3a5a5a6`
**Corpus autoritaire :** `archive/fittrack-kb-corpus`
**Date du review :** 2026-08-24

## Décision proposée

E5 v1 doit être un **module profond** avec une seule interface de traitement par fragment. Le caller lui fournit un fragment de prose attesté, son contexte de titre et un catalogue déterministe des citations présentes. Le module renvoie uniquement :

1. des candidats `claim` ;
2. des brouillons candidats `evidence-assessment` liés aux claims ;
3. les `citation-occurrence` de prose produites par un prétraitement déterministe, jamais par le LLM ;
4. des attributions claim–occurrence candidates ;
5. des diagnostics, y compris les fragments à zéro claim.

Le module n'écrit pas dans `curated/`, ne crée aucun identifiant métier, ne résout aucune Source, ne fusionne rien et ne transforme pas directement la prose clinique en règle exécutable. Les entités `RedFlag`, `AdaptationRule`, `Contraindication`, `ReferralRule`, `SafetyZone`, `EvidenceConflict` et `EvidenceGap` restent des cibles de curation ultérieure. E5 peut seulement produire les claims qui les justifieraient et des diagnostics de routage vers la revue.

La règle de granularité proposée est :

> Une claim candidate porte un seul prédicat évaluable sur un sujet et un outcome donnés, avec tous les qualificatifs nécessaires à sa vérité et à sa sécurité. Deux propositions sont séparées si l'une peut être vraie et l'autre fausse, si elles demandent des citations différentes, si elles changent de type de connaissance, ou si elles demandent une évaluation de confiance différente.

Cette règle est testable par quatre contrôles : indépendance de vérité, indépendance de preuve, indépendance épistémique et conservation du périmètre.

---

# A. Lecture du contrat

## A.1 Schémas directement concernés

### Interface d'extraction

- `extraction-contract/extraction-candidate.schema.json`
  - un candidat n'est pas une entité KB ;
  - `candidateId` est technique et dérivé du contenu ;
  - une extraction LLM doit conserver `modelId`, `promptHash`, `temperature` et `rawResponse` ;
  - `verbatimSpan` porte `text`, `startByte`, `endByte` ;
  - `confidenceOfExtraction` concerne la lecture du fragment, jamais la solidité scientifique ;
  - les flags de risque existants sont réutilisés sans changement de vocabulaire ;
  - tous les candidats E5 v1 ont `reviewState: pending_human_review`.

### Claims et évaluations

- `schemas/core/claim.schema.json`
  - une claim = une affirmation vérifiable ;
  - `rawStatement` est verbatim et n'est jamais remplacé par `canonicalStatement` ;
  - aucun score global de preuve ;
  - `cannotConclude` est obligatoire, même vide ;
  - `EXPERT_PRACTICE` et `HYPOTHESIS` ne peuvent pas être des faits établis ;
  - une `EMG_OBSERVATION` ne peut pas recevoir `established` ou `established_direction` ;
  - les évaluations sont référencées, pas embarquées dans une claim curated.
- `schemas/core/evidence-assessment.schema.json`
  - `confidenceByAspect[]`, `directness`, `evidenceTypes[]` et la hiérarchie restent orthogonaux ;
  - `emg_only` ne peut soutenir une supériorité hypertrophique et ne peut recevoir une confiance haute/modérée sur magnitude, spécificité régionale ou équivalence ;
  - `biomechanical_only`, `mechanistic_hypothesis` et `animal_model` ne peuvent soutenir un risque clinique démontré ;
  - plusieurs évaluations historiques peuvent coexister.

### Provenance et citations

- `schemas/core/corpus-fragment.schema.json`
  - fragment exact avec fichier, `headingPath`, lignes, offsets octets, texte brut et hashes ;
  - le fichier original reste l'autorité.
- `schemas/common/provenance.schema.json`
  - chaîne minimale : entité curated → candidat → fragment → fichier de corpus.
- `schemas/core/citation-occurrence.schema.json`
  - une occurrence n'est pas une Source ;
  - label, URL et position sont conservés ;
  - `resolvesToSourceRef` reste `null` à ce stade.
- `schemas/core/source.schema.json` et `source-resolution.schema.json`
  - seulement en aval ; E5 ne les produit pas et ne les enrichit pas.

### Vocabulaires fermés

- `knowledge-type.vocab.json`
- `epistemic-status.vocab.json`
- `confidence-aspect.vocab.json`
- `confidence-level.vocab.json`
- `directness.vocab.json`
- `evidence-type.vocab.json`
- `clinical-evidence-level.vocab.json`
- `domain.vocab.json`

Le LLM ne peut produire que des valeurs de ces vocabulaires. Quand aucune valeur n'est justifiée par le fragment, le champ cible reste absent ou `null` dans le brouillon et un objet d'état porte `UNRESOLVED`. La chaîne littérale `UNRESOLVED` ne doit jamais être injectée dans un champ à vocabulaire fermé.

## A.2 Schémas cliniques qui contraignent l'interprétation

E5 v1 ne matérialise pas directement ces entités, mais doit préserver les distinctions nécessaires à leur curation :

- `red-flag.schema.json` : signal observable, non diagnostic, action et urgence ;
- `referral-rule.schema.json` : orientation sans nommer de diagnostic ;
- `adaptation-rule.schema.json` : action réversible, monitoring, critères d'arrêt et priorité absolue des red flags ;
- `contraindication.schema.json` : interdiction seulement sur fondement admissible explicite ; une charge biomécanique n'est jamais un tel fondement ;
- `safety-zone.schema.json` : distinction GREEN/ORANGE/RED et arrêt du coaching normal en RED ;
- `tolerance-dimension-definition.schema.json` : définition KB distincte d'une observation utilisateur runtime ;
- `product-safety-policy.schema.json` : une prudence produit n'est pas une vérité médicale ;
- `output-policy.schema.json` : formulations imposées/interdites, hors claims scientifiques ;
- `evidence-conflict.schema.json` et `evidence-gap.schema.json` : conflits et absences explicites sont des objets aval, jamais des vides à combler par E5.

## A.3 Invariants concernés

### Préconditions à appliquer directement aux sorties E5

- **INV-001 — intégrité référentielle :** tout `fragmentRef`, `corpusFileRef`, claim-candidate ref et citation-occurrence-candidate ref doit résoudre dans le batch ou dans les artefacts d'entrée.
- **INV-005 — EMG ≠ hypertrophie :** séparation obligatoire des claims EMG et hypertrophie ; aucun avantage hypertrophique dérivé d'EMG.
- **INV-006 — biomécanique ≠ risque clinique :** aucune charge, force, compression, cisaillement ou moment ne devient danger, blessure ou contre-indication.
- **INV-009 — aucune fusion automatique :** aucune déduplication inter-fragments ou inter-fichiers ne fusionne les claims ou sources. Une ressemblance produit au plus `possible_duplicate`.
- **INV-011 — idempotence :** aujourd'hui exécuté pour la fragmentation seulement ; E5 doit en étendre le principe à l'identité logique des candidats et à la rematérialisation depuis une réponse brute mise en cache.
- **INV-014 — unicité :** les `candidateId` sont uniques et déterministes.
- **INV-015 — séparation KB/POLICY/RUNTIME :** E5 ne crée aucune observation datée d'utilisateur, aucune instruction clinique runtime et aucune politique produit déguisée en claim scientifique.

### Invariants préparés mais appliqués surtout à la promotion/curation

- **INV-002 :** provenance obligatoire des entités curated ; E5 fournit la chaîne nécessaire.
- **INV-003 :** aucune hausse de certitude sans nouvelles sources ; E5 ne remplace aucune évaluation.
- **INV-004 :** conservation de `cannotConclude` ; E5 le copie exactement quand le fragment l'énonce.
- **INV-007 :** les red flags prévalent sur toute adaptation ; E5 route ce contenu vers revue clinique.
- **INV-008 :** une contre-indication exige un fondement admissible ; E5 n'en fabrique jamais.
- **INV-010 :** stabilité des identifiants métier ; E5 n'en attribue aucun.
- **INV-012 :** conservation de l'historique ; E5 ajoute des candidats, il n'écrase rien.
- **INV-013 :** migration F4 ; sans effet direct sur l'extraction de prose E5.

## A.4 Contraintes non négociables

1. E5 lit le fragment en **monde fermé** : seul le texte fourni et son `headingPath` peuvent justifier une sortie.
2. Un lien, un nom de revue, un DOI enfoui dans une URL ou la mémoire du modèle ne justifient aucune métadonnée bibliographique.
3. Le texte contextuel adjacent aide à résoudre une anaphore, mais ne peut jamais fournir le `rawStatement` ni une citation au fragment cible.
4. `payload.rawStatement` doit être exactement égal à `verbatimSpan.text` pour une claim E5.
5. `canonicalStatement` est facultatif. Il ne peut ajouter ni causalité, ni population, ni outcome, ni seuil, ni universalité.
6. Tous les nombres de `canonicalStatement` doivent déjà apparaître dans le span source ; sinon rejet dur.
7. E5 ne produit pas de `sourceRef`, d'auteur, d'année, de DOI, de PMID ou de type de document qui ne soit explicitement écrit dans le fragment.
8. Une absence de preuve n'est produite que si le corpus la signale explicitement.
9. Une pratique, adaptation ou interprétation est séparée du résultat scientifique dès qu'elle peut être évaluée indépendamment.
10. Toute sortie clinique, tout red flag, toute contre-indication, tout seuil numérique et toute formulation de risque va en revue humaine.

## A.5 Réalité d'implémentation à prendre en compte

Le contrat décrit E3 comme un scan déterministe de liens. L'implémentation actuelle `scan-e3.mjs` précise toutefois qu'elle « relit le markdown déjà présent dans les cellules E1 ». L'artefact courant contient une seule occurrence F2, sur `frag.f2.0014`, et aucune occurrence F3. Ce n'est pas une raison de réécrire E3 : E3 reste figé pour les cellules E1 qu'il traite.

Conséquence de conception : avant l'appel LLM, E5 doit utiliser un **scanner déterministe de liens de prose**, construit sur la même primitive de parsing Markdown, pour fournir des handles locaux de citation. Ces occurrences gardent `extraction.method: deterministic_link_scan`, même si elles sont émises dans le run orchestré E5. Le LLM ne crée ni label, ni URL, ni offset.

Autre constat : `fragments.json` est explicitement non exhaustif. Il contient actuellement 24 fragments F2 et 26 fragments F3, alors que les corpus comptent respectivement 413 et 302 lignes selon le manifest. E5 nécessite donc un planificateur déterministe de blocs de prose éligibles ; il ne peut pas supposer que les fragments existants couvrent déjà le corpus dense.

---

# B. Typologie réelle de F2 et F3

## B.1 Structure observée

### F2 — anatomie, biomécanique, sélection d'exercices

- 413 lignes selon le manifest ;
- sections numérotées 0 à 12 ;
- 65 titres Markdown ;
- 49 lignes de tableaux ;
- environ 97 lignes non tabulaires de 350 caractères ou plus, ce qui confirme une prose très dense.

Types de blocs rencontrés :

1. **Garde-fous épistémiques** : hiérarchie, niveaux de confiance, EMG ≠ hypertrophie, charge ≠ danger.
2. **Faits anatomiques composites** : structure, biarticularité, actions, portions régionales et parfois conséquences pratiques dans un même paragraphe.
3. **Résultats directs longitudinaux** : hypertrophie, force, comparaison de modalités, souvent suivis d'une limite et d'une recommandation.
4. **Observations biomécaniques** : moments, bras de levier, forces, profils de résistance et contraintes articulaires.
5. **Observations EMG/performance** : proxies utiles mais non substituables à l'hypertrophie.
6. **Mécanismes et hypothèses** : longueur musculaire, biarticularité, adaptation tissulaire.
7. **Synthèses multi-outcomes** : une même source donne force, hypertrophie, EMG ou contrôle moteur ; chaque outcome doit devenir une claim distincte.
8. **Contradictions et limites** : résultats discordants, absence de différence, portée de population, petits échantillons.
9. **Lacunes explicites** : absence de mesure directe et interdiction d'extrapoler.
10. **Interprétations pratiques** : sélection, substitution, stabilité, confort, disponibilité.
11. **Pratique experte qualitative** : consensus de coachs et heuristiques explicitement étiquetées `expert_practice`.
12. **Règles d'encodage et de gouvernance** : contenu important, mais pas nécessairement une claim scientifique E5.

### F3 — coaching clinique adaptatif

- 302 lignes selon le manifest ;
- sections numérotées 1 à 17 ;
- 30 titres Markdown ;
- 97 lignes de tableaux ;
- environ 15 lignes non tabulaires de 350 caractères ou plus, mais de nombreux items courts cliniquement denses.

Types de blocs rencontrés :

1. **Résumé opérationnel sourcé** : résultat clinique, nuance, garde-fou et action dans un même item.
2. **Informations minimales et triage** : symptômes, contexte, fonction, évolution, red flags.
3. **Zones de sécurité** : critères, actions permises/interdites et orientation.
4. **Red flags** : signaux observables, urgence et non-diagnostic.
5. **Protocoles numériques contextualisés** : seuils d'essais précis, populations précises, et avertissement de non-universalité.
6. **Tolérance et irritabilité** : réponse pendant, après et à 24–48 h, sans créer d'observation runtime.
7. **Recommandations de pratique clinique** : activité, exposition progressive, dosage, retour à l'entraînement.
8. **Adaptations prudentes** : options réversibles, jamais interdictions générales.
9. **Biomécanique clinique indirecte** : utile pour doser, insuffisante pour diagnostiquer un dommage.
10. **Mythes/réfutations** : douleur ≠ dommage, imagerie ≠ cause, posture/exercice ≠ danger universel.
11. **Formulations conversationnelles et politiques produit** : hors claim scientifique E5 v1 ; routées vers policy/revue.
12. **Registre de sources et niveaux de preuve** : métadonnées structurées/tableaux, hors extraction de prose E5.

## B.2 Unité d'entrée recommandée

L'unité primaire est un bloc Markdown sémantique :

- un paragraphe ;
- un item de liste ;
- un callout ;
- jamais un tableau, une ligne de tableau, un titre seul, un bloc de code ou un registre bibliographique.

Un bloc reçoit son `headingPath` et, en contexte non extractible, au maximum le bloc précédent et le bloc suivant. Les claims et citations doivent toujours provenir du bloc cible. Les paragraphes observés tiennent largement dans cette unité ; aucun regroupement par section n'est nécessaire en v1.

---

# C. Politique de granularité

## C.1 Représentation conceptuelle

Une claim candidate peut être lue comme le tuple :

```text
(sujet, relation/prédicat, objet ou outcome, population, conditions, temporalité, modalité)
```

Les qualificatifs qui changent la vérité restent dans la même claim : « chez des sujets entraînés », « après neuf semaines », « à volume égalisé », « dans certaines douleurs chroniques », « sans supériorité durable démontrée ».

## C.2 Les quatre tests de découpage

### Test 1 — indépendance de vérité

Si A peut être vraie alors que B est fausse, produire deux claims.

Exemple : « gain de force spécifique au mode testé » et « pas de différence significative d'hypertrophie » sont deux claims.

### Test 2 — indépendance de preuve

Si A et B n'ont pas nécessairement les mêmes citations ou la même portée de citation, produire deux claims.

Exemple : une observation EMG et une hypertrophie IRM issues du même essai restent deux claims, même avec une citation commune.

### Test 3 — indépendance épistémique

Si A et B changent de `knowledgeType`, de `directness`, de niveau de confiance ou de statut, produire deux claims.

Exemple : résultat mesuré, mécanisme proposé et recommandation pratique sont séparés.

### Test 4 — conservation du périmètre

Ne pas couper un qualificatif indispensable. Une claim qui omet « chez des athlètes de lancer », « à court terme », « sans corrélation fiable » ou « si toléré » est rejetée pour généralisation.

## C.3 Règles de découpage

### Toujours séparer

- deux outcomes différents : force vs hypertrophie, douleur vs fonction, immédiat vs 24 h ;
- observation et interprétation causale ;
- EMG et hypertrophie ;
- biomécanique et risque clinique ;
- résultat et recommandation pratique ;
- résultat dominant et résultat opposé ;
- existence d'une preuve et limite de généralisation si la limite est elle-même une affirmation indépendante ;
- protocole observé et règle universelle explicitement rejetée ;
- recommandation d'un organisme et efficacité clinique de cette recommandation.

### Garder ensemble

- sujet, comparaison et outcome nécessaires au sens ;
- conditions d'égalisation (volume, effort), durée et population ;
- modalisateurs (`peut`, `tend à`, `n'est pas démontré`, `dans certaines populations`) ;
- négation et objet de la négation ;
- valeur numérique et son unité/contexte ;
- limitation méthodologique directement rattachée au même résultat, dans `limitations` plutôt qu'en pseudo-claim.

### Ne pas transformer en claim autonome

- une date, une taille d'échantillon ou une durée isolée ;
- « cette étude est récente » ;
- une liste de facteurs avec le seul verbe vague « comptent » sans relation qualifiable ;
- un titre ou une transition ;
- une recommandation de remplissage de base de données ;
- une formulation conversationnelle de produit ;
- une citation ou un identifiant bibliographique seul.

## C.4 Résultat scientifique et interprétation pratique

Une interprétation pratique devient une candidate séparée si elle :

- recommande, interdit, privilégie, dose ou substitue une action ;
- ajoute une condition non contenue dans la claim scientifique ;
- pourrait être rejetée sans rejeter le résultat scientifique ;
- change de `knowledgeType`, le plus souvent vers `EXPERT_PRACTICE`.

Elle peut rester dans `practicalInterpretation` de la claim scientifique uniquement si elle est explicitement formulée par le corpus, découle sans nouveau présupposé du même résultat, garde la même portée et ne constitue pas une règle clinique/normative autonome. En cas de doute, séparer et router vers revue.

## C.5 Règles de rattachement des citations

Le préprocesseur attribue à chaque lien Markdown du fragment un handle local stable (`cit.f2.013.01`, etc.) et des offsets. Le LLM ne voit que ces handles et ne peut pas écrire d'URL libre.

1. Une citation dans la même proposition est attachable à cette claim.
2. Une citation en fin de phrase peut soutenir les propositions coordonnées de cette phrase seulement si leur portée syntaxique est claire.
3. Une citation ne traverse pas une frontière de phrase par défaut.
4. Une anaphore explicite (`cette étude`, `ces données`, `la méta-analyse`) peut hériter de la citation de la phrase immédiatement précédente seulement s'il n'existe qu'un antécédent possible. Cette attribution est marquée `anaphoric` et revue.
5. Une citation de paragraphe placée après plusieurs résultats indépendants produit `UNRESOLVED` si le mapping source–résultat n'est pas explicite.
6. Une citation soutenant un protocole ne soutient pas automatiquement son universalité, son innocuité ou son efficacité.
7. Une citation issue d'une autre population reste attachée à la claim descriptive sur cette population ; l'extrapolation devient une autre claim `HYPOTHESIS` ou est rejetée.
8. Toutes les citations du paragraphe ne sont jamais copiées vers toutes les claims.
9. Les renvois internes (`section 2.5`) ne deviennent pas des Sources.
10. Si le support est ambigu, la claim peut subsister sans citation résolue avec diagnostic `ambiguous_citation_attribution`; E5 ne force pas de rattachement.

## C.6 Règles par type de connaissance

### `EVIDENCE`

- Réservé à un résultat ou une synthèse explicitement rapporté dans le fragment.
- L'outcome revendiqué doit être celui réellement mesuré ou synthétisé.
- « Une recommandation dit X » est une claim descriptive sur la recommandation ; ce n'est pas automatiquement la preuve que X est efficace.
- Un documentType n'est mappé que s'il est écrit (`méta-analyse`, `CPG`, `essai intra-sujet`, etc.).

### Biomécanique indirecte

- `knowledgeType: BIOMECHANICAL_OBSERVATION` pour moments, forces, bras de levier, compression, cisaillement ou modélisation.
- `directness: biomechanical_only` quand le fragment l'établit.
- `supportsDemonstratedClinicalRisk: false` toujours.
- Une conséquence clinique supposée est séparée en `HYPOTHESIS`, `mechanistic_only`, ou laissée `UNRESOLVED`.

### EMG

- `knowledgeType: EMG_OBSERVATION` ; `directness: emg_only` quand explicite.
- Résultat EMG séparé de tout résultat de force/hypertrophie.
- `supportsHypertrophySuperiority: false` toujours.
- Une amplitude EMG supérieure n'autorise ni `hypertrophyAdvantage`, ni `equivalence`, ni ciblage régional hypertrophique.

### Mécanistique

- `MECHANISM` décrit une voie ou explication proposée.
- `HYPOTHESIS` porte la prédiction non démontrée tirée de cette voie.
- `directness: mechanistic_hypothesis` ; jamais risque démontré.
- Si le fragment emploie « cohérent avec », cette relation ne devient pas « causé par ».

### `EXPERT_PRACTICE`

- Seulement si le fragment étiquette explicitement la pratique, rapporte une convergence d'experts, ou formule une heuristique sans essai correspondant.
- `epistemicStatus: practice_only` par défaut conservateur.
- `directness: expert_only` si aucune preuve directe n'est rattachée.
- Aucune confiance haute ; aucune norme médicale.

### Incertitude

- Les modalisateurs sont conservés verbatim.
- Les plages (`modéré à élevé`) ne sont jamais aplaties.
- Un résultat non significatif n'est pas une preuve d'équivalence.
- « Pas de preuve identifiée » devient `absence_of_evidence` seulement si la recherche/absence est explicitement énoncée.
- Absence de mention de preuve ≠ preuve d'absence.

### Contradiction

- Produire les claims opposées séparément.
- Conserver les citations et limites propres à chacune.
- Ajouter un diagnostic `potential_evidence_conflict`, pas une résolution.
- Ne jamais choisir la claim « gagnante » ni créer une moyenne narrative.

### Interprétation pratique

- Séparée quand elle prescrit un choix.
- `EXPERT_PRACTICE/practice_only` si elle va au-delà du résultat mesuré.
- En F3, toute action clinique candidate est obligatoirement revue et ne devient jamais directement `AdaptationRule`, `Contraindication` ou `ReferralRule` dans E5 v1.

## C.7 Cas `UNRESOLVED`

E5 produit un état `UNRESOLVED` et un diagnostic lorsque :

- la frontière du span exact est ambiguë ou le même texte apparaît plusieurs fois sans occurrence déterminable ;
- le sujet, l'outcome, la population ou la polarité de la claim ne sont pas identifiables sans connaissance externe ;
- deux `knowledgeType` restent plausibles ;
- le statut épistémique n'est pas énoncé ou ne peut être mappé sans hausse de certitude ;
- une confiance est globale sans aspect compatible, ou donnée sous forme de plage ;
- le type de document n'est pas écrit ;
- plusieurs valeurs de `directness` s'appliquent à une claim composite qui n'a pas encore été correctement découpée ;
- la citation terminale peut soutenir plusieurs claims sans mapping explicite ;
- une anaphore a plusieurs antécédents ;
- une causalité n'est que suggérée par `cohérent avec`, `pourrait`, `suggère` ;
- un seuil clinique est rapporté sans population/protocole suffisant ;
- une formulation de risque ne distingue pas dommage, inconfort, charge mécanique et risque mesuré ;
- un conseil clinique pourrait être une pratique prudente, une recommandation de guideline ou une politique produit.

Un `UNRESOLVED` n'est pas une invitation à relancer le modèle jusqu'à ce qu'il choisisse. Le retry corrige la forme, jamais l'incertitude sémantique.

## C.8 Cas à zéro claim

E5 renvoie `claims: []` avec un diagnostic explicite pour :

- titres, séparateurs et transitions sans affirmation ;
- blocs de tableau déjà couverts/exclus ;
- registre de sources, bibliographie ou lien seul ;
- exemple purement illustratif sans généralisation formulée ;
- instruction d'encodage de la KB ou commentaire de schéma ;
- formulation conversationnelle/politique produit hors périmètre E5 v1 ;
- phrase trop vague pour porter un prédicat qualifiable ;
- fragment corrompu, incomplet ou dont la provenance ne peut être relue ;
- contenu qui exigerait d'inventer un sujet, un outcome ou une relation ;
- phrase indiquant seulement que les recommandations suivantes sont `expert_practice`, sans contenir elle-même une pratique spécifique.

Une répétition réelle d'une claim déjà vue n'est pas un zéro claim : elle reste un candidat séparé avec `possible_duplicate`, puisque la fusion automatique est interdite.

## C.9 Règles anti-hallucination

1. Monde fermé et absence explicite d'accès réseau/outils dans l'appel modèle.
2. Sortie structurée stricte ; aucun texte libre hors JSON.
3. Chaque claim référence un span exact du fragment cible.
4. Les offsets sont recalculés par code UTF-8, jamais acceptés du modèle.
5. Les nombres, unités, comparateurs, négations, durées et populations sont comparés au span.
6. Les citations sont choisies dans un catalogue fermé d'occurrences.
7. Les enums sont validés contre les vocabulaires réels du repo.
8. `canonicalStatement` est rejeté s'il ajoute un nombre, une entité nommée ou un modal absent.
9. Les mots à risque (`cause`, `prouve`, `sûr`, `dangereux`, `interdit`, `toujours`, `jamais`, `diagnostic`) déclenchent un contrôle de présence verbatim et une revue clinique.
10. Aucun enrichissement depuis le journal, le domaine URL, le DOI, les connaissances du modèle ou un autre fragment.
11. Aucun retry ne demande « complète ce qui manque ».
12. Toute sortie valide reste `pending_human_review` en E5 v1.

## C.10 Provenance exacte

Le LLM renvoie le texte exact du span et, si nécessaire, son numéro d'occurrence dans le fragment. Le postprocesseur :

1. relit les octets du fichier autoritaire au hash déclaré ;
2. vérifie que `fragment.rawText` correspond à `fragment.startByte:endByte` ;
3. localise le span exact dans les octets UTF-8 du fragment ;
4. calcule les offsets absolus fichier ;
5. relit ces offsets et exige l'égalité octet pour octet ;
6. remplit `verbatimSpan` ;
7. impose `payload.rawStatement === verbatimSpan.text` ;
8. conserve le `textHash` du fragment et le `corpusFileContentHash` dans le manifest du run.

Si le span est introuvable, normalisé, accentué différemment ou ambigu, le candidat est rejeté. Le code ne « corrige » jamais silencieusement la citation du modèle.

## C.11 Compatibilité avec les six axes

| Axe | Porteur | Règle E5 |
|---|---|---|
| `knowledgeType` | claim + assessment | même valeur dans les deux brouillons ; conflit = `UNRESOLVED` |
| `epistemicStatus` | claim | mapping conservateur depuis le texte, jamais depuis le type de source seul |
| `confidenceByAspect[]` | assessment | seulement aspect + niveau explicitement mappables ; plages conservées en raw/unresolved |
| `directness` | assessment | outcome et méthode explicites ; jamais déduite d'une URL |
| `evidenceTypes[]` | assessment | seulement types de documents écrits dans le fragment |
| `hierarchyHint` | assessment | déterministe par corpus : `biomechanics` pour F2, `clinical` pour F3 |

Chaque brouillon porte en plus un sidecar d'extraction par axe :

```json
{
  "axisResolution": {
    "knowledgeType": { "state": "RESOLVED", "value": "EVIDENCE", "rationaleSpan": "..." },
    "epistemicStatus": { "state": "UNRESOLVED", "reason": "status_not_explicit" },
    "confidenceByAspect": { "state": "UNRESOLVED", "raw": "modéré à élevé", "reason": "range_not_scalar" },
    "directness": { "state": "RESOLVED", "value": "direct_hypertrophy_measured" },
    "evidenceTypes": { "state": "RESOLVED", "value": ["meta_analysis"] },
    "hierarchyHint": { "state": "RESOLVED", "value": "biomechanics", "resolvedBy": "deterministic_rule" }
  }
}
```

Ce sidecar vit uniquement dans le candidat. Il n'est pas projeté tel quel dans une entité curated.

---

# D. Exemples annotés

Notation : les tables montrent une `canonicalStatement` proposée pour la lisibilité. Dans l'artefact réel, chaque ligne doit aussi conserver le `rawStatement` exact correspondant au span source. `UNRESOLVED` désigne l'état du sidecar, pas une valeur injectée dans un vocabulaire fermé.

## D.1 F2 — exemple 1 : EMG et hypertrophie, `frag.f2.0001`, ligne 13

> **Règle non négociable : une différence d'amplitude EMG entre deux exercices n'est jamais traitée comme une preuve suffisante qu'un exercice produit plus d'hypertrophie qu'un autre.** L'EMG de surface mesure une activité électrique moyennée et globale, pas la tension mécanique par fibre, ni le recrutement des unités motrices profondes, ni la durée sous tension à une longueur donnée. L'étude la plus directement illustrative de ce principe compare hip thrust et squat : l'EMG du hip thrust dépasse largement celle du squat pour le grand fessier (moyenne 69,5 % contre 29,4 % de la contraction volontaire maximale, pics 172 % contre 84,9 %), mais neuf semaines d'entraînement à volume égalisé produisent une hypertrophie fessière quasiment identique en IRM dans les trois régions du grand fessier, sans corrélation fiable entre l'amplitude EMG et la croissance mesurée ([Plotkin et al., 2023, *Front Physiol*](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full)). Cette dissociation EMG/hypertrophie est traitée comme un résultat de référence dans tout ce rapport.

Claims proposées :

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F2-1A | Une différence d'amplitude EMG ne suffit pas à conclure à une hypertrophie supérieure. | `MYTH_REFUTATION` | `refuted` | Aucun type de document inféré ; Plotkin est un exemple direct mais le support de la règle générale reste à revoir. |
| F2-1B | Dans la comparaison rapportée, l'EMG fessière du hip thrust dépasse celle du squat avec les valeurs données. | `EMG_OBSERVATION` | `UNRESOLVED` | `directness: emg_only`; citation Plotkin attachée ; `supportsHypertrophySuperiority: false`. |
| F2-1C | Après neuf semaines à volume égalisé, l'hypertrophie IRM des trois régions fessières est quasiment identique entre hip thrust et squat. | `EVIDENCE` | `UNRESOLVED` | `directness: direct_hypertrophy_measured`; citation Plotkin ; ne pas convertir « quasiment identique » en équivalence universelle. |
| F2-1D | Dans cette étude, aucune corrélation fiable n'est observée entre amplitude EMG et croissance mesurée. | `EVIDENCE` | `UNRESOLVED` | Citation Plotkin ; `directness` composite EMG + IRM, donc `UNRESOLVED` plutôt que fusion. |

Claim non autonome : la liste de ce que l'EMG ne mesure pas reste une limitation méthodologique attachée à F2-1A, car le fragment ne donne pas une citation distincte et le vocabulaire ne fournit pas un `knowledgeType` incontestable.

Claims rejetées :

- « Le hip thrust et le squat sont équivalents pour tout pratiquant et toute durée. »
- « Une EMG élevée est inutile. »
- « Plotkin prouve que l'EMG ne prédit jamais l'hypertrophie. »

Axes restant `UNRESOLVED` : statut exact de F2-1B/C/D, type de document (non écrit), confiance par aspect, directness unique de F2-1D. Découpage justifié par trois outcomes différents : EMG, hypertrophie IRM, corrélation.

## D.2 F2 — exemple 2 : anatomie, résultat direct et pratique, `frag.f2.0003`, ligne 76

> Ce point anatomique a une conséquence directement démontrée par un essai contrôlé : l'entraînement en extension du coude réalisé en **position bras au-dessus de la tête (overhead)**, qui étire le chef long au niveau de l'épaule pendant l'exercice, produit une hypertrophie substantiellement plus importante du chef long que le même exercice réalisé bras le long du corps (position neutre), à volume et effort égalisés sur plusieurs semaines ([Nunes et al., 2022, *Eur J Sport Sci*](https://onlinelibrary.wiley.com/doi/10.1080/17461391.2022.2100279)). **Il s'agit ici d'une preuve directe d'hypertrophie régionale (niveau modéré à élevé, essai contrôlé unique mais mécanisme biomécanique cohérent et fort)** — l'un des exemples les plus solides de tout ce rapport reliant position articulaire, longueur musculaire et hypertrophie régionale mesurée. Conséquence pratique : les extensions au-dessus de la tête (overhead extension, skull crusher incliné bras verticaux) ciblent préférentiellement le chef long, tandis que les pushdowns et extensions bras le long du corps sollicitent davantage les chefs latéral et médial sans étirement supplémentaire du chef long.

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F2-2A | La position overhead allonge le chef long du triceps au niveau de l'épaule pendant l'extension du coude. | `BIOMECHANICAL_OBSERVATION` | `UNRESOLVED` | Citation Nunes : attribution au mécanisme `UNRESOLVED`, car elle termine la phrase de résultat. |
| F2-2B | À volume et effort égalisés, l'extension overhead produit davantage d'hypertrophie du chef long que la position neutre sur plusieurs semaines. | `EVIDENCE` | `probable` | Citation Nunes ; `directness: direct_hypertrophy_measured`; type `randomized_trial` interdit faute de mot « randomisé » ; « essai contrôlé » reste raw/unresolved. |
| F2-2C | Les extensions overhead peuvent être privilégiées quand le chef long est l'objectif régional. | `EXPERT_PRACTICE` | `practice_only` | Interprétation pratique séparée ; citation Nunes contextuelle, rattachement direct à revoir. |
| F2-2D | Les pushdowns/bras le long du corps sollicitent davantage les chefs latéral et médial sans étirement supplémentaire du chef long. | `UNRESOLVED` | `UNRESOLVED` | « sollicitent » ne précise ni EMG, ni tension, ni hypertrophie ; aucune citation distincte. |

Claims rejetées :

- « Tout exercice overhead est supérieur pour tout le triceps. »
- « Les pushdowns n'hypertrophient pas le chef long. »
- « Le mécanisme biomécanique prouve à lui seul le résultat hypertrophique. »

Axes restant `UNRESOLVED` : confiance `modéré à élevé` non aplatie ; type de document exact ; type/statut de F2-2D ; citation de F2-2A/C. Découpage justifié par le passage mécanisme → résultat régional → conseil pratique.

## D.3 F2 — exemple 3 : force spécifique, hypertrophie et non-équivalence, `frag.f2.0004`, ligne 138

> Une méta-analyse de référence comparant systématiquement l'entraînement en poids libres et sur machines trouve que **chaque modalité produit un gain de force supérieur dans son propre mode de test** (SMD −0,210 en faveur des poids libres pour les tests en poids libres ; tendance en faveur des machines pour les tests sur machines, p = 0,064), un résultat cohérent avec le principe de spécificité, **mais aucune différence significative d'hypertrophie entre les deux modalités** (SMD −0,055, IC95 % −0,397 à 0,287, p = 0,751), sur des interventions de 9 semaines en moyenne ([Heidel et al. / free-weight vs machine meta-analysis, *BMC Sports Sci Med Rehabil*](https://pmc.ncbi.nlm.nih.gov/articles/PMC10426227/)). **Ceci est une preuve directe d'hypertrophie de niveau modéré à élevé** (méta-analyse, mais nombre limité d'études d'hypertrophie disponibles, ce que les auteurs signalent eux-mêmes comme une limite appelant à la prudence). Conclusion pratique : le choix entre poids libres et machines pour l'hypertrophie devrait reposer sur la stabilité, le confort, la disponibilité et la préférence individuelle plutôt que sur une supposée supériorité universelle d'une modalité.

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F2-3A | Chaque modalité produit davantage de gain de force dans son propre mode de test, avec les statistiques rapportées. | `EVIDENCE` | `probable` | Citation Heidel ; `evidenceTypes: [meta_analysis]`; `directness: UNRESOLVED` pour la force. |
| F2-3B | La méta-analyse ne trouve pas de différence significative d'hypertrophie entre poids libres et machines sur les interventions étudiées. | `EVIDENCE` | `uncertain` | Même citation ; `directness: direct_hypertrophy_measured`; confiance globale `modéré à élevé` reste non mappée par aspect ; limite = peu d'études. |
| F2-3C | Pour l'hypertrophie, le choix pratique peut reposer sur stabilité, confort, disponibilité et préférence plutôt que sur une supériorité universelle. | `EXPERT_PRACTICE` | `practice_only` | Citation contextuelle ; conseil séparé du résultat. |

Claims rejetées :

- « Poids libres et machines sont équivalents pour l'hypertrophie. » Un résultat non significatif n'est pas un test d'équivalence.
- « Les machines sont meilleures pour la force. » La tendance p = 0,064 ne le permet pas.
- « Neuf semaines suffisent pour conclure universellement. »

Axes restant `UNRESOLVED` : directness force ; confiance par aspect ; statut exact du conseil. Le `mais` relie deux outcomes, pas deux résultats à fusionner.

## D.4 F2 — exemple 4 : lacune et extrapolation biomécanique, `frag.f2.0008`, ligne 216

> Peu d'études biomécaniques dédiées quantifient directement la charge au coude pendant les exercices de triceps (skull crusher, extension overhead) en musculation récréative ; la littérature disponible sur la charge au coude provient principalement du contexte du lancer au baseball, peu généralisable ([Biomechanics of the elbow during baseball pitching](http://www.jospt.org/doi/10.2519/jospt.1993.17.6.274)). Il s'agit d'une **lacune de preuve identifiée** : l'affirmation courante selon laquelle le skull crusher ou l'extension overhead imposerait une contrainte particulière au coude repose largement sur un raisonnement biomécanique de premier principe (moment de flexion élevé en bras de levier long) plutôt que sur une mesure directe publiée en contexte de musculation — **niveau de preuve très faible, largement inférentiel**.

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F2-4A | Peu de mesures directes dédiées quantifient la charge au coude des exercices de triceps en musculation récréative. | `EVIDENCE` | `absence_of_evidence` | Pas de citation attachée automatiquement : la citation baseball porte sur ce qui existe à la place. |
| F2-4B | La littérature disponible citée sur la charge au coude provient surtout du lancer au baseball et est peu généralisable à la musculation récréative. | `EVIDENCE` | `uncertain` | Citation baseball attachée ; population étrangère conservée ; `generalization` faible/UNRESOLVED selon l'aspect explicite. |
| F2-4C | L'idée d'une contrainte particulière des skull crushers/extensions overhead repose largement sur un moment de flexion inféré, pas sur une mesure directe en musculation. | `HYPOTHESIS` | `mechanistic_only` | `directness: mechanistic_hypothesis`; confiance `very_low`; aucune citation directe ajoutée. |

Claims rejetées :

- « Le skull crusher est dangereux pour le coude. »
- « Le skull crusher impose une charge élevée mesurée au coude. »
- « Les données de baseball s'appliquent aux pratiquants de musculation. »

Axes restant `UNRESOLVED` : type exact du document baseball, aspect de confiance de F2-4B, quantification de la contrainte. Le découpage sépare l'absence, la preuve indirecte existante et l'hypothèse.

## D.5 F2 — exemple 5 : enquête qualitative et `expert_practice`, ligne 353

> Une étude qualitative interrogeant des coachs de bodybuilding sur leurs pratiques et les comparant aux recommandations de la littérature *evidence-based* documente une correspondance globalement bonne mais imparfaite entre pratique de terrain et preuve publiée, avec des domaines où l'expérience pratique dépasse ou diverge de la littérature disponible ([Bodybuilding Coaching Strategies Meet Evidence-Based Recommendations, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10299204/)) — **preuve qualitative/enquête, niveau très faible pour toute affirmation causale, utile uniquement pour cartographier le consensus de pratique**. Sur cette base et sur les principes biomécaniques établis dans ce rapport, les recommandations pratiques suivantes sont explicitement classées comme **expert_practice**, c'est-à-dire non validées par un essai contrôlé dédié :

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F2-5A | L'enquête qualitative rapporte une correspondance globalement bonne mais imparfaite entre pratiques de coachs et recommandations publiées. | `EVIDENCE` | `uncertain` | Citation de l'étude ; `directness: qualitative_survey`; `evidenceTypes: [qualitative_study]`; confiance causale `very_low`, descriptive `UNRESOLVED`. |
| F2-5B | Certains domaines de pratique dépassent ou divergent de la littérature disponible. | `EVIDENCE` | `uncertain` | Même citation ; portée descriptive seulement. |

Zéro claim pour la deuxième phrase prise isolément : elle classe les recommandations qui suivent, mais ne contient aucune pratique spécifique. Elle devient contexte de classification pour les items suivants.

Claims rejetées :

- « Les pratiques des coachs causent de meilleurs résultats. »
- « Le consensus des coachs est une preuve de haut niveau. »
- « Les recommandations suivantes sont validées. »

Axes restant `UNRESOLVED` : confiance descriptive, statut exact de généralisation et citation propre de chaque recommandation suivante. Découpage justifié par la séparation description qualitative / causalité interdite / contexte `expert_practice`.

## D.6 F3 — exemple 1 : douleur, dommage et nuance, `frag.f3.0001`, ligne 11

> 3. **« Douleur pendant l’exercice » n’équivaut pas automatiquement à « dommage ».** Des exercices tolérablement douloureux peuvent produire des résultats comparables, voire un petit avantage antalgique à court terme dans certaines douleurs chroniques, sans supériorité durable démontrée; ce n’est ni une obligation d’avoir mal ni une permission d’ignorer une aggravation ([Smith et al., 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5739826/)).

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F3-1A | Une douleur pendant l'exercice n'équivaut pas automatiquement à un dommage. | `MYTH_REFUTATION` | `refuted` | Citation Smith attachable au bloc, mais portée générale à revoir ; aucune promesse d'innocuité. |
| F3-1B | Dans certaines douleurs chroniques, des exercices tolérablement douloureux peuvent produire des résultats comparables. | `EVIDENCE` | `probable` | Citation Smith ; `directness: direct_clinical`; type de document `UNRESOLVED` car non écrit dans ce fragment. |
| F3-1C | Un petit avantage antalgique peut apparaître à court terme, sans supériorité durable démontrée. | `EVIDENCE` | `uncertain` | Citation Smith ; temporalité et absence durable conservées. |
| F3-1D | Ce résultat n'impose pas d'avoir mal et ne justifie pas d'ignorer une aggravation. | `EXPERT_PRACTICE` | `practice_only` | Garde-fou pratique séparé ; citation contextuelle. |

Claims rejetées :

- « La douleur pendant l'exercice est sans danger. »
- « Il faut s'entraîner dans la douleur. »
- « Une aggravation peut être ignorée. »

Axes restant `UNRESOLVED` : type de document, confiance par aspect, portée de citation de F3-1A/D. Découpage justifié par mythe, outcome comparatif, effet antalgique temporel et garde-fou.

## D.7 F3 — exemple 2 : seuil de protocole ≠ règle universelle, `frag.f3.0002`, ligne 12

> 4. **Les seuils numériques ne sont pas universels.** Le modèle de surveillance utilisé dans certains essais tendineux autorise jusqu’à 5/10 pendant ou juste après, avec retour au niveau de base le lendemain; il s’agit d’un protocole de recherche, non d’une règle pour toute douleur ou toute pathologie ([Sprague et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7905015/)).

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F3-2A | Le protocole décrit autorise jusqu'à 5/10 pendant ou juste après, avec retour au niveau de base le lendemain. | `DEFINITION` | `established` | Citation Sprague ; description d'un protocole, pas seuil d'innocuité ; `numeric_threshold` + `clinical_content`. |
| F3-2B | Ce seuil est un protocole de recherche et non une règle applicable à toute douleur ou pathologie. | `MYTH_REFUTATION` | `refuted` | Citation Sprague attachée à la définition du protocole ; la non-universalité reste explicitement dans le span. |

Claims rejetées :

- « 5/10 est sûr. »
- « 5/10 convient à toute tendinopathie. »
- « Le retour au niveau de base le lendemain exclut une lésion. »

Axes restant `UNRESOLVED` : type exact d'essai, population tendineuse précise, directness et confiance. Le seuil, sa fenêtre temporelle et son contexte restent inséparables.

## D.8 F3 — exemple 3 : red flag non diagnostique, `frag.f3.0007`, ligne 53

> **Règle d’implémentation :** un red flag n’est pas un diagnostic. L’IA doit dire « ce symptôme nécessite une évaluation » et non « vous avez X ». Les signaux isolés ont souvent une faible précision; la combinaison, le contexte et l’évolution déterminent le niveau de suspicion ([IFOMPT, 2020](https://www.jospt.org/doi/10.2519/jospt.2020.9971)).

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F3-3A | Un red flag est un signal d'évaluation, pas un diagnostic. | `DEFINITION` | `established` | Pas d'inférence de pathologie ; `red_flag_content` + `clinical_content`. |
| F3-3B | Les signaux isolés ont souvent une faible précision. | `EVIDENCE` | `probable` | Citation IFOMPT ; type de document non inféré depuis l'URL. |
| F3-3C | Combinaison, contexte et évolution modulent le niveau de suspicion. | `EVIDENCE` | `probable` | Même citation, même phrase ; directness et confiance par aspect `UNRESOLVED`. |

Zéro claim scientifique pour « L'IA doit dire… » : cette phrase est routée comme `output_policy_content`, pas transformée en vérité clinique.

Claims rejetées :

- « Un red flag diagnostique X. »
- « Un signe isolé suffit toujours à déclencher un diagnostic. »
- « Une faible précision permet d'ignorer le signal. »

Axes restant `UNRESOLVED` : evidenceType, directness, confiance. Découpage justifié par définition clinique, performance diagnostique générale et règle de formulation produit.

## D.9 F3 — exemple 4 : recommandation Achille et modalités, ligne 90

> Le principe commun est la **gestion de la charge suivie d’une exposition progressive**, et non le repos complet. Pour le tendon d’Achille de portion moyenne, l’APTA recommande une charge tendineuse aussi élevée que tolérée au moins trois fois par semaine et déconseille le repos complet ([CPG Achille 2024](https://www.jospt.org/doi/10.2519/jospt.2024.0302)). Aucun mode unique — excentrique, heavy slow resistance (HSR), concentrique ou isométrique — n’est universellement supérieur; les isométriques n’offrent pas une analgésie immédiate fiable chez tous ([Maetz et al., 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10240875/), [Clifford et al., 2020](https://bmjopensem.bmj.com/content/6/1/e000760)).

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F3-4A | Pour la tendinopathie d'Achille de portion moyenne, l'APTA recommande une charge aussi élevée que tolérée au moins trois fois par semaine et déconseille le repos complet. | `EVIDENCE` | `established_direction` | Citation CPG Achille ; `evidenceTypes: [clinical_practice_guideline]` car « CPG » est explicite dans le label ; `directness: direct_clinical`. |
| F3-4B | Aucun mode excentrique, HSR, concentrique ou isométrique n'est universellement supérieur. | `EVIDENCE` | `uncertain` | Les deux citations terminales sont un groupe ; attribution individuelle `UNRESOLVED`. |
| F3-4C | Les isométriques n'offrent pas une analgésie immédiate fiable chez tous. | `EVIDENCE` | `probable` | Même groupe de citations ; `acute_effect` possible, confiance non énoncée. |
| F3-4D | La gestion de charge suivie d'exposition progressive est préférée au repos complet. | `EXPERT_PRACTICE` | `practice_only` | Synthèse introductive sans citation syntaxiquement propre ; ne pas lui faire hériter automatiquement des trois liens. |

Claims rejetées :

- « Trois séances par semaine est un seuil universel pour tous les tendons. »
- « Les isométriques ne soulagent jamais. »
- « Le repos est toujours nocif. »

Axes restant `UNRESOLVED` : attribution Maetz/Clifford par claim, confiance par aspect, evidenceTypes des deux études. Découpage justifié par guideline spécifique, comparaison de modalités, effet aigu et synthèse pratique.

## D.10 F3 — exemple 5 : biomécanique lombaire et absence de causalité, ligne 109

> La compression, le cisaillement ou le moment externe décrivent une demande mécanique, mais ne donnent pas à eux seuls un seuil clinique de dommage. La charge absolue, la fatigue, la vitesse, la capacité, l’historique, le sommeil et le contexte comptent. Une revue ne trouve pas de preuve in vivo crédible que davantage de flexion lombaire pendant le soulèvement soit un facteur de risque de lombalgie; les charges étudiées étaient toutefois souvent légères et les données surtout transversales ([Saraceni et al., 2020](https://www.jospt.org/doi/10.2519/jospt.2020.9218)).

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F3-5A | Compression, cisaillement et moment externe décrivent une demande mécanique, pas à eux seuls un seuil clinique de dommage. | `MYTH_REFUTATION` | `refuted` | `biomechanical_risk_language`; aucune citation ajoutée par bleed depuis la troisième phrase. |
| F3-5B | La revue citée n'identifie pas de preuve in vivo crédible qu'une flexion lombaire plus importante au soulèvement soit un facteur de risque de lombalgie. | `EVIDENCE` | `absence_of_evidence` | Citation Saraceni ; `supportsDemonstratedClinicalRisk: false`; limites : charges légères, données transversales. |

La phrase « les facteurs comptent » n'est pas extraite comme claim autonome : elle ne donne ni direction, ni relation falsifiable, ni citation propre.

Claims rejetées :

- « La flexion lombaire ne présente aucun risque. »
- « La compression est sans danger à toute dose. »
- « Les données transversales démontrent l'absence de causalité. »

Axes restant `UNRESOLVED` : evidenceType exact de la revue, directness, confiance par aspect. Le découpage conserve la limite mécanique et l'absence de preuve sans transformer cette dernière en preuve d'absence.

## D.11 F3 — exemple 6 : confort, orthèse et consensus, ligne 152

> L’IA ne doit pas convertir « prise neutre souvent confortable » en règle anatomique. Une orthèse de contre-force peut être adjointe dans certaines épicondylalgies, mais ne remplace pas la progression de charge; un consensus de physiothérapeutes a retenu éducation, pacing, exercice progressif et orthèse, avec douleur définie par l’acceptabilité du patient plutôt que par un chiffre universel ([Bateman et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8712984/)).

| ID | Claim candidate | `knowledgeType` | `epistemicStatus` | Évaluation/citation |
|---|---|---|---|---|
| F3-6A | Une orthèse de contre-force peut être ajoutée dans certaines épicondylalgies mais ne remplace pas la progression de charge. | `EXPERT_PRACTICE` | `practice_only` | Citation Bateman ; `directness: expert_only`; `evidenceTypes: [consensus_statement]` car le consensus est explicite. |
| F3-6B | Le consensus cité retient éducation, pacing, exercice progressif et orthèse. | `EXPERT_PRACTICE` | `practice_only` | Même citation ; liste conservée sans en faire une hiérarchie d'efficacité. |
| F3-6C | Dans ce consensus, l'acceptabilité de la douleur par le patient est préférée à un chiffre universel. | `EXPERT_PRACTICE` | `practice_only` | Même citation ; aucun seuil inventé. |

Zéro claim scientifique pour l'instruction « L'IA ne doit pas convertir… » ; elle devient diagnostic `output_policy_content`. Le contenu sous-jacent « prise neutre souvent confortable » ne devient pas une règle anatomique.

Claims rejetées :

- « La prise neutre est anatomiquement supérieure. »
- « L'orthèse traite seule l'épicondylalgie. »
- « Tout niveau de douleur accepté par le patient est sûr. »

Axes restant `UNRESOLVED` : niveau de confiance, directness clinique éventuelle au-delà du consensus, portée exacte à d'autres épicondylalgies. Découpage justifié par option, contenu de consensus et règle de seuil.

---

# E. Failure modes

| Failure mode | Exemple de dérive | Contrôle proposé |
|---|---|---|
| Fusion excessive | Anatomie + EMG + hypertrophie + conseil en une claim | Tests d'indépendance de vérité/preuve/épistémique |
| Fragmentation excessive | Durée, population et limite deviennent des pseudo-claims | Test de périmètre ; rattachement comme conditions/limitations |
| Citation bleed | Toutes les citations du paragraphe sur toutes les claims | Catalogue fermé + portée phrastique + diagnostic ambigu |
| Inference bleed | URL PubMed → essai randomisé, mémoire modèle → auteur/année | Monde fermé ; enums documentType seulement depuis texte |
| Hausse artificielle de preuve | `modéré à élevé` → `high`; « cohérent » → « démontré » | Plages unresolved ; contrôle lexical des modaux |
| Pratique transformée en evidence | Conseil de coach classé `EVIDENCE` | Séparation résultat/pratique ; `EXPERT_PRACTICE/practice_only` |
| EMG transformée en hypertrophie | Activation supérieure → croissance supérieure | INV-005 en prévalidation ; outcomes séparés |
| Biomécanique transformée en risque | Compression élevée → exercice dangereux | INV-006 ; `supportsDemonstratedClinicalRisk: false` |
| Généralisation de population | Baseball → musculation ; tendon patellaire → toute douleur | Population/condition obligatoires ; warnings de généralisation |
| Clinique transformée en interdiction | Sensibilité fréquente → bannissement de mouvement | Aucun `Contraindication` E5 ; fondement obligatoire en aval |
| Invention de causalité | Association/corrélation → cause | Verbes causaux contrôlés ; canonical rejetée si modal durci |
| Non-significatif → équivalent | Pas de différence → mêmes effets | Détection `no_difference_not_equivalence` |
| Protocole → seuil médical | 5/10 dans un essai → seuil universel sûr | `numeric_threshold`, scope obligatoire, revue clinique |
| Red flag → diagnostic | Signal → « vous avez X » | `red_flag_content`; aucun diagnostic ; schema aval `isDiagnostic:false` |
| Absence de preuve → preuve d'absence | Rien trouvé → effet inexistant | Statut `absence_of_evidence`, formulation conservée |
| Anaphore mal résolue | « cette étude » liée au mauvais lien | Un seul antécédent admissible, sinon unresolved |
| Perte de négation | « ne permet pas » devient « permet » | Vérification des marqueurs de négation raw/canonical |
| Perte de temporalité | court terme → effet général | Termes temporels obligatoirement conservés |
| Perte des limites | claim garde le résultat mais perd « petit échantillon » | limitations extraites du même span/groupe et testées au benchmark |
| Doublon fusionné | paraphrases F2/F3 écrasées | `possible_duplicate`, jamais suppression inter-fragments |
| Retry coercitif | relancer jusqu'à obtenir un enum non ambigu | retries limités aux erreurs formelles, jamais sémantiques |
| Confiance d'extraction confondue | 0,98 modèle → preuve élevée | champs et libellés séparés ; aucun mapping entre les deux |

---

# F. Proposition d'architecture E5

## F.1 Seam et interface du module

Interface externe recommandée :

```ts
extractProseFragment(input: E5FragmentInput): Promise<E5FragmentResult>
```

Le caller connaît seulement le fragment, la version du corpus et la configuration du run. Le module cache derrière ce seam : éligibilité, scan des liens, construction du prompt, appel modèle, parsing, calcul des offsets, validation, diagnostics, IDs et tri stable. Cette profondeur concentre les règles sensibles et permet de tester E5 par la même interface que la production.

Deux adapters réels justifient un seam interne pour le modèle :

- adapter de production vers le modèle fixé ;
- adapter de replay qui relit `rawResponse` sans appel externe.

Le replay adapter est essentiel pour l'audit, les tests et la rematérialisation bit-identique.

## F.2 Input

```json
{
  "fragment": {
      "fragmentId": "frag.f2.0025",
    "corpusFileId": "corpus.f2.anatomie-biomecanique",
    "headingPath": ["..."],
    "startLine": 76,
    "endLine": 76,
    "startByte": 15948,
    "endByte": 17150,
    "blockType": "paragraph",
    "rawText": "...",
    "textHash": "sha256:...",
    "corpusFileContentHash": "sha256:..."
  },
  "contextOnly": {
    "previousBlock": null,
    "nextBlock": null
  },
  "citationCatalog": [
    {
      "handle": "cit.f2.0025.01",
      "rawLabel": "Nunes et al., 2022, Eur J Sport Sci",
      "rawUrl": "https://...",
      "markdown": "[Nunes ...](https://...)",
      "startByte": 0,
      "endByte": 0
    }
  ],
  "runConfig": {
    "extractorVersion": "e5-v1",
    "promptHash": "sha256:...",
    "outputSchemaHash": "sha256:...",
    "modelId": "fixed-model-snapshot",
    "temperature": 0,
    "seed": 0
  }
}
```

Le planificateur en amont :

- relit F2/F3 depuis l'archive et vérifie les hashes ;
- détecte les blocs Markdown ;
- exclut tables, titres, code, registre de sources et blocs déjà couverts par E1–E4 ;
- attribue des fragment IDs techniques déterministes ;
- calcule les offsets octets par relecture ;
- garde un ordre stable fichier/offset.

## F.3 Output

```json
{
  "fragmentRef": "frag.f2.0025",
  "status": "extracted",
  "citationOccurrenceCandidates": [],
  "claimCandidates": [],
  "assessmentCandidates": [],
  "citationAttributions": [],
  "diagnostics": [],
  "rawModelResponseRef": "run.e5...#response-000123"
}
```

### Claim candidate

Enveloppe `ExtractionCandidate` existante, avec :

- `targetKind: claim` ;
- `extraction.method: llm_prose_extraction` ;
- l'objet `extraction` conserve bien `modelId`, `promptHash`, `temperature` et la `rawResponse` intégrale comme l'exige le schéma existant ; le `rawModelResponseRef` du document de run est un index additionnel, pas un remplacement ;
- `payload.rawStatement` exact ;
- `payload.canonicalStatement` facultatif ;
- `payload.domain` ;
- six axes/résolutions compatibles ;
- `cannotConclude`, `limitations`, `conditions`, `practicalInterpretation` uniquement s'ils sont explicitement présents ;
- `reviewState: pending_human_review`.

### Assessment candidate

- `targetKind: evidence-assessment` ;
- `claimCandidateId`, pas d'ID métier ;
- `assessedBy: llm_candidate` ;
- `hierarchyHint`, pas `hierarchyRef` inventé ;
- axes résolus + raw + diagnostics ;
- `supportsHypertrophySuperiority` et `supportsDemonstratedClinicalRisk` forcés par validation.

### Citation occurrence candidate

- produite déterministement avant le LLM ;
- `targetKind: citation-occurrence` ;
- `extraction.method: deterministic_link_scan` ;
- label, URL, markdown et offsets exacts ;
- `resolvesToSourceRef: null` ;
- aucun auteur/année/type ajouté.

### Attribution candidate

L'attribution n'est pas une nouvelle entité métier et reste dans le document de run :

```json
{
  "claimCandidateId": "cand.e5-claim.0123456789abcdef",
  "citationOccurrenceCandidateId": "cand.e5-citation.0123456789abcdef",
  "state": "ATTACHED",
  "scope": "same_clause",
  "rationaleSpan": "..."
}
```

États : `ATTACHED`, `UNRESOLVED`, `REJECTED`. Cette structure n'est jamais projetée directement vers `sourceRefs`; la résolution Source et la revue restent en aval.

## F.4 Prompt système proposé

```text
Tu es l'extracteur E5 de la Knowledge Base FitTrack.

Tâche unique : identifier les affirmations distinctes réellement présentes dans le FRAGMENT CIBLE.
Tu n'es pas auteur, conseiller, curateur, diagnosticien ni moteur de recherche.

MONDE FERMÉ
- Utilise uniquement le fragment cible et son headingPath.
- Le contexte adjacent sert seulement à résoudre une anaphore ; il ne peut fournir ni claim ni citation.
- N'utilise aucune connaissance mémorisée.
- N'infère rien depuis une URL, un journal, un DOI ou un nom d'auteur.

GRANULARITÉ
- Une claim = un prédicat évaluable sur un sujet/outcome, avec population, conditions, temporalité et modalité nécessaires.
- Sépare deux propositions si l'une peut être vraie et l'autre fausse, si leurs citations diffèrent,
  si leur knowledgeType diffère ou si leur confiance peut être évaluée séparément.
- Ne sépare pas les qualificatifs indispensables.
- Sépare résultat scientifique, mécanisme, EMG, biomécanique et conséquence pratique.

SÉCURITÉ ÉPISTÉMIQUE
- EMG n'est jamais hypertrophie.
- Biomécanique n'est jamais risque clinique démontré.
- Association n'est pas causalité.
- Résultat non significatif n'est pas équivalence.
- Protocole de recherche n'est pas seuil universel.
- Red flag n'est pas diagnostic.
- Sensibilité ou adaptation prudente n'est pas contre-indication.
- EXPERT_PRACTICE et HYPOTHESIS ne sont jamais des faits établis.

PROVENANCE
- Pour chaque claim, recopie un verbatimSpan exact et contigu du fragment.
- Ne corrige ni ponctuation, ni accents, ni espaces dans ce span.
- Référence seulement des handles du CITATION CATALOG.
- Si l'attribution est ambiguë, marque UNRESOLVED ; ne rattache pas toutes les citations.

AXES
- Utilise uniquement les valeurs fermées fournies.
- Si un axe n'est pas justifié, marque son axisResolution UNRESOLVED avec une raison.
- Ne place jamais le mot UNRESOLVED dans un champ de vocabulaire fermé.

ZÉRO CLAIM
- Une sortie vide est correcte pour titre, transition, politique produit, instruction d'encodage,
  bibliographie, exemple non généralisé ou fragment qui exige une invention.
- Explique le zéro claim dans diagnostics.

SORTIE
- JSON conforme au schéma fourni, sans prose hors JSON.
- Ne crée aucun ID métier, Source, DOI, PMID, auteur, année, fusion ou décision de revue.
```

Le prompt utilisateur injecte ensuite le fragment, le contexte clairement marqué non extractible, les enums fermés et le catalogue de citations.

## F.5 Validation déterministe post-LLM

Ordre proposé :

1. parse JSON strict ;
2. validation du schéma brut de réponse E5 ;
3. vérification que tous les spans sont exacts et uniques ;
4. calcul/relecture des offsets UTF-8 ;
5. validation des handles de citation ;
6. contrôle `rawStatement === verbatimSpan.text` ;
7. validation des vocabulaires ;
8. cohérence claim/assessment (`knowledgeType`, ref, hiérarchie) ;
9. contrôles des nombres, unités, comparateurs, négations, modaux, populations et temporalités ;
10. contrôles INV-005/006/009/015 ;
11. détection de doublons intra-réponse sans fusion inter-fragments ;
12. génération des IDs techniques ;
13. tri canonique par `startByte`, puis `candidateId` ;
14. émission candidats valides + quarantaine/diagnostics pour les autres.

Contrôles durs spécifiques :

- `EMG_OBSERVATION` + conclusion hypertrophique → rejet ;
- `biomechanical_only` + risque démontré/contre-indication → rejet ;
- seuil numérique sans le contexte temporel/population présent dans le span → rejet ;
- causalité ajoutée dans canonical → rejet ;
- `always/never/safe/dangerous` ajouté → rejet ;
- citation absente du fragment → rejet ;
- ID métier ou Source inventée → rejet du batch concerné.

## F.6 Stratégie de retries

Maximum : **un appel initial + deux retries**, conservés séparément.

- Retry 1 : réparation structurelle ciblée avec erreurs JSON/schema/spans ; aucune nouvelle instruction sémantique.
- Retry 2 : ré-extraction complète du même fragment avec rappel des violations déterministes.
- Pas de retry pour un axe `UNRESOLVED`, une citation ambiguë, une contradiction ou une absence de claim.
- Après deux échecs : `fragment_rejected_after_retries`, raw responses conservées, aucune claim promue.

Les candidats valides indépendants d'un batch peuvent être conservés si leurs refs sont fermées et cohérentes ; toute grappe claim–assessment–attributions est acceptée ou quarantinée atomiquement.

## F.7 Seuils de rejet et de routage

Les seuils reposent d'abord sur des règles, pas sur l'auto-confiance du modèle.

### Rejet dur

- span/offset non vérifiable ;
- contenu absent du fragment ;
- enum invalide ;
- citation inventée ;
- nombre/unité/causalité ajoutés ;
- violation EMG ou biomécanique ;
- ID métier ou source enrichie ;
- référence cassée ;
- sortie non JSON après retries.

### Quarantaine `needs_revision`

- `confidenceOfExtraction < 0.85` ;
- au moins un axe essentiel (`knowledgeType`, polarité, subject/outcome) unresolved ;
- citation ambiguë ;
- span contenant plus d'un prédicat indépendant ;
- contenu clinique, red flag, seuil numérique, contre-indication, formulation de risque ou recommandation normative ;
- possible contradiction/duplicate.

### Passage technique

Un score ≥ 0.85 ne suffit jamais. Le candidat doit passer tous les contrôles durs. En E5 v1, même un candidat techniquement valide reste `pending_human_review` conformément à la politique proposée.

## F.8 Diagnostics

Familles minimales :

- éligibilité : `excluded_table`, `excluded_heading`, `out_of_scope_policy`, `zero_claim_valid` ;
- provenance : `fragment_hash_mismatch`, `span_not_found`, `span_not_unique`, `offset_reread_mismatch` ;
- granularité : `multiple_independent_predicates`, `orphan_qualifier`, `over_fragmented_pseudo_claim` ;
- citation : `unknown_citation_handle`, `ambiguous_citation_attribution`, `citation_bleed_detected`, `anaphora_ambiguous` ;
- axes : `knowledge_type_unresolved`, `epistemic_status_unresolved`, `confidence_range_unresolved`, `confidence_aspect_missing`, `directness_unresolved`, `evidence_type_not_explicit` ;
- sécurité : `emg_hypertrophy_inference`, `biomechanics_risk_inference`, `clinical_universalization`, `diagnostic_inference`, `contraindication_without_basis`, `numeric_threshold_universalized` ;
- fidélité : `causality_added`, `negation_lost`, `population_scope_lost`, `temporality_lost`, `number_added`, `modal_strengthened` ;
- exécution : `invalid_json`, `schema_failure`, `retry_exhausted`, `model_response_empty`.

Chaque diagnostic porte : run, fragment, candidate éventuel, sévérité, code stable, message, span/valeur brute, tentative et règle violée.

## F.9 Idempotence et reproductibilité

Un nouvel appel LLM n'est pas garanti bit-identique, même à température 0. E5 distingue donc :

### Reproductibilité d'audit

Toujours garantie par conservation de : entrée exacte, hashes, modèle snapshot, température, seed si disponible, prompt complet/hash, schema/hash, réponse brute, version extracteur, diagnostics et tentatives.

### Idempotence de rematérialisation

Garantie depuis une `rawResponse` mise en cache : même réponse + mêmes versions → mêmes candidats octet pour octet.

### Identité logique des candidats

`candidateId` est le hash canonique de :

```text
corpusFileContentHash
fragmentId
verbatim start/end byte
targetKind
payload sémantique canonique hors métadonnées de run
```

Le `runId` est dérivé du corpus hash, de la liste ordonnée de fragments, du modèle, du prompt, du schema et de la version extracteur. `extractedAt` reste dans le manifest d'exécution ; il ne participe pas à l'identité logique.

### Détection de dérive

Deux appels frais avec même configuration peuvent diverger. Le pipeline produit alors un diff de candidats (`added`, `removed`, `changed_axes`, `changed_citations`) et bloque la publication automatique.

## F.10 Journalisation

Manifest de run obligatoire :

- `runId`, date début/fin, extracteur/version/commit ;
- modèle exact/snapshot/provider ;
- température, seed, paramètres de sampling ;
- prompt système et utilisateur, hash de chacun ;
- output schema et hash ;
- hashes des vocabulaires ;
- hashes du corpus et de chaque fragment ;
- ordre des fragments ;
- raw responses de toutes les tentatives ;
- latence, tokens, statut, diagnostics ;
- IDs produits et état de revue ;
- version du scanner Markdown et du calcul d'offsets.

Aucun secret ou token d'accès n'est journalisé.

---

# G. Plan de benchmark

## G.1 Golden set manuel proposé

Construire un golden set E5 séparé des 208 fixtures existantes, sans modifier celles-ci.

### Taille v1

- **100 fragments** au total ;
- 50 F2, 50 F3 ;
- au moins 20 fragments à zéro claim ;
- au moins 20 fragments cliniques à haut risque ;
- au moins 15 fragments avec plusieurs citations ;
- au moins 15 fragments avec EMG/biomécanique/mécanisme ;
- au moins 10 fragments avec seuils numériques ;
- au moins 10 fragments avec contradiction ou absence explicite ;
- au moins 10 fragments `EXPERT_PRACTICE` ;
- chevauchement des catégories autorisé, mais toutes doivent être représentées.

Échantillonnage stratifié par section et non par facilité. Inclure les onze exemples de ce review, puis tirer le reste de façon déterministe depuis les blocs éligibles.

## G.2 Annotation humaine

Deux annotateurs indépendants, puis adjudication :

1. décision claim / zéro claim ;
2. spans verbatim exacts ;
3. proposition canonique sans ajout ;
4. conditions, population, temporalité, limites, cannotConclude ;
5. citations attachées / ambiguës / rejetées ;
6. six axes avec `RESOLVED`, `UNRESOLVED`, `NOT_STATED`, `NOT_APPLICABLE` ;
7. flags de risque ;
8. claims explicitement interdites ;
9. justification du découpage.

L'accord inter-annotateurs est mesuré avant adjudication. Les désaccords de granularité deviennent des cas de benchmark, pas des annotations effacées.

## G.3 Métriques

### Précision et recall des claims

Un match exige :

- même prédicat/outcome/polarité ;
- population/condition/temporalité essentielles conservées ;
- span source chevauchant la référence et sans ajout extérieur.

Rapporter micro et macro precision/recall/F1, globalement et par F2/F3/type de connaissance.

### Granularité

- taux de claims fusionnant au moins deux gold claims ;
- taux de gold claims fragmentées en pseudo-claims ;
- score de partition par fragment ;
- revue humaine aveugle : `correct`, `overmerged`, `oversplit`, `scope_lost`.

### Citation attribution

- precision/recall des couples claim–occurrence ;
- taux de citation bleed ;
- exactitude du statut ambigu ;
- exactitude des offsets/labels/URL : exigence 100 %.

### Conservation de la nuance

Taux de conservation de :

- négation ;
- modalité ;
- population ;
- temporalité ;
- comparateur ;
- limite ;
- `cannotConclude` ;
- non-significatif ≠ équivalence ;
- absence de preuve ≠ preuve d'absence.

### Hallucination

Compter toute entité, nombre, citation, causalité, documentType, population ou recommandation absente du span. Une seule hallucination clinique grave est bloquante.

### Sur-interprétation clinique

Jeu de labels dédié :

- symptôme → diagnostic ;
- adaptation → interdiction ;
- protocole → seuil universel ;
- biomécanique → dommage ;
- association → causalité ;
- red flag → pathologie certaine ;
- confort fréquent → règle anatomique ;
- population indirecte → généralisation.

## G.4 Seuils de sortie du prototype

Proposition de gates avant extraction massive :

- claim precision globale ≥ **0,95** ;
- claim recall global ≥ **0,85** ;
- precision clinique F3 ≥ **0,98** ;
- citation attribution precision ≥ **0,97** et recall ≥ **0,90** ;
- offsets et citations inventées : **100 % correct / 0 invention** ;
- hallucination factuelle globale ≤ **0,5 %**, avec **0** hallucination clinique grave ;
- EMG → hypertrophie : **0** ;
- biomécanique → risque démontré : **0** ;
- protocole → seuil universel : **0** ;
- diagnostic ou contre-indication inventés : **0** ;
- conservation négation/population/temporalité ≥ **0,98** ;
- taux `overmerged` ≤ **3 %** ;
- taux `oversplit` ≤ **5 %**.

Si la précision est sous le gate, E5 ne passe pas à l'échelle. Si le recall est faible mais la précision respecte le gate, améliorer le prompt/échantillonnage sans relâcher les contrôles de sécurité.

## G.5 Tests de régression

Créer quatre niveaux de tests lors de l'implémentation future :

1. **préprocesseur déterministe** : blocs, liens, offsets UTF-8, exclusions de tables ;
2. **replay** : raw responses fixes → candidats et diagnostics exacts ;
3. **règles sémantiques déterministes** : EMG, biomécanique, nombres, négations, enums ;
4. **benchmark modèle** : exécution volontaire, versionnée, non requise pour chaque test local.

Les tests principaux passent par l'interface `extractProseFragment`, qui est le seam du module. Les helpers internes ne deviennent pas une seconde interface publique.

---

# Conditions de validation avant implémentation

Le design peut être considéré verrouillé si les décisions suivantes sont acceptées explicitement :

1. E5 v1 produit seulement claims, assessment drafts, occurrences de citation déterministes et diagnostics — pas d'entités cliniques exécutables.
2. Toute sortie E5 v1 reste `pending_human_review`.
3. Les citations de prose sont pré-scannées déterministement dans l'orchestration E5 sans modifier les artefacts E3 existants.
4. Les fragments de prose éligibles sont générés déterministement avec offsets vérifiés, car le golden set actuel n'est pas exhaustif.
5. Les axes non justifiés restent `UNRESOLVED` dans un sidecar, jamais forcés dans les vocabulaires fermés.
6. Le golden set manuel et ses gates sont réalisés avant toute extraction massive.

**Stop respecté : aucune implémentation E5 n'est incluse dans ce review.**
