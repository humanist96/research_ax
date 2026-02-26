import type { ProjectConfig } from '@/types'
import type { OutlineSection, SectionResearchResult, SourceReference } from './types'
import { searchDynamicQueries } from '@/lib/collector/web-search'
import { callClaudeAsync } from './claude-async'

type SectionProgress = (status: 'searching' | 'analyzing', message: string, sourcesFound?: number) => void

function buildSectionAnalysisPrompt(
  section: OutlineSection,
  articles: readonly { title: string; content: string; link: string; source: string; pubDate: string }[],
  config: ProjectConfig,
): string {
  const articlesList = articles
    .map((a, i) => `[${i + 1}] "${a.title}" (${a.source}, ${a.pubDate})\n${a.content}`)
    .join('\n\n')

  return `당신은 "${config.reportTitle}" 보고서의 "${section.title}" 섹션을 작성하는 최고 수준의 리서치 애널리스트입니다.

## 섹션 정보
- 제목: ${section.title}
- 설명: ${section.description}
- 핵심 포인트: ${section.keyPoints.join(', ')}

## 도메인 컨텍스트
${config.domainContext}

## 수집된 기사 (${articles.length}건)
${articlesList}

## 작성 규칙
1. 기사를 단순 나열하지 말고, 통합된 분석을 서술하세요
2. 핵심 포인트를 중심으로 논리적으로 구성하세요
3. 중요한 사실에는 출처를 인라인으로 표기하세요 (예: "~로 나타났다[1]")
4. **800~2000자** 분량으로 심층적으로 작성하세요
5. 마크다운 형식으로 작성하되, 섹션 제목(##)은 포함하지 마세요
6. 소제목(###)을 활용하여 섹션 내부를 구조화하세요
7. 수치, 통계, 구체적 사례를 적극 활용하세요
8. **인과관계 분석**: 왜 이런 현상이 발생했는지 원인과 결과를 명확히 서술하세요
9. **비교 분석**: 관련 사례, 기간별 변화, 경쟁 구도 등 비교 관점을 포함하세요
10. **시사점 도출**: 분석 결과가 의미하는 바와 향후 전망을 제시하세요

마크다운 본문만 출력하세요. 다른 설명은 포함하지 마세요.`
}

export async function researchSection(
  section: OutlineSection,
  config: ProjectConfig,
  onProgress?: SectionProgress,
): Promise<SectionResearchResult> {
  onProgress?.('searching', `"${section.title}" 검색 중...`)

  const searchResults = await searchDynamicQueries(section.searchQueries)

  const sourcesFound = searchResults.length
  onProgress?.('analyzing', `${sourcesFound}건 기사 분석 중...`, sourcesFound)

  const sources: SourceReference[] = searchResults.map((r) => ({
    title: r.title,
    url: r.link,
    source: r.source,
    publishedAt: r.pubDate,
  }))

  if (searchResults.length === 0) {
    return {
      sectionId: section.id,
      title: section.title,
      content: `이 섹션에 대한 최신 뉴스를 찾지 못했습니다. 검색어: ${section.searchQueries.join(', ')}`,
      sources: [],
    }
  }

  const articles = searchResults.map((r) => ({
    title: r.title,
    content: r.content,
    link: r.link,
    source: r.source,
    pubDate: r.pubDate,
  }))

  const prompt = buildSectionAnalysisPrompt(section, articles, config)
  const content = await callClaudeAsync(prompt, { model: 'opus' })

  return {
    sectionId: section.id,
    title: section.title,
    content,
    sources,
  }
}
