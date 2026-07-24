# RF-28 — Plaques disponibles configurables

**Date :** 2026-07-24
**Lot :** 6, correction de clôture de la tranche 2
**Périmètre :** sélection durable des dénominations de plaques disponibles. Aucun comptage des
paires et aucun autre réglage du Lot 8.

## 1. Constat et objectif

Le moteur de RF-28 accepte déjà un inventaire de plaques, mais l’interface lui fournit toujours
l’ensemble olympique par défaut. Dans une salle sans plaques de 25 kg, le calculateur propose donc
une combinaison exacte mais physiquement inutilisable.

L’utilisateur doit pouvoir activer ou désactiver librement chaque dénomination depuis la feuille
« Plaques à charger ». Cette sélection représente le matériel de la salle : elle est globale,
persistée dans IndexedDB et réutilisée pour les séances suivantes.

Le résultat attendu est immédiat : retirer 25 kg recalcule tous les schémas ouverts sans plaque de
25 kg ; fermer l’application puis la rouvrir conserve ce choix.

## 2. Décision de produit

La configuration vit d’abord là où le besoin apparaît, dans « Plaques à charger ». Une section
repliable « Plaques disponibles » se trouve une seule fois au-dessus des schémas de charge, après
le réglage éventuel du poids de barre.

Cette approche est retenue face à deux alternatives :

- un réglage uniquement dans l’écran Réglages serait moins découvrable et anticiperait une part
  plus large du Lot 8 ;
- une sélection éphémère obligerait à retirer les mêmes plaques à chaque séance et contredirait le
  besoin validé.

Le Lot 8 exposera plus tard la même valeur dans son écran central. Il ne créera ni une deuxième
source de vérité ni une migration de données.

## 3. Dénominations et règles

La liste configurable est la liste canonique déjà utilisée par le moteur, dans cet ordre :

`25`, `20`, `15`, `10`, `5`, `2,5`, `1,25`, `1`, `0,5`, `0,25 kg`.

Règles :

- chaque dénomination est soit sélectionnée, soit désélectionnée ;
- une dénomination peut être resélectionnée à tout moment ;
- aucun nombre de paires n’est demandé : une dénomination sélectionnée reste disponible sans
  plafond, comme aujourd’hui ;
- zéro dénomination sélectionnée est un état valide ; le calculateur affiche alors la barre nue et
  le poids manquant au lieu d’inventer une plaque ;
- aucune dénomination personnalisée n’est ajoutée dans cette correction ;
- la sélection s’applique aux barres, aux Smith et aux machines à plaques qui utilisent le
  calculateur ;
- le poids de barre conserve son contrat actuel : valeur éphémère par exercice, perdue à la
  navigation ou au rechargement.

Pour un utilisateur existant qui n’a encore rien configuré, toutes les dénominations sont
sélectionnées. Le comportement actuel est donc conservé jusqu’au premier changement explicite.

## 4. Interface

La section « Plaques disponibles » est repliable pour ne pas repousser les schémas à chaque
ouverture. Son résumé indique l’état courant, par exemple « 9 sur 10 ».

Une fois dépliée, elle affiche les dix poids sous forme de boutons de sélection :

- texte en kilogrammes, formaté avec la virgule française ;
- cible tactile d’au moins 48 px ;
- `aria-pressed` pour porter l’état sélectionné ;
- sélection lisible par la forme, la bordure et la graisse, sans dépendre uniquement de la couleur ;
- focus neutre et visible ;
- aucun usage de l’accent réservé aux records et aux séries validées.

Un appui met à jour la sélection et recalcule immédiatement chaque charge distincte affichée dans
la feuille. La configuration n’ajoute aucun bouton de confirmation : chaque bascule est persistée
au moment où elle est faite, conformément au fonctionnement local-first de l’application.

Si aucune plaque n’est sélectionnée, la section l’indique explicitement. Les blocs de calcul
continuent de rendre la charge atteinte et le poids manquant grâce au contrat existant de
`computePlateLoad`.

Tous les textes vivent dans `src/i18n/fr.ts`.

## 5. Persistance et flux de données

La table `settings`, déjà présente dans le schéma Dexie, stocke une entrée dédiée :

