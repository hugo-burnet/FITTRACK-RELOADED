import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BootScreen } from './Boot';

describe('BootScreen', () => {
  it('exposes the layered scene used for the ground impact', () => {
    const { container } = render(<BootScreen />);

    expect(container.querySelector('.boot-impact')).not.toBeNull();
    expect(container.querySelector('.boot-barbell')).not.toBeNull();
    expect(container.querySelector('.boot-ground')).not.toBeNull();
    expect(container.querySelectorAll('.boot-dust')).toHaveLength(2);
  });

  it('builds the dust from lightweight vector particles', () => {
    const { container } = render(<BootScreen />);

    expect(container.querySelectorAll('.boot-dust circle')).toHaveLength(6);
  });

  it('keeps reduced-motion dust opacity-only', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');

    expect(stylesheet).toContain('animation-name: boot-dust-fade !important;');
    expect(stylesheet).toMatch(/@keyframes boot-dust-fade\s*{[^}]*opacity:/s);
  });
});
