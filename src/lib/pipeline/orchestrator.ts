import * as crypto from 'crypto'
import type { PipelineEvent } from './types'
import type { ProjectConfig, Article, AnalyzedArticle, ReportIndex } from '@/types'
import { aggregateSearch } from '@/lib/collector/aggregator'
import { curateArticles } from '@/lib/collector/article-curator'
import { matchDynamicKeywords, isRelevant } from '@/lib/collector/keyword-matcher'
import { buildCategorizationPrompt, parseCategorizationResult } from '@/lib/analyzer/categorizer'
import { buildSummarizationPrompt, parseSummarizationResult } from '@/lib/analyzer/summarizer'
import { buildDynamicReport, buildReportMeta } from '@/lib/report/markdown-builder'
import { callClaudeAsync } from '@/lib/deep-research/claude-async'
import {
  getProject,
  getProjectArticles,
  saveProjectArticles,
  getProjectAnalyzedArticles,
  saveProjectAnalyzedArticles,
  getExcludedArticleIds,
  getProjectReportIndex,
  saveProjectReportIndex,
  saveProjectReport,
  setProjectStatus,
} from '@/lib/project/store'

const BATCH_SIZE = 10

function generateId(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12)
}

function chunk<T>(arr: readonly T[], size: number): readonly T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

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

async function collectPhase(
  projectId: string,
  config: ProjectConfig,
  emit: (event: PipelineEvent) => void
): Promise<number> {
  emit({ type: 'phase', phase: 'collecting', message: '뉴스를 수집하고 있습니다...' })
  setProjectStatus(projectId, 'collecting')

  const existingArticles = getProjectArticles(projectId)
  const existingUrls = new Set(existingArticles.map((a) => a.url))

  const searchResults = await aggregateSearch(config, {
    queries: config.searchQueries,
    enrichBodies: config.enrichArticles ?? false,
    maxResultsPerSource: config.maxArticlesPerSource ?? 20,
    onSourceComplete: (source, count) => {
      emit({
        type: 'source_search',
        source,
        count,
        message: `${source}: ${count}건 수집`,
      })
    },
  })

  const allItems = searchResults.map((item) => ({
    title: item.title,
    url: item.link,
    content: item.content,
    publishedAt: item.pubDate,
    source: item.source,
  }))

  const newArticles: Article[] = []
  for (const item of allItems) {
    if (existingUrls.has(item.url)) continue

    const { matchedKeywords, relevanceScore } = matchDynamicKeywords(
      item.title,
      item.content,
      config
    )

    if (!isRelevant(relevanceScore, config.minRelevanceScore)) continue

    newArticles.push({
      id: generateId(item.url),
      title: item.title,
      url: item.url,
      source: item.source,
      publishedAt: new Date(item.publishedAt).toISOString(),
      content: item.content,
      matchedKeywords,
      relevanceScore,
      collectedAt: new Date().toISOString(),
    })

    existingUrls.add(item.url)
  }

  const allArticles = [...existingArticles, ...newArticles]
  saveProjectArticles(projectId, allArticles as Article[])

  emit({
    type: 'collection_progress',
    total: allItems.length,
    relevant: newArticles.length,
    message: `총 ${allItems.length}건 중 ${newArticles.length}건 관련 기사 수집 완료`,
  })

  return allArticles.length
}

