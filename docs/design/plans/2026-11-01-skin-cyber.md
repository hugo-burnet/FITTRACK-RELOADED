# Skin Cyber — plan d'implémentation

**Spec :** `docs/design/specs/2026-11-01-skin-cyber-design.md`
**Maquette :** `docs/design/mockups/2026-11-01-skin-cyber.html`

Exécuté dans cet ordre, un commit par étape, chaque étape verte (`typecheck`, `lint`, tests touchés)
avant la suivante. Les cases sont cochées : c'est le plan tel qu'il a été suivi.

- [x] **1. Le socle.** `Theme` + `'cyber'`, `index.html`, Réglages en deux lignes de deux, `fr.ts`,
      police Cyber Sans (+ licence, + crédits), `styles/cyber.css` (jetons, fonds, plaques,
      commandes), `cyber.test.ts`, E2E « aucun écran ne déborde » à 100, 130 et 200 %.
- [x] **2. −15 s / +15 s (tous les thèmes).** `restTimer.shift` en TDD, `RestShift`, branché par
      `CardRest.onShift`, parcours E2E sur un vrai repos.
- [x] **3. La barre de vie du repos.** `msUntilCritical` (TDD), `data-crit` / `data-hit` sur `RestRail`
      (testés), habillage Cyber. Défaut trouvé à la capture et corrigé dans le store : `shift` déplace
      le début avec la fin.
- [x] **4. La coche.** `skinTone` et `setImpactTag` (TDD), `buzzSetImpact`, `SetCheckFx`, `data-fired`
      sur la ligne (testés en Cyber et hors Cyber), habillage. Défaut trouvé à la capture : l'étiquette
      rognée par `SwipeToDelete`.
- [x] **5. Les glitchs.** `cyberGlitch.ts` (TDD), `screenGlitch.ts` + `public/audio/screen-glitch.mp3`,
      `CyberGlitch` dans `AppShell` (testé), habillage ; coquille transparente pour les fonds.
- [x] **6. Portes et documents.** Suite entière, build, E2E entier ; `PROGRESS.md`,
      `decisions-et-pieges.md`, recette téléphone § 6.
