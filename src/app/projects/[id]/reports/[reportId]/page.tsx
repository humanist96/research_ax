'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import type { DeepReportMeta } from '@/lib/deep-research/types'
import { ProjectTabs } from '@/components/projects/ProjectTabs'
import { DeepReportViewer } from '@/components/reports/DeepReportViewer'
import { PageSkeleton } from '@/components/ui/Skeleton'

interface SectionData {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly sourcesCount: number
  readonly status: 'complete' | 'error'
}

export default function DeepReportPage() {
  const params = useParams()
  const projectId = params.id as string
  const reportId = params.reportId as string

  const [meta, setMeta] = useState<DeepReportMeta | null>(null)
  const [sections, setSections] = useState<SectionData[]>([])
  const [mergedContent, setMergedContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [detailRes, mergedRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/reports/${reportId}`),
          fetch(`/api/projects/${projectId}/reports/${reportId}/download?format=md`),
        ])

        const detailData = await detailRes.json()

        if (!detailData.success) {
          setError(detailData.error ?? 'Failed to load report')
          return
        }

        setMeta(detailData.data.meta)
        setSections(detailData.data.sections)

        if (mergedRes.ok) {
          const md = await mergedRes.text()
          setMergedContent(md)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [projectId, reportId])

  if (isLoading) {
    return <PageSkeleton />
  }

  if (error || !meta) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-red-400">{error ?? '보고서를 찾을 수 없습니다'}</p>
          <a href={`/projects/${projectId}/reports`} className="text-sm text-blue-400 hover:underline mt-2 inline-block">
            리포트 목록으로 돌아가기
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">{meta.title}</h1>
        <a href={`/projects/${projectId}/reports`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          &larr; 리포트 목록
        </a>
      </div>

      <ProjectTabs projectId={projectId} />

      <DeepReportViewer
        projectId={projectId}
        reportId={reportId}
        meta={meta}
        sections={sections}
        mergedContent={mergedContent}
      />
    </div>
  )
}
