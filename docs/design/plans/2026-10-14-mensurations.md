# Mensurations — plan d'implémentation

> Steps use checkbox (`- [ ]`) syntax for tracking. Toutes les cases sont cochées : ce plan est le
> compte rendu d'une exécution, écrit au fil de l'eau.

**Goal :** saisir une mesure du corps à n'importe quelle date et lire sa courbe (RF-37, RF-38), sans
les photos.

**Architecture :** une logique pure (`lib/bodyMeasurements.ts`), un dépôt par responsabilité — le poids
et ce qu'il fait aux records (`bodyMeasurements.ts`), les mesures en général (`measurements.ts`) —, des
écrans sous Progression qui ne lisent que ces dépôts.

**Tech Stack :** TypeScript strict, Dexie, Vitest, Testing Library, Playwright. Aucune dépendance nouvelle.

**Spec :** `docs/design/specs/2026-10-14-mensurations-design.md`

## Global Constraints

- Code et noms en **anglais**, interface en **français** dans `src/i18n/fr.ts`.
- `lib/` reste pur : ni Dexie, ni `Date.now()` — l'instant arrive en paramètre.
- Le poids passe **toujours** par `saveBodyWeight` / `deleteBodyWeight`.
- Aucune `version()` Dexie, aucune migration : le schéma est celui du Lot 2.
- TDD : chaque test est vu rouge avant le code qui le fait passer ; chaque règle a été mutée une fois.

---

### Tâche 1 — la logique pure

**Files :** Create `src/lib/bodyMeasurements.ts` (+ test) ; Modify `src/lib/analytics/plot.ts` (+ test).

- [x] Le catalogue de quinze mesures, leurs unités, l'ordre de la liste.
- [x] Les champs libres : préfixe `custom:`, nom normalisé et plafonné à 40 caractères.
- [x] La plausibilité par unité ; le poids sans maximum.
- [x] L'instant d'une date saisie (aujourd'hui, un jour passé, refus de demain et d'un jour inexistant),
      l'arrondi à deux décimales, l'écart d'une série, les bornes d'un jour local.
- [x] `plotTimedPoints` : l'abscisse est la date.

### Tâche 2 — les dépôts

**Files :** Create `src/data/repositories/measurements.ts` (+ test) ; Modify
`src/data/repositories/bodyMeasurements.ts` (+ test).

- [x] `deleteBodyWeight` : refait les records de l'intervalle couvert, vérifié contre une reconstruction
      complète, annulé si la réconciliation échoue.
- [x] `listMeasurements`, `listMeasurementTypes`, `saveMeasurement`, `deleteMeasurement`.

### Tâche 3 — les écrans

**Files :** Create `src/features/measurements/*` ; Modify `src/router.tsx`,
`src/features/analytics/AnalyticsScreen.tsx`, `src/platform/androidBack.ts`, `src/i18n/fr.ts`,
`src/i18n/labels.ts`, `src/features/home/HomeBodyWeightSheet.tsx`, `src/features/home/HomeStatsIsland.tsx`.

- [x] La courbe (`MeasurementChart`) et la carte (`MeasurementCard`), sans « record », avec l'échelle
      gravée au niveau de la courbe.
- [x] La feuille de saisie : valeur, date, nom et unité d'un champ libre, annonce du remplacement,
      refus d'une valeur implausible et d'un jour à venir.
- [x] La liste (avec « Quelle mesure ? ») et la fiche (période, historique, corriger, supprimer).
- [x] La route, la ligne dans Progression, le retour d'Android, le lien depuis la feuille du poids.

### Tâche 4 — la preuve dans un navigateur

**Files :** Create `e2e/mensurations.spec.ts` ; Modify `e2e/support.ts`, `e2e/mise-en-page.spec.ts`.

- [x] Saisie rétrodatée, courbe tracée, rechargement, correction, suppression.
- [x] Le poids de l'accueil et celui des mensurations sont la même mesure.
- [x] Refus d'une faute de frappe et de demain ; champ libre ; cibles de 48 px.
- [x] Les trois écrans, avec des données, dans les trois thèmes aux trois tailles de police.

### Tâche 5 — la documentation

- [x] Inventaire des fonctionnalités, feuille de route, décisions, recette téléphone.
