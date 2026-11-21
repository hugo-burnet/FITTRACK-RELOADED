import { useState } from 'react';
import { t } from '@/i18n/fr';
import { applyEffortPrompt, loadEffortPrompt } from '@/stores/effortPrompt';
import { Card, LearnMore, ListRow, SectionTitle, Toggle } from '@/ui';

/**
 * The two things fatigue changes in the app, said in one place.
 *
 * The switch governs the strip that asks how hard a set was; the paragraph
 * under it states the tempo rule, which nothing else in the interface can
 * explain — a metronome that quietly slows down looks like a bug until you have
 * read, once, that it is meant to.
 */
export function EffortPromptSettings() {
  const [enabled, setEnabled] = useState(loadEffortPrompt);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    applyEffortPrompt(next);
  };

  return (
    <section>
      <SectionTitle>{t('settings.effortSection')}</SectionTitle>
      <Card>
        <ListRow
          title={t('settings.effortPromptRowTitle')}
          subtitle={t('settings.effortPromptRowSubtitle')}
          trailing={
            <Toggle
              label={t('settings.effortPromptTitle')}
              mark={t(enabled ? 'settings.effortPromptOn' : 'settings.effortPromptOff')}
              checked={enabled}
              onChange={toggle}
            />
          }
        />
      </Card>
      <LearnMore>
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {t('settings.effortPromptHint')}
        </p>
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {t('settings.effortTempoHint')}
        </p>
      </LearnMore>
    </section>
  );
}
