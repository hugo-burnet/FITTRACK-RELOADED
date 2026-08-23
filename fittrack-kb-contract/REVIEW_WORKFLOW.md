# Workflow de revue

## Principe : la revue est orientée par le risque, pas exhaustive

Relire trois mille claims avec la même attention est impossible, et le simuler serait pire que de ne pas
relire. Le pipeline achemine donc vers la revue humaine ce qui peut faire du mal, et laisse passer le reste
sous contrôle automatique.

## Ce qui va systématiquement en revue humaine

| Déclencheur (`ReviewDecision.riskTrigger`) | Pourquoi |
|---|---|
| `red_flag` | Un red flag mal calibré fait rater une urgence ou crie au loup |
| `contraindication` | Une interdiction injustifiée retire durablement un mouvement |
| `evidence_conflict` | Trancher un désaccord que le corpus laisse ouvert est une falsification |
| `ambiguous_source` | Fusionner deux publications distinctes fabrique une source qui n'existe pas |
| `clinical_rule` | Toute règle normative clinique |
| `uncertain_merge` | Toute fusion sans identifiant fort |
| `product_policy` | Une politique produit engage le produit, pas la science |

Tout le reste passe si et seulement si les schemas et les quinze invariants passent.

## Ce qu'une décision doit contenir

`ReviewDecision` exige `decidedAt`, `decidedBy`, `targetRefs`, `action` et `rationale`. Une fusion exige en
plus `mergeBasis`.

`decidedBy` est **une personne**. Jamais un modèle : un LLM produit des candidats, pas des décisions. Cette
distinction est portée par le schéma d'extraction, qui interdit à un candidat LLM d'entrer dans `curated/`
sans passer par une décision.

## Le parcours d'un candidat

```text
candidates/                     extraction déterministe ou LLM
   │
   ├── validation de schéma ────────── échec ──→ needs_revision
   │
   ├── invariants ────────────────────  échec ──→ needs_revision
   │
   ├── drapeaux de risque ?
   │      oui ──→ revue humaine ──→ approve | reject | keep_separate | escalate
   │      non  ──→ approbation automatique
   │
   └── attribution d'un identifiant par le registre
              │
         curated/  →  KBRelease
```

L'attribution de l'identifiant intervient **à l'approbation**, pas à l'extraction. Un candidat rejeté ne
consomme donc aucun identifiant, et le registre ne se remplit pas de fantômes.

## Les trois issues qu'on oublie de prévoir

**`keep_separate`.** C'est la décision la plus importante du workflow et la plus facile à sauter. Le corpus
contient un cas réel : la même méta-analyse poids libres contre machines est attribuée à Haugen dans un
fichier et à Heidel dans l'autre, avec deux localisateurs sans recouvrement et aucun identifiant fort
partagé. La ressemblance de revue, d'année et d'objet est exactement le type de similarité qui **ne suffit
pas** à fusionner. `decision.2026-08-23.0003` acte la non-fusion.

**`escalate`.** Certaines questions ne se tranchent pas en revue interne parce qu'elles demandent une
vérification extérieure au corpus. Le conflit Haugen / Heidel est escaladé vers une vérification
bibliographique, hors périmètre de cette phase. Un conflit escaladé reste ouvert et visible ; il ne se
referme pas par lassitude.

**`open_by_design`.** Un `EvidenceConflict` peut n'avoir aucune résolution à trouver. Quand le corpus
présente deux résultats opposés avec leurs raisons méthodologiques, la bonne sortie est de conserver les
deux et de les montrer. `mustBeSurfacedToUser` porte cette obligation jusqu'à l'interface.

## Revue du golden set

Le golden set de cette phase est **destiné à la revue humaine, pas à la consommation par un coach**. Il
compte 208 instances validées, dont plusieurs portent explicitement des rattachements provisoires signalés
en `unknownFields` avec la raison `pending_human_review`.

Ces signalements sont volontaires. Le corpus cite une centaine de références que ce golden set restreint
n'a pas transformées en entités `Source` ; plutôt que de rattacher une affirmation à une source approximative
ou de la laisser sans justification muette, chaque cas dit ce qui manque et pourquoi. La revue consiste à
les traiter un par un, pas à leur faire confiance.

## Cadence de revue

La base clinique demande une révision **au moins annuelle**, avec surveillance des nouvelles recommandations,
et exige que chaque règle conserve ses identifiants de sources et sa date de revue. Le contrat rend cette
exigence structurelle : toute entité normative — condition, red flag, zone de sécurité, règle d'adaptation,
contre-indication, règle d'orientation, définition de tolérance, politique — doit porter
`lifecycle.reviewedAt`, et INV-015 échoue sinon.

## Audit des sorties

La base clinique demande enfin que les sorties de l'IA soient auditées pour cinq dérives précises :
sur-réassurance, diagnostics implicites, restrictions définitives injustifiées, omission de red flags, et
dérive des seuils numériques. `OutputPolicy.auditTargets` porte cette liste.

Cet audit n'est **pas implémenté** : aucun générateur de sortie n'existe encore. C'est une tâche de phase
ultérieure, listée comme telle dans `tests/acceptance-criteria.md`.
