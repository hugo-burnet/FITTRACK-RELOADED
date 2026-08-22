import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getNotificationPreferences,
  setNotificationPreferences,
} from '@/data/repositories/notificationSettings';
import { t } from '@/i18n/fr';
import { reminderMoment, weekdayInitial, weekdayLabel } from '@/i18n/labels';
import type { NotificationPreferences } from '@/lib/notificationPreferences';
import {
  minutesFromClockValue,
  nextReminderOccurrences,
  REMINDER_WEEK_ORDER,
  reminderClockValue,
} from '@/lib/reminders';
import { Input, ListRow, SectionTitle, Toggle } from '@/ui';

/**
 * RF-53 — the three notifications, each with its own switch.
 *
 * They are grouped because they are one question ("when may the app speak to a
 * phone I am not looking at"), and separated because they are three different
 * intrusions: the rest bell answers a set you just validated, the record writes
 * down something you already know, and the reminder rings on a day you did not
 * open the app at all. A single master switch would make the third one's cost
 * fall on the first.
 *
 * The week and the hour only appear once the reminder is on: seven boxes and a
 * clock under a switch that is off are seven boxes that do nothing.
 */
export function NotificationSettings() {
  const preferences = useLiveQuery(getNotificationPreferences);
  // Read once, like every screen that dates something: a clock re-read at each
  // render moves the sentence under the reader for no new information.
  const [openedAt] = useState(() => Date.now());

  if (preferences === undefined) return null;

  const save = (patch: Partial<NotificationPreferences>): void => {
    void setNotificationPreferences(patch);
  };

  const toggleDay = (day: number): void => {
    const days = preferences.schedule.days.includes(day)
      ? preferences.schedule.days.filter((checked) => checked !== day)
      : [...preferences.schedule.days, day];
    save({ schedule: { ...preferences.schedule, days } });
  };

  const [next] = nextReminderOccurrences(preferences.schedule, openedAt, 1);

  return (
    <section>
      <SectionTitle>{t('settings.notificationsSection')}</SectionTitle>
      <div className="overflow-hidden rounded-2xl bg-[var(--surface-1)]">
        <ListRow
          title={t('settings.notificationsRest')}
          subtitle={t('settings.notificationsRestHint')}
          trailing={
            <Toggle
              label={t('settings.notificationsRest')}
              mark={t(preferences.rest ? 'settings.notificationsOn' : 'settings.notificationsOff')}
              checked={preferences.rest}
              onChange={() => save({ rest: !preferences.rest })}
            />
          }
        />
        <ListRow
          title={t('settings.notificationsRecords')}
          subtitle={t('settings.notificationsRecordsHint')}
          trailing={
            <Toggle
              label={t('settings.notificationsRecords')}
              mark={t(
                preferences.records ? 'settings.notificationsOn' : 'settings.notificationsOff',
              )}
              checked={preferences.records}
              onChange={() => save({ records: !preferences.records })}
            />
          }
        />
        <ListRow
          title={t('settings.notificationsReminders')}
          subtitle={t('settings.notificationsRemindersHint')}
          trailing={
            <Toggle
              label={t('settings.notificationsReminders')}
              mark={t(
                preferences.reminders ? 'settings.notificationsOn' : 'settings.notificationsOff',
              )}
              checked={preferences.reminders}
              onChange={() => save({ reminders: !preferences.reminders })}
            />
          }
        />
      </div>

      {preferences.reminders && (
        <div className="mt-3 rounded-2xl bg-[var(--surface-1)] p-4">
          <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
            {t('settings.notificationsDays')}
          </p>
          <div role="group" aria-label={t('settings.notificationsDays')} className="flex gap-1.5">
            {REMINDER_WEEK_ORDER.map((day) => {
              const checked = preferences.schedule.days.includes(day);

              return (
                <button
                  key={day}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={weekdayLabel(day)}
                  onClick={() => toggleDay(day)}
                  className={`min-h-12 flex-1 rounded-xl text-base font-semibold
                    transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)] ${
                      checked
                        ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-2)]'
                    }`}
                >
                  <span aria-hidden="true">{weekdayInitial(day)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Input
              label={t('settings.notificationsTime')}
              type="time"
              value={reminderClockValue(preferences.schedule.minutes)}
              onChange={(event) => {
                const minutes = minutesFromClockValue(event.target.value);
                if (minutes === undefined) return;
                save({ schedule: { ...preferences.schedule, minutes } });
              }}
            />
          </div>

          <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
            {next === undefined
              ? t('settings.notificationsNoDay')
              : t('settings.notificationsNext', { date: reminderMoment(next) })}
          </p>
        </div>
      )}

      <p className="mt-3 px-1 text-sm leading-relaxed text-[var(--text-2)]">
        {t('settings.notificationsAndroidHint')}
      </p>
    </section>
  );
}
