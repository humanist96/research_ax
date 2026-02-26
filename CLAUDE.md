# Koscom AI Report

대화형 리서치 설정으로 최적의 뉴스 분석 보고서를 자동 생성하는 범용 리서치 플랫폼

## Architecture

- **Web**: Next.js 동적 서버 (API Routes + App Router)
- **대화 엔진**: Claude CLI로 후속 질문 생성 → config 자동 생성
- **Collection**: `scripts/collect.ts` — RSS feeds + Google News 검색으로 뉴스 수집
- **Analysis**: `scripts/analyze.ts` — Claude CLI로 카테고리 분류/요약
- **Report**: `scripts/generate-report.ts` — 마크다운 리포트 생성
- **Pipeline**: `scripts/pipeline.ts` — 전체 파이프라인 (수집→분석→리포트)

## Key Commands

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드

# 프로젝트별 파이프라인
npm run pipeline -- --project-id <id>
npm run collect -- --project-id <id>
npm run analyze -- --project-id <id>
npm run report -- --project-id <id>

# 레거시 (글로벌 data/ 폴더 사용)
npm run collect    # 뉴스 수집
npm run analyze    # Claude CLI 분석
npm run report     # 리포트 생성
npm run batch      # 전체 파이프라인
```

## Data Flow

```
사용자 프롬프트 → 대화형 설정 (Claude CLI)
                        ↓
              ProjectConfig 생성
                        ↓
RSS/Web → scripts/collect.ts → data/projects/{id}/articles.json
                                      ↓
Claude CLI → scripts/analyze.ts → data/projects/{id}/analyzed-articles.json
                                      ↓
scripts/generate-report.ts → data/projects/{id}/reports/*.md + index.json
                                      ↓
Next.js 동적 페이지 → 프로젝트별 대시보드/뉴스/리포트
```

## Project Structure

- `src/types/index.ts` — 공통 타입 정의
- `src/types/project.ts` — 프로젝트/대화/설정 타입
- `src/lib/config/sources.ts` — RSS 소스, 키워드 (레거시 기본값)
- `src/lib/project/store.ts` — 프로젝트 CRUD (파일시스템)
- `src/lib/project/chat-handler.ts` — 대화 질문 생성/응답 처리
- `src/lib/project/config-generator.ts` — 대화→config 프롬프트
- `src/lib/collector/` — RSS 파싱, 웹 검색, 키워드 매칭
- `src/lib/analyzer/` — Claude CLI 프롬프트 구성 (분류/요약)
- `src/lib/report/` — 마크다운 리포트 빌더
- `src/app/api/projects/` — API Routes (CRUD, 대화, 파이프라인)
- `src/app/projects/[id]/` — 프로젝트 페이지 (대시보드/대화/뉴스/리포트)
- `src/components/projects/` — 프로젝트 관련 컴포넌트
- `src/components/dashboard/` — 대시보드 컴포넌트
- `src/components/news/` — 뉴스 컴포넌트
- `src/components/reports/` — 리포트 컴포넌트

## API Routes

| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/api/projects` | 목록/생성 |
| GET/DELETE | `/api/projects/[id]` | 상세/삭제 |
| POST | `/api/projects/[id]/chat` | 대화 메시지 |
| POST | `/api/projects/[id]/finalize` | 대화→config 생성 |
| POST | `/api/projects/[id]/pipeline` | 전체 파이프라인 |
| POST | `/api/projects/[id]/collect` | 수집 |
| POST | `/api/projects/[id]/analyze` | 분석 |
| POST | `/api/projects/[id]/report` | 리포트 |
| GET | `/api/projects/[id]/articles` | 기사 데이터 |
| GET | `/api/projects/[id]/reports` | 리포트 데이터 |

## Conventions

- Immutable data patterns (no mutation)
- TypeScript strict mode
- Tailwind CSS for styling
- Dynamic categories (프로젝트별 생성)
- File-system based project storage (data/projects/{id}/)
