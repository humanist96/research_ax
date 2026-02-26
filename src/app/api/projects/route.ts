import { NextRequest, NextResponse } from 'next/server'
import { listProjects, createProject } from '@/lib/project/store'

export async function GET() {
  try {
    const projects = listProjects()
    return NextResponse.json({ success: true, data: projects })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, prompt } = body as { name?: string; prompt?: string }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: 'prompt is required' },
        { status: 400 }
      )
    }

    const projectName = name?.trim() || prompt.trim().slice(0, 50)
    const project = createProject(projectName, prompt.trim())

    return NextResponse.json({ success: true, data: project }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
