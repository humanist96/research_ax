import type { AnalyzedArticle } from '@/types'

interface NewsCardProps {
  readonly article: AnalyzedArticle
  readonly categoryLabels?: Record<string, string>
}

const CATEGORY_COLORS: Record<string, string> = {
  'ai-trading': 'bg-red-500/20 text-red-300',
  'robo-advisor': 'bg-blue-500/20 text-blue-300',
  'customer-service-ai': 'bg-green-500/20 text-green-300',
  'risk-management-ai': 'bg-yellow-500/20 text-yellow-300',
  'internal-automation': 'bg-purple-500/20 text-purple-300',
  'other': 'bg-gray-500/20 text-gray-300',
}

export function NewsCard({ article, categoryLabels = {} }: NewsCardProps) {
  const colorClass = CATEGORY_COLORS[article.category] ?? 'bg-gray-500/20 text-gray-300'
  const label = categoryLabels[article.category] ?? article.category

  return (
    <div className="glass glass-hover rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
          {label}
        </span>
        <span className="text-xs text-gray-500">
          {new Date(article.publishedAt).toLocaleDateString('ko-KR')}
        </span>
      </div>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm font-medium text-gray-200 hover:text-indigo-400 mb-2 line-clamp-2 transition-colors"
      >
        {article.title}
      </a>
      {article.summary && (
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
