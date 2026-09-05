# Revue code et UX — 5 septembre 2026

Méthode : deux évaluations indépendantes (A : /root/ux_review ; B : /root/technical_evidence), revue source et parcours navigateur local. Aucun correctif applicatif. Parcours visuel arrêté à la demande utilisateur.

## Constats prioritaires

### P1 — Une erreur de sauvegarde reste silencieuse

`src/features/workout/useWorkoutSetActions.ts:153-161` absorbe le rejet de `completeSet`, mais lance immédiatement le repos et l'annonce de validation. `onWrite` absorbe également les erreurs. `src/features/workout/WorkoutFinishScreen.tsx:141-166` annonce la fin avant l'écriture et masque son échec. En cas d'erreur IndexedDB, le retour utilisateur ne permet pas de comprendre que la sauvegarde n'a pas abouti. Défaut confirmé par code et scénario d'erreur existant, pas par panne provoquée dans le navigateur. Attendre le succès avant les signaux de réussite ; afficher un échec persistant avec réessai et conserver les valeurs saisies.

### P1 — Une sauvegarde invalide peut être acceptée pour remplacement intégral

`src/lib/backup/parse.ts:43-45,69-94` accepte des lignes arbitraires et transforme les tables absentes ou malformées en listes vides. Un fichier au format/version attendus contenant uniquement une préférence est accepté ; un schéma futur et une séance `{id:'broken'}` également. Vérification du parseur exécutée en mémoire. `src/data/repositories/backup.ts:106-113` remplace toutes les tables dans une transaction. Cette transaction protège d'une erreur d'insertion, mais pas d'un fichier incomplet accepté et insérable. Aucune restauration réelle effectuée. Valider schéma, champs obligatoires et références avant de proposer le remplacement, en distinguant anciennes tables optionnelles et tables essentielles manquantes.

### P2 — Le bilan présente toutes les séries comme identiques à la dernière

Reproduit : 20 kg × 8 puis 30 kg × 6 donnent « 2 × 6 reps · 30 kg ». Le tonnage de 340 kg et le détail historique restent corrects. `src/features/workout/WorkoutFinishScreen.tsx:257-274` utilise `done.at(-1)` puis `done.length × reading`. Afficher chaque série ou « 2 séries · dernière : … », et regrouper uniquement les séries réellement identiques.

### P2 — La recherche filtrée annonce une absence fictive au catalogue

Reproduit : rechercher squat retourne 9 résultats ; ajouter le filtre Biceps donne « squat n’est ni au catalogue ni dans tes exercices » et propose de le créer. `src/features/exercises/ExerciseBrowser.tsx:213-229` traite la recherche sans tenir compte de la cause du résultat vide. Afficher « Aucun résultat avec ces filtres » et proposer de les retirer avant de créer un exercice.

### P2 — Passer le tutoriel ouvre encore deux étapes

Reproduit : Visite guidée → Passer → Guidage vocal → Silence/Fermer → Ma première séance guidée → Plus tard. Le message « La visite est terminée » apparaît même après refus. `src/features/tutorial/TutorialProvider.tsx:174-181,204-215,256-257`. Faire de Passer une sortie réelle ; garder les autres aides disponibles à la demande.

### P2 — L'exercice manquant ne peut pas être créé au moment de l'ajouter

`src/features/workout/WorkoutAddExerciseScreen.tsx:59-64` et `src/features/routines/ExercisePickerScreen.tsx:82-104` ne passent pas `onCreate` au navigateur d'exercices. Il faut quitter la composition pour créer une variante au catalogue puis revenir. Constat source. Ajouter « Créer et ajouter » en préservant les exercices déjà sélectionnés.

### P2 — La sélection multiexercices doit être mémorisée

Les recherches successives conservent la sélection mais ne montrent qu'un compteur ; pas de liste récapitulative ni d'ordre consultable avant ajout. Sources : `ExercisePickerScreen.tsx:66-78`, `WorkoutAddExerciseScreen.tsx:46-56`. Proposer une liste « Sélection (N) » permettant de revoir et retirer les choix sans refaire les recherches.

### P2 — Une séance vide est enregistrée malgré le texte contraire

`src/i18n/fr.ts:499` promet « Aucune série validée. Rien ne sera enregistré. » mais le bouton de sauvegarde est actif et `workoutLifecycle.ts:286` passe la séance à completed. Le test existant de `WorkoutFinishScreen` confirme ce comportement. Cela peut gonfler historique et compteur hebdomadaire. Soit ne pas enregistrer une séance vide, soit rendre explicite son enregistrement et son traitement statistique.

### P2 — La reprise perd le repos en cours

