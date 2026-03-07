import * as fs from 'fs'
import * as path from 'path'
import { buildCategorizationPrompt, parseCategorizationResult } from '../src/lib/analyzer/categorizer'
import { buildSummarizationPrompt, parseSummarizationResult } from '../src/lib/analyzer/summarizer'
import {
  getProject,
  getProjectArticles,
  getProjectAnalyzedArticles,
  getExcludedArticleIds,
  saveProjectAnalyzedArticles,
} from '../src/lib/project/store'
import { callAI } from '../src/lib/ai'
import type { Article, AnalyzedArticle } from '../src/types'

const DATA_DIR = path.resolve(__dirname, '..', 'data')
const ARTICLES_PATH = path.join(DATA_DIR, 'articles.json')
const ANALYZED_PATH = path.join(DATA_DIR, 'analyzed-articles.json')

const BATCH_SIZE = 10

function loadArticles(): Article[] {
  if (!fs.existsSync(ARTICLES_PATH)) {
    console.error('[Analyze] No articles.json found. Run collect first.')
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf-8'))
}

function loadAnalyzed(): AnalyzedArticle[] {
  if (!fs.existsSync(ANALYZED_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(ANALYZED_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function getProjectId(): string | null {
  const idx = process.argv.indexOf('--project-id')
  if (idx === -1 || idx + 1 >= process.argv.length) return null
  return process.argv[idx + 1]
}

async function analyzeForProject(projectId: string) {
  const project = await getProject(projectId)
  if (!project) {
    console.error(`[Analyze] Project ${projectId} not found`)
    process.exit(1)
  }
  if (!project.config) {
    console.error(`[Analyze] Project ${projectId} has no config`)
    process.exit(1)
  }

  const config = project.config
  console.log(`[Analyze] Starting analysis for project: ${project.name}`)

  const excludedIds = new Set(await getExcludedArticleIds(projectId))
  const articles = (await getProjectArticles(projectId)).filter((a) => !excludedIds.has(a.id))
  const existingAnalyzed = await getProjectAnalyzedArticles(projectId)
  const analyzedIds = new Set(existingAnalyzed.map((a) => a.id))

  const unanalyzed = articles.filter((a) => !analyzedIds.has(a.id))

  if (unanalyzed.length === 0) {
    console.log('[Analyze] No new articles to analyze.')
    return
  }

  console.log(`[Analyze] Articles to analyze: ${unanalyzed.length}`)

  const validCategoryIds = config.categories.map((c) => c.id)
  const newAnalyzed: AnalyzedArticle[] = []
  const batches = chunk(unanalyzed, BATCH_SIZE)

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    console.log(`[Analyze] Processing batch ${i + 1}/${batches.length} (${batch.length} articles)`)

    console.log('[Analyze] Categorizing...')
    const catPrompt = buildCategorizationPrompt(batch, config.categories, config.domainContext)
    const catResult = await callAI(catPrompt, { model: 'general' })
    const categories = parseCategorizationResult(catResult, validCategoryIds)

    console.log('[Analyze] Summarizing...')
    const sumPrompt = buildSummarizationPrompt(batch, config.domainContext)
    const sumResult = await callAI(sumPrompt, { model: 'general' })
    const summaries = parseSummarizationResult(sumResult)

    for (const article of batch) {
      const analyzed: AnalyzedArticle = {
        ...article,
        category: categories[article.id] ?? 'other',
        summary: summaries[article.id] ?? '',
        analyzedAt: new Date().toISOString(),
      }
      newAnalyzed.push(analyzed)
    }
  }

  const allAnalyzed = [...existingAnalyzed, ...newAnalyzed]
  await saveProjectAnalyzedArticles(projectId, allAnalyzed)
  console.log(`[Analyze] Total analyzed articles: ${allAnalyzed.length}`)
  console.log('[Analyze] Analysis complete!')
}

async function analyzeDefault() {
  console.log('[Analyze] Starting analysis...')

  const articles = loadArticles()
  const existingAnalyzed = loadAnalyzed()
  const analyzedIds = new Set(existingAnalyzed.map((a) => a.id))

  const unanalyzed = articles.filter((a) => !analyzedIds.has(a.id))

  if (unanalyzed.length === 0) {
    console.log('[Analyze] No new articles to analyze.')
    return
  }

  console.log(`[Analyze] Articles to analyze: ${unanalyzed.length}`)

  const newAnalyzed: AnalyzedArticle[] = []
  const batches = chunk(unanalyzed, BATCH_SIZE)

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    console.log(`[Analyze] Processing batch ${i + 1}/${batches.length} (${batch.length} articles)`)

    console.log('[Analyze] Categorizing...')
    const catPrompt = buildCategorizationPrompt(batch)
    const catResult = await callAI(catPrompt, { model: 'general' })
    const categories = parseCategorizationResult(catResult)

    console.log('[Analyze] Summarizing...')
    const sumPrompt = buildSummarizationPrompt(batch)
    const sumResult = await callAI(sumPrompt, { model: 'general' })
    const summaries = parseSummarizationResult(sumResult)

    for (const article of batch) {
      const analyzed: AnalyzedArticle = {
        ...article,
        category: categories[article.id] ?? 'other',
        summary: summaries[article.id] ?? '',
        analyzedAt: new Date().toISOString(),
      }
      newAnalyzed.push(analyzed)
    }
  }

  const allAnalyzed = [...existingAnalyzed, ...newAnalyzed]
  fs.writeFileSync(ANALYZED_PATH, JSON.stringify(allAnalyzed, null, 2), 'utf-8')
  console.log(`[Analyze] Total analyzed articles: ${allAnalyzed.length}`)
  console.log('[Analyze] Analysis complete!')
}

async function main() {
  const projectId = getProjectId()
  if (projectId) {
    await analyzeForProject(projectId)
  } else {
    await analyzeDefault()
  }
}

main().catch((error) => {
  console.error('[Analyze] Fatal error:', error)
  process.exit(1)
})
