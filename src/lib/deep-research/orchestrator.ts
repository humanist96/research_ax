import * as crypto from 'crypto'
import type { ProjectConfig } from '@/types'
import type { DeepResearchEvent, ReportOutline, SectionResearchResult, DeepReportSectionStatus, DeepReportPhase } from './types'
import { generateOutline } from './outline-generator'
import { researchSection } from './section-researcher'
import {
  generateExecutiveSummary,
  generateConclusion,
  buildMergedMarkdown,
  buildDeepReportMeta,
  buildDeepReportMetaFull,
} from './report-compiler'
import { generatePDF } from './pdf-generator'
import { createConcurrencyLimiter } from './claude-async'
import {
  setProjectStatus,
  getProjectReportIndex,
  saveProjectReportIndex,
  saveDeepReportMeta,
  saveDeepReportSection,
  saveDeepReportMerged,
} from '@/lib/project/store'

export async function runDeepResearch(
  projectId: string,
  config: ProjectConfig,
  emit: (event: DeepResearchEvent) => void,
  providedOutline?: ReportOutline,
): Promise<void> {
  const reportId = `deep-${crypto.randomBytes(6).toString('hex')}`
  const sectionStatuses = new Map<string, DeepReportSectionStatus>()
  let currentPhase: DeepReportPhase = 'outline'
  let outline: ReportOutline | null = null
  const results: SectionResearchResult[] = []

  function persistProgress(): void {
    if (!outline) return
    const meta = buildDeepReportMetaFull(reportId, outline, results, sectionStatuses, currentPhase)
    saveDeepReportMeta(projectId, reportId, meta)
  }

  try {
    // Phase 1: Outline generation (Opus) — skip if outline provided
    if (providedOutline) {
      outline = providedOutline
      emit({ type: 'outline', outline })
    } else {
      emit({ type: 'phase', phase: 'outline', message: '보고서 목차를 생성하고 있습니다...' })
      outline = await generateOutline(config)
      emit({ type: 'outline', outline })
    }

    for (const section of outline.sections) {
      sectionStatuses.set(section.id, 'pending')
      emit({ type: 'section_status', sectionId: section.id, status: 'pending', message: '대기 중' })
    }

    // Save initial meta with phase
    persistProgress()

    // Phase 2: Section research (Opus, max 2 concurrent)
    currentPhase = 'researching'
    persistProgress()
    emit({ type: 'phase', phase: 'researching', message: '섹션별 리서치를 진행하고 있습니다...' })

    const limiter = createConcurrencyLimiter(outline.sections.length)

    const sectionPromises = outline.sections.map((section) =>
      limiter.run(async () => {
        try {
          const result = await researchSection(section, config, (status, message, sourcesFound) => {
            sectionStatuses.set(section.id, status)
            persistProgress()
            emit({ type: 'section_status', sectionId: section.id, status, sourcesFound, message })
          })

          // Save section immediately
          saveDeepReportSection(projectId, reportId, section.id, result.content)
          sectionStatuses.set(section.id, 'complete')
          persistProgress()

          emit({
            type: 'section_status',
            sectionId: section.id,
            status: 'complete',
            sourcesFound: result.sources.length,
            message: '완료',
          })
          emit({ type: 'section_saved', sectionId: section.id, title: section.title })

          return result
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          sectionStatuses.set(section.id, 'error')
          persistProgress()
          emit({ type: 'section_status', sectionId: section.id, status: 'error', message: msg })
          return null
        }
      }),
    )

    const sectionResults = await Promise.all(sectionPromises)
    for (const r of sectionResults) {
      if (r) results.push(r)
    }

    if (results.length === 0) {
      throw new Error('모든 섹션 리서치에 실패했습니다')
    }

    // Phase 3: Executive summary + conclusion + merge
    currentPhase = 'compiling'
    persistProgress()
    emit({ type: 'phase', phase: 'compiling', message: '핵심 요약과 결론을 생성하고 있습니다...' })

    const [execSummary, conclusion] = await Promise.all([
      generateExecutiveSummary(outline, results, config),
      generateConclusion(outline, results, config),
    ])

    saveDeepReportSection(projectId, reportId, 'executive-summary', execSummary)
    sectionStatuses.set('executive-summary', 'complete')

    saveDeepReportSection(projectId, reportId, 'conclusion', conclusion)
    sectionStatuses.set('conclusion', 'complete')

    // Build and save final meta (still compiling phase)
    persistProgress()

    // Build and save merged markdown (with global references)
    const allSources = results.flatMap((r) => r.sources)
    const finalMeta = buildDeepReportMetaFull(reportId, outline, results, sectionStatuses, currentPhase)
    const mergedMd = buildMergedMarkdown(projectId, reportId, finalMeta, allSources)
    saveDeepReportMerged(projectId, reportId, 'md', mergedMd)

    // Also save as flat .md for backward compatibility with ReportList
    const { saveProjectReport } = await import('@/lib/project/store')
    saveProjectReport(projectId, reportId, mergedMd)

    // Register in ReportIndex
    const reportMeta = buildDeepReportMeta(reportId, outline, results)
    const index = getProjectReportIndex(projectId)
    saveProjectReportIndex(projectId, {
      reports: [reportMeta, ...index.reports],
    })

    // Phase 4: PDF generation
    currentPhase = 'pdf'
    persistProgress()
    emit({ type: 'phase', phase: 'pdf', message: 'PDF를 생성하고 있습니다...' })

    try {
      const pdfBuffer = await generatePDF(mergedMd, outline.title)
      saveDeepReportMerged(projectId, reportId, 'pdf', pdfBuffer)
    } catch (pdfError) {
      const pdfMsg = pdfError instanceof Error ? pdfError.message : String(pdfError)
      emit({ type: 'error', message: `PDF 생성 실패 (보고서는 정상 저장됨): ${pdfMsg}` })
    }

    // Final: mark complete
    currentPhase = 'complete'
    persistProgress()
    setProjectStatus(projectId, 'complete')

    emit({ type: 'report_complete', reportId })
    emit({ type: 'phase', phase: 'complete', message: '딥 리서치가 완료되었습니다' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    currentPhase = 'error'
    persistProgress()
    setProjectStatus(projectId, 'error')
    emit({ type: 'error', message: msg })
    emit({ type: 'phase', phase: 'error', message: msg })
  }
}
