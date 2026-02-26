import * as fs from 'fs'
import * as path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { getProject, getDeepReportMeta, getDeepReportMerged, getProjectDir } from '@/lib/project/store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const { id, reportId } = await params

    const project = getProject(id)
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    const meta = getDeepReportMeta(id, reportId)
    if (!meta) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'md'

    const safeTitle = meta.title.replace(/[^\w가-힣\s-]/g, '').trim() || 'report'
    const extension = format === 'pdf' ? 'pdf' : 'md'
    const contentType = format === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8'
    const filename = `${safeTitle}.${extension}`
    const encodedFilename = encodeURIComponent(filename)

    if (format === 'pdf') {
      const safeName = reportId.replace(/[^a-zA-Z0-9-]/g, '')
      const pdfPath = path.join(getProjectDir(id), 'reports', safeName, 'merged.pdf')

      if (!fs.existsSync(pdfPath)) {
        return NextResponse.json(
          { success: false, error: 'PDF file not found' },
          { status: 404 }
        )
      }

      const fileBuffer = fs.readFileSync(pdfPath)
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        },
      })
    }

    const content = getDeepReportMerged(id, reportId, 'md')
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'MD file not found' },
        { status: 404 }
      )
    }

    return new NextResponse(content as string, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
