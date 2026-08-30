import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { t } from '@/i18n/fr';
import { BootScreen } from './Boot';

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
});
