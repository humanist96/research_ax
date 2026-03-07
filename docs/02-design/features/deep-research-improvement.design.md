# Design: Deep Research Improvement

> Plan 참조: `docs/01-plan/features/deep-research-improvement.plan.md`

## 1. Phase 1: AI 호출 경량화 — 상세 설계

### 1-1. 관련성 필터 모델 변경

**파일**: `src/lib/deep-research/relevance-filter.ts`

```diff
- const raw = await callAI(prompt, { model: 'general', temperature: 0.3 })
+ const raw = await callAI(prompt, { model: 'fast', temperature: 0.3 })
```

**관련성 threshold 조정**:
- gpt-4o-mini는 점수를 보수적으로 매기는 경향 → threshold를 6→5로 낮춤
- 또는 기존 6 유지하고 `MIN_ARTICLES`를 3→5로 상향 (fallback 강화)

```diff
- const MIN_ARTICLES = 3
- const RELEVANCE_THRESHOLD = 6
+ const MIN_ARTICLES = 5
+ const RELEVANCE_THRESHOLD = 6
```

**예상 효과**: 관련성 필터 30~40초 → 5~10초

### 1-2. maxTokens 일괄 조정

**파일별 변경**:

| 파일 | 함수 | 현재 | 변경 |
|------|------|------|------|
| `section-researcher.ts` | `analyzeOnly()` | `{ model: 'reasoning', maxTokens: 8192 }` | `{ model: 'reasoning', maxTokens: 4096 }` |
| `section-researcher.ts` | `refineOnly()` | `{ model: 'fast', maxTokens: 8192 }` | `{ model: 'fast', maxTokens: 4096 }` |
| `report-compiler.ts` | `generateExecutiveSummary()` | `{ model: 'reasoning', maxTokens: 8192 }` | `{ model: 'reasoning', maxTokens: 4096 }` |
| `report-compiler.ts` | `generateConclusion()` | `{ model: 'reasoning', maxTokens: 8192 }` | `{ model: 'reasoning', maxTokens: 4096 }` |

**ai/config.ts 글로벌 상한 조정**:

```diff
  const DEFAULT_MAX_TOKENS: Record<string, number> = {
-   reasoning: 16384,
+   reasoning: 8192,
    general: 8192,
    fast: 4096,
  }
```

### 1-3. 입력 토큰 축소

**파일**: `src/lib/deep-research/section-researcher.ts`

#### A. 기사 content 절삭 (formatArticlesList 변경)

```typescript
// 현재: 기사 전문 전달
function formatArticlesList(articles: readonly ArticleItem[]): string {
  return articles
    .map((a, i) => `[${i + 1}] "${a.title}" (${a.source}, ${a.pubDate})\n${a.content}`)
    .join('\n\n')
}

// 변경: 400자로 절삭 + 최대 10건
function formatArticlesList(articles: readonly ArticleItem[]): string {
  const limited = articles.slice(0, MAX_ARTICLES_PER_SECTION)
  return limited
    .map((a, i) => `[${i + 1}] "${a.title}" (${a.source}, ${a.pubDate})\n${a.content.slice(0, 400)}`)
    .join('\n\n')
}

const MAX_ARTICLES_PER_SECTION = 10
```

#### B. 프롬프트 분량 지시 조정

분석 프롬프트의 분량 지시를 조정하여 토큰 절약:

```diff
- 12. **2000~5000자** 분량으로 충실하게 작성하세요
+ 12. **1500~3000자** 분량으로 핵심 위주로 작성하세요
```

이유: maxTokens 4096 = ~2000한글자. 여유를 두고 1500~3000자 지시.

### 1-4. 예상 토큰 사용량 비교

| 항목 | 현재 (추정) | 변경 후 (추정) |
|------|------------|--------------|
| 분석 프롬프트 입력 | ~4000 토큰 (기사 15건×600자) | ~2500 토큰 (기사 10건×400자) |
| 분석 maxTokens | 8192 | 4096 |
| 합계 (입력+출력) | ~12000 | ~6500 |
| 예상 응답 시간 | 40~90초 | 20~45초 |

---

## 2. Phase 2: 스트리밍 타임아웃 안전망 — 상세 설계

### 2-1. callAI 함수 확장

**파일**: `src/lib/ai/client.ts`

현재 `callAI`는 OpenAI SDK의 `chat.completions.create()`를 non-streaming으로 호출.
스트리밍 + 타임아웃 옵션을 추가:

```typescript
interface CallAIOptions {
  model?: AIModelRole | string
  maxTokens?: number
  temperature?: number
  timeoutMs?: number  // NEW: 이 시간 초과 시 지금까지 받은 텍스트 반환
}

async function callAI(prompt: string, options?: CallAIOptions): Promise<string> {
  const { timeoutMs, ...rest } = options ?? {}

  if (!timeoutMs) {
    // 기존 로직: non-streaming
    return callAINonStreaming(prompt, rest)
  }

  // 스트리밍 + 타임아웃
  return callAIWithTimeout(prompt, rest, timeoutMs)
}

async function callAIWithTimeout(
  prompt: string,
  options: Omit<CallAIOptions, 'timeoutMs'>,
  timeoutMs: number,
): Promise<string> {
  const stream = await openai.chat.completions.create({
    model: resolvedModel,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: resolvedMaxTokens,
    stream: true,
  })

  let result = ''
  const deadline = Date.now() + timeoutMs

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? ''
    result += delta

    if (Date.now() > deadline) {
      // 타임아웃: 지금까지 결과 반환
      stream.controller.abort()
      break
    }
  }

  return result
}
```

