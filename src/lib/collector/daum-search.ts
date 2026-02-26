import type { SearchResult, SearchOptions } from './types'

const DAUM_WEB_URL = 'https://dapi.kakao.com/v2/search/web'
const DAUM_BLOG_URL = 'https://dapi.kakao.com/v2/search/blog'

interface DaumDocument {
  readonly title: string
  readonly contents: string
  readonly url: string
  readonly datetime: string
}

interface DaumResponse {
  readonly documents: readonly DaumDocument[]
  readonly meta: { readonly total_count: number }
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
}

function getKakaoApiKey(): string | null {
  return process.env.KAKAO_REST_API_KEY ?? null
}

export function isDaumAvailable(): boolean {
  return getKakaoApiKey() !== null
}

async function searchDaum(
  endpoint: string,
  query: string,
  sourceType: 'daum-web' | 'daum-blog',
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  const apiKey = getKakaoApiKey()
  if (!apiKey) return []

  const maxResults = options?.maxResults ?? 20
  const timeoutMs = options?.timeoutMs ?? 10000

  try {
    const params = new URLSearchParams({
      query,
      size: String(maxResults),
      sort: 'recency',
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(`${endpoint}?${params}`, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Daum API returned ${response.status}: ${response.statusText}`)
    }

    const data: DaumResponse = await response.json()

    return (data.documents ?? []).map((doc) => ({
      title: stripHtmlTags(doc.title),
      link: doc.url,
      content: stripHtmlTags(doc.contents),
      pubDate: doc.datetime ? new Date(doc.datetime).toISOString() : new Date().toISOString(),
      source: sourceType === 'daum-web' ? '다음 웹' : '다음 블로그',
      sourceType,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[DaumSearch] ${sourceType} search failed for "${query}": ${message}`)
    return []
  }
}

export async function searchDaumWeb(
  query: string,
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  return searchDaum(DAUM_WEB_URL, query, 'daum-web', options)
}

export async function searchDaumBlog(
  query: string,
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  return searchDaum(DAUM_BLOG_URL, query, 'daum-blog', options)
}

export async function searchDaumWebMulti(
  queries: readonly string[],
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  const results = await Promise.allSettled(
    queries.map((query) => searchDaumWeb(query, options))
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

export async function searchDaumBlogMulti(
  queries: readonly string[],
  options?: SearchOptions
): Promise<readonly SearchResult[]> {
  const results = await Promise.allSettled(
    queries.map((query) => searchDaumBlog(query, options))
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
