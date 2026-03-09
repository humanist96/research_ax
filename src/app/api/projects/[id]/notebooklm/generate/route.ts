import { NextRequest } from 'next/server'
import { getProject, getProjectNotebookLM, saveProjectNotebookLM, getLatestDeepReportMeta, getDeepReportMerged, saveNotebookAudioBlob, getProjectReportIndex, getProjectReportContent } from '@/lib/project/store'
import { generateContent } from '@/lib/content-generator'
import type { ArtifactType, NotebookArtifact } from '@/types/notebooklm'

export const maxDuration = 60

async function loadReportMarkdown(projectId: string): Promise<string | null> {
  // Try deep research merged report first
  const meta = await getLatestDeepReportMeta(projectId)
  if (meta) {
    const merged = await getDeepReportMerged(projectId, meta.reportId, 'md')
    if (merged && typeof merged === 'string') return merged
  }

  // Fall back to latest standard report
  const index = await getProjectReportIndex(projectId)
  if (index.reports.length === 0) return null

  const latestReport = index.reports[index.reports.length - 1]
  return getProjectReportContent(projectId, latestReport.id)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = await getProject(id)

  if (!project) {
    return Response.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  const notebookLM = await getProjectNotebookLM(id)
  if (!notebookLM) {
    return Response.json({ success: false, error: 'Notebook not created yet' }, { status: 400 })
  }

  try {
    const body = await request.json() as {
      type: ArtifactType
      options?: Record<string, unknown>
    }

    if (!body.type) {
      return Response.json({ success: false, error: 'type is required' }, { status: 400 })
    }

    // Load report markdown (deep research first, then standard)
    const markdown = await loadReportMarkdown(id)
    if (!markdown) {
      return Response.json({ success: false, error: 'No report content found' }, { status: 400 })
    }

    // Generate content via OpenAI
    const result = await generateContent(markdown, body.type, body.options ?? {})

    // Build artifact
    let artifact: NotebookArtifact = {
      type: body.type,
      status: 'complete',
      options: body.options ?? {},
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }

    if (result.audioBuffer) {
      const audioPath = await saveNotebookAudioBlob(id, result.audioBuffer)
      artifact = { ...artifact, resultPath: audioPath }
    } else if (result.data) {
      artifact = { ...artifact, resultData: result.data }
    }

    // Update notebook state
    const existingIdx = notebookLM.artifacts.findIndex((a) => a.type === body.type)
    const updatedArtifacts = existingIdx >= 0
      ? notebookLM.artifacts.map((a, i) => i === existingIdx ? artifact : a)
      : [...notebookLM.artifacts, artifact]

    await saveProjectNotebookLM(id, { ...notebookLM, artifacts: updatedArtifacts })

    return Response.json({ success: true, data: { artifact } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Save error status
    try {
      const nb = await getProjectNotebookLM(id)
      if (nb) {
        const body = await request.clone().json().catch(() => ({ type: null })) as { type?: ArtifactType }
        if (body.type) {
          const errorArtifact: NotebookArtifact = {
            type: body.type,
            status: 'error',
            options: {},
            createdAt: new Date().toISOString(),
            error: message,
          }
          const idx = nb.artifacts.findIndex((a) => a.type === body.type)
          const arts = idx >= 0
            ? nb.artifacts.map((a, i) => i === idx ? errorArtifact : a)
            : [...nb.artifacts, errorArtifact]
          await saveProjectNotebookLM(id, { ...nb, artifacts: arts })
        }
      }
    } catch {
      // Ignore save errors
    }

    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
