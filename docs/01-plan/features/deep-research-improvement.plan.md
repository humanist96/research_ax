# Plan: Deep Research Improvement

> 딥리서치 성능 개선 — 60초 타임아웃 내 안정적 완료 + UI/UX 개선

## 1. 현황 분석 (As-Is)

### 1-1. 구현 완료 항목 (이전 세션에서 완료)

| 항목 | 상태 | 설명 |
|------|------|------|
| 클라이언트 오케스트레이션 | ✅ 완료 | `useDeepResearch.ts` — step-by-step API 호출 |
| 단계별 API Routes | ✅ 완료 | outline, search, analyze, refine, summary, conclusion, finalize |
| 섹션 카드 UI | ✅ 완료 | `SectionCard` — 상태 표시, 미리보기, 재시도 |
| localStorage 복구 | ✅ 완료 | 진행 상태 저장/복원 |
| 에러 복구 | ✅ 완료 | 섹션별 재시도, 전체 재시도, 실패 건너뛰기 |
| 완료 카드 | ✅ 완료 | 링크 복사, MD 다운로드, 보고서 보기 |
| 예상 시간 표시 | ✅ 완료 | 분석 단계에서 남은 시간 추정 |

### 1-2. 핵심 문제: 여전히 타임아웃 발생

API 분리는 되었으나, **개별 API 호출 자체가 60초를 초과**하는 문제 존재:

| API Route | AI 호출 | 모델 | maxTokens | 예상 시간 | 위험도 |
|-----------|---------|------|-----------|----------|--------|
| `/section/search` | 웹검색 + gpt-4o 관련성 필터 | general(gpt-4o) | 4096 | 30~70초 | **높음** |
| `/section/analyze` | gpt-4o 심층 분석 | reasoning(gpt-4o) | 8192 | 40~90초 | **매우 높음** |
| `/section/refine` | gpt-4o-mini 정제 | fast(gpt-4o-mini) | 8192 | 10~20초 | 낮음 |
| `/compile/summary` | gpt-4o 핵심 요약 | reasoning(gpt-4o) | 8192 | 30~60초 | **높음** |
| `/compile/conclusion` | gpt-4o 결론 | reasoning(gpt-4o) | 8192 | 30~60초 | **높음** |
| `/compile/finalize` | AI 호출 없음 | — | — | 1~3초 | 없음 |

**근본 원인 분석**:
1. `reasoning`과 `general` 모두 `gpt-4o`로 설정 → 동일 모델
2. `maxTokens: 8192`는 2000~5000자 출력에 과도함 (실제 필요: ~4096)
3. 관련성 필터에 gpt-4o 사용 → 검색 route에 불필요한 고비용 AI 호출
4. 기사 전문(content)을 AI에 전달 → 입력 토큰 과다 (기사당 ~600자)
5. 섹션 분석 프롬프트에 기사 전문 포함 → 10~15개 기사 × 600자 = 6000~9000자 입력

### 1-3. 남은 UI/UX 문제

| 문제 | 설명 |
|------|------|
| 모바일 미지원 | 프로그레스 바/섹션 카드가 작은 화면에서 깨짐 |
| 서브스텝 미표시 | 분석 중 "검색→필터→분석→정제" 세부 진행률 없음 |
| 병렬 진행 시각화 | 여러 섹션 동시 진행 시 어느 것이 활성인지 불분명 |

## 2. 개선 목표 (To-Be)

### 2-1. 성능 목표

| 지표 | 현재 | 목표 |
|------|------|------|
| `/section/search` | 30~70초 (가끔 타임아웃) | < 45초 (안정) |
| `/section/analyze` | 40~90초 (자주 타임아웃) | < 50초 (안정) |
| `/compile/summary` | 30~60초 (간헐적 타임아웃) | < 40초 |
| `/compile/conclusion` | 30~60초 (간헐적 타임아웃) | < 40초 |
| 전체 완료율 | ~60% (타임아웃으로 실패) | > 95% |
| 전체 소요시간 | 10~30분 | 5~12분 |

### 2-2. UX 목표

- 반응형 디자인: 모바일/태블릿 최적화
- 서브스텝 시각화: 검색→필터→분석→정제 단계별 진행률
- 병렬 진행 표시: 동시 진행 중인 섹션 명확히 구분

## 3. 구현 계획

### Phase 1: AI 호출 경량화 (핵심 — 타임아웃 해결) ✅→🔧

**목표**: 모든 API 호출이 안정적으로 60초 이내 완료

#### 1-1. 관련성 필터 모델 다운그레이드

| 항목 | 현재 | 변경 |
|------|------|------|
| 모델 | `general` (gpt-4o) | `fast` (gpt-4o-mini) |
| 위치 | `relevance-filter.ts` | 동일 |
| 효과 | 관련성 판정에 30~40초 | 5~10초로 단축 |

관련성 점수 매기기는 gpt-4o-mini로도 충분한 품질. 복잡한 추론이 아니라 주제 매칭.

#### 1-2. maxTokens 최적화

| API | 현재 maxTokens | 변경 | 근거 |
|-----|---------------|------|------|
| `analyzeOnly` | 8192 | **4096** | 실제 출력 2000~5000자 = ~2000 토큰 |
| `refineOnly` | 8192 | **4096** | 입력과 비슷한 길이 출력 |
| `generateExecutiveSummary` | 8192 | **4096** | 1200~2500자 = ~1200 토큰 |
| `generateConclusion` | 8192 | **4096** | 1200~2500자 = ~1200 토큰 |

#### 1-3. 입력 토큰 축소

