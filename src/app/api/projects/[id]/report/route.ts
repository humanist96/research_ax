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

export const maxDuration = 60

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
    const project = await getProject(id)
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
      await setProjectStatus(id, 'reporting')

      const excludedIds = new Set(await getExcludedArticleIds(id))
      const allArticles = (await getProjectAnalyzedArticles(id)).filter((a) => !excludedIds.has(a.id))
      const { startDate, endDate } = getDateRange()
      const articles = filterByDateRange(allArticles, startDate, endDate)

      const markdown = buildDynamicReport(articles as AnalyzedArticle[], startDate, endDate, config.categories, config.reportTitle)
      await saveProjectReport(id, endDate, markdown)

      const meta = buildReportMeta(
        articles as AnalyzedArticle[],
        startDate,
        endDate,
        `${config.reportTitle} (${startDate} ~ ${endDate})`
      )
      const index = await getProjectReportIndex(id)
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

      await saveProjectReportIndex(id, updatedIndex)

      await setProjectStatus(id, 'complete')
      const updated = await getProject(id)
      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      await setProjectStatus(id, 'error')
      throw error
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
