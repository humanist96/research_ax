import type { SearchResult, SearchOptions } from './types'

const NAVER_NEWS_URL = 'https://openapi.naver.com/v1/search/news.json'
const NAVER_BLOG_URL = 'https://openapi.naver.com/v1/search/blog.json'

interface NaverItem {
  readonly title: string
  readonly originallink: string
  readonly link: string
  readonly description: string
  readonly pubDate: string
}

interface NaverResponse {
  readonly items: readonly NaverItem[]
  readonly total: number
  readonly display: number
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
}

function getNaverCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function isNaverAvailable(): boolean {
  return getNaverCredentials() !== null
}

async function searchNaver(
  endpoint: string,
  query: string,
  sourceType: 'naver-news' | 'naver-blog',
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  const credentials = getNaverCredentials()
  if (!credentials) return []

  const maxResults = options?.maxResults ?? (sourceType === 'naver-news' ? 20 : 10)
  const timeoutMs = options?.timeoutMs ?? 10000

  try {
    const params = new URLSearchParams({
      query,
      display: String(maxResults),
      sort: 'date',
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(`${endpoint}?${params}`, {
      headers: {
        'X-Naver-Client-Id': credentials.clientId,
        'X-Naver-Client-Secret': credentials.clientSecret,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Naver API returned ${response.status}: ${response.statusText}`)
    }

    const data: NaverResponse = await response.json()

    return (data.items ?? []).map((item) => ({
      title: stripHtmlTags(item.title),
      link: item.originallink || item.link,
      content: stripHtmlTags(item.description),
      pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      source: sourceType === 'naver-news' ? '네이버 뉴스' : '네이버 블로그',
      sourceType,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[NaverSearch] ${sourceType} search failed for "${query}": ${message}`)
    return []
  }
}

export async function searchNaverNews(
  query: string,
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  return searchNaver(NAVER_NEWS_URL, query, 'naver-news', options)
}

export async function searchNaverBlog(
  query: string,
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  return searchNaver(NAVER_BLOG_URL, query, 'naver-blog', options)
}

export async function searchNaverNewsMulti(
  queries: readonly string[],
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  const results = await Promise.allSettled(
    queries.map((query) => searchNaverNews(query, options))
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

export async function searchNaverBlogMulti(
  queries: readonly string[],
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  const results = await Promise.allSettled(
    queries.map((query) => searchNaverBlog(query, options))
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
