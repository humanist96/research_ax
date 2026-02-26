import { spawn } from 'child_process'
import type { ConversationTurn } from '@/types'

const SYSTEM_PROMPT = `당신은 사용자의 리서치 파트너입니다. 사용자가 조사하고 싶은 주제에 대해 구조화된 질문을 통해 뉴스 수집·분석에 필요한 범위를 구체화합니다.

역할:
- 사용자의 관심사를 파악하고, 빠진 관점이 있으면 제안
- 지역 범위, 시간 범위, 핵심 기업/인물, 세부 분야 등을 질문으로 확인
- 충분히 구체화되었다고 판단되면 done: true로 완료 안내

응답 형식:
반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트를 포함하지 마세요.

{
  "message": "사용자에게 보여줄 안내 메시지",
  "questions": [
    {
      "id": "고유ID",
      "label": "질문 제목",
      "type": "single | multi | text",
      "options": ["선택지1", "선택지2"],
      "allowCustom": false,
      "recommended": "추천 답변",
      "reason": "추천 이유 한 줄 설명"
    }
  ],
  "suggestions": [
    {
      "label": "짧은 시나리오명",
      "prompt": "이 시나리오의 상세 답변 — 모든 질문에 대한 구체적이고 풍부한 답변 포함"
    }
  ],
  "done": false
}

규칙:
- type "single": 하나만 선택 (라디오 버튼). options 필수. recommended: options 중 하나(string).
- type "multi": 복수 선택 (체크박스). options 필수. allowCustom: true면 직접 입력 가능. recommended: options 중 복수(string[]).
- type "text": 자유 텍스트 입력. options 불필요. recommended: 추천 텍스트(string).
- recommended: 리서치 주제 맥락을 고려하여 최적의 답변을 추천하세요. 모든 질문에 반드시 포함.
- reason: 왜 이 선택을 추천하는지 한 줄로 설명. 모든 질문에 반드시 포함.
- questions는 한 턴에 2~4개가 적절.
- done: true일 때는 questions와 suggestions를 빈 배열로, message에 완료 안내를 넣으세요.
- JSON만 출력하세요. 마크다운이나 코드블록으로 감싸지 마세요.

suggestions 규칙 (빠른 답변 시나리오):
- suggestions는 2~3개. 각각 서로 다른 관점/방향의 시나리오를 제시하세요.
- label은 10자 이내의 짧은 시나리오명 (예: "국내 중심", "글로벌 시각", "기술 심층").
- prompt는 questions의 모든 항목에 대한 구체적이고 풍부한 답변. "[질문 라벨] 답변" 형식으로 작성하세요.
- 핵심 목적: 프롬프트 작성이 서투른 사용자도 클릭 한 번으로 전문가 수준의 답변을 전송할 수 있도록 돕는 것.
- 각 시나리오는 사용자가 직접 작성하기 어려운 전문적이고 상세한 내용을 포함하세요.

톤: 전문적이되 친근한 한국어. 짧고 명확하게.`

function formatConversationHistory(
  conversation: readonly ConversationTurn[]
): string {
  if (conversation.length === 0) return ''

  return conversation
    .map((turn) => {
      const role = turn.role === 'user' ? 'Human' : 'Assistant'
      return `${role}: ${turn.content}`
    })
    .join('\n\n')
}

export function buildConversationPrompt(
  initialPrompt: string,
  conversation: readonly ConversationTurn[],
  latestUserMessage?: string
): string {
  const parts: string[] = []

  parts.push(SYSTEM_PROMPT)
  parts.push('')
  parts.push(`리서치 주제: "${initialPrompt}"`)
  parts.push('')

  const history = formatConversationHistory(conversation)
  if (history) {
    parts.push('--- 대화 기록 ---')
    parts.push(history)
    parts.push('---')
    parts.push('')
  }

  if (latestUserMessage) {
    parts.push(`Human: ${latestUserMessage}`)
    parts.push('')
    parts.push('위 대화를 이어서 Assistant로서 응답하세요.')
  } else {
    parts.push('사용자가 위 주제로 리서치를 시작하려 합니다. Assistant로서 첫 응답을 해주세요.')
  }

  return parts.join('\n')
}

export function streamClaudeResponse(
  prompt: string,
  onData: (chunk: string) => void,
  onEnd: (fullText: string) => void,
  onError: (error: Error) => void
): void {
  const env = { ...process.env }
  delete env.CLAUDECODE

  const child = spawn('claude', ['--print'], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let fullText = ''
  let stderrText = ''

  child.stdout.on('data', (data: Buffer) => {
    const chunk = data.toString('utf-8')
    fullText += chunk
    onData(chunk)
  })

  child.stderr.on('data', (data: Buffer) => {
    stderrText += data.toString('utf-8')
  })

  child.on('close', (code) => {
    if (code !== 0) {
      onError(new Error(`Claude CLI exited with code ${code}: ${stderrText}`))
      return
    }
    onEnd(fullText.trim())
  })

  child.on('error', (err) => {
    onError(err)
  })

  child.stdin.write(prompt)
  child.stdin.end()
}
