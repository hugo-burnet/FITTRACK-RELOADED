# Bouton deload pendant une séance — conception

## Objectif

Permettre d'alléger en un geste les charges encore à effectuer pendant une séance en cours. Le
bouton applique 80 % des charges affichées, conserve les performances déjà enregistrées et laisse
une trace explicite dans l'export de la séance.

## Expérience utilisateur

- Le header de la séance en cours affiche un bouton compact `Deload` avec une cible tactile d'au
  moins 48 px.
- Un appui ouvre une confirmation qui annonce la réduction à 80 % et l'arrondi appliqué.
- Après confirmation, le bouton indique que le deload est actif et ne peut plus appliquer une
  nouvelle réduction à la même séance.
- L'action reste reconnue après fermeture ou reprise de l'application.

## Règles métier

- Seules les séries non validées sont modifiées. Une série déjà validée représente ce qui a
  réellement été effectué et reste intacte.
- Seuls les exercices comportant une charge sont concernés. Les répétitions, durées, distances,
  RPE et autres valeurs ne changent pas.
- La charge source est celle que la coche enregistrerait au moment de l'action : `weight` saisi,
  sinon `targetWeight`, sinon la charge de la série de même rang lors de la séance précédente.
- La charge calculée vaut `source × 0,8`, arrondie au multiple de 2,5 kg le plus proche.
- Une série sans charge source reste inchangée.
- L'opération est idempotente : elle ne peut être appliquée qu'une fois par séance.

## Persistance et export

La séance persiste `deloadPercent?: number`, fixé à `80` lors de l'application. Ce champ non indexé
ne demande pas de nouvelle migration IndexedDB. Les charges calculées sont écrites immédiatement
dans les séries concernées, dans une transaction repository, afin qu'un arrêt de l'application ne
laisse pas une application partielle.

La note `Deload — charges réduites à 80 %.` est ajoutée aux notes de séance existantes, séparée
proprement et sans doublon. L'export Markdown actuel inclut déjà les notes de séance : aucune logique
d'export parallèle n'est ajoutée.

## Découpage

- Une fonction métier pure calcule et arrondit une charge de deload.
- Le repository de séance applique atomiquement la transformation, ajoute la note et pose le
  marqueur persistant.
- L'écran de séance fournit le bouton, son état actif et la confirmation, avec tous les textes dans
  `src/i18n/fr.ts`.

## Cas limites et erreurs

- Si aucune série ne possède de charge applicable, aucune valeur n'est modifiée ; la séance n'est
  pas marquée comme deload.
- Si le deload est déjà actif, le repository ne modifie rien.
- Si la transaction échoue, aucune charge, note ou marqueur n'est conservé. Le bouton reste
  disponible pour réessayer.

## Vérification

Les tests couvrent le calcul à 80 %, les arrondis au pas de 2,5 kg, les charges saisies/cibles/
précédentes, l'exclusion des séries validées et sans charge, l'idempotence, l'atomicité, la reprise
de séance et la présence de la note dans l'export. Le test d'intégration du header vérifie la
confirmation et l'état actif du bouton.

Le checkpoint manuel consiste à démarrer une séance réelle, valider une série, activer le deload,
constater que seules les séries restantes changent, fermer puis reprendre l'application et vérifier
la note dans l'export.
