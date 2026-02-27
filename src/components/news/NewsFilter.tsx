'use client'

import { useState, useMemo } from 'react'
import type { AnalyzedArticle, Article } from '@/types'
import { NewsList } from './NewsList'

interface NewsFilterProps {
  readonly articles: readonly (AnalyzedArticle | Article)[]
  readonly categoryLabels?: Record<string, string>
  readonly isReviewMode?: boolean
  readonly excludedIds?: ReadonlySet<string>
  readonly onToggleReviewMode?: () => void
  readonly onToggleExclusion?: (articleId: string) => void
}

function isAnalyzed(article: AnalyzedArticle | Article): article is AnalyzedArticle {
  return 'category' in article
}

export function NewsFilter({
  articles,
  categoryLabels = {},
  isReviewMode = false,
  excludedIds,
  onToggleReviewMode,
  onToggleExclusion,
}: NewsFilterProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const excludedCount = excludedIds?.size ?? 0

  const uniqueCategories = useMemo(() => {
    const cats = new Set(
      articles.filter(isAnalyzed).map((a) => a.category)
    )
    return [...cats].sort()
  }, [articles])

  const filtered = useMemo(() => {
    let result = [...articles]

    if (!isReviewMode && excludedIds && excludedIds.size > 0) {
      result = result.filter((a) => !excludedIds.has(a.id))
    }

    if (selectedCategory !== 'all') {
      result = result.filter((a) => isAnalyzed(a) && a.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          (isAnalyzed(a) && a.summary.toLowerCase().includes(query)) ||
          a.source.toLowerCase().includes(query)
      )
    }

    return result.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
  }, [articles, selectedCategory, searchQuery, isReviewMode, excludedIds])

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="기사 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
        >
          <option value="all">전체 카테고리</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabels[cat] ?? cat}
            </option>
          ))}
        </select>
        {onToggleReviewMode && (
          <button
            onClick={onToggleReviewMode}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isReviewMode
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            {isReviewMode ? '검수 모드 ON' : '검수 모드'}
          </button>
        )}
      </div>
      <div className="mb-4 text-sm text-gray-500 flex items-center gap-3">
        <span>{filtered.length}건의 기사</span>
        {excludedCount > 0 && (
          <span className="text-red-400">
            제외됨: {excludedCount}건
          </span>
        )}
      </div>
      <NewsList
        articles={filtered}
        categoryLabels={categoryLabels}
        isReviewMode={isReviewMode}
        excludedIds={excludedIds}
        onToggleExclusion={onToggleExclusion}
      />
    </div>
  )
}
