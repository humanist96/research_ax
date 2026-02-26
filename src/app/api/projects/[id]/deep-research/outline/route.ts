import { NextRequest } from 'next/server'
import { getProject } from '@/lib/project/store'
import { generateOutline } from '@/lib/deep-research/outline-generator'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)

  if (!project) {
    return Response.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  if (!project.config) {
    return Response.json(
      { success: false, error: 'Project config not found. Complete the conversation first.' },
      { status: 400 },
    )
  }

  try {
    const outline = await generateOutline(project.config)
    return Response.json({ success: true, data: outline })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
