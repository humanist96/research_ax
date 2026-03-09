import { NextRequest } from 'next/server'
import { getProject, saveDeepReportSection } from '@/lib/project/store'
import { refineOnly } from '@/lib/deep-research/section-researcher'
import type { OutlineSection, SectionResearchResult } from '@/lib/deep-research/types'

export const maxDuration = 60

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
      section: OutlineSection
      analyzeResult: SectionResearchResult
      reportId: string
    }

    if (!body.section || !body.analyzeResult || !body.reportId) {
      return Response.json({ success: false, error: 'section, analyzeResult, and reportId are required' }, { status: 400 })
    }

    // Step 2: refinement with gpt-4o-mini (fast)
    const result = await refineOnly(body.section, body.analyzeResult, project.config)

    // Overwrite section content with refined version
    await saveDeepReportSection(id, body.reportId, body.section.id, result.content)

    return Response.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
