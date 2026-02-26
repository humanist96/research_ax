import { NextRequest } from 'next/server'
import { getProject, setProjectStatus } from '@/lib/project/store'
import { runPipeline } from '@/lib/pipeline/orchestrator'
import type { PipelineEvent } from '@/lib/pipeline/types'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      JSON.stringify({ success: false, error: 'Project has no config. Finalize first.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const activeStatuses = ['collecting', 'analyzing', 'reporting']
  if (activeStatuses.includes(project.status)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Pipeline is already running' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const config = project.config

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      function emit(event: PipelineEvent): void {
        const sseData = `data: ${JSON.stringify(event)}\n\n`
        try {
          controller.enqueue(encoder.encode(sseData))
        } catch {
          // Stream may have been closed by client disconnect
        }
      }

      runPipeline(id, config, emit).finally(() => {
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
