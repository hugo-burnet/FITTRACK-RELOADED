# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.
> L'historique détaillé vit dans `docs/progress/` et `docs/journal/`.

**Dernière mise à jour :** 2026-09-06 (**sauvegardes, échauffements, tutoriel, commandes de séance**).

## Sauvegardes validées, échauffements reproposés, commandes regroupées (2026-09-06)

- Publication : version 2.5.1 préparée sur master ; push et tag v2.5.1 pour publication PWA et génération de l’APK signé par GitHub Actions. Validation avant changement de numéro : 2 554 tests réussis dans 241 fichiers, typecheck, build et lint verts.
- **Import de sauvegarde.** Nouveau `src/lib/backup/validate.ts` : format, version de
  fichier, version de schéma, structure complète et références sont vérifiés **avant**
  toute écriture. Une table malformée, une ligne qui n'est pas un enregistrement, un champ
  obligatoire absent ou d'un mauvais type, deux lignes sur le même identifiant : le fichier
  est refusé et la base n'est pas touchée. Une table absente reste légitime quand le schéma
  du fichier ne la connaissait pas (blocs à la version 6, paliers à la 12) ; sous ce seuil
  c'est un trou et c'est refusé. Une sauvegarde écrite contre un schéma plus récent que
  cette version est refusée (`unsupported-schema`). Les références cassées ne refusent pas
  le fichier — elles sont comptées et annoncées dans le récapitulatif, qui porte désormais
  la date du fichier et le nombre de lignes. Le message d'erreur nomme la table, la ligne et
  le champ (`features/settings/backupMessages.ts`). `writePreferences` remet les préférences
  d'avant si une écriture `localStorage` échoue à mi-chemin.
- **Échauffements récurrents.** `src/lib/warmupMemory.ts` relit la montée de la dernière
  séance de l'exercice — aucune table, aucune migration : l'historique *est* la mémoire, et
  elle est donc par exercice quelle que soit la routine. Les paliers sont mémorisés en
  pourcentage de la charge de travail du jour et **réappliqués à celle d'aujourd'hui** ; le
  bandeau le dit quand la charge a changé. Proposé sur la seule carte de l'exercice en cours,
  jamais imposé : Ajouter écrit la montée, Modifier rouvre la feuille sur ces paliers,
  ignorer c'est commencer à soulever. Rien n'est proposé si la séance porte déjà un
  échauffement, ni après la première série validée — ce qui règle aussi la reprise après un
  kill. Distinction échauffement/travail inchangée (`isWorkingSet`, `matchPreviousSets`).
- **Tutoriel des réglages.** Le choix du mode accepte désormais le Silence et termine la
  mission : l'étape le refusait et bloquait net celui qui venait couper le son. L'écho est
  devenu sa propre mission (`TUT-SET-03`), gardée par `requires-audible-guidance` — en
  Silence la ligne n'est pas rendue, la mission n'est donc pas proposée. Le mode d'annonce
  est suivi dans l'état du provider au lieu d'être relu à l'aveugle, ce qui corrige au
  passage la fraîcheur de `hasRepPacing`. Une mission dont la garde tombe est **mise en
  pause** (`suspendMission`) et non comptée refusée : elle revient intacte.
- **Commandes de séance.** Le cadenas d'ordre et la commande de deload quittent le bandeau
  pour le menu de séance, sous leur libellé et avec la raison de leur grisage. Le bandeau ne
  garde que l'avancement, le repliage, et l'état « 80 % » **quand la décharge est
  appliquée**. La mission `TUT-WRK-12` ouvre le menu avant de désigner la décharge.
- **Durcissement après coup.** Une seconde session avait commencé la même validation dans un
  worktree voisin, sous la forme d'une table `src/lib/backup/schema.ts` jamais commitée. Les
  deux dérivations s'accordaient sur les seuils `since` (paliers 12, blocs 6, coach 5,
  correspondances 3), ce qui les confirme mutuellement. Deux apports en ont été repris dans
  `validate.ts` : les instants, durées et comptes ne peuvent plus être négatifs, les rangs
  et index doivent être des entiers positifs — et `startedTimezoneOffsetMinutes` est
  explicitement exempté du plancher, parce qu'il est négatif à l'ouest de Greenwich. La
  distinction entre lien de propriété et pointeur de contexte est consignée sur `links` :
  les deux sont comptés, aucun ne refuse le fichier. `schema.ts` a été retiré.
- **Vérification.** `typecheck`, 2 557 tests dans 241 fichiers, `build` et `lint` (le seul
  avertissement restant est le Fast Refresh préexistant de `Boot.tsx`). Aucun essai
  navigateur ni APK.
- **Checkpoint téléphone.** Restaurer une vraie sauvegarde, puis une tronquée à la main
  (vérifier que le message nomme la table et que rien ne bouge) ; séance A avec échauffement
  puis séance B avec charge modifiée ; routine qui porte déjà son échauffement ; tutoriel
  des réglages en Silence ; menu de séance au pouce, clavier ouvert ; premier côté →
  changement → second côté → repos, sans son.

