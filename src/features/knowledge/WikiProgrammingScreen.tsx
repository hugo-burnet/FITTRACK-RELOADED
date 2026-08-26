import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import {
  findProgrammingSection,
  programmingIsUnreviewed,
  programmingRowCount,
  programmingSections,
  programmingTitle,
  type ProgrammingField,
  type ProgrammingRow,
} from './programmingIndex';

/**
 * Le texte des sources arrive en markdown (`[libellé](url)`), et les liens sont
 * déjà séparés dans `links`. On rend les libellés sans les URL : un lien externe
 * n'a rien à faire dans une app qui doit fonctionner dans un sous-sol sans 4G.
 */
function fieldValue(field: ProgrammingField): string {
  if (field.links.length === 0) return field.value;
  return field.links.map((link) => link.label).join(' · ');
}

function RowCard({ row }: { row: ProgrammingRow }) {
  const [head, ...rest] = row.fields;
  return (
    <article className="relative overflow-hidden rounded-2xl bg-[var(--surface-1)] pl-1">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--accent-ink)]" />
      <div className="p-5">
        {head !== undefined && (
          <>
            <p className="label-xs font-semibold text-[var(--accent-ink)]">{head.label}</p>
            <p className="mt-3 text-base leading-7 text-[var(--text-1)]">{fieldValue(head)}</p>
          </>
        )}

        <dl className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
          {rest.map((field) => (
            <div key={field.label}>
              <dt className="label-xs font-semibold text-[var(--text-2)]">{field.label}</dt>
              <dd className="mt-1 text-sm leading-6 text-[var(--text-1)]">{fieldValue(field)}</dd>
            </div>
          ))}
        </dl>

        <p className="record-figure mt-4 text-xs leading-5 text-[var(--text-2)]">
          {row.rowId} · {row.startByte}–{row.endByte}
        </p>
      </div>
    </article>
  );
}

/** Le bandeau qui dit que rien de tout ça n'a été relu. Il ne se ferme pas. */
function UnreviewedNotice() {
  if (!programmingIsUnreviewed) return null;
  return (
    <section className="rounded-2xl border border-[var(--border)] p-5">
      <p className="label-xs font-semibold text-[var(--text-2)]">
        {t('knowledge.programming.unreviewedLabel')}
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">
        {t('knowledge.programming.unreviewedBody')}
      </p>
    </section>
  );
}

export function WikiProgrammingScreen() {
  const navigate = useNavigate();
  const { sectionId } = useParams<{ sectionId: string }>();
  const section = sectionId === undefined ? undefined : findProgrammingSection(sectionId);

  if (sectionId !== undefined && section === undefined) {
    return (
      <Screen title={t('knowledge.wiki.notFoundTitle')} onBack={() => void navigate('/knowledge')}>
        <div role="status" className="rounded-2xl border border-[var(--border)] p-5">
          <p className="text-sm leading-6 text-[var(--text-2)]">{t('knowledge.wiki.notFoundBody')}</p>
        </div>
      </Screen>
    );
  }

  if (section !== undefined) {
    const fiches = section.rows.filter((row) => !row.isBibliography);
    const references = section.rows.filter((row) => row.isBibliography);
    return (
      <Screen
        title={section.title}
        onBack={() => void navigate('/knowledge/programmation')}
        sub={<p className="text-sm leading-6 text-[var(--text-2)]">{programmingTitle}</p>}
      >
        <div className="space-y-4">
          <UnreviewedNotice />
          {fiches.map((row) => (
            <RowCard key={row.rowId} row={row} />
          ))}
          {references.length > 0 && (
            <section className="border-t border-[var(--border)] px-1 pt-5">
              <h2 className="label-xs font-semibold text-[var(--text-2)]">
                {t('knowledge.programming.referencesTitle')}
              </h2>
              <div className="mt-4 space-y-4">
                {references.map((row) => (
                  <RowCard key={row.rowId} row={row} />
                ))}
              </div>
            </section>
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      title={t('knowledge.programming.title')}
      onBack={() => void navigate('/knowledge')}
      action={
        <span className="record-figure text-sm text-[var(--text-2)]">
          {t('knowledge.programming.rowCount', { count: programmingRowCount })}
        </span>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl bg-[var(--accent-soft)] p-5">
          <p className="text-sm leading-6 text-[var(--text-1)]">
            {t('knowledge.programming.intro')}
          </p>
        </section>

        <UnreviewedNotice />

        <ul className="space-y-1">
          {programmingSections.map((item) => (
            <li key={item.sectionId}>
              <Link
                to={`/knowledge/p/${item.sectionId}`}
                className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-[var(--surface-1)] px-4 py-2 text-sm leading-6 text-[var(--text-1)]"
              >
                <span>{item.title}</span>
                <span className="record-figure shrink-0 text-xs text-[var(--text-2)]">
                  {item.rows.length}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}
