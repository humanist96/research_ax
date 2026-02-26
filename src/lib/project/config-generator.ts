import { execSync } from 'child_process'
import type { ConversationTurn, ProjectConfig } from '@/types'
import { RSS_SOURCES } from '@/lib/config/sources'

function callClaude(prompt: string): string {
  try {
    const escaped = prompt.replace(/'/g, "'\\''")
    const env = { ...process.env }
    delete env.CLAUDECODE
    const result = execSync(
      `echo '${escaped}' | claude --print`,
      {
        encoding: 'utf-8',
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
        env,
      }
    )
    return result.trim()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Claude CLI call failed: ${msg}`)
  }
}

export function generateConfig(
  initialPrompt: string,
  conversation: readonly ConversationTurn[]
): ProjectConfig {
  const conversationContext = conversation
    .map((turn) => `${turn.role === 'user' ? '사용자' : '시스템'}: ${turn.content}`)
    .join('\n')

  const prompt = `당신은 리서치 설정 전문가입니다. 사용자의 대화 내용을 분석하여 뉴스 수집/분석 설정을 JSON으로 생성하세요.

사용자의 초기 요청: "${initialPrompt}"

대화 내용:
${conversationContext}

다음 JSON 형식으로 설정을 생성하세요:
{
  "keywords": {
    "primary": ["핵심 키워드 3-8개 (가중치 높음)"],
    "secondary": ["보조 키워드 5-10개 (가중치 낮음)"],
    "entities": ["기업명, 인물명, 기관명 등 고유명사"]
  },
  "categories": [
    {"id": "kebab-case-id", "label": "한글 라벨", "description": "분류 기준 설명"}
  ],
  "searchQueries": ["Google 뉴스 검색어 3-5개"],
  "domainContext": "이 리서치의 도메인 컨텍스트 설명 (분석 AI에게 제공)",
  "reportTitle": "리포트 제목",
  "keywordWeights": {"primary": 3, "secondary": 1, "entity": 2},
  "minRelevanceScore": 3
}

카테고리는 4-8개, "other" 카테고리는 반드시 포함하세요.
JSON만 출력하세요.`

  const result = callClaude(prompt)

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')

    const parsed = JSON.parse(jsonMatch[0])

    const hasOther = parsed.categories.some((c: { id: string }) => c.id === 'other')
    const categories = hasOther
      ? parsed.categories
      : [...parsed.categories, { id: 'other', label: '기타', description: '위 카테고리에 해당하지 않는 기사' }]

    return {
      keywords: {
        primary: parsed.keywords?.primary ?? [],
        secondary: parsed.keywords?.secondary ?? [],
        entities: parsed.keywords?.entities ?? [],
      },
      categories,
      searchQueries: parsed.searchQueries ?? [],
      rssSources: [...RSS_SOURCES],
      domainContext: parsed.domainContext ?? '',
      reportTitle: parsed.reportTitle ?? '리서치 리포트',
      keywordWeights: {
        primary: parsed.keywordWeights?.primary ?? 3,
        secondary: parsed.keywordWeights?.secondary ?? 1,
        entity: parsed.keywordWeights?.entity ?? 2,
      },
      minRelevanceScore: parsed.minRelevanceScore ?? 3,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse config from Claude response: ${msg}`)
  }
}
