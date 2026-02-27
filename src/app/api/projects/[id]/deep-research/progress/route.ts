import { NextRequest } from 'next/server'
import { getProject, getLatestDeepReportMeta } from '@/lib/project/store'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)

  if (!project) {
    return Response.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  const isActive = project.status === 'researching'
  const meta = getLatestDeepReportMeta(id)

  if (!meta) {
    return Response.json({
      success: true,
      data: { active: isActive, reportId: null, phase: null, outline: null, sections: [] },
    })
  }

  const sections = meta.sections.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    sourcesCount: s.sourcesCount,
  }))

  return Response.json({
    success: true,
    data: {
      active: isActive,
      reportId: meta.reportId,
      phase: meta.phase ?? (isActive ? 'researching' : 'complete'),
      outline: meta.outline,
      sections,
    },
  })
}
