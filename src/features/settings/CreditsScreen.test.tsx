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
    expect(screen.getByText(t('credits.fontLicence'))).toBeInTheDocument();
    expect(screen.getByText(t('credits.fontAuthors'))).toBeInTheDocument();
  });
});
