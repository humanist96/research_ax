import Parser from 'rss-parser'
import type { RssSource } from '@/types'

interface RssItem {
  readonly title: string
  readonly link: string
  readonly content: string
  readonly pubDate: string
  readonly source: string
}

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'ResearchAX/1.0',
  },
})

export async function fetchRssFeed(source: RssSource): Promise<readonly RssItem[]> {
  try {
    const feed = await parser.parseURL(source.url)
    return (feed.items ?? []).map((item) => ({
      title: item.title ?? '',
      link: item.link ?? '',
      content: item.contentSnippet ?? item.content ?? '',
      pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
      source: source.name,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[RSS] Failed to fetch ${source.name}: ${message}`)
    return []
  }
}

export async function fetchAllFeeds(
  sources: readonly RssSource[]
): Promise<readonly RssItem[]> {
  const results = await Promise.allSettled(
    sources.map((source) => fetchRssFeed(source))
  )

  return results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )
}
