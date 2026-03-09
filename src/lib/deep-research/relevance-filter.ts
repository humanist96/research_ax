import type { OutlineSection } from './types'
import { callAI } from '@/lib/ai'

export async function filterRelevantArticles<T extends { readonly title: string; readonly content?: string }>(
  section: OutlineSection,
  articles: readonly T[],
): Promise<readonly T[]> {
  const MIN_ARTICLES = 5
  const RELEVANCE_THRESHOLD = 6

  if (articles.length <= MIN_ARTICLES) {
    return articles
  }

  // Limit to 50 articles max to prevent token overflow in relevance scoring
  const MAX_FOR_SCORING = 50
  const candidates = articles.length > MAX_FOR_SCORING ? articles.slice(0, MAX_FOR_SCORING) : articles

  const titlesBlock = candidates
    .map((a, i) => `[${i + 1}] "${a.title}"\n${a.content?.slice(0, 300) ?? '(내용 없음)'}`)
    .join('\n\n')

  const prompt = `당신은 뉴스 기사 관련성 판정 전문가입니다. 각 기사가 해당 섹션 주제와 얼마나 관련 있는지 **점수**로 평가하세요.

## 섹션 정보
- 제목: ${section.title}
- 설명: ${section.description}
- 핵심 포인트: ${section.keyPoints.join(', ')}

## 기사 목록 (${candidates.length}건)
${titlesBlock}

## 평가 기준 (1~10점)
- **9~10점**: 섹션의 핵심 주제를 직접 다루며, 구체적 수치/사실/분석 포함
- **7~8점**: 섹션 주제와 밀접하게 관련되며, 유용한 정보 포함
- **5~6점**: 간접적으로 관련되거나, 배경 정보 제공
- **3~4점**: 약간 관련되지만, 핵심 주제에서 벗어남
- **1~2점**: 거의 무관하거나, 관련성이 매우 낮음

## 판정 시 주의사항
- 제목만으로 판단하지 말고, 요약 내용도 반드시 확인하세요
- 구체적인 데이터(수치, 통계, 사례)가 포함된 기사를 높게 평가하세요
- 단순 홍보성 기사나 중복 기사는 낮게 평가하세요
- 최신 동향이나 심층 분석 기사를 우대하세요

## 출력 (JSON만 출력)
\`\`\`json
{ "scores": [{"id": 1, "score": 8, "reason": "핵심 통계 포함"}, ...] }
\`\`\`
각 기사에 대해 id(1부터), score(1~10), reason(한 줄)을 포함하세요.
JSON 블록만 출력하세요.`

  try {
    const raw = await callAI(prompt, { model: 'fast', temperature: 0.3 })
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) ?? raw.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      return candidates
    }

    const jsonStr = jsonMatch[1] ?? jsonMatch[0]
    const parsed = JSON.parse(jsonStr) as { scores?: unknown }

    if (!Array.isArray(parsed.scores)) {
      return candidates
    }

    const scoreMap = new Map<number, number>()
    for (const entry of parsed.scores) {
      if (typeof entry === 'object' && entry !== null && 'id' in entry && 'score' in entry) {
        const id = Number((entry as { id: unknown }).id)
        const score = Number((entry as { score: unknown }).score)
        if (!isNaN(id) && !isNaN(score)) {
          scoreMap.set(id - 1, score)
        }
      }
    }

    // Filter by threshold, then sort by score descending
    const scored = candidates
      .map((article, i) => ({ article, score: scoreMap.get(i) ?? 0, index: i }))
      .filter((item) => item.score >= RELEVANCE_THRESHOLD)
      .sort((a, b) => b.score - a.score)

    const filtered = scored.map((item) => item.article)

    if (filtered.length < MIN_ARTICLES) {
      const topScored = candidates
        .map((article, i) => ({ article, score: scoreMap.get(i) ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MIN_ARTICLES)
        .map((item) => item.article)
      return topScored
    }

    return filtered
  } catch {
    return candidates
  }
}