## Fluidité de séance et guidage (2026-09-05)

- Publication : version 2.5.0 préparée sur master ; push et tag v2.5.0 pour publication PWA et génération de l’APK signé par GitHub Actions. Validation fonctionnelle : 2 511 tests réussis avant le changement de numéro de version.
- Échauffement : références précédentes appariées indépendamment des séries de travail ; décharge cohérente avec cette règle. Aucun échauffement historique proposé comme charge de travail.
- Séance : exercice à faire déplié, suivants compacts et librement ouvrables ; fin de séance secondaire avant la dernière validation. Indications visibles côté 1, changement de côté et côté 2, même sans cadence. Repos restauré à son échéance après rechargement, effacé à la sauvegarde/à l'abandon.
- Fiabilité : repos et annonce de validation après écriture réussie, erreur affichée en cas de refus IndexedDB ; sauvegarde finale protégée du double appui et interdite sans série validée.
- Bilan : résumé explicitement basé sur la dernière série, nom/type issus du snapshot ; carte musculaire dépliable après le détail.
- Première ouverture : avertissement vocal avant tout son du tutoriel ; choix visite vocale, silencieuse ou Passer. Passer ouvre directement l'app en silence. Campagne à la demande dans l'aide ; narration interdite aussi en Sons uniquement. Tutoriel des deux côtés indépendant du démarrage d'un chrono, progression existante migrée vers le script 3.
- Exercices : état vide avec filtres corrigé ; création depuis le sélecteur sans perdre les choix ; liste ordonnée de sélection avec retrait.
- UI : libellés plus lisibles, séparation cible/valeur dans les champs, même famille orange en clair, titre Progression cohérent, célébrations après la proposition de séance. Fermeture des feuilles robuste sans événement de transition et retrait immédiat de l'arbre d'accessibilité.
- Vérification finale : 2 511 tests passent dans 238 fichiers ; typecheck et build réussis, lint sans erreur (avertissement Fast Refresh préexistant dans Boot.tsx). Groupes ciblés séance/tutoriel et import/reprise/bilan/migration également vérifiés.
- Reste du backlog d'audit : validation structurelle des sauvegardes avant restauration, automatisation volontaire des échauffements récurrents, simplification plus poussée des commandes expertes et du tutoriel des réglages. **Traités le 2026-09-06** (section du haut).
- Checkpoint téléphone : première ouverture sans surprise sonore ; séance unilatérale sans son, changement de côté lisible ; kill pendant repos ; séance suivante après échauffement ; créer une variante depuis la sélection puis revenir ; vérifier bilan et thème clair. Pas de nouvel essai navigateur/APK, conformément à la préférence utilisateur.

## Revue code et UX (2026-09-05)

- Audit sans modification du code applicatif : `docs/audits/2026-09-05-code-ux-review.md`.
- Complément demandé : appariement par position mélangeant échauffements précédents et séries de travail, choix vocal trop tardif, visibilité des deux côtés sans cadence et adéquation des tutoriels. Constats source, sans nouvelle visualisation ni correctif.
- Approfondissement qualité UI : priorité visuelle de Terminer, densité de séance, commandes expertes, bilan mobile, taille des libellés, continuité des thèmes et vocabulaire. Recommandations ajoutées au même audit, sans refonte appliquée.
- Priorités : erreurs d'écriture silencieuses et validation insuffisante des sauvegardes ; bilan de séries hétérogènes trompeur ; faux état vide avec filtres ; friction tutoriel et ajout d'exercices.
- Typecheck/build réussis ; lint sans erreur (un avertissement). Suite complète interrompue sans bilan après blocage apparent, deux échecs de séance signalés. Vérification ciblée indépendante : 118/119, échec cadence reproduit seul. Aucun commit effectué, suite non verte.
- Checkpoint téléphone : reprendre une séance après kill pendant repos, vérifier le bilan de deux séries différentes, tester recherche + filtre contradictoire et sortie réelle du tutoriel. APK et mode avion restent à vérifier.

## Archives de progression

| Fichier | Contenu |
| --- | --- |
| [journal-2026.md](docs/progress/journal-2026.md) | Sessions 2026 (tutoriel, wiki, investigation) |
| [lots.md](docs/progress/lots.md) | Journaux des lots 0 à 7 |
| [decisions-et-pieges.md](docs/progress/decisions-et-pieges.md) | Décisions, pièges, dette technique |
| [2026-08-29-versions-v0-v1.md](docs/journal/2026-08-29-versions-v0-v1.md) | Versions v0–v1 |

## Checkpoints téléphone encore dus

1. **Programme** — ouvrir un bloc actif puis toucher « Ce qu’en dit le corpus » : l’article du
   Guide correspondant à la phase doit s’ouvrir, sans page d’erreur React Router.
2. **Unilatéral sans cadence** — cocher le premier côté : la coche reste grisée dix secondes,
   affiche le décompte, puis se réactive seule pour valider le second côté sans changer de menu.
