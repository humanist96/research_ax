import type { AnalyzedArticle } from '@/types'

interface StatsCardsProps {
  readonly articles: readonly AnalyzedArticle[]
  readonly categoryLabels?: Record<string, string>
}

export function StatsCards({ articles, categoryLabels = {} }: StatsCardsProps) {
  const totalArticles = articles.length
  const todayStr = new Date().toISOString().split('T')[0]
  const todayCount = articles.filter(
    (a) => a.collectedAt.split('T')[0] === todayStr
  ).length

  const categoryCounts: Record<string, number> = {}
  for (const article of articles) {
    categoryCounts[article.category] = (categoryCounts[article.category] ?? 0) + 1
  }
  const categoryCount = Object.keys(categoryCounts).length

  const topCategory = Object.entries(categoryCounts).reduce(
    (max, [cat, count]) => (count > max.count ? { category: cat, count } : max),
    { category: '', count: 0 }
  )

  const topCategoryLabel = categoryLabels[topCategory.category] ?? topCategory.category

  const stats = [
    { label: '총 기사 수', value: totalArticles, color: 'bg-blue-500' },
    { label: '오늘 수집', value: todayCount, color: 'bg-green-500' },
    { label: '카테고리', value: categoryCount, color: 'bg-purple-500' },
    {
      label: '최다 카테고리',
      value: topCategoryLabel || '-',
      sub: topCategory.count > 0 ? `${topCategory.count}건` : undefined,
      color: 'bg-orange-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-lg shadow p-6 border-l-4"
          style={{ borderLeftColor: 'var(--accent)' }}
        >
          <div className={`inline-block px-2 py-1 rounded text-white text-xs ${stat.color} mb-2`}>
            {stat.label}
          </div>
          <div className="text-2xl font-bold">{stat.value}</div>
          {stat.sub && <div className="text-sm text-gray-500">{stat.sub}</div>}
        </div>
      ))}
    </div>
  )
}
