import type { ProjectConfig } from '@/types'
import type { OutlineSection, SectionResearchResult, SourceReference } from './types'
import { searchForSection } from '@/lib/collector/aggregator'
import { callAI } from '@/lib/ai'
import { filterRelevantArticles } from './relevance-filter'
import { filterByKeywordBlacklist } from './keyword-filter'

// Re-export for backward compatibility (used by orchestrator)
export { searchForSection }

type SectionProgress = (status: 'searching' | 'analyzing' | 'deepening' | 'refining', message: string, sourcesFound?: number) => void

export interface ArticleItem {
  readonly title: string
  readonly content: string
  readonly link: string
  readonly source: string
  readonly pubDate: string
}

function getVisualGuidelinesBlock(): string {
  return `## 시각적 요소 활용 지침
- 비교 데이터가 3건 이상이면 **마크다운 표**로 정리하세요 (컬럼 5개 이하)
- 프로세스나 인과관계는 **Mermaid flowchart**로 표현하세요
- 비율/분포 데이터는 **Mermaid pie chart**로 시각화하세요
- 단계/타임라인은 **Mermaid graph**로 표현하세요
- Mermaid 문법 규칙:
  - 한국어 텍스트는 반드시 큰따옴표로 감싸세요: A["한국어 텍스트"]
  - 노드는 10개 이하로 간결하게 유지하세요
  - \`\`\`mermaid 코드 블록으로 작성하세요
- 데이터가 불충분하면 억지로 시각 요소를 만들지 마세요
- 각 섹션에 표 또는 다이어그램을 최소 1개 포함하는 것을 목표로 하세요`
}

function formatArticlesList(articles: readonly ArticleItem[]): string {
  return articles
    .map((a, i) => `[${i + 1}] "${a.title}" (${a.source}, ${a.pubDate})\n${a.content}`)
    .join('\n\n')
}

function buildAnalysisWithGapHintsPrompt(
  section: OutlineSection,
  articles: readonly ArticleItem[],
  config: ProjectConfig,
): string {
  return `당신은 "${config.reportTitle}" 보고서의 "${section.title}" 섹션을 작성하는 최고 수준의 리서치 애널리스트입니다.

## 섹션 정보
- 제목: ${section.title}
- 설명: ${section.description}
- 핵심 포인트: ${section.keyPoints.join(', ')}

## 도메인 컨텍스트
${config.domainContext}

## 수집된 기사 (${articles.length}건)
${formatArticlesList(articles)}

${getVisualGuidelinesBlock()}

## 작성 규칙
1. 기사를 단순 나열하지 말고, 통합된 분석을 서술하세요
2. 핵심 포인트를 중심으로 논리적으로 구성하세요
3. 중요한 사실에는 출처를 인라인으로 표기하세요 (예: "~로 나타났다[출처명]")
4. **1500~4000자** 분량으로 심층적으로 작성하세요
5. 마크다운 형식으로 작성하되, 섹션 제목(##)은 포함하지 마세요
6. 소제목(###)을 활용하여 섹션 내부를 구조화하세요
7. **정량적 데이터(수치, 통계, %)를 최우선으로 인용**하세요
8. **인과관계 분석**: 왜 이런 현상이 발생했는지 원인과 결과를 명확히 서술하세요
9. **비교 분석**: 관련 사례, 기간별 변화, 경쟁 구도 등 비교 관점을 포함하세요
10. **시사점 도출**: 분석 결과가 의미하는 바와 향후 전망을 제시하세요
11. **시각 요소**: 위 시각적 요소 활용 지침에 따라 표나 Mermaid 다이어그램을 적극 활용하세요

## 추가 지시 (자가 검증)
작성 후 스스로 검증하세요:
- 근거 없는 주장이 있으면 완화하거나 보강하세요
- 누락된 관점이 있으면 보완하세요
- 논리적 비약이 있으면 연결을 강화하세요
- 균형 잡힌 시각을 유지하세요

마크다운 본문만 출력하세요. 다른 설명은 포함하지 마세요.`
}

