import { NextRequest, NextResponse } from 'next/server'
import { getProject, getProjectReportIndex, getProjectReportContent } from '@/lib/project/store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await getProject(id)
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('reportId')

    if (reportId) {
      const content = await getProjectReportContent(id, reportId)
      if (!content) {
        return NextResponse.json(
          { success: false, error: 'Report not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, data: { content } })
    }

    const index = await getProjectReportIndex(id)

    // Load report contents from store (works on both local and Vercel)
    const contents: Record<string, string> = {}
    for (const report of index.reports) {
      const content = await getProjectReportContent(id, report.id)
      if (content) {
        contents[report.id] = content
      }
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
