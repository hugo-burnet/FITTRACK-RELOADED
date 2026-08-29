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
});
