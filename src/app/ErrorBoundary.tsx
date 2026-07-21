import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { t } from '@/i18n/fr';
import { Button, EmptyState } from '@/ui';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * On an installed app an uncaught render error is a white screen with no console
 * to look at. This is the floor under that.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur de rendu non capturée', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-full flex-col items-center justify-center bg-[var(--surface-0)]">
        <EmptyState
          title={t('error.title')}
          body={t('error.body')}
          action={
            <Button variant="primary" fullWidth onClick={() => window.location.reload()}>
              {t('error.reload')}
            </Button>
          }
        />
      </div>
    );
  }
}
