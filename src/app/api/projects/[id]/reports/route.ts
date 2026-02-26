import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import { getProject, getProjectReportIndex, getProjectReportContent, getProjectDir } from '@/lib/project/store'
import * as path from 'path'

export async function GET(
  request: NextRequest,
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

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('reportId')

    if (reportId) {
      const content = getProjectReportContent(id, reportId)
      if (!content) {
        return NextResponse.json(
          { success: false, error: 'Report not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, data: { content } })
    }

    const index = getProjectReportIndex(id)

    const contents: Record<string, string> = {}
    const reportsDir = path.join(getProjectDir(id), 'reports')
    try {
      const files = fs.readdirSync(reportsDir)
      for (const file of files) {
        if (file.endsWith('.md')) {
          const rId = file.replace('.md', '')
          contents[rId] = fs.readFileSync(path.join(reportsDir, file), 'utf-8')
        }
      }
    } catch {
      // no reports yet
    }

    return NextResponse.json({
      success: true,
      data: { index, contents },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
