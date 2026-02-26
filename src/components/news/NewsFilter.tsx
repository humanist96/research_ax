'use client'

import { useState, useMemo } from 'react'
import type { AnalyzedArticle } from '@/types'
import { NewsList } from './NewsList'

interface NewsFilterProps {
  readonly articles: readonly AnalyzedArticle[]
  readonly categoryLabels?: Record<string, string>
}

export function NewsFilter({ articles, categoryLabels = {} }: NewsFilterProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const uniqueCategories = useMemo(() => {
    const cats = new Set(articles.map((a) => a.category))
    return [...cats].sort()
  }, [articles])

  const filtered = useMemo(() => {
    let result = [...articles]

    if (selectedCategory !== 'all') {
      result = result.filter((a) => a.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.summary.toLowerCase().includes(query) ||
          a.source.toLowerCase().includes(query)
      )
    }

    return result.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
  }, [articles, selectedCategory, searchQuery])

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="기사 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">전체 카테고리</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabels[cat] ?? cat}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4 text-sm text-gray-500">
        {filtered.length}건의 기사
      </div>
      <NewsList articles={filtered} categoryLabels={categoryLabels} />
    </div>
  )
}
