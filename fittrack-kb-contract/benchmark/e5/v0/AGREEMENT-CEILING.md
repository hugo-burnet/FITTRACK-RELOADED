# Plafond inter-annotateur — quels seuils sont atteignables

Les seuils des gates viennent du Design Review. Ils ont été fixés *avant* qu'on sache
à quel point deux annotateurs humains convergent sur ces axes. Ce document mesure cette
convergence et en déduit lesquels sont atteignables.

Méthode : les annotations de A et de B sont comparées **avec le comparateur qui note le
modèle**, sur les 30 fragments doublement annotés. C'est le point essentiel — si on
notait les humains autrement, « le modèle fait 0,69 » et « les humains font 0,97 » ne
seraient pas comparables. Commande : `npm run measure:e5-agreement`.

## Contrôle de l'instrument

Comparée à elle-même, la GOLD arbitrée donne précision, rappel, `knowledgeType` et
`epistemicStatus` à 1,0000, et sur-fusion comme sur-découpage à 0,0000. L'instrument
n'a donc pas de bruit propre contre la référence qui note le modèle : **les écarts du
modèle sont réels**, pas des artefacts de mesure.

Une réserve, épinglée par un test : dans `frag.e5f3.00000822`, l'annotateur B pose six
claims sur un span identique `[78,298]`. La détection de fusion est purement spatiale et
ne peut pas les distinguer, ce qui plancherise la métrique de fusion à 0,0808 pour B
seul. La GOLD arbitrée ne partage aucun span, donc cette réserve ne touche que la
mesure du plafond humain, pas la notation du modèle.

## Accord humain mesuré, 30 fragments doublement annotés

| Axe | Humains | Seuil | Verdict |
|---|---:|---:|---|
| `knowledgeTypeAccuracy` | 0,9524 | 0,90 | seuil atteignable |
| `epistemicStatusAccuracy` | 0,9116 | 0,85 | seuil atteignable |
| `claimRecall` | 0,9140 | 0,85 | seuil atteignable |
| `mergedClaimRate` | 0,0280 | 0,03 | atteignable, mais serré |
| `overFragmentationRate` | 0,0280 | 0,05 | seuil atteignable |
| `claimPrecision` | 0,9140 | 0,95 | **seuil au-dessus des humains** |
| `citationRecall` | 0,8451 | 0,90 | **seuil au-dessus des humains** |
| `citationPrecision` | 0,8451 | 0,97 | **seuil au-dessus des humains** |
| `unresolvedPreservation` | 0,5699 | 0,90 | **seuil très au-dessus des humains** |

## Modèle contre humains, sur les 11 fragments communs

Comparaison exacte : mêmes fragments, même comparateur, même GOLD.

| Axe | Modèle v0.4 | Humains | Seuil |
|---|---:|---:|---:|
| `knowledgeTypeAccuracy` | 0,6923 | 0,9722 | 0,90 |
| `epistemicStatusAccuracy` | 0,5000 | 0,9143 | 0,85 |
| `claimRecall` | 0,7105 | 0,9867 | 0,85 |
| `mergedClaimRate` | 0,2500 | 0,0267 | 0,03 |
| `unresolvedPreservation` | 0,1364 | 0,5600 | 0,90 |
| `citationPrecision` | **1,0000** | 0,9020 | 0,97 |

## Ce que ça dit

Il faut séparer deux choses qu'on avait tendance à confondre.

**Les axes où les humains convergent.** `knowledgeType` à 0,97, `epistemicStatus` à
0,91, le rappel à 0,99, la fusion à 0,027. Sur ces axes la tâche est bien définie : deux
personnes lisant le même fragment aboutissent au même résultat. Le modèle y est très
en dessous — 0,69, 0,50, 0,71, 0,25. **Ce sont de vrais écarts, et ils sont réductibles.**
Ce n'est pas de la subjectivité irréductible, c'est un défaut de protocole d'extraction.

