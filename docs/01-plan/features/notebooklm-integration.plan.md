# Plan: NotebookLM 연동 기능

> 딥리서치 보고서를 Google NotebookLM과 연동하여 팟캐스트, 퀴즈, 마인드맵 등 다양한 콘텐츠로 변환

## 1. 현황 분석 (As-Is)

### 1-1. 현재 딥리서치 결과물

| 항목 | 현재 |
|------|------|
| 출력 포맷 | 마크다운 보고서 (웹 뷰어) |
| 다운로드 | .md 파일 |
| 활용 방식 | 읽기 전용 — 추가 가공 불가 |
| 소비 채널 | 웹 브라우저만 |

### 1-2. 문제점

- 보고서가 텍스트 중심 → 다양한 소비 형태 부재
- 오디오/비디오 콘텐츠로 변환 수단 없음
- 학습용 퀴즈/플래시카드 등 인터랙티브 콘텐츠 없음
- 보고서 내용을 기반으로 후속 질문/탐색 불가

## 2. notebooklm-py 라이브러리 분석

### 2-1. 핵심 기능 매트릭스

| 기능 | 설명 | 출력 포맷 | 활용 가치 |
|------|------|----------|----------|
| Audio Overview | AI 팟캐스트 생성 (4가지 스타일, 50+ 언어) | MP3/MP4 | **높음** — 이동 중 소비 |
| Video Overview | AI 비디오 요약 (9가지 스타일: 화이트보드, 애니메 등) | MP4 | **높음** — 시각적 요약 |
| Slide Deck | 프레젠테이션 자동 생성 | PDF/PPTX | **높음** — 발표 자료 |
| Quiz | 주제 기반 퀴즈 생성 (난이도 조절) | JSON/MD/HTML | 중간 — 학습 확인 |
| Flashcards | 핵심 개념 플래시카드 | JSON/MD/HTML | 중간 — 반복 학습 |
| Mind Map | 계층적 마인드맵 | JSON | **높음** — 구조 시각화 |
| Data Table | 자연어로 비교표 생성 | CSV | 중간 — 데이터 정리 |
| Infographic | 인포그래픽 이미지 | PNG | 중간 — SNS 공유 |
| Chat | 소스 기반 Q&A | 텍스트 | **높음** — 후속 탐색 |
| Research | 웹/드라이브 추가 리서치 | 소스 추가 | 중간 |

### 2-2. 기술 제약

| 항목 | 내용 |
|------|------|
| 런타임 | Python 3.10+ (비동기) |
| 인증 | Playwright 브라우저 기반 Google 로그인 → 토큰 저장 |
| API 안정성 | 비공식 API — Google 변경 시 깨질 수 있음 |
| 호스팅 | Vercel 서버리스에서 Python 직접 실행 불가 |
| 생성 시간 | 오디오/비디오: 수 분 소요 (비동기 폴링 필요) |

### 2-3. 아키텍처 선택지

| 방안 | 설명 | 장단점 |
|------|------|--------|
| **A. 별도 Python 백엔드** | FastAPI/Flask 서버를 별도 배포, Next.js에서 API 호출 | 안정적, 배포/운영 복잡 |
| **B. Next.js API + child_process** | Python 스크립트를 Next.js에서 실행 | 간단하지만 Vercel 불가 |
| **C. 별도 서버리스 (AWS Lambda/GCP)** | Python Lambda 함수로 분리, Next.js에서 호출 | Vercel 호환, 콜드스타트 |
| **D. 로컬 전용 + 클라이언트 트리거** | 로컬 dev 서버에서만 지원, 프로덕션은 UI 안내만 | 가장 단순, 제한적 |

**권장: 방안 A (별도 Python 마이크로서비스)**
- Railway / Render / Fly.io 등에 FastAPI 배포 (무료 티어 가능)
- Next.js에서 REST API로 호출
- NotebookLM 인증 토큰은 서버 환경변수로 관리

## 3. 구현 계획

### Phase 1: Python 마이크로서비스 (NotebookLM Bridge)

#### 3-1. 서비스 구조

```
notebooklm-bridge/
  ├── main.py              # FastAPI 앱
  ├── auth.py              # 인증 토큰 관리
  ├── services/
  │   ├── notebook.py      # 노트북 CRUD
  │   ├── source.py        # 소스 추가 (보고서 → NotebookLM)
  │   ├── generate.py      # 콘텐츠 생성 (오디오/비디오/슬라이드 등)
  │   ├── chat.py          # Q&A 대화
  │   └── download.py      # 아티팩트 다운로드
  ├── requirements.txt
  └── Dockerfile
```

