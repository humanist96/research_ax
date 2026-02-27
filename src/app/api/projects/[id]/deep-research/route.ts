import { NextRequest } from 'next/server'
import { getProject, setProjectStatus } from '@/lib/project/store'
import { runDeepResearch } from '@/lib/deep-research/orchestrator'
import type { DeepResearchEvent, ReportOutline } from '@/lib/deep-research/types'
import type { ProjectConfig } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)

  if (!project) {
    return new Response(
      JSON.stringify({ success: false, error: 'Project not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!project.config) {
    return new Response(
      JSON.stringify({ success: false, error: 'Project config not found. Complete the conversation first.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (project.status === 'researching') {
    return new Response(
      JSON.stringify({ success: false, error: 'Deep research is already running' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let providedOutline: ReportOutline | undefined
  let enableArticleReview = false
  let keywordBlacklist: readonly string[] = []
  try {
    const body = await request.json() as {
      outline?: ReportOutline
      enableArticleReview?: boolean
      keywordBlacklist?: string[]
    }
    if (body.outline) {
      providedOutline = body.outline
    }
    if (body.enableArticleReview) {
      enableArticleReview = true
    }
    if (Array.isArray(body.keywordBlacklist)) {
      keywordBlacklist = body.keywordBlacklist.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    }
  } catch {
    // No body or invalid JSON — proceed without outline
  }

  setProjectStatus(id, 'researching')

  const config: ProjectConfig = keywordBlacklist.length > 0
    ? { ...project.config, keywordBlacklist }
    : project.config

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      function emit(event: DeepResearchEvent): void {
        const sseData = `data: ${JSON.stringify(event)}\n\n`
        try {
          controller.enqueue(encoder.encode(sseData))
        } catch {
          // Stream may have been closed by client disconnect
        }
      }

      runDeepResearch(id, config, emit, providedOutline, { enableArticleReview }).finally(() => {
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
