import { NextRequest } from 'next/server'
import { getProject, saveDeepReportSection } from '@/lib/project/store'
import { generateConclusion } from '@/lib/deep-research/report-compiler'
import type { ReportOutline, SectionResearchResult } from '@/lib/deep-research/types'

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = await getProject(id)

  if (!project?.config) {
    return Response.json({ success: false, error: 'Project or config not found' }, { status: 404 })
  }

  try {
    const body = await request.json() as {
      reportId: string
      outline: ReportOutline
      sectionResults: SectionResearchResult[]
    }

    const conclusion = await generateConclusion(body.outline, body.sectionResults, project.config)
    await saveDeepReportSection(id, body.reportId, 'conclusion', conclusion)

    return Response.json({ success: true, data: { content: conclusion } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
