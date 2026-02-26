import type { AnalyzedArticle } from '@/types'

interface RecentNewsProps {
  readonly articles: readonly AnalyzedArticle[]
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

const DYNAMIC_COLORS = [
  'bg-red-100 text-red-800',
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
]

function getCategoryColor(category: string, index?: number): string {
  return CATEGORY_COLORS[category] ?? DYNAMIC_COLORS[(index ?? 0) % DYNAMIC_COLORS.length] ?? 'bg-gray-100 text-gray-800'
}

export function RecentNews({ articles, categoryLabels = {} }: RecentNewsProps) {
  const recent = [...articles]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 10)

  const uniqueCategories = [...new Set(articles.map((a) => a.category))]
  const categoryIndex: Record<string, number> = {}
  uniqueCategories.forEach((cat, i) => { categoryIndex[cat] = i })

  if (recent.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">최근 뉴스</h2>
        <p className="text-gray-500">수집된 뉴스가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">최근 뉴스</h2>
      <div className="space-y-3">
        {recent.map((article) => (
          <div key={article.id} className="border-b border-gray-100 pb-3 last:border-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-1"
                >
                  {article.title}
                </a>
                {article.summary && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{article.summary}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(article.category, categoryIndex[article.category])}`}>
                  {categoryLabels[article.category] ?? article.category}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(article.publishedAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
