import type { AnalyzedArticle } from '@/types'

interface CategoryChartProps {
  readonly articles: readonly AnalyzedArticle[]
  readonly categoryLabels?: Record<string, string>
}

const BAR_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
]

export function CategoryChart({ articles, categoryLabels = {} }: CategoryChartProps) {
  const categoryCounts: Record<string, number> = {}
  for (const article of articles) {
    categoryCounts[article.category] = (categoryCounts[article.category] ?? 0) + 1
  }

  const data = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count], i) => ({
      category,
      label: categoryLabels[category] ?? category,
      count,
      color: BAR_COLORS[i % BAR_COLORS.length],
    }))

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="glass rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">카테고리별 분포</h2>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm">데이터가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.category} className="flex items-center gap-3">
              <div className="w-28 text-sm text-gray-400 shrink-0 text-right truncate" title={item.label}>
                {item.label}
              </div>
              <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all flex items-center justify-end pr-2`}
                  style={{ width: `${Math.max((item.count / maxCount) * 100, item.count > 0 ? 8 : 0)}%` }}
                >
                  {item.count > 0 && (
                    <span className="text-xs text-white font-medium">{item.count}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
