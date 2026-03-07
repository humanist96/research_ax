import { NextRequest } from 'next/server'
import { getProject, getProjectNotebookLM, saveProjectNotebookLM } from '@/lib/project/store'
import type { ArtifactStatus } from '@/types/notebooklm'

function getBridgeConfig() {
  const baseUrl = process.env.NOTEBOOKLM_BRIDGE_URL
  const apiKey = process.env.NOTEBOOKLM_API_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params
  const project = await getProject(id)

  if (!project) {
    return Response.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  const bridge = getBridgeConfig()
  if (!bridge) {
    return Response.json({ success: false, error: 'NotebookLM bridge not configured' }, { status: 500 })
  }

  const notebookLM = await getProjectNotebookLM(id)
  if (!notebookLM) {
    return Response.json({ success: false, error: 'Notebook not created yet' }, { status: 400 })
  }

  try {
    const bridgeRes = await fetch(
      `${bridge.baseUrl}/api/notebooks/${notebookLM.notebookId}/tasks/${taskId}`,
      {
        headers: { 'X-API-Key': bridge.apiKey },
      },
    )

    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text().catch(() => 'Unknown error')
      return Response.json({ success: false, error: `Bridge error: ${errText}` }, { status: bridgeRes.status })
    }

    const bridgeData = await bridgeRes.json() as {
      status: string
      error?: string
    }

    // Map bridge status to our ArtifactStatus
    const statusMap: Record<string, ArtifactStatus> = {
      pending: 'pending',
      processing: 'processing',
      complete: 'complete',
      completed: 'complete',
      error: 'error',
      failed: 'error',
    }
    const newStatus: ArtifactStatus = statusMap[bridgeData.status] ?? 'processing'

    // Update artifact status in KV if changed
    const artifact = notebookLM.artifacts.find((a) => a.taskId === taskId)
    if (artifact && artifact.status !== newStatus) {
      const now = new Date().toISOString()
      const updatedArtifacts = notebookLM.artifacts.map((a) =>
        a.taskId === taskId
          ? {
              ...a,
              status: newStatus,
              completedAt: newStatus === 'complete' ? now : a.completedAt,
              error: newStatus === 'error' ? (bridgeData.error ?? 'Unknown error') : undefined,
            }
          : a
      )

      await saveProjectNotebookLM(id, { ...notebookLM, artifacts: updatedArtifacts })
    }

    return Response.json({
      success: true,
      data: {
        taskId,
        status: newStatus,
        error: bridgeData.error,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
