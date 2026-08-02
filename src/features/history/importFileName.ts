/**
 * Un fichier que l'écran d'import sait lire : l'export de Hevy, qui porte
 * toujours ce nom, ou une sauvegarde écrite par FitTrack
 * (`csvExportFileName`).
 *
 * Le contrôle sert à attraper « j'ai pris le mauvais fichier du zip » avant le
 * parseur, dont le message parlerait de colonnes manquantes — un diagnostic
 * juste et illisible.
 */
export function isImportableFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower === 'workout_data.csv' ||
    (lower.startsWith('fittrack-') && lower.endsWith('.csv'))
  );
}
