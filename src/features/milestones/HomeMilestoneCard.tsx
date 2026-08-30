import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  acknowledgeMilestones,
  listMilestones,
  listSeenRetrospectives,
  listUnacknowledgedMilestones,
  markRetrospectiveSeen,
} from '@/data/repositories/milestones';
import { t } from '@/i18n/fr';
import { pickRetrospective } from '@/lib/milestones/retrospective';
import { Button, Card } from '@/ui';
import { MilestonePeek } from './MilestonePeek';
import { MilestoneToken } from './MilestoneToken';
import { milestoneReading } from './milestoneCopy';

/**
 * La seule surface où un palier vient chercher les yeux — et elle est vide
 * presque tout le temps.
 *
 * **Une carte au maximum, jamais deux.** Un palier qui vient de tomber et un
 * anniversaire peuvent coïncider ; les afficher tous les deux ferait de
 * l'accueil un tableau de félicitations, ce qui est la façon la plus sûre de
 * rendre les deux invisibles. Le neuf passe devant : il est arrivé aujourd'hui.
 *
 * **Aucune notification.** Ni ici ni ailleurs : le canal de la barre d'état est
 * pris par les records et les rappels de séance, et un palier tombe si rarement
 * qu'on le lit très bien en rentrant sur l'accueil — ce qui arrive de toute
 * façon une seconde après avoir enregistré la séance qui l'a franchi.
 *
 * **Elle ne se referme jamais toute seule.** Acquitter au montage aurait fait
 * disparaître la carte pendant que l'écran finit de charger, et un palier
 * franchi une fois dans une vie ne se rate pas à cause d'un rendu. C'est le
 * doigt qui ferme, et alors c'est fermé pour toujours.
 */
export function HomeMilestoneCard() {
  // Figé à l'ouverture, comme la régularité de l'accueil : un anniversaire ne
  // doit pas apparaître sous les yeux à minuit pile.
  const [openedAt] = useState(() => Date.now());
  const [peek, setPeek] = useState<{ definitionId: string; title: string } | null>(null);

  const unlocked = useLiveQuery(listUnacknowledgedMilestones, []);
  const all = useLiveQuery(listMilestones, []);
  const seen = useLiveQuery(listSeenRetrospectives, []);

  // `!= null` et non `!== undefined` : la lecture vaut `undefined` tant qu'elle
  // n'a pas répondu, et une carte d'accueil ne doit pas faire tomber tout
  // l'écran parce qu'une lecture lui est revenue vide d'une façon inattendue.
  //
  // Une ligne sans phrase est sautée, jamais comptée : un palier retiré du
  // catalogue laisse derrière lui une ligne non acquittée que plus rien
  // n'acquitte — elle ne peut donc pas devenir la raison pour laquelle
  // l'anniversaire d'un autre palier ne s'affiche plus. C'est le rattrapage de
  // `syncMilestones` qui la retirera, à la prochaine séance.
  const lines = (unlocked ?? []).flatMap((row) => {
    const reading = milestoneReading(row.definitionId, row.value);
    return reading === undefined
      ? []
      : [{ ...reading, id: row.id, definitionId: row.definitionId }];
  });

  if (lines.length > 0) {
    return (
      <section>
        <Card padded>
          <p className="label-xs font-semibold text-[var(--accent-ink)]">
            {lines.length === 1
              ? t('milestone.unlockedOne')
              : t('milestone.unlockedMany', { count: lines.length })}
          </p>

          <ul className="mt-4 flex flex-col gap-3">
            {lines.map((line) => (
              <li key={line.id}>
                <button
                  type="button"
                  onClick={() => setPeek({ definitionId: line.definitionId, title: line.title })}
                  className="flex w-full items-center gap-3 rounded-xl text-left
                    focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-[var(--color-accent)]"
                >
                  <MilestoneToken definitionId={line.definitionId} tone="accent" size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-[var(--text-1)]">
                      {line.title}
                    </span>
                    {line.reached !== undefined && (
                      <span className="mt-0.5 block text-sm text-[var(--text-2)]">
                        {line.reached}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* La phrase qui porte tout le reste : ce palier ne peut plus être
              repris. C'est ce qui le sépare d'une série de semaines. */}
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
            {t('milestone.unlockedHint')}
          </p>

          <Button
            variant="secondary"
            fullWidth
            className="mt-4"
            onClick={() => void acknowledgeMilestones(lines.map((line) => line.id))}
          >
            {t('common.close')}
          </Button>
        </Card>
        <MilestonePeek
          definitionId={peek?.definitionId ?? null}
          title={peek?.title ?? t('milestone.title')}
          onClose={() => setPeek(null)}
        />
      </section>
    );
  }

  if (all == null || seen == null) return null;

  const retrospective = pickRetrospective(all, { now: openedAt, acknowledged: seen });
  if (retrospective === undefined) return null;

  const row = all.find((item) => item.definitionId === retrospective.definitionId);
  const reading =
    row === undefined ? undefined : milestoneReading(row.definitionId, row.value);
  if (row === undefined || reading === undefined) return null;

  return (
    <section>
      <Card padded>
        <p className="label-xs font-semibold text-[var(--text-2)]">
          {retrospective.years === 1
            ? t('milestone.retrospective.oneYear')
            : t('milestone.retrospective.years', { count: retrospective.years })}
        </p>

        <button
          type="button"
          onClick={() => setPeek({ definitionId: row.definitionId, title: reading.title })}
          className="mt-4 flex w-full items-center gap-3 rounded-xl text-left
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[var(--color-accent)]"
        >
          <MilestoneToken definitionId={row.definitionId} size="lg" />
          <p className="min-w-0 flex-1 text-base font-semibold text-[var(--text-1)]">
            {reading.title}
          </p>
        </button>

        <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
          {t('milestone.retrospective.body')}
        </p>

        <Button
          variant="secondary"
          fullWidth
          className="mt-4"
          onClick={() => void markRetrospectiveSeen(retrospective.key)}
        >
          {t('milestone.retrospective.dismiss')}
        </Button>
      </Card>
      <MilestonePeek
        definitionId={peek?.definitionId ?? null}
        title={peek?.title ?? t('milestone.title')}
        onClose={() => setPeek(null)}
      />
    </section>
  );
}
