import { NextRequest, NextResponse } from 'next/server'
import { getProject, setProjectConfig, setProjectStatus } from '@/lib/project/store'
import { generateConfig } from '@/lib/project/config-generator'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = getProject(id)
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    if (project.status !== 'conversation') {
      return NextResponse.json(
        { success: false, error: 'Project is not in conversation mode' },
        { status: 400 }
      )
    }

    setProjectStatus(id, 'configuring')

    try {
      const config = generateConfig(project.prompt, project.conversation)
      const updated = setProjectConfig(id, config)
      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      setProjectStatus(id, 'conversation')
      throw error
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
