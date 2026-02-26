import * as fs from 'fs'
import * as path from 'path'
import { buildReport, buildReportMeta, buildDynamicReport } from '../src/lib/report/markdown-builder'
import {
  getProject,
  getProjectAnalyzedArticles,
  getProjectReportIndex,
  saveProjectReportIndex,
  saveProjectReport,
} from '../src/lib/project/store'
import type { AnalyzedArticle, ReportIndex } from '../src/types'

const DATA_DIR = path.resolve(__dirname, '..', 'data')
const ANALYZED_PATH = path.join(DATA_DIR, 'analyzed-articles.json')
const REPORTS_DIR = path.join(DATA_DIR, 'reports')
const REPORT_INDEX_PATH = path.join(REPORTS_DIR, 'index.json')

function loadAnalyzedArticles(): AnalyzedArticle[] {
  if (!fs.existsSync(ANALYZED_PATH)) {
    console.error('[Report] No analyzed-articles.json found. Run analyze first.')
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(ANALYZED_PATH, 'utf-8'))
}

function loadReportIndex(): ReportIndex {
  if (!fs.existsSync(REPORT_INDEX_PATH)) return { reports: [] }
  try {
    return JSON.parse(fs.readFileSync(REPORT_INDEX_PATH, 'utf-8'))
  } catch {
    return { reports: [] }
  }
}

function getDateRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const endDate = now.toISOString().split('T')[0]
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const startDate = weekAgo.toISOString().split('T')[0]
  return { startDate, endDate }
}

function getProjectId(): string | null {
  const idx = process.argv.indexOf('--project-id')
  if (idx === -1 || idx + 1 >= process.argv.length) return null
  return process.argv[idx + 1]
}

function filterByDateRange(articles: AnalyzedArticle[], startDate: string, endDate: string): AnalyzedArticle[] {
  const rangeArticles = articles.filter((a) => {
    const date = a.publishedAt.split('T')[0]
    return date >= startDate && date <= endDate
  })
  return rangeArticles.length > 0 ? rangeArticles : articles
}

async function reportForProject(projectId: string) {
  const project = getProject(projectId)
  if (!project) {
    console.error(`[Report] Project ${projectId} not found`)
    process.exit(1)
  }
  if (!project.config) {
    console.error(`[Report] Project ${projectId} has no config`)
    process.exit(1)
  }

  const config = project.config
  console.log(`[Report] Generating report for project: ${project.name}`)

  const allArticles = getProjectAnalyzedArticles(projectId)
  if (allArticles.length === 0) {
    console.error('[Report] No analyzed articles found. Run analyze first.')
    process.exit(1)
  }

  const { startDate, endDate } = getDateRange()
  const articles = filterByDateRange(allArticles, startDate, endDate)

  console.log(`[Report] Using ${articles.length} articles for report`)

  const markdown = buildDynamicReport(articles, startDate, endDate, config.categories, config.reportTitle)
  saveProjectReport(projectId, endDate, markdown)
  console.log(`[Report] Report saved`)

  const meta = buildReportMeta(articles, startDate, endDate, `${config.reportTitle} (${startDate} ~ ${endDate})`)
  const index = getProjectReportIndex(projectId)
  const existingIdx = index.reports.findIndex((r) => r.id === meta.id)

  const updatedReports =
    existingIdx >= 0
      ? index.reports.map((r, i) => (i === existingIdx ? meta : r))
      : [...index.reports, meta]

  const updatedIndex: ReportIndex = {
    reports: updatedReports.sort(
      (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
    ),
  }

  saveProjectReportIndex(projectId, updatedIndex)
  console.log('[Report] Report index updated.')
  console.log('[Report] Generation complete!')
}

async function reportDefault() {
  console.log('[Report] Generating report...')

  fs.mkdirSync(REPORTS_DIR, { recursive: true })

  const allArticles = loadAnalyzedArticles()
  const { startDate, endDate } = getDateRange()
  const articles = filterByDateRange(allArticles, startDate, endDate)

  console.log(`[Report] Using ${articles.length} articles for report`)

  const markdown = buildReport(articles, startDate, endDate)
  const reportPath = path.join(REPORTS_DIR, `${endDate}.md`)
  fs.writeFileSync(reportPath, markdown, 'utf-8')
  console.log(`[Report] Report saved: ${reportPath}`)

  const meta = buildReportMeta(articles, startDate, endDate)
  const index = loadReportIndex()
  const existingIdx = index.reports.findIndex((r) => r.id === meta.id)

  const updatedReports =
    existingIdx >= 0
      ? index.reports.map((r, i) => (i === existingIdx ? meta : r))
      : [...index.reports, meta]

  const updatedIndex: ReportIndex = {
    reports: updatedReports.sort(
      (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
    ),
  }

  fs.writeFileSync(
    REPORT_INDEX_PATH,
    JSON.stringify(updatedIndex, null, 2),
    'utf-8'
  )
  console.log('[Report] Report index updated.')
  console.log('[Report] Generation complete!')
}

async function main() {
  const projectId = getProjectId()
  if (projectId) {
    await reportForProject(projectId)
  } else {
    await reportDefault()
  }
}

main().catch((error) => {
  console.error('[Report] Fatal error:', error)
  process.exit(1)
})
