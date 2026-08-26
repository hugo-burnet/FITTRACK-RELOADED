import { useNavigate, useParams } from 'react-router-dom';
import { t } from '@/i18n/fr';
import { ArticleBody } from './ArticleBody';
import { findArticle } from './articleCatalogue';
import { KnowledgeScreenFrame } from './KnowledgeScreenFrame';

/**
 * La page de lecture d'un article. Elle sert les deux adresses — `/knowledge/a`
 * et `/knowledge/programmation/:articleId` — parce qu'un article du Guide se lit
 * exactement comme un autre ; seul l'espace d'où l'on vient change.
 */
export function WikiArticleScreen() {
  const navigate = useNavigate();
  const { articleId } = useParams<{ articleId: string }>();
  const article = articleId === undefined ? undefined : findArticle(articleId);

  // Un article absent n'ouvre pas un écran blanc : il le dit et rend le
  // sommaire, qui est la seule chose dont on est sûr qu'elle existe.
  if (article === undefined) {
    return (
      <KnowledgeScreenFrame
        title={t('knowledge.article.notFoundTitle')}
        onBack={() => void navigate('/knowledge')}
      >
        <div role="status" className="rounded-2xl border border-[var(--border)] p-5">
          <p className="text-sm leading-6 text-[var(--text-2)]">
            {t('knowledge.article.notFoundBody')}
          </p>
        </div>
      </KnowledgeScreenFrame>
    );
  }

  const back = article.family === 'programming' ? '/knowledge/programmation' : '/knowledge';

  return (
    <KnowledgeScreenFrame
      title={article.title}
      onBack={() => void navigate(back)}
      sub={<p className="px-4 text-sm leading-6 text-[var(--text-2)]">{article.summary}</p>}
    >
      <ArticleBody article={article} />
    </KnowledgeScreenFrame>
  );
}
