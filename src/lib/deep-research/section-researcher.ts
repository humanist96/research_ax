import type { ProjectConfig } from '@/types'
import type { OutlineSection, SectionResearchResult, SourceReference } from './types'
import { searchForSection } from '@/lib/collector/aggregator'
import { callClaudeAsync } from './claude-async'
import { filterRelevantArticles } from './relevance-filter'
import { filterByKeywordBlacklist } from './keyword-filter'

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

function buildSectionAnalysisPrompt(
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
3. 중요한 사실에는 출처를 인라인으로 표기하세요 (예: "~로 나타났다[1]")
4. **1000~3000자** 분량으로 심층적으로 작성하세요
5. 마크다운 형식으로 작성하되, 섹션 제목(##)은 포함하지 마세요
6. 소제목(###)을 활용하여 섹션 내부를 구조화하세요
7. 수치, 통계, 구체적 사례를 적극 활용하세요
8. **인과관계 분석**: 왜 이런 현상이 발생했는지 원인과 결과를 명확히 서술하세요
9. **비교 분석**: 관련 사례, 기간별 변화, 경쟁 구도 등 비교 관점을 포함하세요
10. **시사점 도출**: 분석 결과가 의미하는 바와 향후 전망을 제시하세요
11. **시각 요소**: 위 시각적 요소 활용 지침에 따라 표나 Mermaid 다이어그램을 적극 활용하세요

마크다운 본문만 출력하세요. 다른 설명은 포함하지 마세요.`
}

function buildGapDetectionPrompt(
  section: OutlineSection,
  initialContent: string,
  config: ProjectConfig,
): string {
  return `당신은 리서치 품질 검증 전문가입니다. 아래 초기 분석 결과를 검토하고, 누락된 정보나 추가 조사가 필요한 부분을 식별하세요.

## 보고서: "${config.reportTitle}"
## 섹션: "${section.title}"
## 설명: ${section.description}
## 핵심 포인트: ${section.keyPoints.join(', ')}

## 초기 분석 결과
${initialContent}

## 검토 지침
다음 관점에서 갭(gap)을 탐지하세요:
1. **누락된 관점**: 다루지 않은 중요한 시각이나 이해관계자 관점
2. **근거 부족 주장**: 데이터나 출처 없이 제시된 주장
3. **추가 데이터 필요**: 최신 통계, 수치, 사례가 필요한 부분
4. **교차 검증 필요**: 하나의 출처에만 의존하는 핵심 주장

## 출력 형식 (JSON만 출력)
\`\`\`json
{
  "gaps": [
    { "type": "missing_perspective" | "weak_evidence" | "needs_data" | "needs_verification", "description": "갭 설명" }
  ],
  "followUpQueries": ["후속 검색어1", "후속 검색어2"],
  "assessment": "overall_good" | "needs_deepening"
}
\`\`\`

JSON 블록만 출력하세요. 다른 텍스트는 포함하지 마세요.`
}

function buildIntegratedAnalysisPrompt(
  section: OutlineSection,
  articles: readonly ArticleItem[],
  initialContent: string,
  gaps: readonly { type: string; description: string }[],
  config: ProjectConfig,
): string {
  const gapsList = gaps.map((g, i) => `${i + 1}. [${g.type}] ${g.description}`).join('\n')

  return `당신은 "${config.reportTitle}" 보고서의 "${section.title}" 섹션을 재작성하는 최고 수준의 리서치 애널리스트입니다.

## 섹션 정보
- 제목: ${section.title}
- 설명: ${section.description}
- 핵심 포인트: ${section.keyPoints.join(', ')}

## 도메인 컨텍스트
${config.domainContext}

## 이전 분석
${initialContent}

## 식별된 갭 (보완 필요)
${gapsList}

## 추가 수집된 기사 (${articles.length}건)
${formatArticlesList(articles)}

${getVisualGuidelinesBlock()}

## 작성 규칙
1. 이전 분석을 기반으로, 식별된 갭을 보완하여 **통합된 심층 분석**을 작성하세요
2. 추가 기사의 정보를 자연스럽게 통합하세요
3. 교차 검증: 여러 출처에서 확인된 사실은 강조하고, 상충되는 정보는 양쪽을 모두 제시하세요
4. 중요한 사실에는 출처를 인라인으로 표기하세요 (예: "~로 나타났다[1]")
5. **1500~4000자** 분량으로 심층적으로 작성하세요
6. 마크다운 형식으로 작성하되, 섹션 제목(##)은 포함하지 마세요
7. 소제목(###)을 활용하여 섹션 내부를 구조화하세요
8. 수치, 통계, 구체적 사례를 적극 활용하세요
9. **인과관계 분석**: 원인과 결과를 명확히 서술하세요
10. **비교 분석**: 관련 사례, 기간별 변화를 포함하세요
11. **시사점 도출**: 분석 결과가 의미하는 바와 향후 전망을 제시하세요
12. **시각 요소**: 위 시각적 요소 활용 지침에 따라 표나 Mermaid 다이어그램을 적극 활용하세요

마크다운 본문만 출력하세요. 다른 설명은 포함하지 마세요.`
}

function buildCritiqueAndRefinePrompt(
  section: OutlineSection,
  content: string,
  config: ProjectConfig,
): string {
  return `당신은 "${config.reportTitle}" 보고서의 품질 관리 편집자입니다.

## 섹션: "${section.title}"

## 현재 분석 내용
${content}

## 비평 및 개선 지침

**1단계: 비평** — 아래 기준으로 현재 내용을 비평하세요:
- **논리 비약**: 근거 없는 도약이나 비약적 추론
- **근거 부족**: 출처 없이 제시된 핵심 주장
- **편향**: 특정 입장에 치우친 서술
- **누락된 시사점**: 중요하지만 다루지 않은 함의
- **구조적 문제**: 흐름이 자연스럽지 않은 부분
- **시각 요소 검증**: 표나 다이어그램이 적절히 활용되었는지, 부정확하거나 억지스러운 시각 요소는 없는지

**2단계: 개선** — 비평을 반영하여 개선된 버전을 작성하세요:
- 논리적 연결을 강화하세요
- 근거가 부족한 주장은 완화하거나 보강하세요
- 균형 잡힌 시각을 제시하세요
- 빠진 시사점을 추가하세요
- 전체 흐름을 매끄럽게 다듬으세요
- 시각 요소(표/Mermaid 다이어그램)가 부족하면 보완하고, 부정확한 것은 수정하세요
- Mermaid 한국어 노드는 큰따옴표 필수: A["한국어 텍스트"]

## 출력 규칙
- 개선된 본문만 출력하세요 (비평 과정은 포함하지 마세요)
- 마크다운 형식, 섹션 제목(##) 제외
- 소제목(###) 활용
- 인라인 출처 표기 유지

마크다운 본문만 출력하세요.`
}

function buildSourceReferences(sources: readonly SourceReference[]): string {
  if (sources.length === 0) return ''

  const lines = sources.map((s, i) =>
    `${i + 1}. [${s.title}](${s.url}) — ${s.source}, ${s.publishedAt}`
  )

  return `\n\n---\n**출처**\n${lines.join('\n')}`
}

interface GapDetectionResult {
  readonly gaps: readonly { type: string; description: string }[]
  readonly followUpQueries: readonly string[]
  readonly assessment: string
}

function parseGapDetectionResult(raw: string): GapDetectionResult {
  const defaultResult: GapDetectionResult = {
    gaps: [],
    followUpQueries: [],
    assessment: 'overall_good',
  }

  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) ?? raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return defaultResult

    const jsonStr = jsonMatch[1] ?? jsonMatch[0]
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>

    return {
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      followUpQueries: Array.isArray(parsed.followUpQueries)
        ? parsed.followUpQueries.filter((q): q is string => typeof q === 'string').slice(0, 3)
        : [],
      assessment: typeof parsed.assessment === 'string' ? parsed.assessment : 'overall_good',
    }
  } catch {
    return defaultResult
  }
}

