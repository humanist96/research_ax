import type { ProjectConfig } from '@/types'
import type { ReportOutline } from './types'
import { callClaudeAsync } from './claude-async'

function buildOutlinePrompt(config: ProjectConfig): string {
  const keywordsList = [
    ...config.keywords.primary,
    ...config.keywords.secondary,
    ...config.keywords.entities,
  ].join(', ')

  const categoriesList = config.categories
    .map((c) => `- ${c.label}: ${c.description}`)
    .join('\n')

  const searchQueriesList = config.searchQueries.join(', ')

  return `당신은 전문 리서치 보고서의 목차를 설계하는 편집장입니다.

아래 정보를 바탕으로, 심층 리서치 보고서의 목차를 JSON으로 작성하세요.

## 보고서 제목
${config.reportTitle}

## 도메인 컨텍스트
${config.domainContext}

## 핵심 키워드
${keywordsList}

## 분석 카테고리
${categoriesList}

## 사전 검색어
${searchQueriesList}

## 출력 규칙
- 4~7개의 섹션으로 구성
- 각 섹션에는 2~3개의 구체적인 Google News 검색 쿼리 포함 (한국어)
- 각 섹션에는 2~4개의 핵심 포인트(분석 시 다뤄야 할 내용) 포함
- 섹션 ID는 영문 소문자+하이픈 형식 (예: market-overview)
- executiveSummaryGuidance: 최종 요약 작성 시 강조할 핵심 관점

반드시 아래 JSON 스키마에 맞춰 출력하세요. JSON 외의 텍스트는 포함하지 마세요.

\`\`\`json
{
  "title": "보고서 제목",
  "sections": [
    {
      "id": "section-id",
      "title": "섹션 제목",
      "description": "이 섹션에서 다루는 내용 설명",
      "searchQueries": ["검색어1", "검색어2"],
      "keyPoints": ["핵심포인트1", "핵심포인트2", "핵심포인트3"]
    }
  ],
  "executiveSummaryGuidance": "요약 작성 가이드"
}
\`\`\``
}

function parseOutlineResponse(text: string): ReportOutline {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse outline JSON from Claude response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  if (!parsed.title || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('Invalid outline structure: missing title or sections')
  }

  const sections = parsed.sections.slice(0, 7).map((s: Record<string, unknown>, idx: number) => ({
    id: String(s.id ?? `section-${idx + 1}`),
    title: String(s.title ?? ''),
    description: String(s.description ?? ''),
    searchQueries: Array.isArray(s.searchQueries) ? s.searchQueries.map(String).slice(0, 3) : [],
    keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints.map(String).slice(0, 4) : [],
  }))

  return {
    title: String(parsed.title),
    sections,
    executiveSummaryGuidance: String(parsed.executiveSummaryGuidance ?? ''),
  }
}

export async function generateOutline(config: ProjectConfig): Promise<ReportOutline> {
  const prompt = buildOutlinePrompt(config)
  const response = await callClaudeAsync(prompt, { model: 'opus' })
  return parseOutlineResponse(response)
}