#### 3-2. API 설계

```
POST /api/notebooks
  → NotebookLM 노트북 생성 + 보고서 마크다운을 소스로 추가

POST /api/notebooks/{id}/generate
  body: { type: "audio"|"video"|"slide-deck"|"quiz"|"flashcards"|"mind-map"|"infographic"|"data-table", options: {...} }
  → 콘텐츠 생성 트리거, task_id 반환

GET  /api/notebooks/{id}/tasks/{task_id}
  → 생성 상태 폴링 (pending/processing/complete/error)

GET  /api/notebooks/{id}/artifacts/{type}/download
  → 완성된 아티팩트 다운로드

POST /api/notebooks/{id}/chat
  body: { question: "..." }
  → NotebookLM 기반 Q&A

GET  /api/notebooks/{id}/mind-map
  → 마인드맵 JSON 반환

DELETE /api/notebooks/{id}
  → 노트북 정리
```

#### 3-3. 인증 전략

```
1. 최초 1회: 로컬에서 `notebooklm login` 실행 → 브라우저 Google 로그인
2. 토큰 저장: ~/.notebooklm/storage-state.json
3. 서버 배포: 토큰 파일을 환경변수(BASE64 인코딩)로 주입
4. 토큰 갱신: FastAPI 서버에서 주기적 refresh_auth() 호출
```

### Phase 2: Next.js 프론트엔드 연동

#### 3-4. 프록시 API Route

```typescript
// src/app/api/projects/[id]/notebooklm/route.ts
// Next.js → Python Bridge 프록시
// - 보고서 ID로 마크다운 조회
// - Python Bridge에 노트북 생성 + 소스 추가 요청
// - 노트북 ID를 프로젝트 메타에 저장
```

#### 3-5. UI 컴포넌트

| 컴포넌트 | 위치 | 기능 |
|----------|------|------|
| `NotebookLMPanel` | 보고서 뷰어 하단 | 메인 허브 — 콘텐츠 유형 선택 + 생성 |
| `GenerateModal` | 모달 | 생성 옵션 설정 (스타일, 길이, 난이도 등) |
| `ArtifactCard` | 패널 내 | 생성된 콘텐츠 카드 (상태 표시 + 다운로드) |
| `PodcastPlayer` | 인라인 | 오디오 플레이어 (웹에서 바로 재생) |
| `MindMapViewer` | 전체화면 | 마인드맵 시각화 (D3.js 또는 React Flow) |
| `QuizViewer` | 인라인 | 인터랙티브 퀴즈 UI |
| `ChatDrawer` | 사이드 드로어 | NotebookLM 기반 후속 Q&A |

#### 3-6. 사용자 플로우

```
보고서 완료
  ↓
[NotebookLM으로 확장] 버튼 클릭
  ↓
자동: 보고서 마크다운 → NotebookLM 노트북 생성 + 소스 추가
  ↓
콘텐츠 생성 허브 표시:
  ┌────────────────────────────────────────────┐
  │  이 보고서로 무엇을 만들까요?               │
  │                                            │
  │  [팟캐스트]  [비디오 요약]  [프레젠테이션]    │
  │  [퀴즈]     [플래시카드]   [마인드맵]        │
  │  [인포그래픽] [데이터 테이블] [AI 채팅]      │
  │                                            │
  │  생성된 콘텐츠:                              │
  │  ✅ 팟캐스트 (12:34) — [재생] [다운로드]     │
  │  ⏳ 비디오 생성 중... (45%)                  │
  └────────────────────────────────────────────┘
```

### Phase 3: 핵심 콘텐츠 유형별 상세

#### 3-7. 팟캐스트 (Audio Overview) — 최우선

```
옵션:
- 스타일: deep-dive (심층분석) | conversation (대화형) | briefing (브리핑) | summary (요약)
- 길이: short (~5분) | medium (~12분) | long (~20분)
- 언어: 한국어(기본), 영어, 일본어

UI:
- 생성 후 인라인 오디오 플레이어
- MP3 다운로드 버튼
- 생성 소요시간: ~3-5분
```

#### 3-8. 마인드맵 — 높은 시각 가치

```
NotebookLM → JSON 구조 반환
  ↓
프론트엔드 React Flow / D3.js로 인터랙티브 렌더링:
  - 줌/팬
  - 노드 클릭 → 관련 섹션으로 이동
  - 노드 확장/축소
  - PNG 내보내기
```

