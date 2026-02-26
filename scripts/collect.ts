import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { aggregateSearch } from '../src/lib/collector/aggregator'
import { fetchAllFeeds } from '../src/lib/collector/rss-fetcher'
import { searchGoogleNewsMulti } from '../src/lib/collector/google-news'
import { matchKeywords, matchDynamicKeywords, isRelevant } from '../src/lib/collector/keyword-matcher'
import { RSS_SOURCES, PRIMARY_KEYWORDS } from '../src/lib/config/sources'
import {
  getProject,
  getProjectArticles,
  saveProjectArticles,
  getProjectCollectionLog,
  saveProjectCollectionLog,
} from '../src/lib/project/store'
import type { Article, CollectionLog } from '../src/types'

const DATA_DIR = path.resolve(__dirname, '..', 'data')
const ARTICLES_PATH = path.join(DATA_DIR, 'articles.json')
const LOG_PATH = path.join(DATA_DIR, 'collection-log.json')

function generateId(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12)
}

function loadExistingArticles(): Article[] {
  if (!fs.existsSync(ARTICLES_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function loadLogs(): CollectionLog[] {
  if (!fs.existsSync(LOG_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function getProjectId(): string | null {
  const idx = process.argv.indexOf('--project-id')
  if (idx === -1 || idx + 1 >= process.argv.length) return null
  return process.argv[idx + 1]
}

async function collectForProject(projectId: string) {
  const project = getProject(projectId)
  if (!project) {
    console.error(`[Collect] Project ${projectId} not found`)
    process.exit(1)
  }
  if (!project.config) {
    console.error(`[Collect] Project ${projectId} has no config`)
    process.exit(1)
  }

  const config = project.config
  console.log(`[Collect] Starting collection for project: ${project.name}`)

  const existingArticles = getProjectArticles(projectId)
  const existingUrls = new Set(existingArticles.map((a) => a.url))
  const errors: string[] = []

  console.log(`[Collect] Existing articles: ${existingArticles.length}`)

  console.log('[Collect] Searching all sources via aggregator...')
  let searchResults: Awaited<ReturnType<typeof aggregateSearch>> = []
  try {
    searchResults = await aggregateSearch(config, {
      queries: config.searchQueries,
      enrichBodies: config.enrichArticles ?? false,
      maxResultsPerSource: config.maxArticlesPerSource ?? 20,
    })
    console.log(`[Collect] Aggregated results: ${searchResults.length}`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    errors.push(`Aggregate search failed: ${msg}`)
    console.error(`[Collect] Aggregate search failed: ${msg}`)
  }

  const allItems = searchResults.map((item) => ({
    title: item.title,
    url: item.link,
    content: item.content,
    publishedAt: item.pubDate,
    source: item.source,
  }))

  console.log(`[Collect] Total items to process: ${allItems.length}`)

  const newArticles: Article[] = []
  for (const item of allItems) {
    if (existingUrls.has(item.url)) continue

    const { matchedKeywords, relevanceScore } = matchDynamicKeywords(
      item.title,
      item.content,
      config
    )

    if (!isRelevant(relevanceScore, config.minRelevanceScore)) continue

    const article: Article = {
      id: generateId(item.url),
      title: item.title,
      url: item.url,
      source: item.source,
      publishedAt: new Date(item.publishedAt).toISOString(),
      content: item.content,
      matchedKeywords,
      relevanceScore,
      collectedAt: new Date().toISOString(),
    }

    newArticles.push(article)
    existingUrls.add(item.url)
  }

  console.log(`[Collect] New relevant articles: ${newArticles.length}`)

  const allArticles = [...existingArticles, ...newArticles]
  saveProjectArticles(projectId, allArticles)
  console.log(`[Collect] Total articles saved: ${allArticles.length}`)

  const log: CollectionLog = {
    timestamp: new Date().toISOString(),
    sourcesChecked: config.rssSources.length + config.searchQueries.length,
    articlesFound: allItems.length,
    articlesAdded: newArticles.length,
    errors,
  }

  const logs = [...getProjectCollectionLog(projectId), log]
  saveProjectCollectionLog(projectId, logs)

  console.log('[Collect] Collection complete!')
}

async function collectDefault() {
  console.log('[Collect] Starting news collection...')

  fs.mkdirSync(DATA_DIR, { recursive: true })

  const existingArticles = loadExistingArticles()
  const existingUrls = new Set(existingArticles.map((a) => a.url))
  const errors: string[] = []

  console.log(`[Collect] Existing articles: ${existingArticles.length}`)

  console.log('[Collect] Fetching RSS feeds...')
  const rssItems = await fetchAllFeeds(RSS_SOURCES)
  console.log(`[Collect] RSS items fetched: ${rssItems.length}`)

  console.log('[Collect] Searching Google News...')
  let searchItems: Awaited<ReturnType<typeof searchGoogleNewsMulti>> = []
  try {
    searchItems = await searchGoogleNewsMulti(PRIMARY_KEYWORDS.slice(0, 5) as unknown as string[])
    console.log(`[Collect] Search items fetched: ${searchItems.length}`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    errors.push(`Google News search failed: ${msg}`)
    console.error(`[Collect] Google News search failed: ${msg}`)
  }

  const allItems = [
    ...rssItems.map((item) => ({
      title: item.title,
      url: item.link,
      content: item.content,
      publishedAt: item.pubDate,
      source: item.source,
    })),
    ...searchItems.map((item) => ({
      title: item.title,
      url: item.link,
      content: item.content,
      publishedAt: item.pubDate,
      source: item.source,
    })),
  ]

  console.log(`[Collect] Total items to process: ${allItems.length}`)

  const newArticles: Article[] = []
  for (const item of allItems) {
    if (existingUrls.has(item.url)) continue

    const { matchedKeywords, relevanceScore } = matchKeywords(
      item.title,
      item.content
    )

    if (!isRelevant(relevanceScore)) continue

    const article: Article = {
      id: generateId(item.url),
      title: item.title,
      url: item.url,
      source: item.source,
      publishedAt: new Date(item.publishedAt).toISOString(),
      content: item.content,
      matchedKeywords,
      relevanceScore,
      collectedAt: new Date().toISOString(),
    }

    newArticles.push(article)
    existingUrls.add(item.url)
  }

  console.log(`[Collect] New relevant articles: ${newArticles.length}`)

  const allArticles = [...existingArticles, ...newArticles]
  fs.writeFileSync(ARTICLES_PATH, JSON.stringify(allArticles, null, 2), 'utf-8')
  console.log(`[Collect] Total articles saved: ${allArticles.length}`)

  const log: CollectionLog = {
    timestamp: new Date().toISOString(),
    sourcesChecked: RSS_SOURCES.length + 1,
    articlesFound: allItems.length,
    articlesAdded: newArticles.length,
    errors,
  }

  const logs = [...loadLogs(), log]
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), 'utf-8')

  console.log('[Collect] Collection complete!')
}

async function main() {
  const projectId = getProjectId()
  if (projectId) {
    await collectForProject(projectId)
  } else {
    await collectDefault()
  }
}

main().catch((error) => {
  console.error('[Collect] Fatal error:', error)
  process.exit(1)
})