async function analyzePhase(
  projectId: string,
  config: ProjectConfig,
  emit: (event: PipelineEvent) => void
): Promise<number> {
  emit({ type: 'phase', phase: 'analyzing', message: 'AI가 기사를 분석하고 있습니다...' })
  setProjectStatus(projectId, 'analyzing')

  const excludedIds = new Set(getExcludedArticleIds(projectId))
  const articles = getProjectArticles(projectId).filter((a) => !excludedIds.has(a.id))
  const existingAnalyzed = getProjectAnalyzedArticles(projectId)
  const analyzedIds = new Set(existingAnalyzed.map((a) => a.id))
  const unanalyzed = articles.filter((a) => !analyzedIds.has(a.id))

  if (unanalyzed.length === 0) {
    emit({ type: 'analysis_progress', analyzed: 0, total: 0, message: '분석할 새 기사가 없습니다' })
    return existingAnalyzed.length
  }

  const validCategoryIds = config.categories.map((c) => c.id)
  const newAnalyzed: AnalyzedArticle[] = []
  const batches = chunk(unanalyzed, BATCH_SIZE)

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]

    emit({
      type: 'analysis_batch',
      batchIndex: i + 1,
      totalBatches: batches.length,
      step: 'categorizing',
      message: `배치 ${i + 1}/${batches.length} 분류 중...`,
    })

    const catPrompt = buildCategorizationPrompt(batch, config.categories, config.domainContext)
    const catResult = await callClaudeAsync(catPrompt, { model: 'sonnet' })
    const categories = parseCategorizationResult(catResult, validCategoryIds)

    emit({
      type: 'analysis_batch',
      batchIndex: i + 1,
      totalBatches: batches.length,
      step: 'summarizing',
      message: `배치 ${i + 1}/${batches.length} 요약 중...`,
    })

    const sumPrompt = buildSummarizationPrompt(batch, config.domainContext)
    const sumResult = await callClaudeAsync(sumPrompt, { model: 'sonnet' })
    const summaries = parseSummarizationResult(sumResult)

    for (const article of batch) {
      newAnalyzed.push({
        ...article,
        category: categories[article.id] ?? 'other',
        summary: summaries[article.id] ?? '',
        analyzedAt: new Date().toISOString(),
      })
    }

    const totalAnalyzed = newAnalyzed.length
    emit({
      type: 'analysis_progress',
      analyzed: totalAnalyzed,
      total: unanalyzed.length,
      message: `${totalAnalyzed}/${unanalyzed.length}건 분석 완료`,
    })
  }

  const allAnalyzed = [...existingAnalyzed, ...newAnalyzed]
  saveProjectAnalyzedArticles(projectId, allAnalyzed as AnalyzedArticle[])

  return allAnalyzed.length
}

function reportPhase(
  projectId: string,
  config: ProjectConfig,
  emit: (event: PipelineEvent) => void
): void {
  emit({ type: 'phase', phase: 'reporting', message: '리포트를 생성하고 있습니다...' })
  setProjectStatus(projectId, 'reporting')

  const excludedIds = new Set(getExcludedArticleIds(projectId))
  const allArticles = getProjectAnalyzedArticles(projectId).filter((a) => !excludedIds.has(a.id))
  const { startDate, endDate } = getDateRange()
  const articles = filterByDateRange(allArticles, startDate, endDate)

  emit({ type: 'report_progress', message: `${articles.length}건의 기사로 리포트 생성 중...` })

  const markdown = buildDynamicReport(articles, startDate, endDate, config.categories, config.reportTitle)
  saveProjectReport(projectId, endDate, markdown)

  const meta = buildReportMeta(
    articles as AnalyzedArticle[],
    startDate,
    endDate,
    `${config.reportTitle} (${startDate} ~ ${endDate})`
  )
  const index = getProjectReportIndex(projectId)
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

  saveProjectReportIndex(projectId, updatedIndex)

  emit({ type: 'report_progress', message: '리포트 저장 완료' })
}

export async function runPipeline(
  projectId: string,
  config: ProjectConfig,
  emit: (event: PipelineEvent) => void
): Promise<void> {
  try {
    const articlesCollected = await collectPhase(projectId, config, emit)

    const CURATION_THRESHOLD = 50
    const allArticles = getProjectArticles(projectId)
    if (allArticles.length >= CURATION_THRESHOLD) {
      const maxForAnalysis = config.maxArticlesForAnalysis ?? 30
      const result = curateArticles(allArticles, maxForAnalysis)
      saveProjectArticles(projectId, result.selected as Article[])
      emit({
        type: 'curation_progress',
        before: result.totalBefore,
        after: result.totalAfter,
        clusters: result.clustersFound,
        message: `${result.totalBefore}건 → ${result.totalAfter}건 (${result.clustersFound}개 클러스터, 유사 기사 제거)`,
      })
    }

    const articlesAnalyzed = await analyzePhase(projectId, config, emit)
    reportPhase(projectId, config, emit)

    emit({
      type: 'stats',
      articlesCollected,
      articlesAnalyzed,
      reportGenerated: true,
    })

    setProjectStatus(projectId, 'complete')
    emit({ type: 'phase', phase: 'complete', message: '파이프라인이 완료되었습니다' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setProjectStatus(projectId, 'error')
    emit({ type: 'error', message })
    emit({ type: 'phase', phase: 'error', message: `파이프라인 오류: ${message}` })
  }
}