Reproduit : validation → repos 2:00 → rechargement après environ 13 secondes → série conservée mais repos disparu. `src/stores/restTimer.ts:5-10,40-43` documente un état volontairement éphémère. Amélioration de résilience, pas perte de série ni régression établie. Persister l'échéance et l'identifiant de série afin de restaurer le temps restant.

## Appréciation UX

## Complément — continuité des séances et accompagnement

### P1 — L'échauffement précédent peut alimenter une série de travail

Constat source confirmé après signalement utilisateur : `workoutHistory.ts:46-49` retourne toutes les séries validées, échauffements inclus, par ordre. `WorkoutExerciseCard.tsx:471` les associe aux séries actuelles via `previous[index]`. Les échauffements ajoutés par `insertWarmupSets` ne modifient que la séance, alors que la suivante est construite depuis la routine (`workoutLifecycle.ts`). Exemple : A contient échauffement 20 kg puis travail 60 kg ; B repart de la routine sans cet échauffement, et sa première série de travail reçoit la référence 20 kg. En l'absence de cible de charge, `WorkoutSetRow.tsx` utilise cette référence comme valeur proposée, validable. Non reproduit dans le navigateur lors de ce complément. Séparer l'appariement échauffement/travail et leurs rangs ; ne jamais recopier un échauffement comme référence de travail. La mémorisation volontaire d'une montée d'échauffement est un besoin distinct, à proposer explicitement plutôt qu'à confondre avec cet appariement.

### P2 — Le choix vocal arrive après le déclenchement possible de la narration

Le texte initial mentionne déjà la voix, mais `TutorialProvider.tsx:143-147` joue une narration dès l'ouverture du choix vocal, y compris après Passer. Le réglage arrive donc trop tard pour garantir une découverte silencieuse. Proposition : avant toute narration du premier lancement, message explicite « FitTrack peut te guider à voix haute », avec choix de continuer avec ou sans voix ; conserver ce choix et permettre de le changer. Une simple mention noyée dans le tutoriel ne suffit pas.

### P2 — Le changement de côté reste insuffisamment explicite sans cadence

`WorkoutSetRow.tsx:108-119,253-291` distingue premier côté, transition et second côté, mais le bouton visible reste la même coche ; le libellé détaillé est surtout accessible via aria-label. Le compteur visible est porté par les rails de cadence/maintien, ce qui ne fournit pas une indication équivalente lorsqu'ils ne sont pas actifs. La réactivation après dix secondes existe déjà : le problème est la compréhension, pas uniquement le déblocage. Proposition : afficher indépendamment du son et de la cadence « Côté 1 sur 2 », puis « Change de côté · N s », puis « Côté 2 sur 2 ». Ne montrer la série terminée qu'après les deux côtés. Toute annonce indispensable doit avoir son équivalent visuel.

### P2 — Les tutoriels doivent couvrir les situations réelles et le mode choisi

La mission unilatérale `WORKOUT_HOLD_SIDES` de `missions/workout.ts:233-285` enseigne le maintien avec chrono ; elle ne suffit pas à expliquer une série unilatérale en répétitions sans cadence. Le provider tient déjà compte de certains faits (séance active, cadence, effort), mais cela ne démontre pas une couverture adaptée de chaque parcours. À vérifier/couvrir : répétitions sans voix, changement de côté sans cadence, ajout d'échauffement et reprise à la séance suivante, sortie/reprise du tutoriel. Proposition : aides courtes déclenchées au premier besoin, qui attendent le geste réel, restent facultatives et ne demandent pas d'activer un mode que l'utilisateur a choisi de couper.

## Appréciation UX (suite)

La présentation sombre et l'accent orange sont cohérents ; cinq destinations nommées et actions basses facilitent l'orientation. Aucun défaut esthétique majeur de type interface générique n'est prioritaire. Le principal problème est le coût des transitions : découvrir seul, ajouter une variante et vérifier ce qui vient d'être enregistré.

Scores heuristiques exploratoires, limités aux surfaces inspectées :

| Heuristique | /4 |
|---|---:|
| Visibilité de l'état | 3 |
| Langage du monde réel | 3 |
| Contrôle et liberté | 2 |
| Cohérence | 3 |
| Prévention des erreurs | 2 |
| Reconnaissance plutôt que mémoire | 2 |
| Efficacité | 2 |
| Esthétique et minimalisme | 3 |
| Récupération après erreur | 2 |
| Aide | 3 |
| Total | 25/40 |

Nouveau venu : les trois modales retardent l'accès à l'action. Sportif distrait : les sélections invisibles et le détour pour créer une variante demandent trop de mémoire. Le point le plus utile à améliorer est le parcours « je suis devant une machine, j'ajoute ce que je fais maintenant ».

