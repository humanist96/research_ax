import type { AnalyzedArticle } from '@/types'

interface RecentNewsProps {
  readonly articles: readonly AnalyzedArticle[]
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

const DYNAMIC_COLORS = [
  'bg-red-500/20 text-red-300',
  'bg-blue-500/20 text-blue-300',
  'bg-green-500/20 text-green-300',
  'bg-yellow-500/20 text-yellow-300',
  'bg-purple-500/20 text-purple-300',
  'bg-pink-500/20 text-pink-300',
  'bg-blue-500/20 text-blue-300',
  'bg-teal-500/20 text-teal-300',
]

function getCategoryColor(category: string, index?: number): string {
  return CATEGORY_COLORS[category] ?? DYNAMIC_COLORS[(index ?? 0) % DYNAMIC_COLORS.length] ?? 'bg-gray-500/20 text-gray-300'
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
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">최근 뉴스</h2>
        <p className="text-gray-500">수집된 뉴스가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">최근 뉴스</h2>
      <div className="space-y-3">
        {recent.map((article) => (
          <div key={article.id} className="border-b border-white/5 pb-3 last:border-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-200 hover:text-blue-400 line-clamp-1 transition-colors"
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
                <span className="text-xs text-gray-500">
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
