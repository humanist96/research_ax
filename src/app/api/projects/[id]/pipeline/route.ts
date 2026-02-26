import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { getProject, setProjectStatus } from '@/lib/project/store'

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

    if (!project.config) {
      return NextResponse.json(
        { success: false, error: 'Project has no config. Finalize first.' },
        { status: 400 }
      )
    }

    try {
      setProjectStatus(id, 'collecting')
      execSync(`tsx scripts/collect.ts --project-id ${id}`, {
        cwd: process.cwd(),
        timeout: 300000,
        stdio: 'pipe',
      })

      setProjectStatus(id, 'analyzing')
      execSync(`tsx scripts/analyze.ts --project-id ${id}`, {
        cwd: process.cwd(),
        timeout: 300000,
        stdio: 'pipe',
      })

      setProjectStatus(id, 'reporting')
      execSync(`tsx scripts/generate-report.ts --project-id ${id}`, {
        cwd: process.cwd(),
        timeout: 300000,
        stdio: 'pipe',
      })

      setProjectStatus(id, 'complete')
      const updated = getProject(id)
      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      setProjectStatus(id, 'error')
      throw error
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