**Les axes où les humains ne convergent pas.** `unresolvedPreservation` à 0,57 contre un
seuil de 0,90 : deux annotateurs entraînés ne s'accordent qu'une fois sur deux sur le
moment où un axe doit rester `UNRESOLVED`. Un seuil à 0,90 y demande au modèle d'être
plus cohérent avec l'arbitre que les annotateurs ne l'ont été entre eux. Ce n'est pas un
objectif ambitieux, c'est un objectif incohérent. Le problème est en amont : la
consigne d'annotation elle-même ne tranche pas assez.

**Un axe où le modèle bat les humains.** Sa précision de citation est de 1,0000 sur les
11 fragments communs, contre 0,9020 d'accord humain. Les citations sont fermées et
vérifiables — le modèle n'a pas à juger, il a à recopier, et il le fait mieux.

## Seuils proposés

Un seuil ne devrait jamais dépasser l'accord humain mesuré sur le même axe.

| Axe | Seuil actuel | Proposé | Motif |
|---|---:|---:|---|
| `knowledgeTypeAccuracy` | 0,90 | 0,90 | humains à 0,95, marge suffisante |
| `epistemicStatusAccuracy` | 0,85 | 0,85 | humains à 0,91 |
| `claimRecall` | 0,85 | 0,85 | humains à 0,91 |
| `overFragmentationRate` | 0,05 | 0,05 | humains à 0,028 |
| `mergedClaimRate` | 0,03 | 0,03 | humains à 0,028 — garder, mais c'est serré |
| `claimPrecision` | 0,95 | 0,90 | humains à 0,914 |
| `citationRecall` | 0,90 | 0,85 | humains à 0,845 |
| `citationPrecision` | 0,97 | 0,90 | humains à 0,845 ; le modèle est déjà au-dessus |
| `unresolvedPreservation` | 0,90 | — | **à retirer des gates** tant que la consigne d'annotation ne fait pas mieux que 0,57 |

Le dernier point est le seul qui demande un travail hors code : décider quand un axe doit
rester `UNRESOLVED` est une règle d'annotation, pas un réglage de modèle. Tant qu'elle
n'est pas tranchée, la mesurer par une gate revient à noter du bruit.

## Limites de cette mesure

30 fragments, sélectionnés comme difficiles avant annotation — le plafond réel sur du
texte ordinaire est probablement plus haut. Un seul couple d'annotateurs, donc l'accord
mesuré est un point, pas une distribution. Et le plafond de fusion est légèrement
pessimiste à cause des spans partagés de B décrits plus haut.

## Profils de seuils

Les seuils du Design Review ne sont **pas** écrasés. Baisser une cible après l'avoir
ratée, c'est déplacer les poteaux, et un run doit pouvoir être relu contre la cible
affichée quand il a tourné. `benchmarkPass` accepte donc un `thresholdProfile` :

- `design-review` (défaut) : le gel d'origine, inchangé.
- `human-ceiling` : les trois seuils mesurés au-dessus de l'accord humain sont ramenés
  à celui-ci (`claimPrecision` 0,95 → 0,90 ; `citationPrecision` 0,97 → 0,90 ;
  `citationRecall` 0,90 → 0,85), et `unresolvedFidelity` sort du verdict tout en
  restant rapporté, avec le motif `below_measured_inter_annotator_agreement`.

Les gates de sûreté et de rejet global sont identiques dans les deux profils. Elles ne
se négocient pas.

### Ce que le profil ne sauve pas

Appliqué au run DEV-20 réel, le profil `human-ceiling` fait passer les gates en échec de
13 à 11. **Le verdict reste NO.** Assouplir les seuils incohérents ne rend pas le run
acceptable — ça rend seulement la mesure honnête. Les onze échecs restants sont de vrais
écarts sur des axes où deux humains convergent : rappel, `knowledgeType`,
`epistemicStatus`, sur-fusion, sur-découpage.

C'est la réponse à la question « faut-il assouplir les seuils ? » : non, ça ne change
rien au fond. Le travail est dans le protocole d'extraction.
