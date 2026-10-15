import { useState } from 'react';
import type { Routine } from '@/data/types';
import { t } from '@/i18n/fr';
import { Card, ListRow, SectionTitle } from '@/ui';
import { ChevronDownIcon } from '@/ui/icons';
import { BenchmarkLaunchSheet } from './BenchmarkLaunchSheet';

/**
 * « Calibrer les charges », sur la fiche d'un programme : le benchmark de chacune de ses routines.
 *
 * Les charges d'un programme viennent de ses routines — une séance de programme se construit depuis la routine,
 * puis la semaine y applique sa phase — ; calibrer les routines avant de démarrer, c'est donc régler les charges
 * de départ du bloc. C'est le moment où un benchmark sert le plus : on reprend des exercices, ou l'on en
 * change, et le point de départ est une charge posée à l'œil. Le benchmark écrit dans la routine, sur
 * acceptation, comme partout ailleurs ; il ne touche pas au programme lui-même.
 *
 * Une ligne par routine, même quand le split la fait passer deux fois dans la semaine ; une routine supprimée
 * (sans nom) n'a rien à calibrer. Éteinte, avec sa raison, tant qu'une séance tourne : une seule à la fois.
 */
export function ProgramBenchmarkCard({
  sessions,
  busy,
}: {
  sessions: readonly { routineId: string; routineName: string | null }[];
  busy: boolean;
}) {
  const [target, setTarget] = useState<Pick<Routine, 'id' | 'name'> | null>(null);

  const routines = new Map<string, string>();
  for (const session of sessions) {
    if (session.routineName !== null && !routines.has(session.routineId)) {
      routines.set(session.routineId, session.routineName);
    }
  }
  if (routines.size === 0) return null;

  return (
    <section>
      <SectionTitle>{t('benchmark.programTitle')}</SectionTitle>
      <p className="mb-3 px-1 text-sm leading-relaxed text-[var(--text-2)]">
        {t('benchmark.programHint')}
      </p>
      <Card>
        {[...routines].map(([id, name]) => (
          <ListRow
            key={id}
            title={name}
            subtitle={busy ? t('routines.startBusyHint') : t('benchmark.menuHint')}
            disabled={busy}
            onClick={() => setTarget({ id, name })}
            trailing={<ChevronDownIcon className="-rotate-90 text-[var(--text-2)]" />}
          />
        ))}
      </Card>
      <BenchmarkLaunchSheet routine={target} onClose={() => setTarget(null)} />
    </section>
  );
}
