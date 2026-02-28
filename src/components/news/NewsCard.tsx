import type { AnalyzedArticle, Article } from '@/types'

interface NewsCardProps {
  readonly article: AnalyzedArticle | Article
  readonly categoryLabels?: Record<string, string>
  readonly isExcluded?: boolean
  readonly isReviewMode?: boolean
  readonly onToggleExclusion?: (articleId: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  'ai-trading': 'bg-red-500/20 text-red-300',
  'robo-advisor': 'bg-blue-500/20 text-blue-300',
  'customer-service-ai': 'bg-green-500/20 text-green-300',
  'risk-management-ai': 'bg-yellow-500/20 text-yellow-300',
  'internal-automation': 'bg-purple-500/20 text-purple-300',
  'other': 'bg-gray-500/20 text-gray-300',
}

function isAnalyzed(article: AnalyzedArticle | Article): article is AnalyzedArticle {
  return 'category' in article
}

export function NewsCard({
  article,
  categoryLabels = {},
  isExcluded = false,
  isReviewMode = false,
  onToggleExclusion,
}: NewsCardProps) {
  const analyzed = isAnalyzed(article)
  const colorClass = analyzed
    ? (CATEGORY_COLORS[article.category] ?? 'bg-gray-500/20 text-gray-300')
    : 'bg-gray-500/20 text-gray-300'
  const label = analyzed
    ? (categoryLabels[article.category] ?? article.category)
    : '미분류'

  const cardClass = isExcluded
    ? 'glass rounded-xl p-4 opacity-40 border border-red-500/50'
    : 'glass glass-hover rounded-xl p-4'

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          {isReviewMode && onToggleExclusion && (
            <button
              onClick={() => onToggleExclusion(article.id)}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                isExcluded
                  ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-300'
              }`}
            >
              {isExcluded ? '제외됨' : '제외'}
            </button>
          )}
          <span className="text-xs text-gray-500">
            {new Date(article.publishedAt).toLocaleDateString('ko-KR')}
          </span>
        </div>
      </div>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm font-medium text-gray-200 hover:text-blue-400 mb-2 line-clamp-2 transition-colors"
      >
        {article.title}
      </a>
      {analyzed && article.summary && (
        <p className="text-xs text-gray-500 line-clamp-2">{article.summary}</p>
      )}
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
        <span>{article.source}</span>
        {article.matchedKeywords.length > 0 && (
          <>
            <span>|</span>
            <span className="truncate">
              {article.matchedKeywords.slice(0, 3).join(', ')}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
