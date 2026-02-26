import { NextRequest } from 'next/server'
import { getProject } from '@/lib/project/store'
import { regenerateSection } from '@/lib/deep-research/outline-generator'
import type { ReportOutline } from '@/lib/deep-research/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)

  if (!project) {
    return Response.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  if (!project.config) {
    return Response.json(
      { success: false, error: 'Project config not found.' },
      { status: 400 },
    )
  }

  const body = await request.json() as { outline?: ReportOutline; sectionId?: string }

  if (!body.outline || !body.sectionId) {
    return Response.json(
      { success: false, error: 'Missing outline or sectionId in request body' },
      { status: 400 },
    )
  }

  try {
    const section = await regenerateSection(project.config, body.outline, body.sectionId)
    return Response.json({ success: true, data: section })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
