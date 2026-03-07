import { NextResponse } from 'next/server'
import { getProject, getDeepReportMeta, getDeepReportSection } from '@/lib/project/store'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const { id, reportId } = await params

    const project = await getProject(id)
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    const meta = await getDeepReportMeta(id, reportId)
    if (!meta) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      )
    }

    const sections = await Promise.all(meta.sections.map(async (s) => {
      const content = await getDeepReportSection(id, reportId, s.id)
      return {
        id: s.id,
        title: s.title,
        content: content ?? '',
        sourcesCount: s.sourcesCount,
        status: s.status,
      }
    }))

    return NextResponse.json({
      success: true,
      data: { meta, sections },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
