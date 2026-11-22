import { t } from '@/i18n/fr';
import { readDisciplineEvents } from '@/lib/rpeDiscipline';
import { formatNumber } from '@/ui/numberField';

const clock = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Le journal du protocole RPE, une ligne par événement, dans l'ordre : ce que la séance garde de
 * chaque dépassement, de chaque correction et de chaque dérogation. Pur, pour être testé sans écran.
 *
 * `time` est injecté : l'heure locale d'un test ne dépend pas de la machine qui le lance.
 */
export function rpeDisciplineTraceLines(
  events: unknown,
  time: (at: number) => string = (at) => clock.format(at),
): string[] {
  return readDisciplineEvents(events).map((event) => {
    switch (event.kind) {
      case 'triggered':
        return t('rpeDiscipline.traceTriggered', {
          time: time(event.at),
          rpe: formatNumber(event.rpe),
          ceiling: formatNumber(event.ceiling),
        });
      case 'corrected':
        return t('rpeDiscipline.traceCorrected', {
          time: time(event.at),
          from:
            event.previousRpe === undefined
              ? t('rpeDiscipline.traceNone')
              : formatNumber(event.previousRpe),
          to: event.rpe === undefined ? t('rpeDiscipline.traceNone') : formatNumber(event.rpe),
        });
      case 'override':
        return t('rpeDiscipline.traceOverride', { time: time(event.at) });
    }
  });
}
