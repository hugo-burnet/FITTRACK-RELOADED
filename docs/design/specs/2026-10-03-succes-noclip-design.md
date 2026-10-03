# Le succès « noclip »

**Date :** 2026-10-03

**Statut :** à implémenter. Le comportement est celui demandé le 2026-10-03 (« quand tu vois le grub au
moins une fois, le succès est noclip, avec un logo Matrix ou ce genre de conneries ; moi je l’aurai déjà
débloqué donc ça se met dans mon historique de succès simplement ») ; les choix que la demande ne tranchait
pas sont dans « Décisions retenues », avec leur coût si l’on change d’avis.

**Périmètre :** un palier secret, son jeton, son octroi.

**Prérequis :** `2026-10-03-tty1-debloque-et-boot-complet-design.md` (le déblocage de TTY1, dont ce
succès est la mémoire datée), `2026-08-30-milestone-meme-tokens-design.md` (les jetons d’image) et la
projection des paliers, `src/data/repositories/milestones.ts`.

## Objectif

Débloquer TTY1 — avoir vu la console au moins une fois — donne un succès : **noclip**, avec pour jeton une
pluie de code vert façon Matrix. Pour qui a déjà TTY1, comme l’utilisateur, il s’inscrit simplement dans
son historique, sans cérémonie.

## Décisions retenues

1. **Ce succès est un palier.** L’app n’a pas d’autre système de succès : les paliers (Analyses >
   Paliers) sont l’historique que l’utilisateur appelle ainsi, avec leur écran, leur carte d’accueil,
   leurs jetons en image et leur place dans la sauvegarde. Un second système doublerait tout cela. Il
   entre au catalogue comme le cinquante-neuvième, sous le plafond de soixante que `catalogue.test.ts`
   garde exprès bas.
2. **Un nouveau genre, `secret`, que rien dans l’historique ne franchit.** Le moteur l’ignore. La
   synchronisation, qui retire toute ligne qu’aucune séance ne justifie, doit le laisser en place : sans
   cela, la première séance terminée effacerait le succès. Un secret n’est jamais annoncé avant d’être
   acquis — c’est déjà la règle de l’écran, qui ne montre que ce qui est acquis.
3. **La source du déblocage est celle de TTY1.** noclip est acquis **si et seulement si** TTY1 est
   débloqué : une seule vérité, le drapeau, dont la ligne n’est que la mémoire datée. Les trois chemins de
   déblocage — la console rare, l’ancienneté, le thème déjà choisi — donnent donc le succès, sans qu’aucun
   n’ait à le savoir. Le coût du choix inverse (une seconde condition propre au succès) serait deux
   vérités qui divergent.
4. **Célébré en direct, silencieux en rattrapage.** Quand la console rare vient de débloquer TTY1, la ligne
   naît non acquittée : l’accueil montre la carte « Palier franchi » avec le jeton. Dans tous les autres cas
   — l’installation qui passe les 30 jours, le thème déjà TTY1 à la mise à jour — la ligne entre acquittée,
   consultable dans l’écran des paliers et muette ailleurs : c’est la règle du rattrapage de l’historique,
   pour la même raison (une célébration qui n’a pas de moment n’en est pas une). Elle est **datée du jour
   où l’app l’écrit** : on ne sait pas quand ces utilisateurs ont vu la console, et une date inventée
   serait pire que celle-là.
5. **`workoutId` vaut `''`**, le « pas de parent » du modèle — la validation de sauvegarde le lit ainsi
   (`validate.ts` : « `''` est le “pas de parent” du modèle »). Aucune séance ne l’a franchi.
6. **Le jeton est une image comme les autres** : un JPEG embarqué dans `public/milestones/`, une clé d’art,
   une légende. Il est dessiné par un script reproductible : une pluie de glyphes, **sans police** — les
   glyphes sont des traits dessinés, pour que le jeton ne dépende pas de ce que l’appareil sait afficher.
   Il fait 384 px de côté et non 192 : une pluie floue n’est plus une pluie, et le jeton est montré en
   grand dans la feuille du bas. Les mèmes d’origine sont des illustrations ; celui-ci est une image
   générée, qui n’emprunte rien à personne.
7. **Un rayon à part, « Secrets »**, après Volume. Il n’existe à l’écran qu’une fois un secret acquis.
8. **Le nom est `noclip`, en minuscules.** C’est une commande — comme tout ce que l’ouverture TTY1 écrit
   — et la triche qui traverse les murs. La légende, sous le jeton en grand, fait le lien avec Matrix :
   « Il n’y a pas de mur. Il n’y a pas de cuillère. »

## Ce qui ne change pas

- Aucun palier existant, aucun seuil, aucun calcul du moteur ni de la projection. Une séance terminée, un
  import, une réparation d’historique ne touchent pas à noclip.
- Aucune table, aucun index, aucune version de schéma, aucun changement de sauvegarde : la ligne est une
  ligne de `milestones` comme les autres, et le format de sauvegarde la porte déjà.
- Le déblocage de TTY1 et sa révélation dans la console rare : le succès s’y ajoute, il n’y change rien.
- Hors-ligne, sans compte, sans réseau.

## Comportement utilisateur

| Situation | noclip |
|---|---|
| La console rare vient de débloquer TTY1 | **acquis, célébré** : carte « Palier franchi » sur l’accueil |
| TTY1 déjà débloqué à la mise à jour (thème TTY1, 30 jours d’usage, console déjà vue) | acquis, **silencieux**, daté du jour de la mise à jour |
| TTY1 verrouillé | rien — et rien n’en laisse deviner l’existence |
| Une séance se termine, un historique s’importe | inchangé |

