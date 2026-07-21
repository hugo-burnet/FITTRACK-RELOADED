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
| `PROGRESS.md` | État d'avancement réel. **À mettre à jour en fin de chaque session.** |

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
- **Vitest** + Testing Library + `fake-indexeddb` ; **Playwright** pour l'E2E
- **Capacitor** pour l'empaquetage Android (à partir du Lot 10)

## Commandes

```bash
npm run dev          # serveur de dev
npm run build        # build de production (doit passer avant tout commit)
npm run test         # tests unitaires (watch)
npm run test:run     # tests unitaires (une passe, CI)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

## Conventions de code

- Code, noms de variables, commentaires : **en anglais**. Interface utilisateur : **en français**.
- Tous les textes de l'UI vivent dans `src/i18n/fr.ts`. **Jamais de chaîne en dur dans un composant.**
- Un fichier = une responsabilité. Si un fichier dépasse ~300 lignes, le découper.
- Accès aux données **uniquement** via `src/data/repositories/*`. Un composant n'importe jamais
  `db` directement.
- Types partagés dans `src/data/types.ts`. Pas de `any`.
- Dates : timestamps epoch en millisecondes (`number`), jamais de `Date` stockée en base.
- IDs : `crypto.randomUUID()`. Jamais d'auto-increment (cf. ADR-005).

## Tests

- **TDD sur la logique métier** : moteur de records, calculateur de plaques, 1RM, auto-progression,
  export/import. Ces modules sont testés avant d'être écrits.
- Les composants d'affichage purs ne sont pas testés unitairement — l'E2E Playwright couvre les
  parcours.
- Un test qui échoue n'est jamais « corrigé » en modifiant l'assertion sans comprendre pourquoi.

## Git

- Branche de travail : `master`. Commits fréquents et atomiques.
- Convention : `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Préfixer le scope par le lot quand c'est pertinent : `feat(lot-05): saisie des séries`.
- Ne jamais `push --force` sur `master`.

## Rituel de fin de session

1. `npm run typecheck && npm run test:run && npm run build` — les trois doivent passer.
2. Commit.
3. Mettre à jour `PROGRESS.md` : lot terminé/en cours, ce qui reste, pièges rencontrés.
4. Annoncer à l'utilisateur le **checkpoint manuel** à vérifier sur son téléphone.