### 2-2. 적용 대상

Phase 1으로 충분하면 Phase 2는 보류. 적용 시:

| 함수 | timeoutMs |
|------|-----------|
| `analyzeOnly` | 50000 (50초) |
| `generateExecutiveSummary` | 50000 |
| `generateConclusion` | 50000 |

`refineOnly`는 gpt-4o-mini로 빠르므로 timeout 불필요.

### 2-3. 불완전 응답 처리

타임아웃으로 잘린 응답의 품질 보장:

1. `refineOnly`에서 불완전한 부분을 보정 (이미 정제 역할)
2. 마크다운 문법 깨짐 감지: 열린 코드블록(```) 닫기, 열린 표 닫기
3. 최소 길이 체크: 500자 미만이면 타임아웃 에러로 처리 (재시도 유도)

```typescript
function sanitizePartialMarkdown(content: string): string {
  // 열린 코드블록 닫기
  const openFences = (content.match(/```/g) ?? []).length
  if (openFences % 2 !== 0) {
    content += '\n```'
  }
  // 열린 표 row 정리 (미완성 행 제거)
  const lines = content.split('\n')
  const lastLine = lines[lines.length - 1]
  if (lastLine?.includes('|') && !lastLine.endsWith('|')) {
    lines.pop()
    content = lines.join('\n')
  }
  return content
}
```

---

## 3. Phase 3: UI/UX 마이너 개선 — 상세 설계

### 3-1. SectionState 확장

**파일**: `src/hooks/useDeepResearch.ts`

```typescript
export type SectionSubStep = 'search' | 'filter' | 'analyze' | 'refine'

export interface SectionState {
  readonly id: string
  readonly title: string
  readonly status: SectionStepStatus
  readonly subStep?: SectionSubStep      // NEW
  readonly subStepProgress?: number       // NEW: 0~100
  readonly sourcesFound?: number
  readonly message: string
  readonly articles?: readonly ArticleData[]
  readonly result?: SectionResearchResult
  readonly error?: string
  readonly retryCount?: number
}
```

### 3-2. 모바일 반응형 변경

**파일**: `src/components/projects/DeepResearchPanel.tsx`

Phase Progress Bar:
```tsx
// 모바일에서 라벨 숨기고 아이콘만
<span className="font-medium truncate hidden sm:inline">{step.label}</span>
<span className="font-medium truncate sm:hidden">{i + 1}</span>
```

섹션 카드 버튼:
```tsx
// 버튼을 flex-wrap으로 변경
<div className="flex items-center gap-2 flex-wrap">
```

완료 카드:
```tsx
// 모바일에서 버튼 스택
<div className="flex items-center gap-2 flex-col sm:flex-row">
```

### 3-3. 서브스텝 표시 (SectionCard 내)

```tsx
{(section.status === 'analyzing' || section.status === 'refining') && section.subStep && (
  <div className="mt-2 ml-6 text-xs text-gray-500 space-y-0.5">
    <div className={section.subStep === 'search' ? 'text-green-400' : 'text-gray-600'}>
      {section.subStep === 'search' ? '✓' : '○'} 검색
    </div>
    <div className={section.subStep === 'analyze' ? 'text-blue-400 animate-pulse' :
                     section.subStep === 'refine' ? 'text-green-400' : 'text-gray-600'}>
      {section.subStep === 'refine' ? '✓' : section.subStep === 'analyze' ? '◑' : '○'} 분석
    </div>
    <div className={section.subStep === 'refine' ? 'text-purple-400 animate-pulse' : 'text-gray-600'}>
      {section.subStep === 'refine' ? '◑' : '○'} 정제
    </div>
  </div>
)}
```

---

## 4. 구현 순서 (Phase 1 세부)

Phase 1은 코드 변경량이 적고 즉시 효과가 큼:

```
Step 1: relevance-filter.ts — model: 'fast' 변경 (1줄)
Step 2: section-researcher.ts — maxTokens 4096, 기사 400자 절삭, 10건 제한 (3줄)
Step 3: report-compiler.ts — maxTokens 4096 (2줄)
Step 4: ai/config.ts — reasoning maxTokens 8192 (1줄)
Step 5: 로컬 테스트 → Vercel 배포
Step 6: 실제 딥리서치 실행하여 타임아웃 해소 확인
```

Phase 1로 충분하면 Phase 2는 보류.
Phase 3는 Phase 1과 독립적으로 병렬 진행 가능.

---

## 5. 테스트 계획

### 5-1. 성능 테스트

| 테스트 | 기준 | 방법 |
|--------|------|------|
| search route 시간 | < 30초 | Vercel function log |
| analyze route 시간 | < 50초 | Vercel function log |
| summary route 시간 | < 40초 | Vercel function log |
| conclusion route 시간 | < 40초 | Vercel function log |
| 전체 5섹션 완료 | 100% 성공 | 실제 딥리서치 3회 반복 |

### 5-2. 품질 테스트

| 테스트 | 기준 |
|--------|------|
| 관련성 필터 (gpt-4o-mini) | 이전 gpt-4o 결과와 80% 이상 일치 |
| 분석 출력 (maxTokens 4096) | 1500자 이상, 표/다이어그램 포함 |
| 요약/결론 출력 | 1000자 이상 |

### 5-3. 회귀 테스트

- 기존 보고서 보기 기능 정상 동작
- 섹션 재시도 기능 정상 동작
- 실패 건너뛰고 보고서 생성 정상 동작
- localStorage 복구 정상 동작
