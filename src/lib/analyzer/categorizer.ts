import type { CategoryDefinition } from '@/types'

export function buildCategorizationPrompt(
  articles: readonly { title: string; content: string; id: string }[],
  categories?: readonly CategoryDefinition[],
  domainContext?: string
): string {
  const articleList = articles
    .map(
      (a, i) =>
        `[${i + 1}] ID: ${a.id}\n제목: ${a.title}\n내용: ${a.content.slice(0, 300)}`
    )
    .join('\n\n')

  if (categories && categories.length > 0) {
    const categoryList = categories
      .map((c) => `- ${c.id}: ${c.label} (${c.description})`)
      .join('\n')

    return `${domainContext ? `도메인 컨텍스트: ${domainContext}\n\n` : ''}다음 기사들을 아래 카테고리로 분류해주세요.

카테고리:
${categoryList}

기사 목록:
${articleList}

JSON 형식으로 응답해주세요:
[{"id": "기사ID", "category": "카테고리코드"}]

JSON만 출력하고 다른 텍스트는 포함하지 마세요.`
  }

  return `다음 증권사 AI/AX 관련 기사들을 아래 카테고리로 분류해주세요.

카테고리:
- ai-trading: AI 트레이딩 (AI 기반 매매, 알고리즘 트레이딩, 퀀트)
- robo-advisor: 로보어드바이저 (AI 자산관리, 자동 포트폴리오)
- customer-service-ai: 고객서비스 AI (챗봇, 상담 AI, 고객 응대)
- risk-management-ai: 리스크관리 AI (위험 관리, 이상탐지, 컴플라이언스)
- internal-automation: 내부업무자동화 (RPA, 문서 자동화, 업무 효율화)
- other: 기타

기사 목록:
${articleList}

JSON 형식으로 응답해주세요:
[{"id": "기사ID", "category": "카테고리코드"}]

JSON만 출력하고 다른 텍스트는 포함하지 마세요.`
}

export function parseCategorizationResult(
  output: string,
  validCategoryIds?: readonly string[]
): Record<string, string> {
  try {
    const jsonMatch = output.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return {}

    const parsed = JSON.parse(jsonMatch[0]) as { id: string; category: string }[]

    const validIds = validCategoryIds ?? [
      'ai-trading',
      'robo-advisor',
      'customer-service-ai',
      'risk-management-ai',
      'internal-automation',
      'other',
    ]

    const result: Record<string, string> = {}
    for (const item of parsed) {
      const category = validIds.includes(item.category)
        ? item.category
        : 'other'
      result[item.id] = category
    }
    return result
  } catch {
    console.error('[Categorizer] Failed to parse categorization result')
    return {}
  }
}
