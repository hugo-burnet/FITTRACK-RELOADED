# Prompt de reprise — knowledge base FitTrack

> À coller tel quel dans une session neuve. Il est autonome : rien de ce qui suit ne
> suppose un contexte antérieur. Écrit le 25 août 2026, branche
> `claude/task-7-complete-06d6ff`, dernier commit `77ef6fd`.

---

## Mise à jour du 26 août 2026 — lire ceci en premier

Ce qui suit reste exact sur le pipeline, le corpus et les coûts. Deux choses ont changé.

**La direction.** L'objectif n'est plus un assistant qui répond, c'est **un wiki qui montre
où lire**. Le plan et l'état d'avancement vivent dans `docs/plans/kb-phase-4-wiki.md` —
c'est le fichier à ouvrir pour reprendre, ses cases se cochent au fil des sessions.
`kb-phase-3-restitution.md` est dépassé sur ses étapes 4 à 6.

**Le diagnostic.** Le blocage décrit plus bas (« la couverture ne dépasse pas… ») était
faux. L'annotation exhaustive des 59 questions DEV donne :

| | |
|---|---:|
| Couverture du corpus | **31/59 = 52,5 %** (seuil de continuation : 20 %) |
| Lacunes réelles, toutes en programmation | 28 |
| Erreurs de récupération, après correction | 5 |
| Rappel de la recherche embarquée, 8 candidats | 27/31 |

Le corpus était **sous-exploité**, pas trop pauvre. Détail complet dans
`fittrack-kb-contract/benchmark/e5-retrieval/selective-v1/DEV-ANNOTATION.md`.

**Deux règles à ne pas casser.** `CAL` et `TEST` n'ont jamais été ouverts et ne doivent pas
l'être : les lire est irréversible. Et régler la recherche sur `DEV` en a fait un jeu
d'entraînement — le banc `scripts/score-evidence-search.mjs` sert à départager deux
variantes, pas à produire un chiffre publiable.

---

## Ce que tu reprends

Un sous-projet du dépôt FitTrack (application personnelle de musculation, local-first,
mono-utilisateur). Le sous-projet vit dans `fittrack-kb-contract/`.

**But initial :** constituer une base de connaissances annotée épistémiquement à partir de
documents de musculation curés par le propriétaire, pour servir de données de *fine-tuning*
ou d'ancrage à un Qwen3-1.7B tournant sur son téléphone.

**Exigence non négociable, énoncée par lui :** « j'avais besoin d'un truc fiable donc qui ne
se trompe pas, et qui invente pas, pas juste 1 des 2 ». Fiable veut dire **les deux** :
ni faux, ni inventé. Une architecture qui garantit l'un en sacrifiant l'autre ne répond pas
à la demande.

## Ce qui existe et fonctionne

**Un pipeline d'extraction** (`tools/e5-llm/`) : fragments de prose → prompt versionné
(`e5-llm-v0.4.4`) → DTO du fournisseur → matérialisation déterministe de spans UTF-8 →
validation canonique → prédiction évaluée contre un GOLD humain.

- **Corpus assemblé** : `candidates/e5-corpus.json`, **207 fragments, 410 affirmations**
  (186 humaines, 224 modèle, 7 écartées comme incluses dans une autre)
- **Récupération au niveau de l'affirmation** (v0.4) : une affirmation dangereuse est
  filtrée individuellement au lieu de rejeter le fragment entier. Rejeu mesuré : 26 rejets
  → 0, +18 correspondances GOLD, aucune affirmation valide perdue
- **Accord inter-annotateurs** (kappa de Cohen) : 0,889 sur `epistemicStatus`, 0,940 sur
  `knowledgeType`. L'échelle à 9 niveaux n'a rien à simplifier
- **Coût total dépensé : 14,23 $.** Rien de payant depuis l'assemblage du corpus
- Sorties brutes archivées : branche `origin/archive/e5-llm-runs-v0.4`, 1 286 fichiers

