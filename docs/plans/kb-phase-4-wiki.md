# KB phase 4 — Le wiki : arrêter de répondre, montrer où lire

> Écrit le 2026-08-26, branche `claude/task-7-complete-06d6ff`.
> Ce fichier est un plan **et** l'état d'avancement de la phase 4. Les cases se
> cochent au fil des sessions ; c'est ce fichier qu'on relit pour reprendre.

## Pourquoi cette bifurcation

La phase 3 visait un coach qui répond, avec Qwen3-1.7B sur le téléphone. Ses étapes 1 à 3
sont faites. Les étapes 4 à 6 sont **abandonnées**, pour trois raisons mesurées le
2026-08-26 et détaillées dans
`fittrack-kb-contract/benchmark/e5-retrieval/selective-v1/DEV-ANNOTATION.md` :

1. **Le refus n'existe pas.** Le moteur renvoie des candidats pour **28 questions sur 28**
   auxquelles le corpus ne peut pas répondre. Pour un système qui répond, c'est
   éliminatoire. Pour un système qui pointe, c'est une recherche infructueuse — visible en
   une seconde, sans conséquence.
2. **Le corpus est une encyclopédie, pas un coach.** Il couvre l'anatomie, la biomécanique,
   la sélection d'exercices et le clinique. Il ne contient **rien** sur la programmation :
   volume, fréquence, tempo, ordre, deload, plages de répétitions, RIR, plateaux,
   priorisation. C'est ce qu'on demande à un coach, et c'est ce qui manque.
3. **La couverture est de 52,5 %**, ce qui est très bon pour un ouvrage de référence et
   intenable pour un assistant censé répondre à tout.

La phase 3 laissait d'ailleurs une question ouverte : « Que fait l'app quand la recherche
ne trouve rien ? Silence, ou renvoi vers le corpus brut ? » Le wiki est la réponse : il n'y
a jamais de « rien », il y a un corpus qu'on parcourt.

## Ce qu'on a déjà, mesuré

| | |
|---|---:|
| Passages de prose distincts | **209** (les 408 affirmations s’y replient) |
| Volume de prose | ~95 500 caractères, soit ~64 pages A4 |
| Sections | **64** |
| Documents sources | 2 |
| Affirmations ancrées à l'octet | 408 |
| Questions DEV annotées, appariées à leurs sources | **31** |
| Questions DEV que le corpus ne peut pas traiter | **28** |

La recherche existe déjà (`src/features/knowledge/searchEvidence.ts`, 8 candidats,
rappel 27/31), tourne hors ligne, sans modèle. Coût API restant pour la phase 4 : **zéro**.

## Périmètre de la v1

Trois écrans, une règle : **le wiki ne rédige jamais**. Il ordonne, il situe, il cite.

### Dans la v1

- **Sommaire** — les 2 documents, leurs 64 sections, avec le nombre de passages. C'est ce
  qui transforme 209 passages orphelins en quelque chose qui se parcourt.
- **Page de section** — les passages d'une section, **dans l'ordre du document source**
  (tri par `supportStartByte`), chacun avec son statut épistémique et son ancrage.
- **Index des questions** — les 31 questions répondables comme portes d'entrée, chacune
  menant à ses passages. Et, listées honnêtement, les 28 que le corpus ne couvre pas :
  dire ce qui manque vaut mieux qu'une page vide.
- **La recherche existante mène aux pages de section**, pour qu'un résultat atterrisse
  dans son contexte au lieu de flotter seul.

### Hors v1, assumé

- Aucune édition, aucune rédaction, aucune génération.
- Aucun lien croisé entre sections (le corpus en contient déjà en texte, ça suffit).
- **CAL et TEST restent fermés.** Leurs 118 questions ne sont pas de la matière à wiki
  tant que la décision de ne jamais revenir à un produit calibré n'est pas prise. Les
  ouvrir est irréversible ; c'est une décision qu'on peut reporter sans rien perdre.
- Aucun ajout de source. La lacune « programmation » est réelle et documentée, elle se
  traite par de la curation, pas par du code.

## Décisions techniques

**Aucun nouvel artefact de données.** La structure du wiki se **dérive** de
`src/features/knowledge/evidence-index.json` au chargement du module. 209 passages à
regrouper, c'est instantané. Un second fichier généré finirait par diverger du premier —
c'est exactement le défaut corrigé le 2026-08-26 sur le banc hybride, qui mesurait un
pipeline différent de celui qui était livré.

