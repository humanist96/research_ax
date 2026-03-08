import type { AudioOptions, QuizOptions, SlideOptions } from '@/types/notebooklm'

const MAX_REPORT_CHARS = 12000

function truncateReport(markdown: string): string {
  if (markdown.length <= MAX_REPORT_CHARS) return markdown
  return markdown.slice(0, MAX_REPORT_CHARS) + '\n\n... (이하 생략)'
}

export function buildQuizPrompt(markdown: string, options?: QuizOptions): string {
  const difficulty = options?.difficulty ?? 'medium'
  const quantityMap = { less: 5, default: 10, more: 15 } as const
  const count = quantityMap[options?.quantity ?? 'default']

  const difficultyGuide = {
    easy: '기본 개념 확인 수준. 보고서에 명시된 사실 위주.',
    medium: '핵심 내용 이해도 확인. 인과관계, 비교, 수치 해석 포함.',
    hard: '심화 분석 수준. 추론, 시사점 도출, 복합적 판단 요구.',
  }[difficulty]

  return `아래 보고서를 기반으로 ${count}개의 객관식 퀴즈를 생성하세요.

## 난이도: ${difficulty}
${difficultyGuide}

## 보고서
${truncateReport(markdown)}

## 출력 형식 (JSON만 출력)
\`\`\`json
{
  "questions": [
    {
      "question": "질문 텍스트",
      "choices": ["선택지A", "선택지B", "선택지C", "선택지D"],
      "correctIndex": 0,
      "explanation": "정답 해설 (1~2문장)"
    }
  ]
}
\`\`\`

규칙:
- 선택지는 반드시 4개
- correctIndex는 0~3
- 보고서에 근거한 문제만 출제
- JSON 블록만 출력하세요`
}

export function buildFlashcardsPrompt(markdown: string): string {
  return `아래 보고서에서 핵심 개념 15~20개를 추출하여 플래시카드를 생성하세요.

## 보고서
${truncateReport(markdown)}

## 출력 형식 (JSON만 출력)
\`\`\`json
{
  "cards": [
    {
      "front": "핵심 개념/용어/질문",
      "back": "설명/정의/답변 (2~3문장)",
      "category": "카테고리명"
    }
  ]
}
\`\`\`

규칙:
- front: 짧고 명확한 질문이나 핵심 용어
- back: 이해하기 쉬운 설명 (수치 포함)
- category: 보고서 섹션명 또는 주제 분류
- JSON 블록만 출력하세요`
}

export function buildMindMapPrompt(markdown: string): string {
  return `아래 보고서의 구조와 핵심 개념을 계층적 마인드맵으로 변환하세요.

## 보고서
${truncateReport(markdown)}

## 출력 형식 (JSON만 출력)
\`\`\`json
{
  "root": {
    "id": "root",
    "label": "보고서 제목",
    "children": [
      {
        "id": "section-1",
        "label": "섹션명",
        "children": [
          { "id": "topic-1-1", "label": "핵심 주제" },
          { "id": "topic-1-2", "label": "핵심 주제" }
        ]
      }
    ]
  }
}
\`\`\`

규칙:
- 최대 3단계 깊이
- 각 노드의 label은 15자 이내
- 1단계: 보고서 주요 섹션 (3~6개)
- 2단계: 섹션별 핵심 주제 (2~4개)
- 3단계: 세부 키워드 (1~3개, 선택)
- id는 고유해야 함
- JSON 블록만 출력하세요`
}

export function buildSlidesPrompt(markdown: string, options?: SlideOptions): string {
  const count = options?.slideCount ?? 10

  return `아래 보고서를 ${count}장의 프레젠테이션 슬라이드로 변환하세요.

## 보고서
${truncateReport(markdown)}

## 출력 형식 (JSON만 출력)
\`\`\`json
{
  "slides": [
    {
      "title": "슬라이드 제목",
      "bullets": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
      "speakerNotes": "발표자 노트 (1~2문장)"
    }
  ]
}
\`\`\`

규칙:
- 첫 슬라이드: 보고서 제목 + 핵심 요약
- 마지막 슬라이드: 결론 및 시사점
- 각 슬라이드 bullets: 3~5개, 각 항목 30자 이내
- 수치와 데이터를 적극 활용
- JSON 블록만 출력하세요`
}

export function buildAudioScriptPrompt(markdown: string, options?: AudioOptions): string {
  const style = options?.style ?? 'briefing'
  const length = options?.length ?? 'medium'

  const wordCountMap = { short: 500, medium: 1200, long: 2500 } as const
  const targetWords = wordCountMap[length]

  const styleGuide = {
    'deep-dive': '전문가 두 명이 심층 토론하는 형식. 데이터와 인사이트 중심.',
    conversation: '친근한 대화체. 청취자가 쉽게 이해할 수 있도록 비유와 예시 활용.',
    briefing: '간결한 뉴스 브리핑 형식. 핵심 사실과 수치 위주.',
    summary: '요약 정리 형식. 보고서의 핵심만 빠르게 전달.',
  }[style]

  return `아래 보고서를 기반으로 오디오 팟캐스트 스크립트를 작성하세요.

## 스타일: ${style}
${styleGuide}

## 분량: 약 ${targetWords}자 (한국어)

## 보고서
${truncateReport(markdown)}

## 작성 규칙
- 한국어로 작성
- 자연스러운 구어체 (TTS로 읽힐 예정)
- 마크다운이나 특수 서식 없이 순수 텍스트만
- 괄호, 기호, URL 사용 금지
- 숫자는 한글로 표기 (예: "약 삼십 퍼센트")
- 핵심 데이터와 인사이트를 포함
- 시작 인사와 마무리 포함

스크립트만 출력하세요.`
}
