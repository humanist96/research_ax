import { NextRequest } from 'next/server'
import { getProject, saveDeepReportSection } from '@/lib/project/store'
import { analyzeSection } from '@/lib/deep-research/section-researcher'
import type { ArticleItem } from '@/lib/deep-research/section-researcher'
import type { OutlineSection } from '@/lib/deep-research/types'

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
    return Response.json({ success: false, error: 'Project config not found' }, { status: 400 })
  }

  try {
    const body = await request.json() as {
      section: OutlineSection
      articles: ArticleItem[]
      reportId: string
    }

    if (!body.section || !body.articles || !body.reportId) {
      return Response.json({ success: false, error: 'section, articles, and reportId are required' }, { status: 400 })
    }

    const result = await analyzeSection(body.section, body.articles, project.config)

    // Save section content
    saveDeepReportSection(id, body.reportId, body.section.id, result.content)

    return Response.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