Le dépôt est **public**. Aucun secret ne doit entrer dans le bundle ni dans une archive.

## Ce qui a été mesuré ensuite, et qui bloque

Phase 3 : restituer. Trente questions écrites par le propriétaire lui-même, figées avec
un hash **avant** toute recherche (`benchmark/e5-retrieval/questions-30.json`).

### La génération est condamnée en l'état

Six configurations mesurées — `qwen3:1.7b` et `gemma4:e2b`, trois prompts, avec et sans
réflexion, avec et sans contexte de titres. Aucune n'approche l'utilisable : le modèle
choisit mal parmi quatre affirmations, transfère une propriété d'un sujet à un autre, se
trompe d'anatomie, invente des recommandations, ou recopie la question.

### Rien ne savait dire « je ne sais pas »

Ni les scores BM25, ni les scores d'embedding, ni la marge, ni le z-score, ni un modèle
0,5 B, ni `qwen3:1.7b` sous quatre configurations, ni `gemma4:e2b`.

### Le reclassement a été ajouté, et partiellement mesuré

Fusion hybride BM25 + embeddings par *reciprocal rank fusion* (k = 60), puis reclassement
des 12 meilleurs candidats vers 4.

- **Reclassement par `qwen3:1.7b` : sans effet.** 84 des 120 notes tombent sur 6 ou 8
- **Reclassement par `bge-reranker-base`** (vrai cross-encoder, 278 M, q8, dans le
  navigateur — ollama 0.32.15 renvoie 404 sur `/api/rerank`, aucun modèle téléchargé n'y
  changerait rien) : premier score étalé de la chaîne, **−9,86 à +1,44**

### L'étiquetage en aveugle — la seule mesure non circulaire

Le propriétaire a étiqueté les 30 questions score masqué et ordre brouillé, critère plus
strict que la consigne. Il a corrigé une étiquette dans le sens qui le désavantage.

- **5 utiles sur 30**
- **AUC 0,832**, IC 95 % de Hanley-McNeil **[0,601 ; 1,000]** — signal réel, intervalle
  très large avec 5 positifs, borne basse proche du hasard
- Quatre des cinq utiles sont dans les six premiers rangs sur trente
- **Aucun seuil exploitable** : la précision 1,00 au rang 3 repose sur trois points dont
  deux signalés incertains par l'étiqueteur lui-même
- **q.24** : le bon extrait a été choisi pour cette question, puis noté −5,073. Le
  classement *à l'intérieur* d'une question est juste, la comparaison *entre* questions
  échoue — les logits d'un cross-encoder ne sont pas calibrés d'une requête à l'autre

Reproduire : `node tools/e5-retrieval/score-blind-labels.mjs`

### Le plafond, tel qu'il est actuellement compris

**Le corpus répond à 5 des 30 vraies questions.** Une recherche parfaite avec un seuil
parfait en rendrait 5. L'hypothèse posée est un décalage de genre : le corpus est un
document de biomécanique et de lecture de preuve (bras de levier, EMG, méta-analyses,
niveaux de confiance), les questions sont des questions de coaching (*je stagne, je change
ou j'insiste ? un côté pousse plus fort, je fais quoi ?*).

**Cette hypothèse n'a pas été testée.** Elle a été formulée après coup à partir de 30
questions. C'est le premier point à vérifier, pas à reprendre pour acquis.

## Une faiblesse de méthode à connaître

Sur ce projet, la personne qui a mesuré a plusieurs fois conclu trop tôt :

- un moteur de récupération a été jugé incohérent et un mécanisme construit pour le
  contourner, alors que le chiffre gênant venait d'un défaut de comptage — l'accord humain
  réel était 0,9314
- une passe d'évaluation a comparé 20 fragments à 100 références, produisant 80 rejets
  fantômes
- la génération a été déclarée impossible **avant** que le reclassement ne soit monté
- deux verdicts alarmants venaient de l'instrument de mesure, pas du système mesuré

Conséquence pratique : **avant de conclure qu'un composant échoue, vérifie l'instrument.**
Et avant d'itérer sur des réglages, nomme le plafond atteignable.

---

## Ce qu'on te demande

Trois livrables, dans cet ordre.

### 1. L'état de l'art

Cherche ce qui se fait réellement aujourd'hui pour ce problème précis : **répondre de
façon fiable, hors ligne, sur un téléphone, à partir d'un petit corpus fermé, avec la
capacité de refuser**. Pas la RAG en général — ce cas-là.

Questions ouvertes qui méritent une réponse documentée :

- comment l'abstention est-elle traitée en pratique (seuils calibrés, vérification
  d'ancrage *a posteriori*, NLI d'implication, conformal prediction) ?
