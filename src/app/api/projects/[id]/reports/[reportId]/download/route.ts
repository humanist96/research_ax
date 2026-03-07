import * as fs from 'fs'
import * as path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { getProject, getDeepReportMeta, getDeepReportMerged, getProjectDir } from '@/lib/project/store'
import { buildReportHtml } from '@/lib/deep-research/pdf-generator'

export async function GET(
  request: NextRequest,
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

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') ?? 'md'

    const safeTitle = meta.title.replace(/[^\w가-힣\s-]/g, '').trim() || 'report'

    // HTML format: for client-side PDF generation
    if (format === 'html') {
      const mdContent = await getDeepReportMerged(id, reportId, 'md')
      if (!mdContent) {
        return NextResponse.json(
          { success: false, error: 'MD file not found' },
          { status: 404 }
        )
      }
      const html = buildReportHtml(mdContent as string, meta.title)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      })
    }

    // PDF format: serve pre-generated PDF (local mode only)
    if (format === 'pdf') {
      const safeName = reportId.replace(/[^a-zA-Z0-9-]/g, '')
      const pdfPath = path.join(getProjectDir(id), 'reports', safeName, 'merged.pdf')

      if (!fs.existsSync(pdfPath)) {
        return NextResponse.json(
          { success: false, error: 'PDF file not found. Use format=html for client-side PDF generation.' },
          { status: 404 }
        )
      }

      const fileBuffer = fs.readFileSync(pdfPath)
      const filename = `${safeTitle}.pdf`
      const encodedFilename = encodeURIComponent(filename)
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        },
      })
    }

    // MD format (default)
    const content = await getDeepReportMerged(id, reportId, 'md')
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'MD file not found' },
        { status: 404 }
      )
    }

    const filename = `${safeTitle}.md`
    const encodedFilename = encodeURIComponent(filename)
    return new NextResponse(content as string, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
