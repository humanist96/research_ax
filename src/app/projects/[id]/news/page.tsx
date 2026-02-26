'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import type { ResearchProject, AnalyzedArticle } from '@/types'
import { ProjectTabs } from '@/components/projects/ProjectTabs'
import { NewsFilter } from '@/components/news/NewsFilter'

export default function ProjectNewsPage() {
  const params = useParams()
  const id = params.id as string

  const [project, setProject] = useState<ResearchProject | null>(null)
  const [articles, setArticles] = useState<AnalyzedArticle[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [projRes, artRes] = await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch(`/api/projects/${id}/articles`),
        ])
        const projData = await projRes.json()
        const artData = await artRes.json()

        if (projData.success) setProject(projData.data)
        if (artData.success) setArticles(artData.data)
      } catch {
        // handled by empty state
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id])

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>로딩 중...</p>
      </div>
    )
  }

  const categoryLabels: Record<string, string> = {}
  if (project?.config) {
    for (const cat of project.config.categories) {
      categoryLabels[cat.id] = cat.label
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">{project?.name ?? '뉴스'}</h1>
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">&larr; 홈으로</a>
      </div>

      <ProjectTabs projectId={id} />

      <div className="mb-6">
        <p className="text-gray-500 text-sm">수집된 뉴스 목록</p>
      </div>

      <NewsFilter articles={articles} categoryLabels={categoryLabels} />
    </div>
  )
}
