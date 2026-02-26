'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { ResearchProject, AnalyzedArticle } from '@/types'
import { ProjectTabs } from '@/components/projects/ProjectTabs'
import { PipelineStatus } from '@/components/projects/PipelineStatus'
import { ConfigPreview } from '@/components/projects/ConfigPreview'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { RecentNews } from '@/components/dashboard/RecentNews'
import { CategoryChart } from '@/components/dashboard/CategoryChart'
import { DeepResearchPanel } from '@/components/projects/DeepResearchPanel'

export default function ProjectDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [project, setProject] = useState<ResearchProject | null>(null)
  const [articles, setArticles] = useState<AnalyzedArticle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [projRes, artRes] = await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch(`/api/projects/${id}/articles`),
        ])
        const projData = await projRes.json()
        const artData = await artRes.json()

        if (projData.success) {
          if (projData.data.status === 'conversation') {
            router.push(`/projects/${id}/chat`)
            return
          }
          setProject(projData.data)
        } else {
          setError(projData.error)
        }

        if (artData.success) {
          setArticles(artData.data)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id, router])

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>프로젝트를 불러오는 중...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error ?? 'Project not found'}</p>
        <a href="/" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          홈으로 돌아가기
        </a>
      </div>
    )
  }

  const categoryLabels: Record<string, string> = {}
  if (project.config) {
    for (const cat of project.config.categories) {
      categoryLabels[cat.id] = cat.label
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-500 mt-1 text-sm">{project.prompt}</p>
        </div>
        <a
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; 홈으로
        </a>
      </div>

      <ProjectTabs projectId={id} />

      {project.config && (
        <>
          <PipelineStatus
            projectId={id}
            status={project.status}
            onStatusChange={(status) => {
              setProject({ ...project, status })
              if (status === 'complete') {
                fetch(`/api/projects/${id}/articles`)
                  .then((r) => r.json())
                  .then((data) => {
                    if (data.success) setArticles(data.data)
                  })
              }
            }}
          />
          <DeepResearchPanel
            projectId={id}
            status={project.status}
            onStatusChange={(status) => {
              setProject({ ...project, status })
            }}
          />
        </>
      )}

      {articles.length > 0 && (
        <>
          <StatsCards articles={articles} categoryLabels={categoryLabels} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RecentNews articles={articles} categoryLabels={categoryLabels} />
            <CategoryChart articles={articles} categoryLabels={categoryLabels} />
          </div>
        </>
      )}

      {project.config && articles.length === 0 && (
        <ConfigPreview config={project.config} />
      )}
    </div>
  )
}