**Afficher `displayContext`, jamais `rawQuote`.** 18 % des affirmations sont des bouts de
phrase (« et une **rotation interne**. »). Parfaits comme unités de récupération,
illisibles comme prose. Et dédupliquer : **408 affirmations ne font que 209 passages**.

**Identifiants de section stables et lisibles**, dérivés du chemin de titres. Un test
vérifie leur unicité sur les 64 : une collision silencieuse enverrait deux sections sur
la même URL.

**Les métadonnées mesurées fausses restent invisibles.** Le statut épistémique hors
`refuted` (exactitude 0,46), le type de connaissance (0,689) et l'attribution des
citations (0,766) ont été mesurés peu fiables en phase 2. La v1 n'affiche que ce qui est
soit vérifié, soit explicitement marqué comme non relu.

## Tâches

- [x] **T1 — Plan et suivi multi-session.** Ce fichier, `kb-phase-3-restitution.md` marqué
      comme dépassé sur ses étapes 4 à 6, `kb-prompt-de-reprise.md` remis à jour,
      `PROGRESS.md` complété.
- [x] **T2 — Dérivation de la structure.** `src/features/knowledge/wikiIndex.ts`, 10 tests.
      Produit **2 documents, 64 sections, 209 passages**, dans l'ordre du document source.
      `findWikiSection(id)` pour la route de section.

      > **Piège trouvé en l'écrivant, à connaître avant de toucher ce module :** `f2` et
      > `e5f2` ne sont pas deux documents, ce sont les deux passes d'extraction du **même
      > fichier** — 186 affirmations relues par un humain, 224 sorties du modèle — et leurs
      > octets indexent le même texte. Les traiter séparément coupe chaque document en deux
      > et détruit l'ordre de lecture. Le préfixe `e5` est retiré du code de document, et un
      > test garde cette hypothèse : un code ne doit jamais recouvrir deux titres.
      >
      > Répartition réelle : `f2` Anatomie, 49 sections / 149 passages ; `f3` Clinique,
      > 15 sections / 60 passages (après la fusion des passages imbriqués, cf. T6).
- [x] **T3 — Écran sommaire.** `WikiBrowse.tsx`, sous la recherche existante.
- [x] **T4 — Écran de section.** Route `/knowledge/s/:sectionId`.
- [x] **T5 — Index des questions.** Route `/knowledge/questions`. Artefact
      `wiki-questions.json` généré par `npm run kb:build-wiki-questions`.
- [x] **T6 — Relier la recherche aux sections.** Chaque résultat mène à sa page.

      > **Défaut trouvé en lisant l'app, corrigé :** les passages n'étaient dédupliqués que
      > par égalité stricte, ce qui laissait passer les contextes **imbriqués** — l'un porte
      > la phrase, l'autre le paragraphe qui la contient. **57 des 266 passages, sur 36
      > sections des 64.** Plus d'une page sur deux se répétait à quelques lignes
      > d'intervalle. Après fusion : **209 passages**, 408 affirmations toutes conservées.
      > Même famille que le défaut du banc hybride, un cran plus subtil.
- [x] **T7 — Checkpoint téléphone.** Fait le 2026-08-26 : trois défauts trouvés sur
      appareil réel (doublons de passage, fiches hors sujet, emphase Markdown affichée),
      tous corrigés. Version testée : v1.4.2, corrigés en v1.4.3.
      > Le panneau navigateur ne compose pas d'images quand il est masqué : aucune capture
      > n'a jamais pu valider la mise en page depuis une session agent. Ce checkpoint ne
      > peut se faire que sur l'appareil, et il a trouvé trois défauts que le banc ne
      > voyait pas — c'est l'argument pour le refaire à chaque version.

## Ce qui reste à trancher

- **Les 224 affirmations aux métadonnées vides** (extraites par le modèle, non relues par
  un humain) : les afficher comme les autres, ou les signaler ? La phase 3 posait déjà la
  question. Pour un wiki, la réponse penche vers « signaler », mais c'est une décision
  produit.
- **La lacune programmation.** Douze à quinze documents ciblés sur les sections utiles
  coûteraient 12 à 15 $ d'extraction (0,06 $ par fragment, mesuré sur trois dry-runs). À
  décider quand le wiki tournera : on verra alors ce qui manque à l'usage, pas en théorie.
