# Sauvegarde cohérente du backend SQLite

Suite de la première tranche homelab, sans déploiement public. Le contrat déjà
retenu exige une sauvegarde SQLite cohérente et une génération indépendante
de la base restaurée. Cette tranche ajoute uniquement l'export cohérent ;
la remise en service et la rotation de génération restent bloquantes pour
une restauration opérationnelle.

1. Écrire des tests avec une vraie base SQLite en mode WAL : exporter les
   transactions validées, exclure une transaction non validée, vérifier le
   fichier autonome avec integrity_check. Ne jamais recopier le seul fichier
   principal pendant que SQLite écrit.
2. Créer un nouveau dossier d'export privé, refuser tout dossier préexistant
   (y compris un lien symbolique), préserver la source en lecture seule et
   exporter par l'API sqlite3.backup. Échec : nettoyer uniquement le dossier
   créé par cet appel ; aucun export incomplet accepté.
3. Produire un manifeste versionné contenant la somme SHA-256 de la base,
   un horodatage UTC et la génération d'origine comme information. Ne jamais
   exporter le secret Django ni le fichier de génération comme configuration
   restaurable. Un manifeste n'authentifie pas une sauvegarde non fiable.
4. Ajouter la commande Django backup_sync avec un chemin de destination
   explicite et sans contenu utilisateur dans les logs. Vérifier tests,
   migrations et configuration. Documenter copie chiffrée hors machine,
   contrôles d'intégrité et interdiction de restaurer en ligne.

Une future restauration devra arrêter le backend, vérifier une sauvegarde
de confiance, renouveler la génération externe, invalider les credentials
restaurés puis relancer et tester avant ouverture. La simple copie d'une
base ou la réutilisation de sa génération ne satisfait pas ce contrat.
