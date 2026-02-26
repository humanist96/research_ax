import type { ProjectConfig } from '@/types'
import type { SearchResult, AggregateSearchOptions, CollectionSourceConfig } from './types'
import { searchGoogleNewsMulti } from './google-news'
import { fetchAllFeeds } from './rss-fetcher'
import { isNaverAvailable, searchNaverNewsMulti, searchNaverBlogMulti } from './naver-search'
import { isDaumAvailable, searchDaumWebMulti, searchDaumBlogMulti } from './daum-search'
import { enrichSearchResults } from './article-extractor'
import { RSS_SOURCES } from '@/lib/config/sources'

const DEFAULT_MAX_PER_SOURCE = 20
const DEFAULT_ENRICH_CONCURRENCY = 5

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const params = new URLSearchParams(parsed.search)
    const keysToRemove = [...params.keys()].filter(
      (key) => key.startsWith('utm_') || key === 'ref' || key === 'fbclid' || key === 'gclid'
    )
    keysToRemove.forEach((key) => params.delete(key))
    parsed.search = params.toString()
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url
  }
}

function deduplicateResults(results: readonly SearchResult[]): readonly SearchResult[] {
  const urlMap = new Map<string, SearchResult>()

  for (const result of results) {
    const normalizedUrl = normalizeUrl(result.link)
    const existing = urlMap.get(normalizedUrl)
    if (!existing || result.content.length > existing.content.length) {
      urlMap.set(normalizedUrl, result)
    }
  }

  return [...urlMap.values()]
}

function getSourceConfig(config: ProjectConfig): CollectionSourceConfig {
  return config.collectionSources ?? {
    googleNews: true,
    rss: true,
    naverNews: true,
    naverBlog: false,
    daumWeb: false,
    daumBlog: false,
  }
}

export function getAvailableSources(): readonly { type: string; available: boolean }[] {
  return [
    { type: 'google-news', available: true },
    { type: 'rss', available: true },
    { type: 'naver-news', available: isNaverAvailable() },
    { type: 'naver-blog', available: isNaverAvailable() },
    { type: 'daum-web', available: isDaumAvailable() },
    { type: 'daum-blog', available: isDaumAvailable() },
  ]
}

export async function aggregateSearch(
  config: ProjectConfig,
  options: AggregateSearchOptions
): Promise<readonly SearchResult[]> {
  const sourceConfig = getSourceConfig(config)
  const maxResults = options.maxResultsPerSource ?? DEFAULT_MAX_PER_SOURCE
  const searchOptions = { maxResults }

  const searchTasks: Promise<readonly SearchResult[]>[] = []

  if (sourceConfig.googleNews !== false) {
    searchTasks.push(
      searchGoogleNewsMulti(options.queries, searchOptions)
        .then((results) => {
          console.log(`[Aggregator] Google News: ${results.length} results`)
          return results
        })
    )
  }

  if (sourceConfig.rss !== false) {
    const rssSources = config.rssSources.length > 0 ? config.rssSources : RSS_SOURCES
    searchTasks.push(
      fetchAllFeeds(rssSources)
        .then((results) => {
          if (results.length === 0 && rssSources !== RSS_SOURCES && RSS_SOURCES.length > 0) {
            console.log('[Aggregator] RSS: project feeds returned 0, trying default feeds...')
            return fetchAllFeeds(RSS_SOURCES)
          }
          return results
        })
        .then((results) => {
          console.log(`[Aggregator] RSS: ${results.length} results`)
          return results
        })
    )
  }

  if (sourceConfig.naverNews !== false && isNaverAvailable()) {
    searchTasks.push(
      searchNaverNewsMulti(options.queries, searchOptions)
        .then((results) => {
          console.log(`[Aggregator] Naver News: ${results.length} results`)
          return results
        })
    )
  }

  if (sourceConfig.naverBlog && isNaverAvailable()) {
    searchTasks.push(
      searchNaverBlogMulti(options.queries, searchOptions)
        .then((results) => {
          console.log(`[Aggregator] Naver Blog: ${results.length} results`)
          return results
        })
    )
  }

  if (sourceConfig.daumWeb && isDaumAvailable()) {
    searchTasks.push(
      searchDaumWebMulti(options.queries, searchOptions)
        .then((results) => {
          console.log(`[Aggregator] Daum Web: ${results.length} results`)
          return results
        })
    )
  }

  if (sourceConfig.daumBlog && isDaumAvailable()) {
    searchTasks.push(
      searchDaumBlogMulti(options.queries, searchOptions)
        .then((results) => {
          console.log(`[Aggregator] Daum Blog: ${results.length} results`)
          return results
        })
    )
  }

  const settled = await Promise.allSettled(searchTasks)
  const allResults = settled.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )

  const deduplicated = deduplicateResults(allResults)
  console.log(`[Aggregator] Total: ${allResults.length} → Deduplicated: ${deduplicated.length}`)

  if (options.enrichBodies) {
    console.log(`[Aggregator] Enriching article bodies (concurrency: ${options.maxEnrichConcurrency ?? DEFAULT_ENRICH_CONCURRENCY})...`)
    const enriched = await enrichSearchResults(deduplicated, {
      maxConcurrency: options.maxEnrichConcurrency ?? DEFAULT_ENRICH_CONCURRENCY,
    })
    console.log(`[Aggregator] Enrichment complete`)
    return enriched
  }

  return deduplicated
}

export async function searchForSection(
  queries: readonly string[],
  config: ProjectConfig
): Promise<readonly SearchResult[]> {
  return aggregateSearch(config, {
    queries,
    maxResultsPerSource: config.maxArticlesPerSource ?? DEFAULT_MAX_PER_SOURCE,
    enrichBodies: config.enrichArticles ?? true,
    maxEnrichConcurrency: DEFAULT_ENRICH_CONCURRENCY,
  })
}
