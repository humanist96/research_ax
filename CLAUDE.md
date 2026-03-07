# Koscom AI Report

대화형 리서치 설정으로 최적의 뉴스 분석 보고서를 자동 생성하는 범용 리서치 플랫폼

## Architecture

- **Web**: Next.js 동적 서버 (API Routes + App Router)
- **AI 엔진**: OpenAI API SDK (`src/lib/ai/`) — 모델 역할 매핑 (reasoning/general/fast)
- **대화 엔진**: OpenAI streaming으로 후속 질문 생성 → config 자동 생성
- **Collection**: RSS feeds + Google News + Naver/Daum 검색으로 뉴스 수집
- **Analysis**: OpenAI API로 카테고리 분류/요약
- **Report**: 마크다운 리포트 생성
- **Storage**: 추상화 레이어 (`src/lib/storage/`) — local(파일시스템) 또는 vercel(KV+Blob)
- **Deploy**: Vercel 호환 (serverless functions, 60초 타임아웃)

## Key Commands

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드

# 프로젝트별 파이프라인
npm run pipeline -- --project-id <id>
npm run collect -- --project-id <id>
npm run analyze -- --project-id <id>
npm run report -- --project-id <id>
```

## Environment Variables

```env
OPENAI_API_KEY=sk-...
AI_MODEL_REASONING=gpt-4o        # opus 역할
AI_MODEL_GENERAL=gpt-4o-mini     # sonnet 역할
AI_MODEL_FAST=gpt-4o-mini        # haiku 역할
STORAGE_BACKEND=local             # local | vercel
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
```

## Data Flow

```
사용자 프롬프트 → 대화형 설정 (OpenAI streaming)
                        ↓
              ProjectConfig 생성 (OpenAI API)
                        ↓
RSS/Web → collector → articles.json
                        ↓
OpenAI API → analyzer → analyzed-articles.json
                        ↓
report-builder → reports/*.md + index.json
                        ↓
Next.js 동적 페이지 → 프로젝트별 대시보드/뉴스/리포트
```

## Project Structure

- `src/lib/ai/` — OpenAI SDK 래핑 (callAI, streamAI, createConcurrencyLimiter)
- `src/lib/storage/` — 스토리지 추상화 (local filesystem / Vercel KV+Blob)
- `src/types/index.ts` — 공통 타입 정의
- `src/types/project.ts` — 프로젝트/대화/설정 타입 (AIModelConfig 포함)
- `src/lib/config/sources.ts` — RSS 소스, 키워드 (레거시 기본값)
- `src/lib/project/store.ts` — 프로젝트 CRUD (sync + async 버전)
- `src/lib/project/chat-handler.ts` — 대화 질문 생성/응답 처리 (streamAI)
- `src/lib/project/config-generator.ts` — 대화→config (async callAI)
- `src/lib/collector/` — RSS 파싱, 웹 검색, 키워드 매칭
- `src/lib/analyzer/` — 분류/요약 프롬프트 구성
- `src/lib/report/` — 마크다운 리포트 빌더
- `src/lib/deep-research/` — 심층 리서치 (outline → section research → compile)
- `src/lib/pipeline/` — 표준 파이프라인 오케스트레이션
- `src/app/api/projects/` — API Routes
- `src/app/projects/[id]/` — 프로젝트 페이지

## API Routes

| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/api/projects` | 목록/생성 |
| GET/DELETE | `/api/projects/[id]` | 상세/삭제 |
| POST | `/api/projects/[id]/chat` | 대화 메시지 (SSE streaming) |
| POST | `/api/projects/[id]/finalize` | 대화→config 생성 |
| POST | `/api/projects/[id]/pipeline` | 전체 파이프라인 (SSE) |
| POST | `/api/projects/[id]/collect` | 수집 |
| POST | `/api/projects/[id]/analyze` | 분석 |
| POST | `/api/projects/[id]/report` | 리포트 |
| GET | `/api/projects/[id]/articles` | 기사 데이터 |
| GET | `/api/projects/[id]/reports` | 리포트 데이터 |
| POST | `/api/projects/[id]/deep-research` | 딥 리서치 전체 (SSE) |
| POST | `/api/projects/[id]/deep-research/outline` | 목차 생성 (~30초) |
| POST | `/api/projects/[id]/deep-research/section/search` | 섹션 검색+필터 (~60초) |
| POST | `/api/projects/[id]/deep-research/section/analyze` | 섹션 분석 (~60초) |
| POST | `/api/projects/[id]/deep-research/compile` | 요약+결론+병합 (~60초) |
| GET | `/api/projects/[id]/reports/[reportId]/download?format=html` | HTML (클라이언트 PDF용) |

## Conventions

- Immutable data patterns (no mutation)
- TypeScript strict mode
- Tailwind CSS for styling
- Dynamic categories (프로젝트별 생성)
- AI model roles: reasoning(opus), general(sonnet), fast(haiku)
- Storage: STORAGE_BACKEND=local (개발) / vercel (배포)
- No child_process in src/ — all AI calls via OpenAI SDK
