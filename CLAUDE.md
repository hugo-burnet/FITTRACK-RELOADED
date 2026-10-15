# FitTrack — Conventions du projet

> Ce fichier est chargé automatiquement au démarrage de **chaque** session Claude Code.
> Il contient les règles non négociables. Les détails sont dans `docs/plans/`.

## Contexte en une phrase

Application personnelle de suivi de musculation (clone fonctionnel de Hevy, **sans aucune
fonctionnalité sociale**), déployée en PWA sur GitHub Pages puis empaquetée en APK Android
via Capacitor. Usage strictement personnel, mono-utilisateur, **local-first**.

## Documents de référence

| Fichier | Rôle |
|---|---|
| `audit-hevy-cahier-des-charges.md` | Cahier des charges source. Les `RF-xx` viennent de là. |
| `docs/plans/00-ROADMAP.md` | Découpage en lots + checkpoints. **Lire avant de commencer un lot.** |
| `docs/plans/01-ARCHITECTURE.md` | Stack, modèle de données, décisions techniques (ADR). |
| `docs/plans/lot-NN-*.md` | Plan détaillé tâche par tâche d'un lot. |
| `docs/design/` | Spécifications et plans d'exécution, une paire de fichiers par fonctionnalité. |
| `PROGRESS.md` | État d'avancement réel, **court par construction** (où on en est, ce qui reste, ce qui est dû). **À mettre à jour en fin de chaque session.** |
| `docs/journal/` | Les versions livrées et closes, détachées de `PROGRESS.md`. En lecture seule. Une version publiée y part. |
| `docs/progress/decisions-et-pieges.md` | Décisions, pièges et **dette technique assumée**. |
| `docs/recette-telephone.md` | La liste unique des checkpoints à vérifier sur le téléphone. |

## Règles non négociables

1. **Aucune limite artificielle.** Pas de quota sur les routines, l'historique, les exercices
   personnalisés. C'est la recommandation transverse n°1 de l'audit.
2. **Local-first.** Toute fonctionnalité doit marcher à 100 % hors-ligne, sans réseau, sans
   compte. Le réseau est un bonus, jamais un prérequis. Une salle de sport = un sous-sol sans 4G.
3. **Aucun secret dans le bundle.** Le code est déployé sur un site statique public : toute clé
   d'API embarquée est publique. Si une fonctionnalité a besoin d'un secret, elle passe par un
   proxy serverless (cf. Lot 19) — jamais par une variable `VITE_*`.
4. **Pas de perte de données.** Une séance en cours doit survivre à un crash, un appel
   téléphonique, un kill de l'app. Écriture en base à chaque série validée, pas en fin de séance.
5. **Mobile-first, une main, en sueur.** Cibles tactiles ≥ 48 px, contraste élevé, thème sombre
   par défaut. L'écran de séance en direct est l'écran le plus important de l'app.

## Stack

- **Vite + React + TypeScript** (strict), **Tailwind CSS v4**
- **Dexie.js** sur IndexedDB (persistance) + `dexie-react-hooks` (`useLiveQuery`) pour la réactivité
- **Zustand** uniquement pour l'état éphémère (séance en cours, minuteur)
- **React Router en mode hash** (`createHashRouter`) — obligatoire, cf. ADR-003
- **Vitest** + Testing Library + `fake-indexeddb` ; **Playwright** pour l'E2E (`e2e/`, `playwright.config.ts`)
- **Capacitor** pour l'empaquetage Android (à partir du Lot 10)

## Commandes

```bash
npm run dev          # serveur de dev
npm run build        # build de production (doit passer avant tout commit)
npm run test         # tests unitaires (watch)
npm run test:run     # tests unitaires (une passe, CI)
npm run test:e2e     # parcours dans un vrai navigateur à 390 px (construit puis sert le build)
npm run typecheck    # tsc --noEmit, sur src/ et sur e2e/
npm run lint         # eslint
```

## Conventions de code

