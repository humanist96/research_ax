import { NextRequest } from 'next/server'
import { getProject } from '@/lib/project/store'
import { searchAndFilterSection } from '@/lib/deep-research/section-researcher'
import type { OutlineSection } from '@/lib/deep-research/types'
import type { ProjectConfig } from '@/types'

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
      keywordBlacklist?: string[]
    }

    if (!body.section) {
      return Response.json({ success: false, error: 'section is required' }, { status: 400 })
    }

    const config: ProjectConfig = body.keywordBlacklist?.length
      ? { ...project.config, keywordBlacklist: body.keywordBlacklist }
      : project.config

    const articles = await searchAndFilterSection(body.section, config)

    return Response.json({
      success: true,
      data: {
        sectionId: body.section.id,
        articles,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
