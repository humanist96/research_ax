# Plan: Deep Research Improvement

> 딥리서치 성능 개선 + UI/UX 디자인 개선

## 1. 현황 분석 (As-Is)

### 1-1. 핵심 문제: 딥리서치 타임아웃

| 항목 | 현재 상태 | 문제 |
|------|----------|------|
| 아키텍처 | 단일 SSE 스트림 (`/deep-research` route) | 전체 파이프라인이 하나의 서버리스 함수에서 실행 |
| Vercel 제한 | Hobby: 60초, Pro: 300초 | `analyzeSection()`만 3~4회 AI 호출 × 5섹션 = 15~20회 AI 호출 |
| AI 호출 패턴 | 섹션당: search → filter(Haiku) → analyze(Reasoning) → gap detect(Reasoning) → deepening search → integrated analyze(Reasoning) → critique(Reasoning) | **섹션당 최소 4~6회 AI 호출**, 각 10~30초 |
| 총 소요시간 | 5섹션 × 4~6회 × ~20초 + 요약/결론 = **약 10~30분** | 60초 타임아웃 내 완료 불가 |

### 1-2. 단계별 API는 이미 존재하지만 미사용

이미 생성된 step-by-step route들:
- `POST /deep-research/outline` — 목차 생성 ✅ (프론트에서 사용 중)
- `POST /deep-research/section/search` — 섹션 검색+필터 ⚠️ (존재하지만 미사용)
- `POST /deep-research/section/analyze` — 섹션 분석 ⚠️ (존재하지만 미사용)
- `POST /deep-research/compile` — 요약+결론+병합 ⚠️ (존재하지만 미사용)

**문제**: 프론트엔드(`DeepResearchPanel.tsx`)가 여전히 단일 SSE route(`/deep-research`)만 호출하고 있음.

### 1-3. UI/UX 문제

| 문제 | 설명 |
|------|------|
| 진행률 불투명 | SSE 이벤트가 올 때만 업데이트, 중간에 끊기면 복구 어려움 |
| 에러 복구 없음 | 한 섹션 실패 시 전체 실패 처리 |
| 디자인 단조 | 진행 상태가 텍스트 위주, 시각적 피드백 부족 |
| 모바일 미지원 | 프로그레스 바/섹션 카드가 작은 화면에서 깨짐 |
| 완료 후 경험 | 보고서 보기 버튼만 존재, 공유/다운로드 등 후속 액션 부재 |

## 2. 개선 목표 (To-Be)

### 2-1. 성능 목표

| 지표 | 현재 | 목표 |
|------|------|------|
| 각 API 호출 | ~10분 (단일 SSE) | < 60초/호출 |
| 전체 완료 | 10~30분 (종종 타임아웃) | 5~15분 (안정적 완료) |
| 에러 복구 | 전체 재시작 | 실패 섹션만 재시도 |
| Vercel 호환 | Hobby 불가 | Hobby 완전 호환 |

### 2-2. UX 목표

- 실시간 진행률: 각 섹션의 세부 단계(검색→필터→분석→심화→정제) 표시
- 부분 결과 열람: 완료된 섹션은 즉시 미리보기 가능
- 섹션별 재시도: 실패한 섹션만 개별 재시도
- 반응형 디자인: 모바일/태블릿 최적화
- 완료 후 액션: 공유 링크, HTML/PDF 다운로드

## 3. 구현 계획

### Phase 1: 클라이언트 오케스트레이션 (핵심)

**목표**: 서버 SSE 의존 제거 → 클라이언트가 step-by-step API를 순차 호출

```
현재 흐름:
  Client → POST /deep-research (SSE, ~10분) → Server runs everything

변경 흐름:
  Client → POST /outline                    (~15초)
  Client → POST /section/search   × N섹션   (~30초/섹션, 병렬 3개)
  Client → POST /section/analyze  × N섹션   (~50초/섹션, 병렬 2개)
  Client → POST /compile                    (~40초)
```

#### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/projects/DeepResearchPanel.tsx` | SSE 소비 → step-by-step API 호출 오케스트레이터로 전환 |
| `src/hooks/useDeepResearch.ts` (신규) | 딥리서치 상태 머신 + API 오케스트레이션 로직 추출 |
| `src/app/api/projects/[id]/deep-research/section/analyze/route.ts` | `analyzeSection` 내부를 sub-step으로 분할 (Phase 2에서 상세) |

#### 클라이언트 상태 머신

```
idle → generating_outline → editing_outline → searching → analyzing → compiling → complete
                                                  ↓             ↓
                                              (섹션별)      (섹션별)
                                              search_1     analyze_1
                                              search_2     analyze_2
                                              ...          ...
```

#### 핵심 설계 원칙

1. **각 API 호출은 60초 이내 완료**: Vercel Hobby 호환
2. **섹션 독립성**: 섹션 A 실패가 섹션 B에 영향 없음
3. **클라이언트 상태 저장**: `localStorage`에 진행 상태 저장, 새로고침해도 복구 가능
4. **병렬 실행**: search는 3개 병렬, analyze는 2개 병렬 (API Rate Limit 고려)

### Phase 2: 분석 단계 경량화

**목표**: `analyzeSection()` 내부의 AI 호출 횟수 줄이기 (6회 → 2~3회)

현재 `analyzeSection` 파이프라인:
```
1. Initial Analysis (Reasoning, ~20초)
2. Gap Detection (Reasoning, ~10초)
3. Follow-up Search (~5초)
4. Integrated Analysis (Reasoning, ~20초)
5. Critique & Refine (Reasoning, ~15초)
```

