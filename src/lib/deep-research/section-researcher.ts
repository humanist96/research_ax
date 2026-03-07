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
  return `## 시각적 요소 활용 지침 (필수)

### 마크다운 표
- 비교 데이터가 2건 이상이면 반드시 **마크다운 표**로 정리하세요
- 컬럼은 3~6개 이내, 데이터 행은 3~10개
- 표에는 수치, 비율, 변화량 등 정량적 데이터를 우선 배치하세요
- 표 앞뒤에 간단한 해석 문장을 추가하세요

### Mermaid 다이어그램
- 프로세스, 인과관계, 흐름도: **Mermaid flowchart**
  \`\`\`mermaid
  graph TD
    A["원인"] --> B["결과"]
  \`\`\`
- 비율/분포/점유율: **Mermaid pie chart**
  \`\`\`mermaid
  pie title 시장 점유율
    "A사" : 40
    "B사" : 30
    "기타" : 30
  \`\`\`
- 타임라인/로드맵: **Mermaid timeline**
  \`\`\`mermaid
  timeline
    title 주요 일정
    2024-Q1 : 계획 수립
    2024-Q2 : 시범 운영
  \`\`\`
- Mermaid 필수 규칙:
  - 한국어 텍스트는 반드시 큰따옴표: A["한국어 텍스트"]
  - 노드 10개 이하로 간결하게
  - \`\`\`mermaid 코드 블록 사용

### 서식 강화
- **굵은 글씨**: 핵심 수치, 핵심 키워드 강조
- 핵심 인사이트는 **인용 블록(>)** 으로 강조
- 목록(-, 1.)을 활용하여 가독성 확보
- 핵심 수치가 있으면 강조 블록으로 표현:
  > **핵심 수치**: 시장 규모 xxx조원, 성장률 xx% (출처)

### 각 섹션 최소 요구사항
- **마크다운 표 1개 이상** 필수
- **Mermaid 다이어그램 1개** 또는 **추가 표 1개** 권장
- 데이터가 불충분하면 억지로 만들지 마세요`
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
전문적이고 심층적인 분석 보고서를 작성해야 합니다. 학술 논문 수준의 깊이와 비즈니스 보고서의 실용성을 갖추세요.

## 섹션 정보
- 제목: ${section.title}
- 설명: ${section.description}
- 핵심 포인트: ${section.keyPoints.join(', ')}

## 도메인 컨텍스트
${config.domainContext}

## 수집된 기사 (${articles.length}건)
${formatArticlesList(articles)}

${getVisualGuidelinesBlock()}

## 작성 규칙 (엄격히 준수)

### 구조와 흐름
1. 소제목(###)을 활용하여 3~5개 하위 주제로 구조화하세요
2. 각 하위 주제는 논리적 흐름으로 연결되어야 합니다
3. 도입 → 현황 분석 → 핵심 발견 → 시사점 순서로 전개하세요
4. 마크다운 형식으로 작성하되, 섹션 제목(##)은 포함하지 마세요

### 분석의 깊이
5. **정량적 데이터를 최우선 인용**: 수치, 통계, %, 금액, 변화율 등을 적극 활용하세요
6. **인과관계 분석**: 현상의 원인과 결과를 명확히 분석하세요 (왜? → 어떻게? → 그래서?)
7. **비교 분석**: 시간적 변화(전년 대비), 주체 간 비교(기업/국가), 관점 대비 등
8. **시사점 도출**: 분석 결과가 의미하는 바, 향후 예상 전개, 대응 방향
9. **근거 기반 서술**: 모든 주장에는 출처 데이터 또는 논리적 근거를 포함하세요

### 서식과 가독성
10. 중요한 사실에는 출처를 인라인 표기: "~로 나타났다[출처명]"
11. 핵심 데이터는 **굵게** 표시하고, 인용 블록(>)으로 강조하세요
12. **2000~5000자** 분량으로 충실하게 작성하세요
13. 각 하위 주제에 구체적인 사례나 데이터를 반드시 포함하세요

### 시각 요소 (필수)
14. **마크다운 표 최소 1개**: 비교 데이터, 현황 정리, 수치 요약 등
15. **Mermaid 다이어그램 권장**: 프로세스, 인과관계, 비율 등 시각화
16. 위 시각적 요소 활용 지침을 반드시 참고하세요

## 자가 검증 (작성 후 반드시 수행)
- 근거 없는 주장이 있으면 완화하거나 보강하세요
- 핵심 포인트가 모두 다뤄졌는지 확인하세요
- 정량적 데이터가 충분히 인용되었는지 확인하세요
- 표나 다이어그램이 최소 1개 포함되었는지 확인하세요
- 논리적 비약이 있으면 연결을 강화하세요
- 균형 잡힌 시각을 유지하세요

마크다운 본문만 출력하세요. 다른 설명은 포함하지 마세요.`
}

function buildRefinementPrompt(
  section: OutlineSection,
  content: string,
  config: ProjectConfig,
): string {
  return `당신은 "${config.reportTitle}" 보고서의 수석 편집자입니다. 아래 분석 내용을 전문적으로 개선하세요.

## 섹션: "${section.title}"

## 현재 내용
${content}

## 개선 체크리스트

### 구조 개선
- 논리적 흐름이 자연스러운지 확인하고 다듬으세요
- 소제목(###)이 적절히 사용되었는지 확인하세요
- 도입부와 마무리가 매끄러운지 확인하세요

### 시각 요소 보강
- **마크다운 표**가 없으면 반드시 1개 이상 추가하세요
  - 비교 데이터, 수치 요약, 현황 정리 등에 활용
- **Mermaid 다이어그램**이 없으면 적합한 곳에 1개 추가를 검토하세요
  - flowchart: 프로세스/인과관계, pie: 비율/점유율, timeline: 일정
  - 한국어 노드는 큰따옴표 필수: A["한국어 텍스트"]
  - 데이터가 불충분하면 억지로 만들지 마세요

### 서식 강화
- 핵심 수치와 키워드는 **굵게** 처리하세요
- 중요 인사이트는 인용 블록(>)으로 강조하세요
- 인라인 출처 표기를 유지하세요

### 품질 확인
- 마크다운 형식, 섹션 제목(##) 제외, 소제목(###) 활용
- 2000~5000자 분량 유지
- 근거 없는 주장 제거 또는 완화

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
 * Phase 1 only: search + keyword blacklist filter + relevance scoring filter.
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

  // Scoring-based relevance filter (gpt-4o)
  const filtered = await filterRelevantArticles(section, afterBlacklist)
  onProgress?.('searching', `${sourcesFound}건 중 ${filtered.length}건 선별`, filtered.length)

  return filtered as readonly ArticleItem[]
}

/**
 * Phase 2: analysis pipeline (2 AI calls with gpt-4o).
 * 1. Deep analysis with self-verification (Reasoning/gpt-4o, ~30s)
 * 2. Refinement with visual element check (General/gpt-4o, ~15s)
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

  // Step 1: Deep analysis with integrated self-verification (gpt-4o, high tokens)
  const analysisPrompt = buildAnalysisWithGapHintsPrompt(section, articles, config)
  const analysisContent = await callAI(analysisPrompt, { model: 'reasoning', maxTokens: 8192 })

  // Step 2: Refinement with visual element reinforcement (gpt-4o)
  onProgress?.('refining', '품질 개선 중...')

  const refinePrompt = buildRefinementPrompt(section, analysisContent, config)
  const refinedContent = await callAI(refinePrompt, { model: 'general', maxTokens: 8192 })

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
