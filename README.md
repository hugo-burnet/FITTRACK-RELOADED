# FitTrack

[![Version](https://img.shields.io/github/v/tag/hugo-burnet/FITTRACK-RELOADED?label=tag&color=2f6f4e)](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases)
[![Pages](https://img.shields.io/badge/PWA-GitHub%20Pages-12110f)](https://hugo-burnet.github.io/FITTRACK-RELOADED/)
[![Android](https://img.shields.io/badge/Android-APK-3DDC84)](docs/ANDROID.md)
[![Node](https://img.shields.io/badge/node-%3E%3D20-43853d)](package.json)

Suivi de musculation personnel. Local-first, hors-ligne, sans compte, sans fil social.

Un clone fonctionnel de Hevy pour un seul utilisateur : la salle est un sous-sol sans 4G, pas un réseau social.

**En ligne :** [hugo-burnet.github.io/FITTRACK-RELOADED](https://hugo-burnet.github.io/FITTRACK-RELOADED/)  
**Téléchargements :** [Releases](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases) — le badge `tag` ci-dessus donne la dernière version publiée.

---

## Ce que c’est

- **Séance en direct** — saisie une main, écriture en base à chaque série validée.
- **Coach vocal** — annonces sérialisées, musique atténuée hors effort, records et récapitulatif de fin.
- **Cadence** — tempo choisi au chrono de la carte d’exercice, préparation dans 10 secondes, 3–2–1, impacts par répétition et passage à l’exercice suivant.
- **Tutoriel oral** — visite initiale facultative et aide contextuelle `?` sur chaque grande page.
- **Routines** — modèles, dossiers, pas de quota.
- **Blocs** — périodisation par intention (`loadIndex` + phase). La routine reste le 100 %. Le Coach tranche sur les perfs, il n’invente pas de permissions.
- **Carte du corps** — les muscles travaillés sur douze semaines ; toucher un muscle donne ses exercices.
- **Historique & records** — 1RM, volume, import CSV Hevy, export CSV / Markdown.
- **Paliers** — 56 seuils écrits à la main, acquis à vie. Aucun compteur qui redescend, aucun objectif affiché avant d'être franchi.
- **Sauvegarde complète** — tout le compte (tables, réglages, préférences) dans un JSON que l’app sait restaurer.
- **PWA et APK** — même code. Capacitor pour Android.

## Ce que ce n’est pas

Pas de compte, pas de cloud obligatoire, pas de likes. Une clé d’API n’a rien à faire dans le bundle (`VITE_*` public = public).

Les données vivent dans IndexedDB (Dexie). Désinstaller l’app les efface. Mettre à jour : installer par-dessus, **sans** désinstaller.

---

## Installer

| Canal | Pour qui | Guide |
| --- | --- | --- |
| PWA | Chrome (Android) / Safari (iOS) | [docs/INSTALLATION.md](docs/INSTALLATION.md) |
| APK signé | Android, hors navigateur | [docs/ANDROID.md](docs/ANDROID.md) |

Un tag `v*` publie l’APK dans une GitHub Release. Pousser `master` seul met à jour Pages, pas la page Releases.

```bash
git push origin master
version="v$(node -p "require('./package.json').version")"
git tag -a "$version" -m "FitTrack $version" && git push origin "$version"
```

---

## Stack

Vite · React 19 · TypeScript strict · Tailwind v4 · Dexie (IndexedDB) · Zustand (état éphémère uniquement) · React Router **hash** · Vitest · Capacitor 8.

Décisions : [docs/plans/01-ARCHITECTURE.md](docs/plans/01-ARCHITECTURE.md).

---

## Développement

```bash
npm install
npm run dev
```

Le `base` Vite suit le nom du dépôt. En local : [http://localhost:5173/FITTRACK-RELOADED/](http://localhost:5173/FITTRACK-RELOADED/).

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de dev (pas de service worker) |
| `npm run build` | Production (`tsc -b` + Vite) |
| `npm run preview` | Build local, SW inclus |
| `npm run test:run` | Tests, une passe |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run android:sync` | Build web Android + `cap sync` |

Un push sur `master` lance lint, typecheck, tests, build, puis GitHub Pages. Un échec bloque la mise en ligne.

---

## Documentation

| Document | Contenu |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Règles non négociables (agents et humains) |
| [docs/plans/00-ROADMAP.md](docs/plans/00-ROADMAP.md) | Lots |
| [docs/plans/01-ARCHITECTURE.md](docs/plans/01-ARCHITECTURE.md) | ADR, modèle |
| [PROGRESS.md](PROGRESS.md) | État réel |
| [audit-hevy-cahier-des-charges.md](audit-hevy-cahier-des-charges.md) | Cahier des charges source (`RF-xx`) |
| [docs/design/](docs/design/) | Spécifications et plans d'exécution, par fonctionnalité |

---

## Licence

Usage personnel. Le dépôt n’est pas publié sous une licence open source.

La carte musculaire reprend [Z-Anatomy](licenses/z-anatomy/) (attribution dans ce dossier). La base d’exercices s’appuie sur des jeux de données du domaine public, documentés dans `PROGRESS.md`.
