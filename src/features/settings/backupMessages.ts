import { t, type TranslationKey } from '@/i18n/fr';
import type { BackupFlaw, BackupOrphan, BackupTable } from '@/lib/backup';

/**
 * Ce que le refus d'une sauvegarde dit à voix haute.
 *
 * `lib/backup` rend des défauts en langage machine — une table, une ligne, un
 * champ — et n'a rien à savoir du français. La traduction vit ici parce qu'un
 * message qui dit seulement « fichier invalide » ne laisse aucun geste
 * possible : on ne sait ni quelle sauvegarde est en cause, ni s'il faut en
 * essayer une autre. Le nom de la table et le numéro de ligne, si.
 *
 * Un seul défaut est détaillé, avec le compte des autres : la liste complète
 * d'un fichier réellement abîmé se compte en milliers de lignes, et un message
 * qu'on ne peut pas lire ne vaut pas mieux que pas de message.
 */

/** Le nom d'une table tel qu'un humain la nommerait. */
export function backupTableLabel(table: BackupTable): string {
  return t(`settings.restoreTable.${table}` as TranslationKey);
}

/** Les lignes sont comptées à partir de 1 : c'est ce qu'un éditeur affiche. */
function describeFlaw(flaw: BackupFlaw): string {
  const table = backupTableLabel(flaw.table);
  switch (flaw.kind) {
    case 'missing-table':
      return t('settings.restoreFlawMissingTable', { table });
    case 'not-a-list':
      return t('settings.restoreFlawNotAList', { table });
    case 'not-a-record':
      return t('settings.restoreFlawNotARecord', { table, line: flaw.index + 1 });
    case 'missing-field':
      return t('settings.restoreFlawMissingField', {
        table,
        line: flaw.index + 1,
        field: flaw.field,
      });
    case 'invalid-field':
      return t('settings.restoreFlawInvalidField', {
        table,
        line: flaw.index + 1,
        field: flaw.field,
      });
    case 'duplicate-key':
      return t('settings.restoreFlawDuplicateKey', { table, key: flaw.key });
  }
}

export function backupStructureMessage(flaws: BackupFlaw[], flawCount: number): string {
  const first = flaws[0];
  if (first === undefined) return t('settings.restoreErrorStructure', { detail: '?' });

  const detail =
    flawCount > 1
      ? t('settings.restoreErrorStructureMore', {
          detail: describeFlaw(first),
          rest: flawCount - 1,
        })
      : describeFlaw(first);

  return t('settings.restoreErrorStructure', { detail });
}

/** `null` quand le fichier se tient : le silence est la bonne nouvelle. */
export function backupOrphanMessage(orphans: BackupOrphan[]): string | null {
  const count = orphans.reduce((sum, orphan) => sum + orphan.count, 0);
  if (count === 0) return null;
  return t('settings.restoreConfirmOrphans', { count });
}
