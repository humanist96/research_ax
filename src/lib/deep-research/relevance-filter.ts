import type { OutlineSection } from './types'
import { callClaudeAsync } from './claude-async'

export async function filterRelevantArticles<T extends { readonly title: string; readonly content?: string }>(
  section: OutlineSection,
  articles: readonly T[],
): Promise<readonly T[]> {
  const MIN_ARTICLES = 3

  if (articles.length <= MIN_ARTICLES) {
    return articles
  }

  const titlesBlock = articles
    .map((a, i) => `${i + 1}. ${a.title}\n요약: ${a.content?.slice(0, 500) ?? ''}`)
    .join('\n')

  const prompt = `당신은 뉴스 기사 관련성 판정 전문가입니다.

## 섹션 정보
- 제목: ${section.title}
- 설명: ${section.description}
- 핵심 포인트: ${section.keyPoints.join(', ')}

## 기사 목록
${titlesBlock}

## 지시
각 기사가 위 섹션 주제와 관련이 있는지 판정하세요.
제목과 요약 내용을 함께 고려하여, 조금이라도 관련이 있으면 "관련"으로 분류하세요.

## 출력 (JSON만 출력)
\`\`\`json
{ "relevant": [1, 3, 5] }
\`\`\`
"relevant" 배열에 관련 있는 기사의 번호(1부터 시작)만 포함하세요.
JSON 블록만 출력하세요.`

  try {
    const raw = await callClaudeAsync(prompt, { model: 'haiku' })
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) ?? raw.match(/\{[\s\S]*?\}/)

    if (!jsonMatch) {
      return articles
    }

    const jsonStr = jsonMatch[1] ?? jsonMatch[0]
    const parsed = JSON.parse(jsonStr) as { relevant?: unknown }

    if (!Array.isArray(parsed.relevant)) {
      return articles
    }

    const relevantIndices = new Set(
      parsed.relevant
        .filter((n): n is number => typeof n === 'number')
        .map((n) => n - 1),
    )

    const filtered = articles.filter((_, i) => relevantIndices.has(i))

    if (filtered.length < MIN_ARTICLES) {
      return articles.slice(0, MIN_ARTICLES)
    }

    return filtered
  } catch {
    return articles
  }
}
