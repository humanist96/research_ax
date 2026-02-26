import Parser from 'rss-parser'
import type { RssSource } from '@/types'
import type { SearchResult } from './types'

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'ResearchAX/1.0',
  },
})

export async function fetchRssFeed(source: RssSource): Promise<readonly SearchResult[]> {
  try {
    const feed = await parser.parseURL(source.url)
    return (feed.items ?? []).map((item) => ({
      title: item.title ?? '',
      link: item.link ?? '',
      content: item.contentSnippet ?? item.content ?? '',
      pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
      source: source.name,
      sourceType: 'rss' as const,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[RSS] Failed to fetch ${source.name}: ${message}`)
    return []
  }
}

export async function fetchAllFeeds(
  sources: readonly RssSource[]
): Promise<readonly SearchResult[]> {
  const results = await Promise.allSettled(
    sources.map((source) => fetchRssFeed(source))
  )

  return results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )
}
