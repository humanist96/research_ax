import * as crypto from 'crypto'
import type { ProjectConfig } from '@/types'
import type { DeepResearchEvent, SectionResearchResult } from './types'
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
): Promise<void> {
  const reportId = `deep-${crypto.randomBytes(6).toString('hex')}`

  try {
    // Phase 1: Outline generation (Opus)
    emit({ type: 'phase', phase: 'outline', message: '보고서 목차를 생성하고 있습니다...' })

    const outline = await generateOutline(config)
    emit({ type: 'outline', outline })

    for (const section of outline.sections) {
      emit({ type: 'section_status', sectionId: section.id, status: 'pending', message: '대기 중' })
    }

    // Save initial meta
    const initialMeta = buildDeepReportMetaFull(
      reportId,
      outline,
      [],
      new Map(),
    )
    saveDeepReportMeta(projectId, reportId, initialMeta)

    // Phase 2: Section research (Opus, max 2 concurrent)
    emit({ type: 'phase', phase: 'researching', message: '섹션별 리서치를 진행하고 있습니다...' })

    const limiter = createConcurrencyLimiter(outline.sections.length)
    const results: SectionResearchResult[] = []
    const sectionStatuses = new Map<string, 'complete' | 'error'>()

    const sectionPromises = outline.sections.map((section) =>
      limiter.run(async () => {
        try {
          const result = await researchSection(section, config, (status, message, sourcesFound) => {
            emit({ type: 'section_status', sectionId: section.id, status, sourcesFound, message })
          })

          // Save section immediately
          saveDeepReportSection(projectId, reportId, section.id, result.content)
          sectionStatuses.set(section.id, 'complete')

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
    emit({ type: 'phase', phase: 'compiling', message: '핵심 요약과 결론을 생성하고 있습니다...' })

    const [execSummary, conclusion] = await Promise.all([
      generateExecutiveSummary(outline, results, config),
      generateConclusion(outline, results, config),
    ])

    saveDeepReportSection(projectId, reportId, 'executive-summary', execSummary)
    sectionStatuses.set('executive-summary', 'complete')

    saveDeepReportSection(projectId, reportId, 'conclusion', conclusion)
    sectionStatuses.set('conclusion', 'complete')

    // Build and save final meta
    const finalMeta = buildDeepReportMetaFull(reportId, outline, results, sectionStatuses)
    saveDeepReportMeta(projectId, reportId, finalMeta)

    // Build and save merged markdown (with global references)
    const allSources = results.flatMap((r) => r.sources)
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
    emit({ type: 'phase', phase: 'pdf', message: 'PDF를 생성하고 있습니다...' })

    try {
      const pdfBuffer = await generatePDF(mergedMd, outline.title)
      saveDeepReportMerged(projectId, reportId, 'pdf', pdfBuffer)
    } catch (pdfError) {
      const pdfMsg = pdfError instanceof Error ? pdfError.message : String(pdfError)
      emit({ type: 'error', message: `PDF 생성 실패 (보고서는 정상 저장됨): ${pdfMsg}` })
    }

    setProjectStatus(projectId, 'complete')

    emit({ type: 'report_complete', reportId })
    emit({ type: 'phase', phase: 'complete', message: '딥 리서치가 완료되었습니다' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    setProjectStatus(projectId, 'error')
    emit({ type: 'error', message: msg })
    emit({ type: 'phase', phase: 'error', message: msg })
  }
}
