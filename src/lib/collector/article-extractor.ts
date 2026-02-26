import * as cheerio from 'cheerio'
import type { SearchResult } from './types'

const MAX_BODY_LENGTH = 5000
const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_CONCURRENCY = 5

interface DomainSelector {
  readonly domain: string
  readonly selector: string
}

const DOMAIN_SELECTORS: readonly DomainSelector[] = [
  { domain: 'n.news.naver.com', selector: '#newsct_article' },
  { domain: 'news.naver.com', selector: '#newsct_article' },
  { domain: 'www.hankyung.com', selector: '.article-body' },
  { domain: 'www.mk.co.kr', selector: '#article_body' },
  { domain: 'www.fnnews.com', selector: '#article_content' },
  { domain: 'www.sedaily.com', selector: '.article_view' },
  { domain: 'www.etnews.com', selector: '#articleBody' },
  { domain: 'biz.chosun.com', selector: '.article-body' },
  { domain: 'www.donga.com', selector: '.article_txt' },
  { domain: 'www.hani.co.kr', selector: '.article-text' },
  { domain: 'www.khan.co.kr', selector: '.art_body' },
]

const FALLBACK_SELECTORS = ['article', '.article-content', '.article_content', 'main p']

const REMOVE_SELECTORS = [
  'script', 'style', 'nav', 'header', 'footer',
  '.ad', '.ads', '.advertisement', '.banner',
  '.social-share', '.related-articles', '.comment',
  'iframe', 'noscript',
]

function getSelectorForUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname
    const match = DOMAIN_SELECTORS.find((ds) => hostname.includes(ds.domain))
    return match?.selector ?? null
  } catch {
    return null
  }
}

function cleanHtml($: cheerio.CheerioAPI): void {
  REMOVE_SELECTORS.forEach((sel) => $(sel).remove())
}

function extractText($: cheerio.CheerioAPI, selector: string): string {
  const element = $(selector)
  if (element.length === 0) return ''
  return element.text().replace(/\s+/g, ' ').trim()
}

export async function extractArticleBody(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchAX/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) return null

    const html = await response.text()
    const $ = cheerio.load(html)

    cleanHtml($)

    const domainSelector = getSelectorForUrl(url)
    if (domainSelector) {
      const text = extractText($, domainSelector)
      if (text.length > 100) {
        return text.slice(0, MAX_BODY_LENGTH)
      }
    }

    for (const selector of FALLBACK_SELECTORS) {
      const text = extractText($, selector)
      if (text.length > 100) {
        return text.slice(0, MAX_BODY_LENGTH)
      }
    }

    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[ArticleExtractor] Failed to extract from ${url}: ${message}`)
    return null
  }
}

async function processWithConcurrencyLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  processor: (item: T) => Promise<R>
): Promise<readonly R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (const item of items) {
    const task = processor(item).then((result) => {
      results.push(result)
    })
    executing.push(task)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
      const settled = await Promise.allSettled(executing)
      const pending = executing.filter(
        (_, i) => settled[i].status !== 'fulfilled' || settled[i] === undefined
      )
      executing.length = 0
      executing.push(...pending)
    }
  }

  await Promise.allSettled(executing)
  return results
}

export async function enrichSearchResults(
  results: readonly SearchResult[],
  options?: { readonly maxConcurrency?: number; readonly timeoutMs?: number }
): Promise<readonly SearchResult[]> {
  const concurrency = options?.maxConcurrency ?? DEFAULT_CONCURRENCY
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const enriched = await processWithConcurrencyLimit(
    results,
    concurrency,
    async (result): Promise<SearchResult> => {
      const body = await extractArticleBody(result.link, timeoutMs)
      if (body && body.length > result.content.length) {
        return { ...result, content: body }
      }
      return result
    }
  )

  return enriched
}