**최적화 방안**:

| 전략 | 설명 | 절감 |
|------|------|------|
| A. Gap+Critique 통합 | Gap Detection과 Critique를 하나의 프롬프트로 통합 | -1 AI 호출 |
| B. 조건부 Deepening | Gap assessment가 `overall_good`이면 follow-up 생략 | -2 AI 호출 (조건부) |
| C. 모델 다운그레이드 | Gap Detection을 `general`(gpt-4o-mini)로 변경 | 속도 2~3배 향상 |
| D. 토큰 제한 조정 | 불필요하게 긴 maxTokens 줄이기 (8192→4096) | 응답 시간 단축 |

**변경 후 파이프라인**:
```
1. Analysis + Deepening Hints (Reasoning, ~25초) — 초기 분석 + 갭 탐지를 하나로
2. (조건부) Follow-up Search + Integrated Analysis (Reasoning, ~25초)
3. Final Refinement (General, ~10초) — 경량 모델로 품질 다듬기
```

#### 변경 파일

| 파일 | 변경 |
|------|------|
| `src/lib/deep-research/section-researcher.ts` | `analyzeSection()` 파이프라인 재구성 |
| `src/app/api/projects/[id]/deep-research/section/analyze/route.ts` | 타임아웃 안전장치 추가 |

### Phase 3: UI/UX 개선

#### 3-1. 진행 상태 시각화 개선

- **섹션 카드 UI**: 각 섹션이 독립 카드로 표시, 내부에 sub-step 프로그레스
- **예상 시간 표시**: "약 N분 남음" 예측 (완료된 섹션 기반 평균 계산)
- **섹션 미리보기**: 완료된 섹션 클릭 시 내용 미리보기 모달

```
┌─────────────────────────────────────┐
│ 📊 딥 리서치 진행 상황   약 8분 남음    │
├─────────────────────────────────────┤
│ ■■■■■■■■░░░░░░░░░░ 45% (2/5 완료)    │
├─────────────────────────────────────┤
│ ✅ 시장 현황       12건  [미리보기]     │
│ ✅ 기술 동향        8건  [미리보기]     │
│ ⏳ 경쟁 구도        6건  분석 중...     │
│    ├─ 🔍 검색 완료                     │
│    ├─ 📊 분석 중... (45초)              │
│    └─ ⏳ 정제 대기                      │
│ 🕐 규제 환경       — 대기               │
│ 🕐 전망           — 대기               │
├─────────────────────────────────────┤
│ [실패 섹션 재시도] [전체 중단]          │
└─────────────────────────────────────┘
```

#### 3-2. 에러 핸들링 & 재시도

- 섹션별 재시도 버튼 (최대 2회)
- 전체 중단 버튼 (진행 중인 API 호출 abort)
- 실패 섹션 건너뛰고 나머지로 보고서 생성 옵션

#### 3-3. 완료 후 경험

- 보고서 미리보기 카드 (제목, 섹션 수, 소스 수, 생성일)
- 다운로드 옵션: Markdown / HTML
- 공유 링크 복사 버튼
- "새 딥리서치 실행" 버튼

#### 변경 파일

| 파일 | 변경 |
|------|------|
| `src/components/projects/DeepResearchPanel.tsx` | 전면 리디자인 |
| `src/components/projects/SectionProgressCard.tsx` (신규) | 섹션별 진행 카드 컴포넌트 |
| `src/components/projects/SectionPreviewModal.tsx` (신규) | 섹션 미리보기 모달 |
| `src/components/projects/ResearchCompletionCard.tsx` (신규) | 완료 후 액션 카드 |

### Phase 4: 안정성 & 모니터링

- `AbortController` 활용한 API 호출 취소 지원
- 클라이언트 `localStorage` 기반 진행 상태 복구
- Vercel Function 로그에 각 단계 소요시간 기록
- 에러 발생 시 자동 재시도 (exponential backoff)

## 4. 작업 순서

```
Phase 1 (클라이언트 오케스트레이션) — 가장 핵심, 타임아웃 해결
  ↓
Phase 2 (분석 경량화) — 각 API 호출이 60초 안에 들어오도록
  ↓
Phase 3 (UI/UX 개선) — Phase 1의 새 아키텍처 위에 구축
  ↓
Phase 4 (안정성) — 마무리
```

## 5. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| `analyzeSection` 60초 초과 | 단일 섹션 분석이 타임아웃 | Phase 2 경량화로 해결, 최악의 경우 sub-step별 API 분리 |
| OpenAI API Rate Limit | 병렬 호출 시 429 에러 | 동시성 2~3으로 제한, retry with backoff |
| localStorage 용량 | 대용량 보고서 데이터 | 진행 상태만 저장, 실제 콘텐츠는 서버에 |
| 클라이언트 오케스트레이션 복잡도 | 상태 관리 어려움 | `useDeepResearch` 커스텀 훅으로 격리 |
| 브라우저 탭 닫기 | 진행 중 손실 | 서버에 섹션별 저장 → 재접속 시 이어서 진행 |

## 6. 성공 기준

- [ ] 5섹션 딥리서치가 Vercel Hobby(60초 제한)에서 완료
- [ ] 각 API 호출이 60초 이내
- [ ] 실패 섹션 재시도 가능
- [ ] 완료된 섹션 즉시 미리보기 가능
- [ ] 새로고침 후 진행 상태 복구
- [ ] 모바일 반응형 디자인
