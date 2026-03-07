import { NextRequest, NextResponse } from 'next/server'
import {
  getProject,
  setProjectStatus,
  getProjectAnalyzedArticles,
  getExcludedArticleIds,
  getProjectReportIndex,
  saveProjectReportIndex,
  saveProjectReport,
} from '@/lib/project/store'
import { buildDynamicReport, buildReportMeta } from '@/lib/report/markdown-builder'
import type { AnalyzedArticle, ReportIndex } from '@/types'

function getDateRange(): { readonly startDate: string; readonly endDate: string } {
  const now = new Date()
  const endDate = now.toISOString().split('T')[0]
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const startDate = weekAgo.toISOString().split('T')[0]
  return { startDate, endDate }
}

function filterByDateRange(
  articles: readonly AnalyzedArticle[],
  startDate: string,
  endDate: string
): readonly AnalyzedArticle[] {
  const rangeArticles = articles.filter((a) => {
    const date = a.publishedAt.split('T')[0]
    return date >= startDate && date <= endDate
  })
  return rangeArticles.length > 0 ? rangeArticles : articles
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = getProject(id)
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    if (!project.config) {
      return NextResponse.json(
        { success: false, error: 'Project has no config' },
        { status: 400 }
      )
    }

    const config = project.config

    try {
      setProjectStatus(id, 'reporting')

      const excludedIds = new Set(getExcludedArticleIds(id))
      const allArticles = getProjectAnalyzedArticles(id).filter((a) => !excludedIds.has(a.id))
      const { startDate, endDate } = getDateRange()
      const articles = filterByDateRange(allArticles, startDate, endDate)

      const markdown = buildDynamicReport(articles as AnalyzedArticle[], startDate, endDate, config.categories, config.reportTitle)
      saveProjectReport(id, endDate, markdown)

      const meta = buildReportMeta(
        articles as AnalyzedArticle[],
        startDate,
        endDate,
        `${config.reportTitle} (${startDate} ~ ${endDate})`
      )
      const index = getProjectReportIndex(id)
      const existingIdx = index.reports.findIndex((r) => r.id === meta.id)

      const updatedReports =
        existingIdx >= 0
          ? index.reports.map((r, i) => (i === existingIdx ? meta : r))
          : [...index.reports, meta]

      const updatedIndex: ReportIndex = {
        reports: [...updatedReports].sort(
          (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
        ),
      }

      saveProjectReportIndex(id, updatedIndex)

      setProjectStatus(id, 'complete')
      const updated = getProject(id)
      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      setProjectStatus(id, 'error')
      throw error
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