#### 3-9. 프레젠테이션 (Slide Deck)

```
옵션:
- 레이아웃: standard | compact
- 슬라이드 수: auto | 10 | 15 | 20
- 개별 슬라이드 수정: 자연어 프롬프트

출력: PDF (뷰어 내) + PPTX (다운로드)
```

#### 3-10. AI 채팅 (후속 Q&A)

```
보고서 내용 기반 NotebookLM 채팅:
- 사이드 드로어 UI
- "이 보고서에서 X에 대해 더 자세히 알려줘"
- "섹션 3의 데이터를 다른 관점에서 분석해줘"
- 대화 히스토리 유지
- 답변에 출처 링크 포함
```

### Phase 4: 데이터 모델 확장

#### 3-11. 프로젝트 메타데이터 확장

```typescript
// src/types/project.ts 확장
interface ProjectNotebookLM {
  notebookId: string          // NotebookLM 노트북 ID
  createdAt: string
  artifacts: NotebookArtifact[]
}

interface NotebookArtifact {
  type: 'audio' | 'video' | 'slide-deck' | 'quiz' | 'flashcards' | 'mind-map' | 'infographic' | 'data-table'
  status: 'pending' | 'processing' | 'complete' | 'error'
  taskId?: string
  downloadUrl?: string        // Bridge 서버 URL
  options: Record<string, unknown>
  createdAt: string
  completedAt?: string
}
```

#### 3-12. 스토리지

```
KV: project:{id}:notebooklm → ProjectNotebookLM (메타)
Blob: projects/{id}/artifacts/audio.mp3 등 (다운로드 캐시, 선택)
```

## 4. 작업 순서

```
Phase 1: Python Bridge 서비스 (1~2일)
  - FastAPI 서버 + notebooklm-py 연동
  - 인증, 노트북 생성, 소스 추가, 생성, 다운로드 API
  - Railway/Render 배포
  ↓
Phase 2: Next.js 프록시 + 기본 UI (1일)
  - API Route 프록시
  - NotebookLMPanel 컴포넌트
  - 노트북 생성 + 팟캐스트 생성/재생
  ↓
Phase 3: 추가 콘텐츠 유형 (1~2일)
  - 마인드맵 뷰어 (React Flow)
  - 슬라이드덱 뷰어/다운로드
  - 퀴즈/플래시카드 인터랙티브 UI
  ↓
Phase 4: AI 채팅 + 완성도 (1일)
  - ChatDrawer 사이드바
  - 상태 폴링 최적화
  - 에러 핸들링 + 로딩 UX
```

## 5. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 비공식 API 변경/차단 | 전체 기능 중단 | 기능을 "실험적(Beta)" 라벨로 표시, graceful degradation |
| Google 계정 인증 만료 | 생성 실패 | refresh_auth() 자동 호출, 실패 시 재로그인 안내 |
| 콘텐츠 생성 지연 (5분+) | UX 불만 | 비동기 폴링 + 알림, "생성 중" 상태 카드 |
| Python 서비스 운영 비용 | 추가 인프라 | Railway 무료 티어 ($5 크레딧/월) 또는 Render 무료 |
| 대용량 파일 (비디오 50MB+) | 전송 지연 | 직접 다운로드 URL 제공 (Bridge 경유 안 함) |
| Rate Limiting | 동시 생성 제한 | 큐잉 시스템, 사용자당 동시 1건 제한 |

## 6. 환경변수 (추가)

```env
# NotebookLM Bridge
NOTEBOOKLM_BRIDGE_URL=https://your-bridge.railway.app
NOTEBOOKLM_API_KEY=bridge-internal-auth-key    # Bridge ↔ Next.js 인증
```

## 7. 성공 기준

- [ ] 딥리서치 보고서 완료 후 1클릭으로 NotebookLM 노트북 자동 생성
- [ ] 팟캐스트(오디오) 생성 + 웹 플레이어 재생 가능
- [ ] 마인드맵 인터랙티브 뷰어 작동
- [ ] 프레젠테이션 PDF/PPTX 다운로드 가능
- [ ] 퀴즈/플래시카드 인터랙티브 UI 작동
- [ ] 보고서 기반 후속 Q&A 채팅 가능
- [ ] 콘텐츠 생성 상태가 실시간 업데이트 (폴링)
- [ ] Bridge 서비스 안정적 운영 (99% uptime)