## Vérifications et limites

- Navigateur local avec données de test : onboarding, modèle Poussée, démarrage, deux séries, rechargement, fin, sauvegarde, historique, recherche et filtre exercices. Inspection de progression et début du formulaire programme ; ces derniers parcours ne sont pas validés de bout en bout. Vue desktop et viewport mobile 390 × 844, sans téléphone réel.
- Typecheck et build réussis. Lint : aucune erreur, un avertissement Fast Refresh dans `src/app/Boot.tsx:13`.
- Suite complète lancée : deux échecs signalés dans `WorkoutScreen.integration.test.tsx`, puis absence de progression ; arrêt sans résultat global. Une tentative excluant ce fichier a également été interrompue sans résultat exploitable. Ne pas présenter la suite complète comme passée.
- Vérification ciblée indépendante : 118/119 tests passent ; l'échec « ne lance pas une prescription fantôme quand les prochaines reps sont vides » est reproduit seul. Symptôme : après fin du repos puis saisie des répétitions, la cadence ne se réarme pas. Cause de production non établie.
- Détecteur Impeccable : trois alertes broken-image, toutes faux positifs sur des commentaires `<img>` dans `src/platform/chartImage.ts:10,21,41`. Aucun overlay injecté : l'évaluation navigateur disponible est en lecture seule.
- APK, clavier Android, audio réel, interruption par appel, restauration destructive, mode avion sur build PWA et totalité des programmes/imports non testés. Pas de certification d'accessibilité ou de fonctionnement hors-ligne complet.

Ordre recommandé : fiabilité des écritures et restauration ; exactitude bilan/recherche/séance vide ; création et sélection d'exercices ; onboarding et reprise du repos.

## Qualité perçue et UI — approfondissement

Constats de structure et recommandations produit, à distinguer des bugs reproduits. Fondés sur le code actuel et les captures précédentes, sans nouveau parcours visuel.

- **Hiérarchie pendant la séance.** `WorkoutScreen.tsx` maintient Terminer en grande bande d'accent dès la première série ; les validations répétées sont de petites coches. Réserver la dominante visuelle à la série en cours et au repos ; conserver Terminer accessible mais secondaire avant la fin.
- **Densité et attention.** `workoutFold.ts` ouvre tous les exercices par défaut ; le modèle Poussée affiche six blocs et dix-neuf séries. Proposer une vue centrée sur l'exercice en cours, la suite compacte et les exercices terminés repliables. Garder la liberté d'exécution dans un autre ordre, sans déplacement automatique pendant la saisie.
- **Commandes expertes trop permanentes.** Le bandeau de séance expose 80 %, cadenas et repliage. Les cibles tactiles sont larges mais le sens des icônes demande de l'apprentissage. Faire apparaître les libellés dans les menus/contextes appropriés et donner la place permanente aux états utiles maintenant.
- **Bilan mobile.** La capture 390 × 844 montre une grande carte musculaire avant le détail des exercices, lequel sort du premier écran. Remonter le résultat lisible et la vérification des séries ; rendre la carte anatomique secondaire/dépliable.
- **Accueil et priorité à la reprise.** `HomeScreen.tsx` rend le palier avant la suggestion de séance. Les célébrations devraient préserver l'accès immédiat à la prochaine action, particulièrement à la reprise d'une séance.
- **Lisibilité fine.** `label-xs` définit des capitales de 11 px espacées ; cela convient moins aux informations à lire pendant l'effort. Réserver ce style aux annotations, augmenter les indications utiles et différencier nettement objectif proposé, valeur saisie et série validée. Contraste mesuré sur téléphone restant à vérifier.
- **Identité des thèmes.** `index.css` passe de l'orange en sombre au vert en clair. Choix possible, mais il transforme la signature de l'app. Une même famille d'accent adaptée aux contrastes renforcerait la continuité, sauf préférence explicite pour deux identités.
- **Cohérence des mots.** Les destinations Planifier/Routines, Progression/Analyses et Programmes/blocs sont compréhensibles séparément mais imposent des traductions mentales. Stabiliser les intitulés de destination et expliquer les notions métier au premier besoin.
- **Confiance discrète.** Compléter les corrections de persistance par un état Enregistrement/Enregistré/Échec, attaché à l'action concernée et sans notifications envahissantes. L'absence de réseau ne doit pas donner l'impression d'une panne quand l'app est prête hors-ligne.

Direction recommandée : conserver la palette sombre et la navigation familière, mais faire de la séance une interface qui indique immédiatement où l'on en est, ce qui vient d'être enregistré et quel geste vient ensuite. Priorité à la hiérarchie, aux états et à la continuité avant les effets décoratifs.