3. **Paliers** — Progression › Paliers : jetons-images (Pepe, git gud, stonks…) à la place du
   disque chiffré. L'état vide reste vide. Après une séance qui franchit un palier, la carte
   d'accueil porte le même visuel avec un anneau accent. Thème clair aussi.
4. **Ouverture** — fermer l'app, la relancer à froid : plaques, deux phrases, accueil. Puis forcer
   le terminal (clé `fittrack.bootEasterEggAfter` due) : écran noir, glyphes blancs, comme GRUB.
5. **Tutoriel** — sélecteur de guidage à quatre modes, série unilatérale menée jusqu'au bout.
6. **Première séance / DOMS** — install neuve (ou reset IndexedDB) : enregistrer une
   première séance, voir le Malphite-Chad « Rock solid. » sur l'accueil. APK : 48 h plus
   tard, notif « Tes premières DOMS » puis la porte au tap. Compte actuel : les deux
   paliers sont déjà dans Progression › Paliers, sans carte ni notif.

## Première séance et premières DOMS (2026-08-31)

- Deux paliers de pratique : `sessions-1` (Ta première séance) et `doms-48` (Tes
  premières DOMS), avant les 10 séances. Jetons `rock-solid` et `doms-door`.
- Compte neuf : carte d'accueil à l'enregistrement, puis badge à la relance 48 h plus
  tard. APK seulement : notification locale pile à 48 h si la première séance a été
  fêtée en direct. PWA : pas de pop-up.
- Compte déjà en route : projection v2, rattrapage silencieux, pas de fête.
- Spec : `docs/design/specs/2026-08-31-first-session-doms-paliers-design.md`.
- Vérification : typecheck et build verts. Vitest 2502/2503 ; l'échec restant est
  `ProgramFlow` « Semaine N sur 4 » (date du 3 août 2026, hors de ce lot).

## Documentation des programmes et transition unilatérale (2026-08-30)

- Le lien de preuve d’une phase ne reconstruit plus l’ancienne route supprimée
  `/knowledge/p/:sectionId`. Il résout l’article actuel du Guide et ouvre sa route
  `/knowledge/programmation/:articleId` ; les phases décharge, progression, surcharge et reprise
  sont couvertes.
- La ligne de série unilatérale dérive désormais son état depuis sa propre horloge. Après la
  première coche, le verrou de dix secondes expire donc sans dépendre d’un nouveau rendu du parent
  ni d’un passage par un menu — notamment quand aucune cadence ne fait bouger l’écran.
- Vérification : typecheck et build de production verts. La passe Vitest unique demandée a validé
  2 473 tests sur 2 474, dont les nouvelles régressions ; l’unique échec était une attente exacte
  de 38 s ayant mesuré 39 s. Cette attente a été rendue déterministe après la passe, sans relancer
  la suite conformément à la consigne utilisateur.

## Ouverture simplifiée et terminal GRUB (2026-08-30)

### Ce qui change

- La barre conserve uniquement son chargement de plaques. La chute, la compression, la secousse,
  le sol et la poussière sont supprimés — y compris la « deuxième passe » d'impact encore sur
  `origin/master` au moment de la fusion.
- « Progressive Overload » apparaît, puis « Production was the gym » 180 ms plus tard ; le rideau
  fond ensuite vers l'accueil en opacité seule.
- Durées : 2 180 ms (normal), 3 360 ms (console). Une séance active saute le rideau et **ne
  consomme pas** la date du terminal.
- Une date `fittrack.bootEasterEggAfter` (hors sauvegarde `fittrack:`) programme une variante
  rare tous les 14 à 28 jours. Quatre logs fixes, curseur, `progressive_overload = true`.
  Fond `#000`, glyphes `#fff`, indépendant du thème.
- `prefers-reduced-motion: reduce` : fondus / états statiques, pas de glitch ni de frappe.

### Vérifications

- 17 tests ciblés boot / easter egg verts avant fusion `origin/master`.
- Typecheck, suite et build : à rejouer sur l'arbre fusionné.

## Les paliers (2026-08-29)

Catalogue de 56 seuils acquis à vie, table Dexie `milestones` (schéma 12), rétrospective
d'anniversaire. Aucune notification. Une carte au maximum sur l'accueil.

**Jetons (2026-08-30).** Le disque chiffré cède la place à 22 illustrations originales de mèmes
(`public/milestones/*.jpg`, ~192 px). Mapping dans `src/lib/milestones/art.ts`. Le chiffre reste
dans le titre. Workbox précache les `jpg`. DEV : `?demoPaliers=1` affiche le mur sans écrire en
base. Nintendo dehors. Pepe dedans (feels good, smug, feels bad, rare).

Correctifs origin : un seuil retiré ne fait plus taire les anniversaires ; rattrapage après
import Hevy.

## Découpage de l'écran de séance (2026-08-29)

`WorkoutScreen.tsx` sort les feuilles, les gestes, le chargement et les recherches dans des
modules dédiés. Aucun comportement changé, livré dans v2.4.0.
