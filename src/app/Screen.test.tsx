import { render, screen } from '@testing-library/react';
import { t } from '@/i18n/fr';
import { Screen } from './Screen';
import { APP_VERSION } from './version';

describe('Screen', () => {
  it('shows the app version in its header', () => {
    render(
      <Screen title="Accueil">
        <p>contenu</p>
      </Screen>,
    );

    const version = screen.getByText(t('app.versionLabel', { version: APP_VERSION }));

    expect(version.closest('header')).toContainElement(
      screen.getByRole('heading', { level: 1, name: 'Accueil' }),
    );
  });

  it('leaves the title alone: the version is not part of the heading', () => {
    render(
      <Screen title="Pecs / triceps du lundi">
        <p>contenu</p>
      </Screen>,
    );

    // `name` is matched whole: a version written into the h1 would turn the title into
    // "Pecs / triceps du lundi v…", which is what a user-chosen name must never become.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Pecs / triceps du lundi' }),
    ).toBeInTheDocument();
  });

  it('is not something to press', () => {
    render(
      <Screen title="Accueil" onBack={() => {}}>
        <p>contenu</p>
      </Screen>,
    );

    const version = screen.getByText(t('app.versionLabel', { version: APP_VERSION }));

    expect(version.closest('button')).toBeNull();
  });
});

describe('Screen cursor', () => {
  it('renders a decorative cursor after the title when asked', () => {
    const { container } = render(
      <Screen title="Accueil" cursor>
        <span />
      </Screen>,
    );

    // Hidden from the accessibility tree: the title keeps its own name.
    expect(screen.getByRole('heading', { level: 1, name: 'Accueil' })).toBeInTheDocument();
    expect(container.querySelector('.tty-cursor')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders nothing extra by default', () => {
    const { container } = render(
      <Screen title="Accueil">
        <span />
      </Screen>,
    );

    expect(container.querySelector('.tty-cursor')).toBeNull();
  });
});