function buildRefinementPrompt(
  section: OutlineSection,
  content: string,
  config: ProjectConfig,
): string {
  return `당신은 "${config.reportTitle}" 보고서의 편집자입니다. 아래 분석 내용을 개선하세요.

## 섹션: "${section.title}"

## 현재 내용
${content}

## 개선 지침
- 논리적 흐름을 다듬으세요
- 시각 요소(표/Mermaid)가 부족하면 1개 이상 추가하세요
- Mermaid 한국어 노드는 큰따옴표 필수: A["한국어 텍스트"]
- 인라인 출처 표기를 유지하세요
- 마크다운 형식, 섹션 제목(##) 제외, 소제목(###) 활용

개선된 본문만 출력하세요.`
}

function buildSourceReferences(sources: readonly SourceReference[]): string {
  if (sources.length === 0) return ''

  const lines = sources.map((s, i) =>
    `${i + 1}. [${s.title}](${s.url}) — ${s.source}, ${s.publishedAt}`
  )

  return `\n\n---\n**출처**\n${lines.join('\n')}`
}

/**
 * Phase 1 only: search + keyword blacklist filter + Haiku relevance filter.
 * Returns filtered articles ready for analysis or user review.
 */
export async function searchAndFilterSection(
  section: OutlineSection,
  config: ProjectConfig,
  onProgress?: SectionProgress,
): Promise<readonly ArticleItem[]> {
  onProgress?.('searching', `"${section.title}" 검색 중...`)

  const searchResults = await searchForSection(section.searchQueries, config)

  const sourcesFound = searchResults.length
  onProgress?.('searching', `${sourcesFound}건 수집 완료, 필터링 중...`, sourcesFound)

  if (searchResults.length === 0) {
    return []
  }

  const rawArticles: ArticleItem[] = searchResults.map((r) => ({
    title: r.title,
    content: r.content,
    link: r.link,
    source: r.source,
    pubDate: r.pubDate,
  }))

  // Keyword blacklist filter (always applied)
  const afterBlacklist = filterByKeywordBlacklist(rawArticles, config.keywordBlacklist ?? [])

  // Haiku relevance filter
  const filtered = await filterRelevantArticles(section, afterBlacklist)
  onProgress?.('searching', `${sourcesFound}건 중 ${filtered.length}건 선별`, filtered.length)

  return filtered as readonly ArticleItem[]
}

/**
 * Phase 2: optimized analysis pipeline (2 AI calls instead of 4~6).
 * 1. Deep analysis with self-verification (Reasoning, ~30s)
 * 2. Refinement (General/fast, ~10s)
 * Takes pre-filtered articles from searchAndFilterSection.
 */
export async function analyzeSection(
  section: OutlineSection,
  articles: readonly ArticleItem[],
  config: ProjectConfig,
  onProgress?: SectionProgress,
): Promise<SectionResearchResult> {
  if (articles.length === 0) {
    return {
      sectionId: section.id,
      title: section.title,
      content: `이 섹션에 대한 최신 뉴스를 찾지 못했습니다. 검색어: ${section.searchQueries.join(', ')}`,
      sources: [],
    }
  }

  onProgress?.('analyzing', `${articles.length}건 기사 분석 중...`, articles.length)

  // Step 1: Deep analysis with integrated self-verification (Reasoning)
  const analysisPrompt = buildAnalysisWithGapHintsPrompt(section, articles, config)
  const analysisContent = await callAI(analysisPrompt, { model: 'reasoning', maxTokens: 4096 })

  // Step 2: Light refinement (General — faster model)
  onProgress?.('refining', '품질 개선 중...')

  const refinePrompt = buildRefinementPrompt(section, analysisContent, config)
  const refinedContent = await callAI(refinePrompt, { model: 'general', maxTokens: 4096 })

  // Build source references
  const sources: SourceReference[] = articles.map((a) => ({
    title: a.title,
    url: a.link,
    source: a.source,
    publishedAt: a.pubDate,
  }))

  const finalContent = refinedContent + buildSourceReferences(sources)

  return {
    sectionId: section.id,
    title: section.title,
    content: finalContent,
    sources,
  }
}

/**
 * Full pipeline: search + filter + analyze in one call.
 * Backward compatible — calls searchAndFilterSection then analyzeSection.
 */
export async function researchSection(
  section: OutlineSection,
  config: ProjectConfig,
  onProgress?: SectionProgress,
): Promise<SectionResearchResult> {
  const articles = await searchAndFilterSection(section, config, onProgress)
  return analyzeSection(section, articles, config, onProgress)
}
