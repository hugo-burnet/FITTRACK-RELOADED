# Installer l’APK Android FitTrack

L’APK est produit par GitHub Actions et signé avec une clé privée stable. Il fonctionne hors ligne et conserve toutes ses données sur le téléphone.

> Ne désinstalle jamais FitTrack pour appliquer une mise à jour : Android supprimerait aussi sa base IndexedDB locale. Avant toute récupération destructive, exporte tes données en JSON ou CSV et conserve le fichier ailleurs.

## 1. Créer la clé de signature une seule fois

Installe un JDK 21, puis exécute à la racine du dépôt :

```powershell
New-Item -ItemType Directory -Force .secrets
keytool -genkeypair -v -keystore .secrets/fittrack.jks -alias fittrack -keyalg RSA -keysize 4096 -validity 10000
```

Choisis des mots de passe longs et uniques. Le dossier `.secrets/` et les fichiers `*.jks` sont ignorés par Git.

## 2. Sauvegarder la clé

Copie `fittrack.jks`, son mot de passe, l’alias et le mot de passe de la clé dans un coffre chiffré hors du dépôt. Cette clé doit rester identique pour toutes les mises à jour : si elle est perdue, Android refusera d’installer un nouvel APK par-dessus l’ancien.

## 3. Configurer GitHub Actions

Copie le JKS en Base64 dans le presse-papiers :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path '.secrets/fittrack.jks'))) | Set-Clipboard
```

Dans le dépôt GitHub, ouvre **Settings → Secrets and variables → Actions**, puis crée :

- `FITTRACK_ANDROID_KEYSTORE_BASE64` : le contenu Base64 ;
- `FITTRACK_ANDROID_KEYSTORE_PASSWORD` : le mot de passe du JKS ;
- `FITTRACK_ANDROID_KEY_ALIAS` : `fittrack` ;
- `FITTRACK_ANDROID_KEY_PASSWORD` : le mot de passe de la clé.

Chaque push sur `master`, ou lancement manuel du workflow **Android APK**, vérifie le projet puis produit un APK signé. Un tag `v*` publie aussi automatiquement cet APK dans une GitHub Release.

### Publier une release : deux gestes, pas un

Le push et le tag ne font pas la même chose, et pousser `master` seul ne publie **rien** dans Releases — l’APK n’existe alors que comme artefact de workflow, effacé au bout de 30 jours. Piège vécu à la v0.2.0 : les deux workflows passent au vert, la page Releases reste vide, et tout a l’air cassé alors que rien ne l’est.

```bash
git push origin master
```

```bash
git tag -a v0.2.0 -m "FitTrack Android v0.2.0" && git push origin v0.2.0
```

Le premier déploie la PWA sur GitHub Pages et construit l’APK. Le second le publie. Le numéro du tag doit correspondre au champ `version` de `package.json`, que le workflow lit pour nommer le fichier.

## 4. Télécharger l’APK

Ouvre la page **Releases** du dépôt et télécharge directement `FitTrack-vX.Y.Z.apk`. L’artefact **fittrack-android-debug** de l’exécution **Actions → Android APK** reste disponible pendant 30 jours comme solution de secours ; il faut alors décompresser le ZIP pour obtenir `app-debug.apk`.

## 5. Autoriser l’installation

Ouvre l’APK depuis l’application qui l’a téléchargé ou depuis le gestionnaire de fichiers. Android peut demander d’autoriser **Installer des applications inconnues** pour cette source précise. Active l’autorisation, reviens à l’APK et confirme l’installation.

## 6. Installer les mises à jour

Télécharge le nouvel artefact et ouvre son APK sans désinstaller FitTrack. Android reconnaît la même application et conserve l’historique, les routines et la séance active. Si Android propose **Mettre à jour**, confirme.

## 7. Accorder les autorisations utiles

Au premier démarrage, autorise les notifications. Ouvre ensuite **Paramètres Android → Applications → Accès spécial → Alarmes et rappels** et autorise FitTrack. Le nom exact du menu varie selon le fabricant.

Ces autorisations permettent d’afficher la séance active et de sonner à la fin du repos, même écran verrouillé. L’app et la saisie des séries restent utilisables si elles sont refusées.

## 8. Dépannage

- **Signature incompatible** : l’APK n’a pas été signé avec le même JKS. Ne désinstalle pas immédiatement ; retrouve la clé d’origine ou exporte d’abord les données depuis l’app installée.
- **Aucune notification** : vérifie l’autorisation globale de FitTrack et les canaux **Séance en cours** et **Minuteur de repos**.
- **Alarme retardée** : autorise **Alarmes et rappels**, puis enlève les restrictions de batterie propres au fabricant si nécessaire.
- **Espace privé Android** : FitTrack y constitue une installation et des données distinctes. Quand l’espace privé est verrouillé, Android peut suspendre ses notifications ; installe et utilise l’app dans l’espace où tu souhaites recevoir les alertes.

## Checkpoint sur le téléphone

1. Télécharge et installe l’APK de la dernière GitHub Release.
2. Vérifie l’icône FitTrack et l’écran de démarrage.
3. Démarre une séance et vérifie sa notification persistante.
4. Valide une série, verrouille l’écran et vérifie que le repos sonne à l’heure prévue.
5. Remplace puis annule un repos et vérifie qu’aucune ancienne alarme ne sonne.
6. Vérifie le bouton Retour Android depuis un sous-écran de séance, la séance, les onglets et l’accueil.
7. Installe l’APK suivant par-dessus le premier et vérifie que tout l’historique local est conservé.
8. Active le mode avion, force l’arrêt de FitTrack, puis rouvre l’app et vérifie que l’app complète et la séance active sont disponibles.
