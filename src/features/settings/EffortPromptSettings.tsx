import { useState } from 'react';
import { t } from '@/i18n/fr';
import { applyEffortPrompt, loadEffortPrompt } from '@/stores/effortPrompt';
import { ListRow, SectionTitle, Toggle } from '@/ui';

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
      <div className="overflow-hidden rounded-2xl bg-[var(--surface-1)]">
        <ListRow
          title={t('settings.effortPromptTitle')}
          subtitle={t('settings.effortPromptHint')}
          trailing={
            <Toggle
              label={t('settings.effortPromptTitle')}
              mark={t(enabled ? 'settings.effortPromptOn' : 'settings.effortPromptOff')}
              checked={enabled}
              onChange={toggle}
            />
          }
        />
      </div>
      <p className="mt-3 px-1 text-sm leading-relaxed text-[var(--text-2)]">
        {t('settings.effortTempoHint')}
      </p>
    </section>
  );
}
