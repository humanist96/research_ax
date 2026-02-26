import Parser from 'rss-parser'
import { GOOGLE_NEWS_RSS_BASE, PRIMARY_KEYWORDS } from '@/lib/config/sources'

interface SearchResult {
  readonly title: string
  readonly link: string
  readonly content: string
  readonly pubDate: string
  readonly source: string
}

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'KoscomAIReport/1.0',
  },
})

export async function searchGoogleNews(
  query: string
): Promise<readonly SearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query)
    const url = `${GOOGLE_NEWS_RSS_BASE}?q=${encodedQuery}&hl=ko&gl=KR&ceid=KR:ko`
    const feed = await parser.parseURL(url)

    return (feed.items ?? []).slice(0, 10).map((item) => ({
      title: item.title ?? '',
      link: item.link ?? '',
      content: item.contentSnippet ?? item.content ?? '',
      pubDate: item.pubDate ?? new Date().toISOString(),
      source: 'Google News',
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[WebSearch] Google News search failed for "${query}": ${message}`)
    return []
  }
}

export async function searchAllKeywords(): Promise<readonly SearchResult[]> {
  const queries = PRIMARY_KEYWORDS.slice(0, 5)
  return searchQueries(queries as unknown as string[])
}

export async function searchDynamicQueries(
  queries: readonly string[]
): Promise<readonly SearchResult[]> {
  return searchQueries(queries.slice(0, 5))
}

async function searchQueries(
  queries: readonly string[]
): Promise<readonly SearchResult[]> {
  const results = await Promise.allSettled(
    queries.map((query) => searchGoogleNews(query))
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