Dans l’écran des paliers, sous le rayon « Secrets », la ligne se lit `noclip`, puis « le 3 octobre 2026 ».
Toucher sa ligne ouvre le jeton en grand et sa légende.

## Architecture

### Le genre et le catalogue

`MilestoneKind` gagne `'secret'` et `MilestoneGroup` gagne `'secret'`. Le catalogue écrit
`NOCLIP_MILESTONE_ID = 'noclip'` et une définition `{ kind: 'secret', group: 'secret', threshold: 1 }`
— sans exercice ni sujet, comme les jalons de pratique. `earnMilestones` ne le rend jamais, quel que soit
l’historique.

### Le dépôt

`grantSecretMilestone(definitionId, { celebrate, now })` écrit la ligne **une fois** : un second appel ne
fait rien, et rend `undefined`. Il ne s’applique qu’à un identifiant dont la définition est de genre
`secret` : un palier d’entraînement appartient à la projection, jamais à un appel à la main.

`syncMilestones` laisse en place les lignes de genre `secret` au lieu de les retirer comme orphelines. Un
palier retiré du catalogue, lui, reste retiré comme avant.

### L’octroi

`src/app/noclip.ts`, `grantNoclipIfUnlocked(storage, { celebrate })` : lit le drapeau de TTY1 et, s’il est
levé, accorde noclip. Il ne lève jamais : un succès qui ne s’écrit pas ne doit pas empêcher l’app de
s’ouvrir, et il s’écrira au démarrage suivant.

`main.tsx` l’appelle deux fois :

- **à la fin d’une console rare jouée jusqu’au bout**, après `unlockTty1`, avec `celebrate` vrai si la
  console vient de débloquer TTY1 (`unlocking`) et faux sinon ;
- **après l’initialisation de la base**, après le déblocage par l’ancienneté, avec `celebrate` faux : c’est
  le rattrapage, qui écrit la ligne de qui avait TTY1 avant ce succès.

### L’affichage

`MilestonesScreen` range un rayon de plus. `milestoneReading` lit le titre d’un secret dans `fr.ts`
(`milestone.secret.<id>`) ; `fr.ts` reçoit le nom du rayon, le titre et la légende du jeton.

### Le jeton

`MILESTONE_ART_KEYS` et la table d’art gagnent `noclip`. `scripts/milestone-art/noclip.py` dessine la
pluie (Python, sans dépendance, graine fixe) et l’encode en JPEG avec ImageMagick, comme
`scripts/tty1-font/` est l’outil de la police : hors de `package.json`, mais dans le dépôt, parce que
sans son générateur personne ne saurait refaire l’image. Le fichier est précaché par le glob `jpg` qui
sert déjà les autres jetons.

## Limites connues

- **La date de qui l’avait déjà** est celle de la mise à jour, pas celle où il a vu la console. Elle n’est
  pas retrouvable.
- **Une console rare et un rattrapage qui se croisent**, quand la base met plus de temps à s’ouvrir que la
  console à se jouer, peuvent faire naître la ligne acquittée au lieu d’en faire une carte. Cela ne se voit
  qu’au premier lancement d’une installation neuve, où la console rare n’est jamais due.
- **La rétrospective de l’accueil** : un an plus tard, elle peut rappeler noclip comme n’importe quel
  palier (« Il y a un an, tu franchissais ce palier »). C’est voulu, et drôle.
- **Le jeton est une image générée**, pas un hommage reconnaissable à un film précis : il dit « pluie de
  code vert », ce que tout le monde lit comme Matrix.

## Vérification

Du TDD sur ce qui a une logique :

- le catalogue (un secret, dans son rayon, sans sujet) et le moteur (jamais rendu) ;
- la lecture d’un secret et le rayon de l’écran ;
- l’art (une clé, un fichier, une légende, utilisé une seule fois) ;
- le dépôt : une ligne, une seule fois ; célébrée ou acquittée ; refus d’un palier d’entraînement ;
  `syncMilestones` qui la laisse intacte avec ou sans historique, et qui retire toujours un vrai orphelin ;
  la sauvegarde qui l’accepte ;
- `grantNoclipIfUnlocked` : rien tant que TTY1 est verrouillé, une ligne dès qu’il ne l’est plus,
  idempotent, jamais d’exception.

L’image se vérifie à l’œil, en 64 px (la liste), 80 px (l’accueil) et en grand (la feuille) ; le parcours
complet se vérifie dans Chromium : un démarrage avec TTY1 déjà débloqué écrit la ligne acquittée et
l’écran des paliers la montre ; une console rare qui débloque TTY1 laisse la carte sur l’accueil.

Le checkpoint manuel se fait sur téléphone : ouvrir Analyses > Paliers après la mise à jour et trouver
noclip sous « Secrets », son jeton en grand, sa légende.

## Hors périmètre

- Une notification, un son, ou une ligne de plus dans la console rare : la carte de l’accueil suffit.
- D’autres secrets. Le genre les accepte, mais aucun autre n’est écrit : la rareté est la fonctionnalité.
- Un jeton animé. Un jeton est une image, comme les cinquante autres.
- Retirer le succès si TTY1 se reverrouille : TTY1 ne se reverrouille jamais.
