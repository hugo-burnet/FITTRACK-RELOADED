# Corriger la documentation d’une phase de programme

## Contexte

La fiche d’un bloc affiche « Ce qu’en dit le corpus » pour les phases documentées. Le lien pointe encore vers `/knowledge/p/:sectionId`, route supprimée lorsque le Guide est passé des sections brutes aux articles structurés. React Router ne trouve donc aucune route et affiche sa page d’erreur développeur.

La recommandation de cette page concernant `errorElement` n’est pas la cause du défaut. Un écran d’erreur personnalisé masquerait seulement le lien mort.

## Comportement attendu

Un appui ouvre l’article actuel du Guide qui contient les fiches de la phase affichée :

- décharge → `programming-deload` ;
- progression → `programming-progression` ;
- surcharge → `programming-volume` ;
- reprise → `programming-fatigue-recovery`.

Les phases construction et test restent sans lien, car le corpus ne leur consacre pas de section précise.

## Conception

`phaseEvidenceFor` conserve la section source utilisée pour le titre et le nombre de fiches. À partir d’une fiche non bibliographique de cette section, il demande au catalogue d’articles quel article la cite, puis utilise `articleHref` pour produire l’adresse publique actuelle. Cette résolution s’appuie ainsi sur les identifiants déclarés dans le corpus, sans dupliquer une seconde table article-par-phase.

Si la section, ses fiches ou l’article correspondant disparaissent lors d’une régénération du corpus, `phaseEvidenceFor` renvoie `null`. La fiche du bloc masque alors le lien au lieu d’en créer un autre qui serait mort.

`ProgramDetailScreen` utilise directement l’adresse résolue par `phaseEvidenceFor`. Il ne construit plus d’URL de connaissance lui-même.

## Tests

Le test de `phaseEvidenceFor` doit d’abord échouer en exigeant les adresses actuelles des quatre phases documentées. Après le correctif, il vérifie aussi que toute preuve renvoyée possède une adresse d’article du Guide valide.

Un test d’intégration de la fiche du bloc vérifie que « Ce qu’en dit le corpus » porte l’adresse de l’article attendu, afin d’empêcher le composant de réintroduire une route codée en dur.

Enfin, le parcours est rejoué dans l’application locale : l’appui doit afficher l’article correspondant sans page d’erreur React Router.

## Hors périmètre

- Aucun changement visuel du bouton.
- Aucun changement des badges ou des paliers.
- Aucune restauration de l’ancienne route `/knowledge/p/:sectionId`.
- Aucun ajout d’écran d’erreur générique dans ce correctif ciblé.
