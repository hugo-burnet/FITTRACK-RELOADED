import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { t } from '@/i18n/fr';
import { CreditsScreen } from './CreditsScreen';

describe('CreditsScreen', () => {
  it('credits the TTY1 font with its work, authors and licence', () => {
    render(
      <MemoryRouter>
        <CreditsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText(t('credits.fontWork'))).toBeInTheDocument();
    // Les deux polices, TTY1 et Cyber, sont sous la même licence : la mention paraît deux fois.
    expect(screen.getAllByText(t('credits.fontLicence'))).toHaveLength(2);
    expect(screen.getByText(t('credits.fontAuthors'))).toBeInTheDocument();
  });

  it('credits the Cyber font, derived from Rajdhani', () => {
    render(
      <MemoryRouter>
        <CreditsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText(t('credits.cyberFontWork'))).toBeInTheDocument();
    expect(screen.getByText(t('credits.cyberFontAuthors'))).toBeInTheDocument();
    expect(screen.getByText(t('credits.cyberFontNotice'))).toBeInTheDocument();
  });
});
