import { useState, useSyncExternalStore } from 'react';
import { t, type TranslationKey } from '@/i18n/fr';
import { isOfflineReady, subscribeAppUpdate } from '@/platform/appUpdate';
import {
  isInstallAvailable,
  isInstalled,
  promptInstall,
  subscribeInstall,
  type InstallOutcome,
} from '@/platform/install';
import { ListRow } from '@/ui';

/** Every answer the browser can give to "install this", each with its sentence. */
const INSTALL_MESSAGE = {
  installed: 'settings.installDone',
  dismissed: 'settings.installDismissed',
  unavailable: 'settings.installUnavailable',
  failed: 'settings.installFailed',
} as const satisfies Record<InstallOutcome, TranslationKey>;

/** L'installation sur l'écran d'accueil, et l'état de la copie hors-ligne qu'elle déclenche. */
export function InstallSettings() {
  /** Ce que l'invite d'installation a donné. */
  const [installOutcome, setInstallOutcome] = useState<InstallOutcome | null>(null);
  const installAvailable = useSyncExternalStore(subscribeInstall, isInstallAvailable, () => false);
  const offlineReady = useSyncExternalStore(subscribeAppUpdate, isOfflineReady, () => false);
  // Lu une fois : le mode d'affichage ne change pas en cours de session, et
  // `matchMedia` n'existe pas sous jsdom.
  const [standalone] = useState(isInstalled);

  /**
   * L'invite d'installation. Le bouton reste cliquable même quand le navigateur
   * n'a rien à proposer : une ligne grisée n'explique pas pourquoi, et la
   * réponse « déjà installée, ou à ajouter depuis le menu » est justement ce que
   * l'utilisateur a besoin de lire à ce moment-là.
   */
  const install = async () => {
    setInstallOutcome(await promptInstall());
  };

  /**
   * Chrome décide seul du moment où il fire `beforeinstallprompt`, et il peut le
   * faire après que l'utilisateur a tapé la ligne. « Déjà installée, ou à
   * ajouter depuis le menu » deviendrait alors faux sous les yeux de quelqu'un
   * qui a maintenant une vraie invite disponible. Le message se retire de
   * lui-même plutôt que de survivre à sa raison d'être.
   */
  const shownOutcome = installOutcome === 'unavailable' && installAvailable ? null : installOutcome;

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-[var(--surface-1)]">
        <ListRow
          title={t('settings.installLink')}
          subtitle={t('settings.installHint')}
          disabled={standalone}
          onClick={() => void install()}
        />
      </div>
      {shownOutcome !== null && (
        <p
          role="status"
          className={`mt-3 px-1 text-sm leading-relaxed ${
            shownOutcome === 'failed' ? 'text-[var(--danger-ink)]' : 'text-[var(--text-2)]'
          }`}
        >
          {t(INSTALL_MESSAGE[shownOutcome])}
        </p>
      )}
      {/*
        L'état hors-ligne se lit, il ne se règle pas : c'est la réponse à
        « est-ce que ça marchera au sous-sol ? », la seule question que la
        règle n°2 pose vraiment. Il vit sous la ligne d'installation parce
        que c'est l'installation qui le déclenche.
      */}
      <p className="mt-3 px-1 text-sm leading-relaxed text-[var(--text-2)]">
        {t(offlineReady ? 'settings.offlineReady' : 'settings.offlinePending')}
      </p>
    </div>
  );
}
