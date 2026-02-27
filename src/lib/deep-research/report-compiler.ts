import type { ProjectConfig, ReportMeta } from '@/types'
import type { ReportOutline, SectionResearchResult, SourceReference, DeepReportMeta, DeepReportSectionMeta, DeepReportSectionStatus, DeepReportPhase } from './types'
import { callClaudeAsync } from './claude-async'
import {
  getDeepReportSection,
  listDeepReportSections,
} from '@/lib/project/store'

function buildExecutiveSummaryPrompt(
  outline: ReportOutline,
  results: readonly SectionResearchResult[],
  config: ProjectConfig,
): string {
  const sectionSummaries = results
    .map((s) => `- **${s.title}**: ${s.content.slice(0, 300)}...`)
    .join('\n')

  return `당신은 "${config.reportTitle}" 보고서의 핵심 요약(Executive Summary)을 작성하는 전문 편집자입니다.

## 보고서 정보
- 제목: ${outline.title}
- 요약 가이드: ${outline.executiveSummaryGuidance}
- 도메인: ${config.domainContext}

## 각 섹션 요약
${sectionSummaries}

## 작성 규칙
1. 보고서 전체의 핵심 발견과 시사점을 3~5문장으로 압축하세요
2. 가장 중요한 수치와 트렌드를 포함하세요
3. 독자가 이 요약만 읽어도 보고서의 핵심을 파악할 수 있어야 합니다
4. **600~1000자** 분량으로 작성하세요
5. 마크다운 형식이되, 제목(##)은 포함하지 마세요
6. **핵심 지표 요약 표**: 보고서에서 도출된 주요 수치/지표를 마크다운 표로 정리하세요
7. Mermaid 다이어그램은 사용하지 마세요 (이 섹션은 텍스트+표 위주)

마크다운 본문만 출력하세요.`
}

function buildConclusionPrompt(
  outline: ReportOutline,
  results: readonly SectionResearchResult[],
  config: ProjectConfig,
): string {
  const sectionSummaries = results
    .map((s) => `- **${s.title}**: ${s.content.slice(0, 300)}...`)
    .join('\n')

  return `당신은 "${config.reportTitle}" 보고서의 결론 및 전망을 작성하는 전문 편집자입니다.

## 보고서 정보
- 제목: ${outline.title}
- 도메인: ${config.domainContext}

## 각 섹션 요약
${sectionSummaries}

## 시각적 요소 활용 지침
- 핵심 시사점이나 전망을 **마크다운 표**로 정리하세요 (예: 단기/중기/장기 전망)
- 향후 트렌드나 영향 관계가 있으면 **Mermaid flowchart**로 표현하세요
- Mermaid 문법 규칙: 한국어 텍스트는 큰따옴표 필수 A["한국어 텍스트"], 노드 10개 이하
- 데이터가 불충분하면 억지로 다이어그램을 만들지 마세요

## 작성 규칙
1. 보고서의 핵심 발견을 종합하세요
2. 향후 주목해야 할 트렌드와 전망을 제시하세요
3. 실행 가능한 시사점(actionable insights)을 포함하세요
4. **600~1000자** 분량으로 작성하세요
5. 마크다운 형식이되, 제목(##)은 포함하지 마세요
6. 표나 다이어그램을 활용하여 전망과 시사점을 구조화하세요

마크다운 본문만 출력하세요.`
}

export async function generateExecutiveSummary(
  outline: ReportOutline,
  results: readonly SectionResearchResult[],
  config: ProjectConfig,
): Promise<string> {
  const prompt = buildExecutiveSummaryPrompt(outline, results, config)
  return callClaudeAsync(prompt, { model: 'opus' })
}

export async function generateConclusion(
  outline: ReportOutline,
  results: readonly SectionResearchResult[],
  config: ProjectConfig,
): Promise<string> {
  const prompt = buildConclusionPrompt(outline, results, config)
  return callClaudeAsync(prompt, { model: 'opus' })
}

