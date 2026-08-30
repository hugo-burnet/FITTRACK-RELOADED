# Ouverture simplifiée et console GRUB — conception

**Date :** 30 août 2026

**Statut :** validé (terminal noir / écriture blanche, comme GRUB)

**Plan d'exécution :** `docs/superpowers/plans/2026-08-30-boot-simple-reveal.md`.

## 1. Objectif

Retirer l'impact de la barre (chute, compression, secousse, sol, poussière) et retrouver une
ouverture courte : les plaques s'enfilent, deux phrases se posent, le rideau révèle l'accueil.

Tous les 14 à 28 jours, une variante rare remplace les deux phrases par un terminal noir à
écriture blanche, du même genre qu'un écran GRUB / dmesg : quatre logs fixes, un curseur, puis
`progressive_overload = true`.

## 2. Approches considérées

1. **CSS + une clé localStorage — retenu.** Pas de moteur d'animation, pas de Dexie, pas de
   réseau. Les délais vivent dans `index.css`. La date du prochain terminal vit dans une seule
   clé hors sauvegarde.
2. **Moteur d'easter eggs générique.** Disproportionné pour une surprise vue une fois toutes les
   deux à quatre semaines.
3. **Table Dexie / préférence sauvegardée.** Un restore ne doit pas brûler ni forcer la surprise.
   Le terminal n'est pas un réglage.

## 3. Séquence normale

Durée d'ouverture : **2 180 ms** (`BOOT_HOLD_MS.normal`). La contrainte historique de 2 500 ms
est levée : sans chute, la scène est plus courte.

1. Le manchon se pose, les deux paires de plaques s'enfilent (rythme inchangé : 640 ms et 940 ms).
2. « Progressive overload » apparaît à 1 340 ms.
3. « Production was the gym » apparaît 180 ms plus tard (1 520 ms).
4. Le rideau s'efface en **opacité seule** (320 ms). Plus de `scale` sur `boot-curtain`.

Une séance active non périmée saute toujours le rideau.

## 4. Séquence rare (console GRUB)

Durée d'ouverture : **3 360 ms** (`BOOT_HOLD_MS.console`).

1. Les plaques se chargent comme en normal, sur le fond themé de l'app.
2. À 1 260 ms, le lockup (barre + nom) glitch et cède la place au terminal.
3. Quatre lignes apparaissent une à une (1 440, 1 600, 1 760, 1 920 ms) :
   - `[ OK ] quadriceps.service active`
   - `[ OK ] core.stability mounted`
   - `[ WARN ] ego-lifting detected`
   - `[ FAIL ] excuses.mount: permission denied`
4. Le prompt `root@fittrack:~#` arrive à 2 100 ms, curseur bloc clignotant.
5. La commande `progressive_overload = true` s'écrit en 27 pas (2 700–3 180 ms).
6. Le rideau révèle **directement l'accueil** (pas les deux phrases de marque).

Les chaînes sont en anglais volontairement : c'est un terminal, pas l'UI française. Elles vivent
quand même dans `src/i18n/fr.ts`.

### Palette GRUB — non négociable

Le terminal **ignore le thème** de l'app. Clair ou sombre, c'est le même écran :

| Rôle        | Valeur   |
| ----------- | -------- |
| Fond        | `#000`   |
| Écriture    | `#fff`   |
| Curseur     | `#fff`   |

Pas de `--surface-0`, pas de `--text-1`, pas d'accent FitTrack, pas de jaune/rouge sur
`[WARN]` / `[FAIL]`. Toute la glyphe est blanche sur noir, comme un GRUB textuel.

La frappe anime `width` en `ch` avec `steps(27)`. C'est la seule exception à « transform et
opacité » : un vrai dévoilement caractère par caractère, borné à 27ch, une fois toutes les
deux à quatre semaines.

## 5. Planification locale

- Clé : `fittrack.bootEasterEggAfter` (un timestamp epoch ms).
- **Point, pas deux-points.** Le backup ne capture que le préfixe `fittrack:`. Cette clé est
  volontairement hors export / restore.
- Première ouverture, clé absente ou valeur invalide : on écrit une date dans 14 à 28 jours
  (`14 + floor(random * 15)`) et on joue le boot **normal**. Jamais de terminal le jour de
  l'install.
- Quand la date est due : on **montre** le terminal, on ne réécrit la date **qu'après** une
  ouverture jouée jusqu'au bout.
- Une séance active qui saute le rideau **ne consomme pas** la date.
- `localStorage` inaccessible ou `setItem` qui jette : boot normal, l'app s'ouvre.

Pas de réglage, pas de bouton debug en production.

## 6. Accessibilité et hors-ligne

- `prefers-reduced-motion: reduce` : plus de glitch, plus de frappe, plus de clignotement.
  Le terminal apparaît par fondu ; les lignes et la commande sont déjà là.
- La scène décorative reste `aria-hidden` ; les textes de marque gardent leur comportement
  actuel.
- Zéro réseau, zéro image, zéro dépendance.

## 7. Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/app/bootEasterEgg.ts` | Variante, planning, attente d'ouverture |
| `src/app/Boot.tsx` | Scène barre / phrases / terminal |
| `src/index.css` | Délais, keyframes, palette GRUB |
| `src/i18n/fr.ts` | Quatre logs, prompt, commande |
| `src/main.tsx` | Choix de variante au démarrage, consommation après jeu |

## 8. Vérification

- Tests du sélecteur, du saut séance active, des deux scènes, de l'absence d'impact, et du
  contrat GRUB (`#000` / `#fff`).
- Typecheck, suite, build.
- Checkpoint téléphone : cold start normal, puis un cold start avec la clé due pour juger le
  terminal noir.
