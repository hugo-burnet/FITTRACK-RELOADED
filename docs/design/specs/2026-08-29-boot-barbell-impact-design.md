# Impact de la barre au démarrage — conception

> ## ⛔ Révoqué le 2026-08-30 — l'impact est entièrement supprimé de l'app
>
> Cette fonctionnalité n'existe plus. Sur retour de l'utilisateur (« la suite est un peu naze, ça
> fait cheap »), la chute, l'écrasement, la secousse et la poussière ont été retirés du code : il ne
> reste que le chargement des plaques, suivi d'un silence, puis d'un resserrement d'interlettrage
> sur le principe. `boot-drop`, `boot-impact-shake`, `boot-dust-l`, `boot-dust-r`,
> `boot-dust-fade`, `.boot-impact`, `.boot-barbell` et `.boot-dust` ne sont plus dans le dépôt.
>
> **Ce que ce chantier a appris, et qui vaut au-delà de lui.** Le défaut n'était pas dans la courbe
> de chute — elle était juste. Il était dans le nombre de couches démarrant sur la même frame :
> quatre animations à 1 600 ms pour un seul événement, sur un dessin qui fait quatre traits, se
> lisent comme un effet et non comme une conséquence. Chacune des quatre était défendable seule ;
> c'est leur somme qui a coûté la fonctionnalité. Un écran vu une fois par démarrage supporte un
> geste, pas une cinématique.
>
> Le détail de la suppression, le défaut de saut vertical trouvé en la vérifiant et le nouveau
> contrat de test sont dans « L'ouverture, troisième passe » de `PROGRESS.md`. Ce document reste en
> lecture seule, comme trace de la décision et de son motif.


## Objectif

Remplacer le petit aller-retour vertical de la barre chargée par une chute qui donne une impression
de poids : la barre tombe, se comprime au contact du sol, provoque une secousse courte et soulève
un nuage de poussière. La séquence doit rester lisible sur téléphone, fluide et brève.

## Approches considérées

1. **Impact CSS et SVG intégré — retenu.** Ajouter dans le composant d'ouverture une ligne de sol et
   quelques formes SVG pour la poussière, puis synchroniser leur apparition avec des animations CSS.
   Cette solution ne charge aucun asset, reste nette à toutes les densités d'écran et respecte le
   fonctionnement entièrement hors ligne.
2. **Image ou sprite de poussière.** Le résultat pourrait être plus organique, mais ajouterait un
   asset raster, du poids et une direction artistique distincte du logo géométrique existant.
3. **Canvas ou bibliothèque d'animation.** Des particules plus riches seraient possibles, au prix
   d'une dépendance ou d'un moteur disproportionné pour une animation affichée une fois au lancement.

## Séquence retenue

Les deux paires de plaques continuent de glisser sur la barre selon le rythme existant. Une fois la
barre chargée :

- elle commence légèrement au-dessus de sa position finale et accélère vers le sol ;
- au contact, elle s'aplatit très brièvement sur l'axe vertical et s'élargit légèrement ;
- elle remonte de quelques pixels, puis se stabilise sans rebond élastique ;
- le bloc visuel entier subit une secousse horizontale amortie ;
- deux nappes de poussière partent du centre vers les côtés, montent légèrement et disparaissent ;
- une fine ligne de sol se révèle au moment du contact et reste visible jusqu'à la sortie du rideau.

Le principe de l'application apparaît sur l'impact, comme dans l'animation actuelle, puis la
signature apparaît avant le fondu de sortie. La durée totale de l'ouverture reste de 2,5 secondes :
aucun délai supplémentaire n'est ajouté au démarrage.

## Structure et style

`LoadedBar` devient une petite scène SVG. La barre existante reste la source du logo ; elle est
simplement regroupée séparément du sol et de la poussière afin que chaque élément reçoive son propre
mouvement. La poussière utilise la couleur de texte secondaire avec une opacité faible, tandis que
la ligne de sol reprend la couleur de bordure. Le rendu conserve donc la palette et le langage
graphique actuels, sans nouvelle dépendance ni image externe.

## Accessibilité et performances

- Avec `prefers-reduced-motion: reduce`, la barre, le sol et la poussière apparaissent uniquement
  par fondu ; aucune chute, compression ni secousse n'est jouée.
- Les animations portent sur `transform`, `opacity` et un flou très limité aux petits éléments de
  poussière. Aucune propriété de mise en page n'est animée.
- La scène reste `aria-hidden`; les textes de marque conservent le comportement accessible actuel.
- Les promotions `will-change` sont bornées à la phase d'entrée et aux éléments réellement animés.

## Vérification

Un test structurel du composant vérifie que la scène expose les couches nécessaires à l'impact :
barre, sol, poussière et conteneur de secousse. Les vérifications TypeScript, unitaires et de build
doivent passer. Le checkpoint manuel consiste à relancer l'application sur téléphone et à vérifier
que la barre semble heurter le sol, que la poussière reste discrète, et que le réglage système de
réduction des animations supprime la chute et la secousse.