function buildGlobalReferences(allSources: readonly SourceReference[]): string {
  if (allSources.length === 0) return ''

  const seen = new Set<string>()
  const unique: SourceReference[] = []
  for (const s of allSources) {
    if (seen.has(s.url)) continue
    seen.add(s.url)
    unique.push(s)
  }

  const lines = unique.map((s, i) =>
    `${i + 1}. [${s.title}](${s.url}) — ${s.source}, ${s.publishedAt}`
  )

  return `## 참고 자료\n\n${lines.join('\n')}\n`
}

export function buildMergedMarkdown(
  projectId: string,
  reportId: string,
  meta: DeepReportMeta,
  allSources?: readonly SourceReference[],
): string {
  const parts: string[] = []

  parts.push(`# ${meta.title}\n`)
  parts.push(`> 생성일: ${meta.generatedAt}\n`)

  const execSummary = getDeepReportSection(projectId, reportId, 'executive-summary')
  if (execSummary) {
    parts.push(`## 핵심 요약\n\n${execSummary}\n`)
  }

  for (const sectionMeta of meta.sections) {
    if (sectionMeta.id === 'executive-summary' || sectionMeta.id === 'conclusion') continue
    const content = getDeepReportSection(projectId, reportId, sectionMeta.id)
    if (content) {
      parts.push(`## ${sectionMeta.title}\n\n${content}\n`)
    }
  }

  const conclusion = getDeepReportSection(projectId, reportId, 'conclusion')
  if (conclusion) {
    parts.push(`## 결론 및 전망\n\n${conclusion}\n`)
  }

  if (allSources && allSources.length > 0) {
    parts.push(buildGlobalReferences(allSources))
  }

  return parts.join('\n')
}

export function buildDeepReportMeta(
  reportId: string,
  outline: ReportOutline,
  sectionResults: readonly SectionResearchResult[],
): ReportMeta {
  const now = new Date().toISOString()
  const totalSources = sectionResults.reduce((sum, s) => sum + s.sources.length, 0)

  const sectionLabels: Record<string, string> = {}
  for (const s of outline.sections) {
    sectionLabels[s.id] = s.title
  }

  const categoryBreakdown: Record<string, number> = {}
  for (const s of sectionResults) {
    categoryBreakdown[s.sectionId] = s.sources.length
  }

  return {
    id: reportId,
    title: outline.title,
    startDate: now,
    endDate: now,
    generatedAt: now,
    totalArticles: totalSources,
    categoryBreakdown,
    type: 'deep-research',
    sectionLabels,
  }
}

export function buildDeepReportMetaFull(
  reportId: string,
  outline: ReportOutline,
  sectionResults: readonly SectionResearchResult[],
  sectionStatuses: ReadonlyMap<string, DeepReportSectionStatus>,
  phase?: DeepReportPhase,
): DeepReportMeta {
  const now = new Date().toISOString()
  const totalSources = sectionResults.reduce((sum, s) => sum + s.sources.length, 0)

  const resultMap = new Map(sectionResults.map((r) => [r.sectionId, r]))

  const sections: DeepReportSectionMeta[] = [
    {
      id: 'executive-summary',
      title: '핵심 요약',
      sourcesCount: 0,
      status: sectionStatuses.get('executive-summary') ?? 'pending',
    },
    ...outline.sections.map((s) => ({
      id: s.id,
      title: s.title,
      sourcesCount: resultMap.get(s.id)?.sources.length ?? 0,
      status: sectionStatuses.get(s.id) ?? 'pending' as const,
    })),
    {
      id: 'conclusion',
      title: '결론 및 전망',
      sourcesCount: 0,
      status: sectionStatuses.get('conclusion') ?? 'pending',
    },
  ]

  return {
    reportId,
    title: outline.title,
    outline,
    generatedAt: now,
    totalSources,
    sections,
    ...(phase !== undefined ? { phase } : {}),
  }
}
