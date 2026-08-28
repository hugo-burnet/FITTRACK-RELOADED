import { useNavigate } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { Card, SectionTitle } from '@/ui';

/**
 * The attributions FitTrack owes, on a screen rather than in the repository.
 *
 * **Obligation, not courtesy.** The muscle drawing is an adaptation of Z-Anatomy
 * under CC BY-SA 4.0, whose §3(a) asks that the credit, the licence and the
 * notice of modification travel with the work "in any reasonable manner based on
 * the medium". `licenses/z-anatomy/` covers someone who clones the source; it
 * covers nobody who installs the PWA or the APK. This screen is the medium's
 * reasonable manner.
 *
 * No accent anywhere: the charte spends it on primary actions, validated sets and
 * records, and a credits page is none of those.
 */
export function CreditsScreen() {
  const navigate = useNavigate();

  return (
    <Screen title={t('credits.title')} onBack={() => void navigate('/settings')}>
      <div className="flex flex-col gap-9">
        {/* La signature, en une ligne, sur le seul écran qui répond à « c'est
            quoi, cette app ». L'ouverture la joue en trois temps ; ici elle se
            lit d'un coup, et sans accent comme le reste de cette page. */}
        <p className="px-1 text-[0.9375rem] leading-relaxed font-semibold text-[var(--text-1)]">
          {t('app.slogan')}
        </p>

        <p className="px-1 text-sm leading-relaxed text-[var(--text-2)]">{t('credits.intro')}</p>

        <section>
          <SectionTitle>{t('credits.muscleMapTitle')}</SectionTitle>
          <Card padded>
            <div className="flex flex-col gap-2">
              {/* The work and its licence on one line: the two facts an
                  attribution is checked against. */}
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-semibold text-[var(--text-1)]">
                  {t('credits.muscleMapWork')}
                </span>
                <span className="text-sm text-[var(--text-2)]">
                  {t('credits.muscleMapLicence')}
                </span>
              </p>

              <p className="text-sm leading-relaxed text-[var(--text-2)]">
                {t('credits.muscleMapAuthors')}
              </p>

              <p className="text-sm leading-relaxed text-[var(--text-2)]">
                {t('credits.muscleMapNotice')}
              </p>

              {/* The licence's own URI. §3(a)(1)(C) accepts a URI or a hyperlink;
                  this is both, so it still reads as an address when the phone is
                  offline in a basement and nothing can be opened. */}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer"
                className="text-sm break-all text-[var(--text-2)] underline underline-offset-4"
              >
                {t('credits.muscleMapLink')}
              </a>
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle>{t('credits.appTitle')}</SectionTitle>
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('credits.appNotice')}</p>
          </Card>
        </section>
      </div>
    </Screen>
  );
}
