import { NextRequest, NextResponse } from 'next/server'
import { getProject, setProjectStatus, getProjectArticles, getProjectAnalyzedArticles, getExcludedArticleIds, saveProjectAnalyzedArticles } from '@/lib/project/store'
import { buildCategorizationPrompt, parseCategorizationResult } from '@/lib/analyzer/categorizer'
import { buildSummarizationPrompt, parseSummarizationResult } from '@/lib/analyzer/summarizer'
import { callAI } from '@/lib/ai'
import type { AnalyzedArticle } from '@/types'

const BATCH_SIZE = 10

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
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
      setProjectStatus(id, 'analyzing')

      const excludedIds = new Set(getExcludedArticleIds(id))
      const articles = getProjectArticles(id).filter((a) => !excludedIds.has(a.id))
      const existingAnalyzed = getProjectAnalyzedArticles(id)
      const analyzedIds = new Set(existingAnalyzed.map((a) => a.id))
      const unanalyzed = articles.filter((a) => !analyzedIds.has(a.id))

      if (unanalyzed.length === 0) {
        setProjectStatus(id, 'ready')
        const updated = getProject(id)
        return NextResponse.json({ success: true, data: updated })
      }

      const validCategoryIds = config.categories.map((c) => c.id)
      const newAnalyzed: AnalyzedArticle[] = []
      const batches = chunk(unanalyzed, BATCH_SIZE)

      for (const batch of batches) {
        const catPrompt = buildCategorizationPrompt(batch, config.categories, config.domainContext)
        const catResult = await callAI(catPrompt, { model: 'general' })
        const categories = parseCategorizationResult(catResult, validCategoryIds)

        const sumPrompt = buildSummarizationPrompt(batch, config.domainContext)
        const sumResult = await callAI(sumPrompt, { model: 'general' })
        const summaries = parseSummarizationResult(sumResult)

        for (const article of batch) {
          newAnalyzed.push({
            ...article,
            category: categories[article.id] ?? 'other',
            summary: summaries[article.id] ?? '',
            analyzedAt: new Date().toISOString(),
          })
        }
      }

      const allAnalyzed = [...existingAnalyzed, ...newAnalyzed]
      saveProjectAnalyzedArticles(id, allAnalyzed as AnalyzedArticle[])

      setProjectStatus(id, 'ready')
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