- 기사 content를 관련성 필터에는 600자 전달 (현재 유지)
- 기사 content를 분석 프롬프트에는 **400자로 축소** (현재 전문 전달)
- 기사 수 상한: 섹션당 최대 **10건** (현재 제한 없음)

#### 1-4. 검색 route 분리 (search + filter 분리)

현재 `/section/search` route 내부:
```
searchAndFilterSection() = 웹검색(10~20초) + AI 관련성 필터(30~40초) = 40~70초
```

변경:
```
/section/search  = 웹검색 + 키워드 필터만 (10~20초) ← AI 호출 없음
/section/filter  = AI 관련성 스코어링 (gpt-4o-mini, 5~10초) ← 새 route
```

또는 관련성 필터를 gpt-4o-mini로 변경 시 합산해도 20~30초 → 분리 불필요할 수 있음.
**우선 모델 다운그레이드 먼저 적용, 그래도 초과 시 route 분리.**

#### 변경 파일

| 파일 | 변경 |
|------|------|
| `src/lib/deep-research/relevance-filter.ts` | `model: 'general'` → `model: 'fast'` |
| `src/lib/deep-research/section-researcher.ts` | maxTokens 4096, 기사 content 400자 절삭, 최대 10건 |
| `src/lib/deep-research/report-compiler.ts` | maxTokens 4096 |
| `src/lib/ai/config.ts` | DEFAULT_MAX_TOKENS.reasoning: 16384→8192 (글로벌 상한 조정) |

### Phase 2: 스트리밍 타임아웃 안전망

**목표**: AI 응답이 느릴 때 부분 결과라도 반환

#### 2-1. OpenAI 스트리밍 + 서버 타임아웃

```
analyzeOnly() 내부:
  1. OpenAI streaming으로 호출 (stream: true)
  2. 50초 경과 시 스트림 중단, 지금까지 받은 텍스트 반환
  3. 불완전하지만 유효한 결과 → refineOnly에서 보정 가능
```

#### 2-2. callAI에 timeout 옵션 추가

```typescript
// src/lib/ai/client.ts
callAI(prompt, { model: 'reasoning', maxTokens: 4096, timeoutMs: 50000 })
// → 50초 내 완료 안 되면 지금까지의 스트림 결과 반환
```

#### 변경 파일

| 파일 | 변경 |
|------|------|
| `src/lib/ai/client.ts` | `callAI`에 `timeoutMs` 옵션 추가, 스트리밍 기반 부분 결과 반환 |
| `src/lib/deep-research/section-researcher.ts` | analyzeOnly에 timeoutMs: 50000 전달 |

### Phase 3: UI/UX 마이너 개선

**목표**: 기존 구현된 UI 위에 모바일 대응 + 서브스텝 시각화 추가

#### 3-1. 모바일 반응형

- 페이즈 프로그레스 바: 모바일에서 아이콘만 표시 (라벨 숨김)
- 섹션 카드: 버튼을 아래줄로 wrap
- 완료 카드: 버튼 스택 레이아웃

#### 3-2. 분석 서브스텝 표시

```
⏳ 경쟁 구도        6건  분석 중...
   ├─ 검색 완료
   ├─ 분석 중... (45초)
   └─ 정제 대기
```

`SectionState`에 `subStep` 필드 추가하여 진행 세분화.

#### 변경 파일

| 파일 | 변경 |
|------|------|
| `src/components/projects/DeepResearchPanel.tsx` | 모바일 반응형 + 서브스텝 표시 |
| `src/hooks/useDeepResearch.ts` | `SectionState`에 `subStep` 필드 추가 |

## 4. 작업 순서

```
Phase 1 (AI 호출 경량화) — 가장 핵심, 즉시 적용 가능
  ↓
Phase 2 (스트리밍 타임아웃 안전망) — Phase 1로도 부족한 경우 보험
  ↓
Phase 3 (UI/UX 마이너 개선) — 모바일 + 서브스텝
```

**예상 효과 (Phase 1만 적용 시)**:

| API | 현재 | Phase 1 후 예상 |
|-----|------|----------------|
| `/section/search` | 30~70초 | 15~30초 (필터 gpt-4o-mini) |
| `/section/analyze` | 40~90초 | 25~45초 (maxTokens 4096 + 입력 축소) |
| `/compile/summary` | 30~60초 | 20~35초 (maxTokens 4096) |
| `/compile/conclusion` | 30~60초 | 20~35초 (maxTokens 4096) |

## 5. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| gpt-4o-mini 관련성 판정 품질 저하 | 관련 없는 기사 포함 | threshold 7로 상향 조정 |
| maxTokens 4096에서 출력 잘림 | 내용 불완전 | 프롬프트에 "간결하게" 지시 + 잘림 감지 로직 |
| 기사 content 400자에서 정보 손실 | 분석 품질 저하 | 기사 수로 보완 (양 > 깊이) |
| 스트리밍 타임아웃 시 불완전 응답 | 마크다운 깨짐 | refineOnly에서 보정, 또는 재시도 |
| OpenAI API Rate Limit | 병렬 호출 시 429 에러 | 동시성 2~3으로 제한, retry with backoff |

## 6. 성공 기준

- [ ] 5섹션 딥리서치가 Vercel Hobby(60초 제한)에서 **95% 이상 완료**
- [ ] 각 API 호출이 50초 이내 (10초 마진)
- [x] 실패 섹션 재시도 가능 (이미 구현)
- [x] 완료된 섹션 즉시 미리보기 가능 (이미 구현)
- [x] 새로고침 후 진행 상태 복구 (이미 구현)
- [ ] 모바일 반응형 디자인
