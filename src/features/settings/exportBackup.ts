import { getBootStorage } from '@/app/bootEasterEgg';
import { buildBackup } from '@/data/repositories/backup';
import { t } from '@/i18n/fr';
import { backupFileName, serializeBackup } from '@/lib/backup';
import { saveTextFile, type SaveOutcome } from '@/platform/saveFile';
import { rememberBackup } from '@/stores/backupMemory';

/**
 * Le compte entier, sorti en un fichier — et la date de cette sortie retenue.
 *
 * Il y a deux portes vers cette sauvegarde : la ligne des Réglages, et le rappel de l'accueil.
 * Elles passent par ici pour une seule raison, qui est que la date retenue ne doit jamais
 * dépendre de la porte empruntée : un rappel qui n'apprend pas qu'on vient de sauvegarder
 * revient aussitôt, et c'est celui qu'on apprend à ignorer.
 *
 * **On retient `exportedAt`, l'instant où le fichier a été construit**, pas celui où la feuille de
 * partage se referme : une séance enregistrée entre les deux n'est pas dans le fichier. On ne
 * retient rien quand la feuille est fermée sans choix (`cancelled`) ou que l'écriture échoue : le
 * fichier n'existe alors nulle part.
 *
 * `shared` ne prouve pas que le fichier est arrivé quelque part — Android ne dit pas ce que
 * l'utilisateur a choisi dans la feuille. C'est le meilleur signal disponible, et le même que celui
 * dont le tutoriel se contente.
 */
export async function exportBackup(): Promise<SaveOutcome> {
  const backup = await buildBackup();
  const outcome = await saveTextFile({
    name: backupFileName(backup.exportedAt),
    text: serializeBackup(backup),
    type: 'application/json;charset=utf-8',
    title: t('settings.backupExportTitle'),
  });
  if (outcome === 'shared' || outcome === 'downloaded') {
    rememberBackup(getBootStorage(), backup.exportedAt);
  }
  return outcome;
}