function deduplicateArticles(articles: readonly ArticleItem[]): readonly ArticleItem[] {
  const seen = new Set<string>()
  return articles.filter((a) => {
    if (seen.has(a.link)) return false
    seen.add(a.link)
    return true
  })
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
 * Phase 2: analysis pipeline (initial analysis → gap detection → deepening → refinement).
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

  // Step 2: Initial analysis (Opus)
  const analysisPrompt = buildSectionAnalysisPrompt(section, articles, config)
  const initialContent = await callClaudeAsync(analysisPrompt, { model: 'opus' })

  // Step 3: Gap detection + follow-up search (Sonnet)
  onProgress?.('deepening', '갭 탐지 및 심화 검색 중...')

  const gapPrompt = buildGapDetectionPrompt(section, initialContent, config)
  const gapRaw = await callClaudeAsync(gapPrompt, { model: 'sonnet' })
  const gapResult = parseGapDetectionResult(gapRaw)

  let allArticles: readonly ArticleItem[] = articles
  let integratedContent = initialContent

  if (gapResult.followUpQueries.length > 0 && gapResult.assessment === 'needs_deepening') {
    const additionalResults = await searchForSection(gapResult.followUpQueries, config)

    if (additionalResults.length > 0) {
      const rawAdditionalArticles: ArticleItem[] = additionalResults.map((r) => ({
        title: r.title,
        content: r.content,
        link: r.link,
        source: r.source,
        pubDate: r.pubDate,
      }))

      const afterBlacklist = filterByKeywordBlacklist(rawAdditionalArticles, config.keywordBlacklist ?? [])
      const additionalArticles = await filterRelevantArticles(section, afterBlacklist)
      allArticles = deduplicateArticles([...articles, ...additionalArticles])

      onProgress?.('deepening', `추가 ${additionalResults.length}건 중 ${additionalArticles.length}건 선별, 통합 분석 중...`, allArticles.length)

      const integratedPrompt = buildIntegratedAnalysisPrompt(
        section,
        additionalArticles,
        initialContent,
        gapResult.gaps,
        config,
      )
      integratedContent = await callClaudeAsync(integratedPrompt, { model: 'opus' })
    }
  }

  // Step 4: Self-critique + refinement (Sonnet)
  onProgress?.('refining', '자기비평 및 품질 개선 중...')

  const critiquePrompt = buildCritiqueAndRefinePrompt(section, integratedContent, config)
  const refinedContent = await callClaudeAsync(critiquePrompt, { model: 'sonnet' })

  // Step 5: Build source references
  const sources: SourceReference[] = allArticles.map((a) => ({
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