- **Ouvrir CAL et TEST**, si et seulement si le produit calibré est définitivement
  abandonné. Irréversible.

## Garde-fous hérités

Ils s'appliquent au wiki comme à l'extraction : pas de diagnostic, pas de
contre-indication universelle, pas de saut biomécanique vers un danger. Le dépôt est
public. L'application reste en mode `UNCALIBRATED` et n'appelle jamais un passage une
« réponse ».

## Le refus n'est pas calibrable sur un score lexical (2026-08-26)

`scripts/calibrate-refusal.mjs --split DEV` cherche, parmi quatre signaux que la
recherche connaît au moment de décider, celui qui sépare le mieux les 31
questions répondables des 28 qui ne le sont pas.

| signal | seuil | répondables gardées | non-répondables refusées | score |
|---|---:|---:|---:|---:|
| score du top-1 | 11,94 | 21/31 | 16/28 | 0,620 |
| nombre de termes appariés | 3 | 23/31 | 14/28 | 0,597 |
| couverture des termes | 0,40 | 14/31 | 21/28 | 0,564 |
| marge top1–top3 | 3,77 | 15/31 | 13/28 | 0,474 |

Le meilleur seuil refuse 16 questions de bruit sur 28 **en refusant aussi 10
questions sur 31 auxquelles le corpus répond**. Inutilisable : on dégraderait
l'écran pour filtrer la moitié du bruit.

**Conséquence sur CAL.** CAL sert une fois, à choisir le seuil de refus. Il n'y
a rien à calibrer tant que le signal n'existe pas — l'ouvrir maintenant
dépenserait la partition pour rien. **CAL reste fermé.**

**Conséquence sur l'ordre des travaux.** Un score BM25 mesure un recouvrement de
mots, jamais une couverture de sujet ; c'est la cause du taux de faux positifs
de 100 % constaté toute la journée. Un cross-encoder, lui, produit un score de
*pertinence* — la quantité dont le refus a besoin. Le reclassement n'est donc
pas seulement un gain de classement : **c'est le préalable à tout refus**, et
donc à CAL.

- [ ] **T8 — Mesurer le reclassement.** `tools/e5-retrieval/measure-rerank-lab.html`,
      servi par `serve-lab.mjs`, sur le vivier de `scripts/dump-search-pool.mjs`.
      À lancer avec le panneau navigateur **visible** : masqué, le rendu est bridé
      et l'inférence gèle le fil principal. Non exécutable en session agent.

      > **Trois défauts du banc, trouvés avant d'avoir un seul chiffre** — tous de la
      > même famille : le banc ne disait pas dans quelles conditions il tournait.
      >
      > 1. Modèle sur le fil principal, 18 paires en un passage, aucun avancement
      >    publié. Chrome affichait « Page ne répondant pas » et un run lent était
      >    indistinguable d'un run planté. Corrigé : Web Worker, lots de 4,
      >    `postMessage` par lot et `progress_callback` au téléchargement.
      > 2. **Pas d'en-têtes COOP/COEP sur `serve-lab.mjs`** → pas de
      >    `SharedArrayBuffer` → **WASM mono-thread**, et WebGPU jamais demandé. J'ai
      >    failli conclure « ce modèle est trop lourd pour le téléphone » à partir de
      >    la pire configuration possible. Corrigé, et le backend réellement obtenu
      >    est désormais affiché puis consigné dans le résultat.
      > 3. Le petit modèle de comparaison, `Xenova/mmarco-mMiniLMv2-L12-H384-v1`,
      >    **n'existe pas** — identifiant écrit de mémoire. Remplacé par
      >    `Xenova/bge-reranker-base` (278 M, 266 Mo en q8), vérifié contre l'API
      >    HuggingFace.
      >
      > **Plancher de taille, mesuré :** un cross-encoder qui comprend le français
      > coûte ~266 Mo quantifié, parce que 69 % de ses paramètres sont la table
      > d'embeddings de 250 000 tokens. Ce n'est pas un modèle qu'on rend petit ;
      > c'est un téléchargement qu'on assume ou qu'on refuse. Le chiffre à opposer
      > à ce coût est le gain sur 27/31 et 17/31 — il n'existe pas encore.
- [ ] **T9 — Recalibrer le refus sur le score de reclassement**, si T8 est concluant.
      Puis, et seulement puis, CAL.
