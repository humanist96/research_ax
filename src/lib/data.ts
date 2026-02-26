import * as fs from 'fs'
import * as path from 'path'
import type { Article, AnalyzedArticle, ReportIndex, ReportMeta } from '@/types'

const DATA_DIR = path.resolve(process.cwd(), 'data')
const REPORTS_DIR = path.join(DATA_DIR, 'reports')

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

export function getArticles(): Article[] {
  return readJsonSafe(path.join(DATA_DIR, 'articles.json'), [])
}

export function getAnalyzedArticles(): AnalyzedArticle[] {
  return readJsonSafe(path.join(DATA_DIR, 'analyzed-articles.json'), [])
}

export function getReportIndex(): ReportIndex {
  return readJsonSafe(path.join(REPORTS_DIR, 'index.json'), { reports: [] })
}

export function getReportContent(id: string): string | null {
  const safeName = id.replace(/[^a-zA-Z0-9-]/g, '')
  const filePath = path.join(REPORTS_DIR, `${safeName}.md`)
  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

export function getReportMeta(id: string): ReportMeta | null {
  const index = getReportIndex()
  return index.reports.find((r) => r.id === id) ?? null
}
