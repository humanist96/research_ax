import Parser from 'rss-parser'
import { GOOGLE_NEWS_RSS_BASE } from '@/lib/config/sources'
import type { SearchResult, SearchOptions } from './types'

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'KoscomAIReport/1.0',
  },
})

export async function searchGoogleNews(
  query: string,
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  const maxResults = options?.maxResults ?? 10
  try {
    const encodedQuery = encodeURIComponent(query)
    const url = `${GOOGLE_NEWS_RSS_BASE}?q=${encodedQuery}&hl=ko&gl=KR&ceid=KR:ko`
    const feed = await parser.parseURL(url)

    return (feed.items ?? []).slice(0, maxResults).map((item) => ({
      title: item.title ?? '',
      link: item.link ?? '',
      content: item.contentSnippet ?? item.content ?? '',
      pubDate: item.pubDate ?? new Date().toISOString(),
      source: 'Google News',
      sourceType: 'google-news' as const,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[GoogleNews] Search failed for "${query}": ${message}`)
    return []
  }
}

export async function searchGoogleNewsMulti(
  queries: readonly string[],
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  const results = await Promise.allSettled(
    queries.slice(0, 5).map((query) => searchGoogleNews(query, options))
  )

  const allResults = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )

  const seen = new Set<string>()
  return allResults.filter((item) => {
    if (seen.has(item.link)) return false
    seen.add(item.link)
    return true
  })
}