- Code, noms de variables, noms de fichiers : **en anglais**. Interface utilisateur : **en français**.
- Commentaires : la langue dans laquelle le raisonnement a été écrit. L'anglais est le défaut
  historique et le reste pour les modules qui y sont déjà ; le français est admis, et l'est en
  pratique dans la moitié du dépôt. Ce qui n'est pas négociable, c'est qu'un commentaire dise
  **pourquoi** — quel défaut réel il empêche de revenir. Un commentaire juste en français vaut
  mieux qu'une traduction qui a perdu la nuance, et cette règle disait le contraire.
- Tous les textes de l'UI vivent dans `src/i18n/fr.ts`. **Jamais de chaîne en dur dans un composant.**
- **Un fichier = une responsabilité.** C'est la règle ; les ~300 lignes n'en sont que le
  symptôme le plus commode à mesurer. Un fichier qui les dépasse est un fichier à **regarder**,
  pas un fichier à couper : on le découpe s'il fait deux métiers, on le laisse s'il n'en fait
  qu'un. Un dictionnaire (`src/i18n/fr.ts`) et un vocabulaire de types (`src/data/types.ts`)
  sont chacun une seule responsabilité, quelle que soit leur longueur.
  Découper au compteur produit des composants à vingt propriétés qui se repassent le même
  état : moins de lignes par fichier, plus de couplage, et personne n'y gagne.
  L'état réel du dépôt et les exceptions connues sont dans « Dette technique assumée »
  de `docs/progress/decisions-et-pieges.md` — un écart non consigné est le seul qui pose problème.
- Accès aux données **uniquement** via `src/data/repositories/*`. Un composant n'importe jamais
  `db` directement. Seule exception, et elle est commentée sur place : `DebugScreen`, qui parle de
  *tables* et non de routines ou de séances.
- Types partagés dans `src/data/types.ts`. Pas de `any`.
- Dates : timestamps epoch en millisecondes (`number`), jamais de `Date` stockée en base.
- IDs : `crypto.randomUUID()`. Jamais d'auto-increment (cf. ADR-005).

## Tests

- **TDD sur la logique métier** : moteur de records, calculateur de plaques, 1RM, auto-progression,
  export/import. Ces modules sont testés avant d'être écrits.
- Les composants d'affichage purs ne sont pas testés unitairement — l'E2E Playwright couvre les
  parcours. Il vit dans `e2e/` : une séance de bout en bout, la série qui survit à un rechargement,
  les cibles de 48 px, la sauvegarde, le démarrage sans réseau, et l'absence de débordement dans les
  trois thèmes à la taille de police du système. Un défaut d'affichage trouvé à la main devient un
  test là, pas une ligne de PROGRESS.md.
- L'E2E ne garde pas le déploiement (`.github/workflows/e2e.yml` est à part) : un navigateur n'est
  jamais tout à fait déterministe. Il se promeut en porte quand il a fait ses preuves.
- Un test qui échoue n'est jamais « corrigé » en modifiant l'assertion sans comprendre pourquoi.

## Git

- Branche de travail : `master`. Commits fréquents et atomiques. Une session d'agent travaille sur sa
  propre branche `ccr-*` ; la fusion `--no-ff` dans `master` et la release se font **sur demande
  explicite**, jamais d'office.
- Convention : `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Préfixer le scope par le lot quand c'est pertinent : `feat(lot-05): saisie des séries`.
- Ne jamais `push --force` sur `master`.

## Rituel de fin de session

1. `npm run typecheck && npm run test:run && npm run build` — les trois doivent passer. Si l'interface a
   changé : `npm run test:e2e` aussi.
2. Commit.
3. Mettre à jour `PROGRESS.md` : ce qui change, ce qui reste. Court : le détail d'une décision va dans
   `docs/progress/decisions-et-pieges.md`, et une version publiée dans `docs/journal/`.
4. Ajouter le **checkpoint manuel** à `docs/recette-telephone.md` et l'annoncer à l'utilisateur.
