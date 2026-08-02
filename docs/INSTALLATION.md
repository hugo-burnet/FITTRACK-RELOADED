# Installer FitTrack sur ton téléphone

> Écrit au Lot 9, contre la version en ligne du 2026-08-02.
> Concerne la **PWA** — l'app installée depuis le navigateur. L'APK Android arrive au Lot 10 et
> ne remplacera pas cette page : les deux s'installent différemment.

**L'adresse :** https://hugo-burnet.github.io/FITTRACK-RELOADED/

---

## Android — Chrome

1. Ouvre l'adresse dans Chrome.
2. Va dans **Réglages** (dernier onglet) → **Application** → **Installer sur l'écran d'accueil**.
3. Confirme dans la fenêtre de Chrome.

L'icône apparaît dans le tiroir d'applications et sur l'écran d'accueil. Lancée depuis là, l'app
n'a plus de barre d'adresse.

**Si la ligne répond « Déjà installée, ou à ajouter depuis le menu du navigateur » :** Chrome
décide seul du moment où il autorise l'installation, et il ne le fait pas à la première seconde de
la première visite. Passe par le menu **⋮ → Ajouter à l'écran d'accueil**, qui marche toujours.

## iPhone — Safari

Safari ne permet pas à une page de proposer l'installation ; la ligne des réglages ne servira à
rien, c'est normal et non contournable.

1. Ouvre l'adresse dans **Safari** (Chrome sur iOS ne sait pas installer).
2. Bouton **Partager** → **Sur l'écran d'accueil**.

---

## Vérifier que le hors-ligne marche

C'est le point du Lot 9, et le seul qui mérite d'être testé pour de vrai.

1. Ouvre l'app **une fois** avec du réseau et laisse-la finir de charger. C'est cette visite qui
   remplit le cache.
2. **Réglages → Application** doit afficher « Prête pour le hors-ligne : l'app démarre sans
   réseau. » Tant qu'il affiche « Copie hors-ligne en cours de préparation », attends et recharge.
3. Ferme complètement l'app.
4. **Mode avion.**
5. Relance depuis l'icône : l'app doit démarrer entièrement — accueil, routines, historique,
   séance en direct.

Si elle démarre en mode avion, la règle non négociable n°2 est tenue : une salle en sous-sol sans
4G ne change plus rien.

---

## Les mises à jour

Chaque push sur `master` republie le site. L'app installée ne bascule **pas** toute seule.

Au démarrage suivant, si une nouvelle version attend, un bandeau apparaît en haut :

> Une nouvelle version est disponible. — **Plus tard** / **Recharger**

- **Recharger** applique la mise à jour et recharge la page.
- **Plus tard** masque le bandeau. La version qui tourne continue de tourner ; la nouvelle
  s'installera à une prochaine ouverture.

**C'est volontaire.** Une app qui se met à jour toute seule peut se recharger au milieu d'une
série, et la règle n°4 dit qu'une séance en cours survit à tout. Le prix de cette garantie, c'est
que tu choisis le moment.

> Corollaire : si tu viens de pousser un correctif et que le téléphone ne le voit pas, ce n'est pas
> un bug. Ouvre l'app, attends le bandeau, appuie sur **Recharger**.

---

## Désinstaller, ou repartir de zéro

- **Désinstaller** : appui long sur l'icône → Désinstaller. Comme n'importe quelle app.
- **Vider les données** : Réglages → Données → Diagnostic. Les séances sont dans IndexedDB, sur le
  téléphone, et **la désinstallation ne les efface pas forcément** — selon le navigateur, elles
  survivent à la réinstallation.

⚠️ **Avant toute manipulation de ce genre, fais une sauvegarde** : Réglages → Données →
« Sauvegarder l'historique (CSV) ». Rien n'est synchronisé nulle part ; ce fichier est la seule
copie qui existe en dehors du téléphone.