```ts
{
  key: 'availablePlateWeightsKg',
  value: number[],
  updatedAt: number
}
```

L’accès passe exclusivement par un repository dans `src/data/repositories/`. Les composants
n’importent jamais `db` directement.

À la lecture, le repository :

1. retourne la liste canonique complète si l’entrée n’existe pas ;
2. accepte uniquement un tableau ;
3. conserve seulement les nombres finis, strictement positifs et présents dans la liste canonique ;
4. retire les doublons ;
5. remet les valeurs dans l’ordre canonique ;
6. considère un tableau vide comme une configuration valide ;
7. revient à la liste canonique complète si la valeur stockée n’est pas un tableau exploitable.

À l’écriture, le repository applique la même normalisation puis écrit la valeur et `updatedAt` dans
une seule opération Dexie. Aucun changement de schéma ni migration n’est nécessaire.

`WorkoutScreen` lit la configuration de manière réactive et la transmet à `PlateLoadSheet`.
`PlateLoadSheet` transforme les poids sélectionnés en inventaire pour chaque appel à
`computePlateLoad`. Une modification réussie réveille la lecture Dexie et recalcule tous les blocs.

Si l’écriture échoue, la sélection persistée reste la source de vérité, la feuille reste ouverte et
affiche une erreur localisée. Aucun état partiellement enregistré ne doit survivre.

## 6. Contrats conservés

Cette correction ne modifie pas :

- l’algorithme pur de `computePlateLoad` ;
- l’ordre glouton du plus lourd au plus léger ;
- le signalement d’un reste impossible à charger exactement ;
- la gestion des charges sous le poids de barre ;
- les équipements éligibles au calculateur ;
- le poids de barre réglable de RF-31 ;
- les séries, routines ou exercices stockés.

Le moteur sait déjà recevoir `inventory: PlateInventory`. La correction relie cette capacité à une
configuration utilisateur durable.

## 7. Tests

### Repository

Les tests sont écrits et exécutés en rouge avant l’implémentation :

- absence de réglage → liste canonique complète ;
- sauvegarde d’une sélection sans 25 kg → même sélection après nouvelle lecture ;
- tableau vide → état vide conservé, sans retour automatique au défaut ;
- doublons et ordre arbitraire → liste dédupliquée et réordonnée ;
- valeur non-tableau ou entièrement invalide → repli sur la liste canonique ;
- `updatedAt` est renouvelé à chaque écriture.

### Interface

Les tests de composant couvrent :

- toutes les plaques sont sélectionnées par défaut ;
- désélectionner 25 kg appelle l’écriture avec la liste correcte ;
- un inventaire sans 25 kg recalcule 100 kg sur une barre de 20 kg en `2 × 20` par côté ;
- resélectionner 25 kg rétablit le calcul `25 · 15` ;
- zéro plaque sélectionnée affiche la barre nue et le poids manquant ;
- les boutons exposent correctement leur état avec `aria-pressed`.

### Vérification réelle

Sur téléphone :

1. ouvrir une charge de 100 kg avec une barre de 20 kg ;
2. déplier « Plaques disponibles » et désélectionner 25 kg ;
3. vérifier que le schéma devient immédiatement `2 × 20 kg` par côté ;
4. fermer puis rouvrir la feuille : 25 kg reste désélectionné ;
5. naviguer ou recharger complètement l’application : le choix reste conservé ;
6. ouvrir les plaques d’un autre exercice : la même sélection globale s’applique ;
7. resélectionner 25 kg : le schéma redevient `25 + 15 kg` par côté ;
8. vérifier l’absence de débordement horizontal et des cibles d’au moins 48 px.

Après ce checkpoint, RF-28 et le Lot 6 peuvent être officiellement clôturés dans `PROGRESS.md`.

## 8. Hors périmètre

- nombre de paires disponibles par dénomination ;
- ajout, suppression ou renommage de dénominations personnalisées ;
- inventaires différents par salle ou par équipement ;
- poids de barre global persistant ;
- unités en livres ;
- écran central de réglages du matériel ;
- export/import des réglages.

Ces éléments restent au Lot 8. Cette correction ne sort de ce lot que la sélection durable des
dénominations déjà connues, exigée par l’usage réel de RF-28.
