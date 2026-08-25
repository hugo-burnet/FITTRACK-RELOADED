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
| Passages de prose distincts | **266** |
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
  qui transforme 266 passages orphelins en quelque chose qui se parcourt.
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
`src/features/knowledge/evidence-index.json` au chargement du module. 266 passages à
regrouper, c'est instantané. Un second fichier généré finirait par diverger du premier —
c'est exactement le défaut corrigé le 2026-08-26 sur le banc hybride, qui mesurait un
pipeline différent de celui qui était livré.

**Afficher `displayContext`, jamais `rawQuote`.** 18 % des affirmations sont des bouts de
phrase (« et une **rotation interne**. »). Parfaits comme unités de récupération,
illisibles comme prose. Et dédupliquer : **408 affirmations ne font que 266 passages**.

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
      Produit **2 documents, 64 sections, 266 passages**, dans l'ordre du document source.
      `findWikiSection(id)` pour la route de section.

      > **Piège trouvé en l'écrivant, à connaître avant de toucher ce module :** `f2` et
      > `e5f2` ne sont pas deux documents, ce sont les deux passes d'extraction du **même
      > fichier** — 186 affirmations relues par un humain, 224 sorties du modèle — et leurs
      > octets indexent le même texte. Les traiter séparément coupe chaque document en deux
      > et détruit l'ordre de lecture. Le préfixe `e5` est retiré du code de document, et un
      > test garde cette hypothèse : un code ne doit jamais recouvrir deux titres.
      >
      > Répartition réelle : `f2` Anatomie, 49 sections / 194 passages ; `f3` Clinique,
      > 15 sections / 72 passages.
- [ ] **T3 — Écran sommaire.** Les 2 documents, leurs sections, le nombre de passages.
      Textes dans `src/i18n/fr.ts`. Route `/knowledge` enrichie sous la recherche existante.
- [ ] **T4 — Écran de section.** Route `/knowledge/s/:sectionId`. Passages dans l'ordre,
      ancrage affiché, retour au sommaire. Cible tactile ≥ 48 px, thème sombre par défaut.
- [ ] **T5 — Index des questions.** Route `/knowledge/questions`. Les 31 répondables vers
      leurs passages ; les 28 autres listées avec le sous-domaine manquant.
- [ ] **T6 — Relier la recherche aux sections.** Un résultat de recherche mène à sa page de
      section, ancré sur le bon passage.
- [ ] **T7 — Checkpoint téléphone.** Parcourir le sommaire, ouvrir trois sections, chercher
      « mon tendon tire », suivre un résultat jusqu'à sa section. À faire sur le vrai
      appareil : le panneau navigateur ne compose pas d'images quand il est masqué, donc
      aucune capture n'a pu valider la mise en page.

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
