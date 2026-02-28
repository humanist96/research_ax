'use client'

import { useState, useCallback } from 'react'
import type { ArticlesForReview } from '@/lib/deep-research/types'

interface ArticleReviewPanelProps {
  readonly projectId: string
  readonly sections: readonly ArticlesForReview[]
  readonly onSubmit: (excludedBySection: Record<string, string[]>) => void
  readonly isSubmitting: boolean
}

function SectionReviewCard({
  section,
  excludedUrls,
  collapsed,
  onToggleCollapse,
  onToggleArticle,
  onToggleAll,
}: {
  readonly section: ArticlesForReview
  readonly excludedUrls: ReadonlySet<string>
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
  readonly onToggleArticle: (url: string) => void
  readonly onToggleAll: (include: boolean) => void
}) {
  const includedCount = section.articles.length - excludedUrls.size
  const totalCount = section.articles.length

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-white/5">
        <button
          onClick={onToggleCollapse}
          className="text-gray-400 hover:text-white transition-colors text-sm w-5"
        >
          {collapsed ? '\u25B6' : '\u25BC'}
        </button>
        <span className="text-gray-200 font-medium flex-1">{section.sectionTitle}</span>
        <span className="text-xs text-gray-400">
          <span className={includedCount === totalCount ? 'text-green-400' : 'text-amber-400'}>
            {includedCount}
          </span>
          /{totalCount}건 선택
        </span>
      </div>
      {!collapsed && (
        <div className="px-4 py-2 space-y-1">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => onToggleAll(true)}
              className="px-2 py-1 text-xs text-gray-400 border border-white/10 rounded hover:text-white hover:border-white/20 transition-all"
            >
              전체 선택
            </button>
            <button
              onClick={() => onToggleAll(false)}
              className="px-2 py-1 text-xs text-gray-400 border border-white/10 rounded hover:text-white hover:border-white/20 transition-all"
            >
              전체 해제
            </button>
          </div>
          {section.articles.map((article) => {
            const isExcluded = excludedUrls.has(article.link)
            return (
              <label
                key={article.link}
                className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  isExcluded ? 'opacity-50 bg-white/[0.02]' : 'hover:bg-white/5'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!isExcluded}
                  onChange={() => onToggleArticle(article.link)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${isExcluded ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                    {article.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {article.source} &middot; {article.pubDate}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ArticleReviewPanel({ projectId, sections, onSubmit, isSubmitting }: ArticleReviewPanelProps) {
  const [excludedBySection, setExcludedBySection] = useState<Record<string, Set<string>>>({})
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set())

  const toggleCollapse = useCallback((sectionId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }, [])

  const toggleArticle = useCallback((sectionId: string, url: string) => {
    setExcludedBySection((prev) => {
      const current = prev[sectionId] ?? new Set<string>()
      const next = new Set(current)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
      }
      return { ...prev, [sectionId]: next }
    })
  }, [])

  const toggleAll = useCallback((sectionId: string, include: boolean, articles: readonly ArticlesForReview['articles'][number][]) => {
    setExcludedBySection((prev) => {
      if (include) {
        return { ...prev, [sectionId]: new Set<string>() }
      }
      return { ...prev, [sectionId]: new Set(articles.map((a) => a.link)) }
    })
  }, [])

  const handleSubmit = useCallback(() => {
    const result: Record<string, string[]> = {}
    for (const [sectionId, urls] of Object.entries(excludedBySection)) {
      if (urls.size > 0) {
        result[sectionId] = [...urls]
      }
    }
    onSubmit(result)
  }, [excludedBySection, onSubmit])

  const totalArticles = sections.reduce((sum, s) => sum + s.articles.length, 0)
  const totalExcluded = Object.values(excludedBySection).reduce((sum, s) => sum + s.size, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-white font-medium">기사 리뷰</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            분석에 포함할 기사를 선택하세요 &middot; 총 {totalArticles}건 중 {totalArticles - totalExcluded}건 선택됨
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {sections.map((section) => (
          <SectionReviewCard
            key={section.sectionId}
            section={section}
            excludedUrls={excludedBySection[section.sectionId] ?? new Set()}
            collapsed={collapsedIds.has(section.sectionId)}
            onToggleCollapse={() => toggleCollapse(section.sectionId)}
            onToggleArticle={(url) => toggleArticle(section.sectionId, url)}
            onToggleAll={(include) => toggleAll(section.sectionId, include, section.articles)}
          />
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
        >
          {isSubmitting ? '제출 중...' : `분석 진행 (${totalArticles - totalExcluded}건)`}
        </button>
      </div>
    </div>
  )
}