- la non-calibration des cross-encoders entre requêtes a-t-elle une parade standard ?
- que valent les modèles embarqués récents sur de la génération ancrée en français ?
- le *fine-tuning* sur un corpus de 410 affirmations est-il seulement dans les ordres de
  grandeur où quelque chose fonctionne ?

Cite des sources. Distingue ce qui est mesuré de ce qui est annoncé.

### 2. L'audit de la méthode suivie ici

Points forts, faiblesses, failles. Sois précis et cite les fichiers. En particulier :

- l'extraction verbatim par spans octet-exacts garantit qu'aucune affirmation n'est
  inventée — mais **61 % des affirmations commencent en milieu de phrase** (56 % des
  humaines), donc illisibles seules. L'hydratation vers la phrase complète a été
  implémentée et n'a changé aucune mesure. Est-ce que la propriété vaut son prix ?
- 30 questions et 5 positifs : est-ce suffisant pour décider quoi que ce soit ?
- les seuils et les profils gelés (`design-review` vs `human-ceiling`) protègent-ils
  vraiment contre l'ajustement rétrospectif des cibles ?
- qu'est-ce qui, dans ce qui a été mesuré, ne survivrait pas à une réplication ?

### 3. La décision

Tranche entre **arrêt**, **bifurcation** et **continuation corrigée**. Les trois sont
également recevables — l'arrêt n'est pas un échec à éviter, et le travail déjà payé n'est
pas un argument pour continuer.

Dis explicitement :

- ce qui serait jeté et ce qui serait conservé dans chaque cas
- quelle mesure, si elle tombait autrement, retournerait ta recommandation
- le coût en argent et en temps de l'option que tu retiens

Rends la recommandation en une phrase avant de la justifier.

---

## Contraintes

- Interface en français, code et noms de fichiers en anglais. Rien de codé en dur dans un
  composant : les textes vivent dans `src/i18n/fr.ts`
- Local-first : tout doit marcher hors ligne. Une salle de sport est un sous-sol sans 4G
- Aucun appel payant sans accord explicite, montant annoncé d'avance
- `npm run typecheck && npm run test:run && npm run build` doivent passer avant tout commit
- Ne lance pas `prettier --write` sur des fichiers que tu n'as pas touchés

## Où regarder

| Chemin | Contenu |
|---|---|
| `fittrack-kb-contract/benchmark/e5-retrieval/RESULTATS.md` | journal complet des mesures de restitution |
| `fittrack-kb-contract/benchmark/e5-retrieval/etiquettes-aveugle.json` | les 30 étiquettes en aveugle |
| `fittrack-kb-contract/tools/e5-retrieval/score-blind-labels.mjs` | AUC, IC, balayage de seuils |
| `fittrack-kb-contract/tools/e5-retrieval/rerank-lab.html` | banc cross-encoder (navigateur) |
| `fittrack-kb-contract/candidates/e5-corpus.json` | le corpus, 207 fragments / 410 affirmations |
| `docs/plans/kb-phase-3-restitution.md` | le plan de la phase en cours |
| `PROGRESS.md` | état d'avancement réel |
