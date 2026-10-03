import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { t } from '@/i18n/fr';
import { BootScreen } from './Boot';
import { BOOT_HOLD_MS } from './bootEasterEgg';
import { APP_VERSION } from './version';

describe('BootScreen', () => {
  it('keeps the loaded bar but removes every ground-impact layer', () => {
    const { container } = render(<BootScreen />);

    expect(container.querySelector('.boot-bar')).not.toBeNull();
    expect(container.querySelectorAll('.boot-plate')).toHaveLength(4);
    expect(container.querySelector('.boot-impact')).toBeNull();
    expect(container.querySelector('.boot-ground')).toBeNull();
    expect(container.querySelector('.boot-dust')).toBeNull();
  });

  it('shows the two brand lines on the normal path', () => {
    const { container, getByText } = render(<BootScreen variant="normal" />);

    expect(getByText(t('app.principle'))).not.toBeNull();
    expect(getByText(t('app.tagline'))).not.toBeNull();
    expect(container.querySelector('.boot-console')).toBeNull();
  });

  it('replaces the brand lines with the fixed console on the rare path', () => {
    const { container, getByText, queryByText } = render(<BootScreen variant="console" />);

    expect(queryByText(t('app.principle'))).toBeNull();
    expect(queryByText(t('app.tagline'))).toBeNull();
    expect(container.querySelectorAll('.boot-console-line')).toHaveLength(4);
    expect(getByText(t('boot.consoleCommand'))).not.toBeNull();
  });

  it('adds two lines under the typed command when the console unlocks TTY1', () => {
    const { container, getByText } = render(<BootScreen variant="console" unlocking />);
    const log = container.querySelector('.boot-console-log');

    expect(container.querySelectorAll('.boot-console-line')).toHaveLength(6);
    expect([...(log?.children ?? [])].map((child) => child.className)).toEqual([
      'boot-console-line',
      'boot-console-line',
      'boot-console-line',
      'boot-console-line',
      'boot-console-prompt',
      'boot-console-line',
      'boot-console-line',
    ]);
    expect(getByText(t('boot.consoleUnlocked'))).not.toBeNull();
    expect(getByText(t('boot.consoleUnlockedHint'))).not.toBeNull();
  });

  it('says nothing of an unlock when there is none to announce', () => {
    const { container, queryByText } = render(<BootScreen variant="console" />);

    expect(container.querySelectorAll('.boot-console-line')).toHaveLength(4);
    expect(queryByText(t('boot.consoleUnlocked'))).toBeNull();
    expect(queryByText(t('boot.consoleUnlockedHint'))).toBeNull();
  });

  it('keeps the unlock to the rare console: the other openings have no such lines', () => {
    for (const variant of ['normal', 'tty1'] as const) {
      const { queryByText, unmount } = render(<BootScreen variant={variant} unlocking />);

      expect(queryByText(t('boot.consoleUnlocked'))).toBeNull();
      unmount();
    }
  });

  it('sets the two unlock lines after the typed command, 100 ms and 260 ms past its end', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const bootStyles = stylesheet.slice(stylesheet.indexOf(" * L'ouverture de l'app."));

    expect(bootStyles).toMatch(
      /\.boot\[data-phase='in'\] \.boot-console-line:nth-child\(6\)\s*{[^}]*animation-delay: 3280ms;/s,
    );
    expect(bootStyles).toMatch(
      /\.boot\[data-phase='in'\] \.boot-console-line:nth-child\(7\)\s*{[^}]*animation-delay: 3440ms;/s,
    );
  });

  it('pops the two normal lines 180 ms apart', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const bootStyles = stylesheet.slice(stylesheet.indexOf(" * L'ouverture de l'app."));

    expect(bootStyles).toMatch(
      /\.boot\[data-phase='in'\] \.boot-principle\s*{[^}]*animation: pop 320ms [^;]* 1340ms both;/s,
    );
    expect(bootStyles).toMatch(
      /\.boot\[data-phase='in'\] \.boot-tagline\s*{[^}]*animation: pop 320ms [^;]* 1520ms both;/s,
    );
  });

  it('contains no drop, rebound, shake, dust, or ground keyframes', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');

    for (const removed of [
      'boot-drop',
      'boot-impact-shake',
      'boot-ground-reveal',
      'boot-dust-l',
      'boot-dust-r',
    ]) {
      expect(stylesheet).not.toContain(`@keyframes ${removed}`);
    }
  });

  it('turns the rare path into static fades for reduced motion', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const reducedMotion = stylesheet.slice(
      stylesheet.indexOf('@media (prefers-reduced-motion: reduce)'),
      stylesheet.indexOf('/* A deliberately quiet effort rail.'),
    );

    expect(reducedMotion).toMatch(
      /\.boot\[data-phase='in'\]\[data-variant='console'\] \.boot-console\s*{[^}]*animation-name: boot-fade !important;/s,
    );
    expect(reducedMotion).toMatch(
      /\.boot-console-line,[^}]*\.boot-console-command,[^}]*\.boot-console-cursor\s*{[^}]*animation: none !important;/s,
    );
  });

  it('reveals the app with an opacity-only curtain', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const curtain = stylesheet.match(/@keyframes boot-curtain\s*{([\s\S]*?)\n}/)?.[1];

    expect(curtain).toContain('opacity: 0');
    expect(curtain).not.toContain('transform');
  });

  it('keeps the console compact enough for narrow phones', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');

    expect(stylesheet).toMatch(/\.boot-console\s*{[^}]*padding: 1rem;/s);
    expect(stylesheet).toMatch(
      /\.boot-console-log\s*{[^}]*font-size: clamp\(0\.6875rem, 3\.125vw, 0\.75rem\);/s,
    );
    expect(stylesheet).toMatch(/\.boot-console-prompt\s*{[^}]*flex-wrap: wrap;/s);
  });

  it('paints the rare console as a GRUB terminal, black with white glyphs', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const bootStyles = stylesheet.slice(stylesheet.indexOf(" * L'ouverture de l'app."));
    const block = bootStyles.slice(
      bootStyles.indexOf('.boot-console {'),
      bootStyles.indexOf('.boot-console-command {'),
    );

    expect(block).toMatch(/\.boot-console\s*{[^}]*background:\s*#000;/s);
    expect(block).toMatch(/\.boot-console-log\s*{[^}]*color:\s*#fff;/s);
    expect(block).not.toMatch(/var\(--surface-0\)/);
    expect(block).not.toMatch(/var\(--text-1\)/);
  });

  it('plays the whole console under the logo on the TTY1 path', () => {
    const { container, getByText, queryByText } = render(<BootScreen variant="tty1" />);

    expect(container.querySelector('.boot')?.getAttribute('data-variant')).toBe('tty1');
    expect(container.querySelector('.boot-bar')).not.toBeNull();
    expect(queryByText(t('app.principle'))).toBeNull();
    expect(container.querySelectorAll('.boot-tty1-line')).toHaveLength(4);
    expect(getByText(t('boot.consoleCommand'))).not.toBeNull();
    expect(getByText(`# ${t('app.tagline')}`)).not.toBeNull();
  });

  it('levels each status line of the TTY1 console', () => {
    const { container } = render(<BootScreen variant="tty1" />);

    expect(
      [...container.querySelectorAll('.boot-tty1-tag')].map((tag) =>
        tag.getAttribute('data-level'),
      ),
    ).toEqual(['ok', 'ok', 'warn', 'fail']);
  });

  it('keeps the brackets of a status line out of its colour', () => {
    const { container } = render(<BootScreen variant="tty1" />);
    const first = container.querySelector('.boot-tty1-line');

    // Grey brackets around a coloured word, as on a Linux console: `[` OK `]`.
    expect(first?.querySelectorAll('.boot-tty1-bracket')).toHaveLength(2);
    expect(first?.textContent).toBe(t('boot.consoleQuadriceps'));
  });

  it('prints the app version under its name', () => {
    const { getByText } = render(<BootScreen variant="tty1" />);

    expect(getByText(t('boot.versionLine', { version: APP_VERSION }))).not.toBeNull();
  });

  it('prints no version line on the other paths', () => {
    const { container } = render(<BootScreen variant="normal" />);

    expect(container.querySelector('.boot-tty1-version')).toBeNull();
  });

  it('keeps the TTY1 opening as long as the normal one', () => {
    expect(BOOT_HOLD_MS.tty1).toBe(BOOT_HOLD_MS.normal);
  });

  it('shows the TTY1 console at once in reduced motion', () => {
    const skin = readFileSync('src/styles/tty1.css', 'utf8');
    const reduced = skin.slice(skin.indexOf('@media (prefers-reduced-motion: reduce)'));

    expect(reduced).toMatch(/\.boot-tty1-line[^}]*animation:\s*none\s*!important;/s);
  });
});
