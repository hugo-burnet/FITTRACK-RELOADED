# Coach Export & Markdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sortir une séance de l'app en Markdown, en trois gestes, à partir d'une projection pure et versionnée — et prouver au passage que l'instantané du jalon 08A est juste.

**Architecture:** Cf. `docs/superpowers/specs/2026-07-28-coach-export-markdown-design.md`. Chaîne `exportQueries` → `projectCoachExport` → `serializeMarkdown` → `share`. Seul le premier maillon touche Dexie ; les deux suivants sont purs et testés sans base.

**Tech Stack:** TypeScript strict, Dexie 4, Vitest, fake-indexeddb, Testing Library.

## Global Constraints

- `src/lib/export/`, jamais `src/domain/` (architecture §7).
- La projection ne contient **aucune chaîne française**. Seul `serializeMarkdown.ts` importe `i18n/`.
- Aucune métrique agrégée dans les DTO : pas de `definitions`.
- Aucun téléchargement de fichier, aucun écran `/settings/export` — E3/E4.
- Réutiliser `entryColumns`, `sessionTotals`, `isWorkingSet`, `measurementShape` : ne réécrire aucune règle de mesure ou de volume.
- Pas de correction opportuniste hors périmètre.

---

### Task 1: Le fuseau, en dates lisibles

**Files:**
- Modify: `src/lib/timezone.ts`, `src/lib/timezone.test.ts`

**Interfaces:**
- Produces: `localDateKey(at: number, offsetMinutes: number): string` (`'2026-07-27'`), `isoWithOffset(at: number, offsetMinutes: number): string` (`'2026-07-27T18:20:00+02:00'`), `shiftToOffset(at: number, offsetMinutes: number): number` (instant décalé, à formater avec `timeZone: 'UTC'`).

- [ ] Tests rouges : offset `+120` un 27 juillet à 18:20 UTC+2 ; offset `0` ; offset négatif `-300` ; une séance à 23:30 locale dont le jour civil ne bascule pas selon l'offset du lecteur ; passage de minuit.
- [ ] Implémenter les trois fonctions, commenter pourquoi `shiftToOffset` + `timeZone: 'UTC'` est le seul moyen de formater un offset brut avec `Intl`.

### Task 2: Les DTO et la projection pure

**Files:**
- Create: `src/lib/export/types.ts`
- Create: `src/lib/export/projectCoachExport.ts`, `src/lib/export/projectCoachExport.test.ts`

**Interfaces:**
- Produces: `ExportScope`, `ExportOptions`, `DEFAULT_EXPORT_OPTIONS`, `CoachExport`, `ExportWorkout`, `ExportExercise`, `ExportSet`, `ExportSource`, `projectCoachExport(scope, sources, options, now): CoachExport`.

- [ ] Écrire `types.ts` d'après la spec, chaque champ commenté (surtout `schemaVersion` et l'absence de `definitions`).
- [ ] Tests rouges de la projection, sans Dexie, sur des objets littéraux :
  - séance sans exercice, séance avec exercice sans série ;
  - identité : instantané présent → nom de l'instantané ; instantané absent + bibliothèque → nom de la bibliothèque ; ni l'un ni l'autre → `name` absent ;
  - **non-régression 08A** : instantané et bibliothèque en désaccord → l'instantané gagne ;
  - les six `MeasurementType` : seuls les champs de la forme sont émis ;
  - les quatre `SetType` ; `includeWarmups: false` écarte les échauffements **et renumérote** `number` ;
  - `includeNotes: false` supprime notes de séance et d'exercice ; `includeIds: true` ajoute les ids, absents par défaut ;
  - RPE absent/présent, `side` autre que `both` ;
  - `startedAt` et `localDate` calculés avec `startedTimezoneOffsetMinutes`, repli sur `localOffsetMinutes` quand le champ manque ;
  - `workoutCount` / `workingSetCount` comptés avec `isWorkingSet` ;
  - ordre stable des séances, exercices et séries.
- [ ] Implémenter la projection, tests verts.

### Task 3: Les requêtes bornées

**Files:**
- Create: `src/data/repositories/exportQueries.ts`, `src/data/repositories/exportQueries.test.ts`

