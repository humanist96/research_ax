import type { AnalyzedArticle } from '@/types'

interface NewsCardProps {
  readonly article: AnalyzedArticle
  readonly categoryLabels?: Record<string, string>
}

const CATEGORY_COLORS: Record<string, string> = {
  'ai-trading': 'bg-red-100 text-red-800',
  'robo-advisor': 'bg-blue-100 text-blue-800',
  'customer-service-ai': 'bg-green-100 text-green-800',
  'risk-management-ai': 'bg-yellow-100 text-yellow-800',
  'internal-automation': 'bg-purple-100 text-purple-800',
  'other': 'bg-gray-100 text-gray-800',
}

export function NewsCard({ article, categoryLabels = {} }: NewsCardProps) {
  const colorClass = CATEGORY_COLORS[article.category] ?? 'bg-gray-100 text-gray-800'
  const label = categoryLabels[article.category] ?? article.category

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
          {label}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(article.publishedAt).toLocaleDateString('ko-KR')}
        </span>
      </div>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm font-medium text-gray-900 hover:text-blue-600 mb-2 line-clamp-2"
      >
        {article.title}
      </a>
      {article.summary && (
        <p className="text-xs text-gray-500 line-clamp-2">{article.summary}</p>
      )}
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
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
