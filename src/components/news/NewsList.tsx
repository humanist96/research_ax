import type { AnalyzedArticle } from '@/types'
import { NewsCard } from './NewsCard'

interface NewsListProps {
  readonly articles: readonly AnalyzedArticle[]
  readonly categoryLabels?: Record<string, string>
}

export function NewsList({ articles, categoryLabels }: NewsListProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg mb-2">수집된 뉴스가 없습니다</p>
        <p className="text-sm">패스트 리서치를 실행하여 뉴스를 수집해주세요.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} categoryLabels={categoryLabels} />
      ))}
    </div>
  )
}
