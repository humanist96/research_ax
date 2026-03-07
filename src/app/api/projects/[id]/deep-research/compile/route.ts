import { NextRequest } from 'next/server'
import {
  getProject,
  setProjectStatus,
  saveDeepReportSection,
  saveDeepReportMeta,
  saveDeepReportMerged,
  saveProjectReport,
  getProjectReportIndex,
  saveProjectReportIndex,
} from '@/lib/project/store'
import {
  generateExecutiveSummary,
  generateConclusion,
  buildMergedMarkdown,
  buildDeepReportMeta,
  buildDeepReportMetaFull,
} from '@/lib/deep-research/report-compiler'
import type { ReportOutline, SectionResearchResult, DeepReportSectionStatus } from '@/lib/deep-research/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = await getProject(id)

  if (!project) {
    return Response.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  if (!project.config) {
    return Response.json({ success: false, error: 'Project config not found' }, { status: 400 })
  }

  try {
    const body = await request.json() as {
      reportId: string
      outline: ReportOutline
      sectionResults: SectionResearchResult[]
    }

    if (!body.reportId || !body.outline || !body.sectionResults) {
      return Response.json({ success: false, error: 'reportId, outline, and sectionResults are required' }, { status: 400 })
    }

    const { reportId, outline, sectionResults } = body

    // Generate executive summary and conclusion in parallel
    const [execSummary, conclusion] = await Promise.all([
      generateExecutiveSummary(outline, sectionResults, project.config),
      generateConclusion(outline, sectionResults, project.config),
    ])

    // Save sections
    await saveDeepReportSection(id, reportId, 'executive-summary', execSummary)
    await saveDeepReportSection(id, reportId, 'conclusion', conclusion)

    // Build section statuses
    const sectionStatuses = new Map<string, DeepReportSectionStatus>()
    sectionStatuses.set('executive-summary', 'complete')
    sectionStatuses.set('conclusion', 'complete')
    for (const s of outline.sections) {
      sectionStatuses.set(s.id, 'complete')
    }

    // Save meta
    const meta = buildDeepReportMetaFull(reportId, outline, sectionResults, sectionStatuses, 'complete')
    await saveDeepReportMeta(id, reportId, meta)

    // Build and save merged markdown
    const allSources = sectionResults.flatMap((r) => r.sources)
    const mergedMd = await buildMergedMarkdown(id, reportId, meta, allSources)
    await saveDeepReportMerged(id, reportId, 'md', mergedMd)

    // Save flat .md for compatibility
    await saveProjectReport(id, reportId, mergedMd)

    // Register in ReportIndex
    const reportMeta = buildDeepReportMeta(reportId, outline, sectionResults)
    const index = await getProjectReportIndex(id)
    await saveProjectReportIndex(id, {
      reports: [reportMeta, ...index.reports],
    })

    await setProjectStatus(id, 'complete')

    return Response.json({
      success: true,
      data: {
        reportId,
        meta,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await setProjectStatus(id, 'error')
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
