import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/resetDb';
import { t } from '@/i18n/fr';
import { TTY1_UNLOCK_KEY } from '@/stores/skinUnlock';
import { THEME_STORAGE_KEY } from '@/stores/theme';
import { AppearanceSettingsScreen } from './AppearanceSettingsScreen';

function renderSettings() {
  render(
    <MemoryRouter>
      <AppearanceSettingsScreen />
    </MemoryRouter>,
  );
}

describe('AppearanceSettingsScreen — thème', () => {
  beforeEach(async () => {
    await resetDb();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  const themeGroup = () => screen.getByRole('radiogroup', { name: t('settings.theme') });
  const tty1Option = () =>
    within(themeGroup()).getByRole('radio', { name: t('settings.themeTty1') });

  describe('quand TTY1 est débloqué', () => {
    beforeEach(() => localStorage.setItem(TTY1_UNLOCK_KEY, '1'));

    it('offers the four themes and applies TTY1 at once', async () => {
      renderSettings();

      expect(
        within(themeGroup())
          .getAllByRole('radio')
          .map((option) => option.textContent),
      ).toEqual([
        t('settings.themeDark'),
        t('settings.themeLight'),
        t('settings.themeTty1'),
        t('settings.themeCyber'),
      ]);

      await userEvent.click(tty1Option());

      expect(document.documentElement.getAttribute('data-theme')).toBe('tty1');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('tty1');
      expect(screen.getByText(t('settings.themeTty1Hint'))).toBeInTheDocument();
    });

    it('keeps the dark theme hint until TTY1 is chosen', () => {
      renderSettings();

      expect(screen.getByText(t('settings.themeHint'))).toBeInTheDocument();
      expect(screen.queryByText(t('settings.themeTty1Hint'))).toBeNull();
    });

    it('shows no lock and no riddle', () => {
      renderSettings();

      expect(tty1Option()).not.toHaveAttribute('aria-disabled');
      expect(tty1Option().querySelector('svg')).toBeNull();
      expect(screen.queryByText(t('settings.themeTty1Locked'))).toBeNull();
    });
  });

  describe('Cyber', () => {
    const cyberOption = () =>
      within(themeGroup()).getByRole('radio', { name: t('settings.themeCyber') });

    it('is open from the start, with nothing to unlock', () => {
      renderSettings();

      expect(cyberOption()).not.toHaveAttribute('aria-disabled');
    });

    it('applies at once and says what it is', async () => {
      renderSettings();

      await userEvent.click(cyberOption());

      expect(document.documentElement.getAttribute('data-theme')).toBe('cyber');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('cyber');
      expect(screen.getByText(t('settings.themeCyberHint'))).toBeInTheDocument();
    });
  });

  describe('tant que TTY1 est verrouillé', () => {
    it('keeps the option in the list, dimmed and marked as unavailable', () => {
      renderSettings();

      expect(
        within(themeGroup())
          .getAllByRole('radio')
          .map((option) => option.textContent),
      ).toEqual([
        t('settings.themeDark'),
        t('settings.themeLight'),
        t('settings.themeTty1'),
        t('settings.themeCyber'),
      ]);
      expect(tty1Option()).toHaveAttribute('aria-disabled', 'true');
      expect(tty1Option()).toHaveAttribute('aria-checked', 'false');
      expect(tty1Option().querySelector('svg')).not.toBeNull();
    });

    it('does not say how to unlock it, only that something is to be found', () => {
      renderSettings();

      const riddle = screen.getByText(t('settings.themeTty1Locked'));
      expect(riddle).toBeInTheDocument();
      expect(tty1Option()).toHaveAttribute('aria-describedby', riddle.id);
    });

    it('ignores a tap on it', async () => {
      renderSettings();

      await userEvent.click(tty1Option());

      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
      expect(screen.queryByText(t('settings.themeTty1Hint'))).toBeNull();
    });

    it('still lets the two other themes be chosen', async () => {
      renderSettings();

      await userEvent.click(
        within(themeGroup()).getByRole('radio', { name: t('settings.themeLight') }),
      );

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });
  });
});
