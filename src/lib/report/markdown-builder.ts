import type { AnalyzedArticle, ReportMeta, CategoryDefinition } from '@/types'

export function buildReport(
  articles: readonly AnalyzedArticle[],
  startDate: string,
  endDate: string,
  options?: {
    readonly title?: string
    readonly categoryLabels?: Record<string, string>
  }
): string {
  const title = options?.title ?? 'AI/AX 증권사 동향 리포트'
  const categoryLabels = options?.categoryLabels ?? {}
  const categoryBreakdown = getCategoryBreakdown(articles)
  const lines: string[] = []

  lines.push(`# ${title}`)
  lines.push('')
  lines.push(`## 기간: ${startDate} ~ ${endDate}`)
  lines.push('')
  lines.push('## 요약')
  lines.push('')
  lines.push(`- 총 수집 기사: ${articles.length}건`)

  const breakdownStr = Object.entries(categoryBreakdown)
    .filter(([, count]) => count > 0)
    .map(([cat, count]) => `${categoryLabels[cat] ?? cat}(${count})`)
    .join(', ')
  lines.push(`- 카테고리별: ${breakdownStr}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  const categoryKeys = Object.keys(categoryBreakdown)
  let sectionNum = 1

  for (const category of categoryKeys) {
    const categoryArticles = articles.filter((a) => a.category === category)
    if (categoryArticles.length === 0) continue

    const label = categoryLabels[category] ?? category
    lines.push(`## ${sectionNum}. ${label}`)
    lines.push('')

    for (const article of categoryArticles) {
      const date = new Date(article.publishedAt).toLocaleDateString('ko-KR')
      lines.push(`- [${article.title}](${article.url}) - ${article.source} (${date})`)
      if (article.summary) {
        lines.push(`  > ${article.summary}`)
      }
      lines.push('')
    }

    sectionNum++
  }

  return lines.join('\n')
}

export function buildReportMeta(
  articles: readonly AnalyzedArticle[],
  startDate: string,
  endDate: string,
  title?: string
): ReportMeta {
  return {
    id: endDate,
    title: title ?? `AI/AX 증권사 동향 리포트 (${startDate} ~ ${endDate})`,
    startDate,
    endDate,
    generatedAt: new Date().toISOString(),
    totalArticles: articles.length,
    categoryBreakdown: getCategoryBreakdown(articles),
  }
}

export function buildDynamicReport(
  articles: readonly AnalyzedArticle[],
  startDate: string,
  endDate: string,
  categories: readonly CategoryDefinition[],
  reportTitle: string
): string {
  const categoryLabels: Record<string, string> = {}
  for (const cat of categories) {
    categoryLabels[cat.id] = cat.label
  }

  return buildReport(articles, startDate, endDate, {
    title: reportTitle,
    categoryLabels,
  })
}

function getCategoryBreakdown(
  articles: readonly AnalyzedArticle[]
): Record<string, number> {
  const breakdown: Record<string, number> = {}

  for (const article of articles) {
    breakdown[article.category] = (breakdown[article.category] ?? 0) + 1
  }

  return breakdown
}