**Interfaces:**
- Produces: `listExportSources(scope: ExportScope): Promise<ExportSource[]>`.

- [ ] Tests rouges sur `fake-indexeddb` : les quatre périmètres ; séance `active` et séance supprimée écartées ; ligne d'exercice et série soft-deleted écartées ; série non validée écartée ; exercice **soft-deleted conservé** dans `exercise` ; bornes `from` inclusif / `to` exclusif ; tri par `startedAt` croissant ; périmètre `exercise` ne gardant que ses lignes et écartant les séances sans occurrence.
- [ ] Implémenter : une seule passe `bulkGet` sur la bibliothèque, aucun appel à `getLastPerformance`. Commenter pourquoi ce n'est pas `getWorkoutDetail`.

### Task 4: Le sérialiseur Markdown

**Files:**
- Create: `src/lib/export/serializeMarkdown.ts`, `src/lib/export/serializeMarkdown.test.ts`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Produces: `serializeMarkdown(data: CoachExport): string`.

- [ ] Ajouter la section `export.*` à `fr.ts` : titre, lignes d'en-tête, libellés de colonnes, avertissement de tonnage, `unknownExercise`, valeur absente.
- [ ] Tests rouges : `|` dans un nom d'exercice ou une note ; retour à la ligne dans une note de séance (préservé, hors tableau) et dans une note d'exercice ; accents ; `102,5` ; colonnes issues de `entryColumns` pour les six types ; colonne « Type » omise quand tout est `normal` ; colonne « RPE » omise quand aucune série n'en porte ; `—` pour un trou ; préfixe `−` sur l'assistance et **aucune ligne de tonnage** sur une séance sans `weightRole: 'load'` ; nom manquant → libellé générique ; aucune série résumée.
- [ ] Implémenter, tests verts.

### Task 5: Le partage

**Files:**
- Create: `src/platform/share.ts`, `src/platform/share.test.ts`

**Interfaces:**
- Produces: `type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'`, `shareText(payload: { title: string; text: string }): Promise<ShareOutcome>`.

- [ ] Tests rouges avec `navigator` stubbé : partage disponible → `'shared'` ; `AbortError` → `'cancelled'` sans copie ; `navigator.share` absent → copie → `'copied'` ; autre erreur de partage → repli copie ; copie indisponible ou en échec → `'failed'`.
- [ ] Implémenter.

### Task 6: Partager depuis le détail d'une séance

**Files:**
- Modify: `src/features/history/HistoryDetailScreen.tsx`, `src/i18n/fr.ts`
- Create: `src/features/history/HistoryDetailScreen.test.tsx` (ou étendre s'il existe)

- [ ] Ajouter `history.share`, `history.copy`, `history.shareCopied`, `history.shareFailed` à `fr.ts`.
- [ ] Ajouter **Partager** et **Copier le texte** en tête de l'`ActionSheet` existant, avant Modifier/Supprimer.
- [ ] Construire le Markdown **synchronement** à partir du `detail` déjà chargé (via `projectCoachExport` sur une `ExportSource` dérivée du `WorkoutDetail` en main) — aucun `await` entre le tap et `navigator.share`.
- [ ] Réutiliser le créneau d'alerte de `deleteFailed` pour le retour : `'copied'` → confirmation, `'failed'` → échec, `'shared'`/`'cancelled'` → rien.
- [ ] Tests : les deux entrées existent ; un partage annulé n'affiche aucun message ; une copie affiche la confirmation.

### Task 7: Portes, vérification navigateur et clôture

- [ ] `npm.cmd run lint`, `typecheck`, `test:run`, `build` — les quatre verts.
- [ ] Piloter l'app en 375 × 812 px : ouvrir une séance archivée, `⋯` → Copier le texte, vérifier le Markdown obtenu (colonnes justes, décimales françaises, aucune synthèse), puis renommer l'exercice dans la bibliothèque et recopier — **le nom ne doit pas bouger**.
- [ ] Mettre à jour `PROGRESS.md`.
- [ ] Commits : `docs(lot-08)` pour la spec et le plan, puis `feat(lot-08)` pour l'implémentation.
