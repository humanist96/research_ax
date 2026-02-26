import type { Article } from '@/types'

export interface CurationResult {
  readonly selected: readonly Article[]
  readonly clustersFound: number
  readonly totalBefore: number
  readonly totalAfter: number
}

const SOURCE_TIERS: Record<string, number> = {
  '연합뉴스': 10, '조선일보': 10, '중앙일보': 10, '동아일보': 10, '한국경제': 10,
  '매일경제': 10, 'KBS': 10, 'MBC': 10, 'SBS': 10, 'YTN': 10,
  '한겨레': 9, '경향신문': 9, '서울경제': 9, '아시아경제': 9, '파이낸셜뉴스': 9,
  '이데일리': 8, '머니투데이': 8, '뉴스1': 8, '뉴시스': 8, '디지털타임스': 8,
  '전자신문': 8, 'ZDNet': 8, 'IT조선': 8, '블로터': 8, '테크M': 8,
}

const DEFAULT_TIER = 5

function getBigrams(text: string): Set<string> {
  const cleaned = text.replace(/[\s\-_.,!?'"()[\]{}]/g, '')
  const bigrams = new Set<string>()
  for (let i = 0; i < cleaned.length - 1; i++) {
    bigrams.add(cleaned.slice(i, i + 2))
  }
  return bigrams
}

function titleSimilarity(a: string, b: string): number {
  const bigramsA = getBigrams(a)
  const bigramsB = getBigrams(b)

  if (bigramsA.size === 0 || bigramsB.size === 0) return 0

  let intersectionSize = 0
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersectionSize++
  }

  const unionSize = bigramsA.size + bigramsB.size - intersectionSize
  return unionSize === 0 ? 0 : intersectionSize / unionSize
}

function findRoot(parent: readonly number[], i: number): number {
  let current = i
  while (parent[current] !== current) {
    current = parent[current]
  }
  return current
}

function clusterBySimilarity(
  articles: readonly Article[],
  threshold: number
): readonly (readonly number[])[] {
  const n = articles.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const rank = new Array(n).fill(0)

  const union = (a: number, b: number): void => {
    const rootA = findRoot(parent, a)
    const rootB = findRoot(parent, b)
    if (rootA === rootB) return

    if (rank[rootA] < rank[rootB]) {
      parent[rootA] = rootB
    } else if (rank[rootA] > rank[rootB]) {
      parent[rootB] = rootA
    } else {
      parent[rootB] = rootA
      rank[rootA]++
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (titleSimilarity(articles[i].title, articles[j].title) >= threshold) {
        union(i, j)
      }
    }
  }

  const clusters = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = findRoot(parent, i)
    const existing = clusters.get(root)
    if (existing) {
      existing.push(i)
    } else {
      clusters.set(root, [i])
    }
  }

  return Array.from(clusters.values())
}

function scoreArticle(article: Article, maxRelevance: number, maxContentLength: number): number {
  const sourceName = article.source
  const sourceTier = SOURCE_TIERS[sourceName] ?? DEFAULT_TIER
  const sourceScore = sourceTier / 10

  const now = Date.now()
  const published = new Date(article.publishedAt).getTime()
  const daysSince = Math.max(0, (now - published) / (1000 * 60 * 60 * 24))
  const freshnessScore = Math.exp(-0.3 * daysSince)

  const relevanceScore = maxRelevance > 0
    ? article.relevanceScore / maxRelevance
    : 0

  const contentScore = maxContentLength > 0
    ? Math.min(article.content.length / maxContentLength, 1)
    : 0

  return (
    sourceScore * 0.35 +
    freshnessScore * 0.30 +
    relevanceScore * 0.25 +
    contentScore * 0.10
  )
}

const SIMILARITY_THRESHOLD = 0.45
const DEFAULT_MAX_ARTICLES = 30

export function curateArticles(
  articles: readonly Article[],
  maxCount: number = DEFAULT_MAX_ARTICLES
): CurationResult {
  if (articles.length === 0) {
    return { selected: [], clustersFound: 0, totalBefore: 0, totalAfter: 0 }
  }

  const maxRelevance = Math.max(...articles.map((a) => a.relevanceScore))
  const maxContentLength = Math.max(...articles.map((a) => a.content.length))

  const scored = articles.map((article) => ({
    article,
    score: scoreArticle(article, maxRelevance, maxContentLength),
  }))

  const clusters = clusterBySimilarity(articles, SIMILARITY_THRESHOLD)

  const representatives = clusters.map((indices) => {
    const clusterItems = indices.map((i) => scored[i])
    const best = clusterItems.reduce((a, b) => (a.score >= b.score ? a : b))
    return best
  })

  const sorted = [...representatives].sort((a, b) => b.score - a.score)
  const selected = sorted.slice(0, maxCount).map((item) => item.article)

  return {
    selected,
    clustersFound: clusters.length,
    totalBefore: articles.length,
    totalAfter: selected.length,
  }
}
