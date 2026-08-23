# curated/

Source de vérité validée.

Dans ce paquet de contrat, les instances curées vivent dans `fixtures/golden-set/`, seul emplacement que le
validateur parcourt. Les dupliquer ici ferait exister deux versions d'une même entité, qui finiraient par
diverger — et pour une règle clinique, deux versions contradictoires sont pires qu'une règle absente.

Arborescence prévue en production :

```text
curated/
├── epistemic/   claims, sources, assessments, conflicts, gaps
├── training/    variables et heuristiques de programmation
├── anatomy/     muscles, régions, articulations, actions
├── exercises/   exercices, variantes, observations, substitutions
└── clinical/    conditions, symptômes, red flags, règles générales
```

Le clinique est modélisé en dernier et soumis aux contrôles les plus stricts : provenance obligatoire, date
de revue obligatoire, fondement énuméré pour toute interdiction, et priorité inconditionnelle des red flags.
