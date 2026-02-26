export function buildSummarizationPrompt(
  articles: readonly { title: string; content: string; id: string }[],
  domainContext?: string
): string {
  const articleList = articles
    .map(
      (a, i) =>
        `[${i + 1}] ID: ${a.id}\n제목: ${a.title}\n내용: ${a.content.slice(0, 500)}`
    )
    .join('\n\n')

  const contextLine = domainContext
    ? `도메인 컨텍스트: ${domainContext}\n\n`
    : ''

  return `${contextLine}다음 기사들의 핵심 내용을 각각 1-2줄로 요약해주세요.

기사 목록:
${articleList}

JSON 형식으로 응답해주세요:
[{"id": "기사ID", "summary": "요약 내용"}]

JSON만 출력하고 다른 텍스트는 포함하지 마세요.`
}

export function parseSummarizationResult(
  output: string
): Record<string, string> {
  try {
    const jsonMatch = output.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return {}

    const parsed = JSON.parse(jsonMatch[0]) as { id: string; summary: string }[]
    const result: Record<string, string> = {}
    for (const item of parsed) {
      result[item.id] = item.summary
    }
    return result
  } catch {
    console.error('[Summarizer] Failed to parse summarization result')
    return {}
  }
}
