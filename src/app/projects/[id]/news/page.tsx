'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { ResearchProject, AnalyzedArticle, Article } from '@/types'
import { ProjectTabs } from '@/components/projects/ProjectTabs'
import { NewsFilter } from '@/components/news/NewsFilter'
import { PageSkeleton } from '@/components/ui/Skeleton'

export default function ProjectNewsPage() {
  const params = useParams()
  const id = params.id as string

  const [project, setProject] = useState<ResearchProject | null>(null)
  const [articles, setArticles] = useState<(AnalyzedArticle | Article)[]>([])
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [projRes, analyzedRes, rawRes, excludedRes] = await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch(`/api/projects/${id}/articles`),
          fetch(`/api/projects/${id}/articles?type=raw`),
          fetch(`/api/projects/${id}/articles/excluded`),
        ])
        const projData = await projRes.json()
        const analyzedData = await analyzedRes.json()
        const rawData = await rawRes.json()
        const excludedData = await excludedRes.json()

        if (projData.success) setProject(projData.data)

        const analyzedArticles: AnalyzedArticle[] = analyzedData.success ? analyzedData.data : []
        const rawArticles: Article[] = rawData.success ? rawData.data : []

        if (analyzedArticles.length > 0) {
          const analyzedIdSet = new Set(analyzedArticles.map((a: AnalyzedArticle) => a.id))
          const unanalyzedRaw = rawArticles.filter((a: Article) => !analyzedIdSet.has(a.id))
          setArticles([...analyzedArticles, ...unanalyzedRaw])
        } else {
          setArticles(rawArticles)
        }

        if (excludedData.success) {
          setExcludedIds(new Set(excludedData.data))
        }
      } catch {
        // handled by empty state
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id])

  const handleToggleExclusion = useCallback(async (articleId: string) => {
    const prev = excludedIds
    const next = new Set(prev)
    if (next.has(articleId)) {
      next.delete(articleId)
    } else {
      next.add(articleId)
    }

    setExcludedIds(next)

    try {
      const res = await fetch(`/api/projects/${id}/articles/excluded`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...next] }),
      })
      const data = await res.json()
      if (!data.success) {
        setExcludedIds(prev)
      }
    } catch {
      setExcludedIds(prev)
    }
  }, [id, excludedIds])

  if (isLoading) {
    return <PageSkeleton />
  }

  const categoryLabels: Record<string, string> = {}
  if (project?.config) {
    for (const cat of project.config.categories) {
      categoryLabels[cat.id] = cat.label
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">{project?.name ?? '뉴스'}</h1>
        <a href="/projects" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">&larr; 워크스페이스</a>
      </div>

      <ProjectTabs projectId={id} />

      <div className="mb-6">
        <p className="text-gray-400 text-sm">수집된 뉴스 목록</p>
      </div>

      <NewsFilter
        articles={articles}
        categoryLabels={categoryLabels}
        isReviewMode={isReviewMode}
        excludedIds={excludedIds}
        onToggleReviewMode={() => setIsReviewMode((v) => !v)}
        onToggleExclusion={handleToggleExclusion}
      />
    </div>
  )
}
