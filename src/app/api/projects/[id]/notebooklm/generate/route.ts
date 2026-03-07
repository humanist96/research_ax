import { NextRequest } from 'next/server'
import { getProject, getProjectNotebookLM, saveProjectNotebookLM } from '@/lib/project/store'
import type { ArtifactType, NotebookArtifact } from '@/types/notebooklm'

function getBridgeConfig() {
  const baseUrl = process.env.NOTEBOOKLM_BRIDGE_URL
  const apiKey = process.env.NOTEBOOKLM_API_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
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

  const bridge = getBridgeConfig()
  if (!bridge) {
    return Response.json({ success: false, error: 'NotebookLM bridge not configured' }, { status: 500 })
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

    // Call Python Bridge to generate content
    const bridgeRes = await fetch(`${bridge.baseUrl}/api/notebooks/${notebookLM.notebookId}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': bridge.apiKey,
      },
      body: JSON.stringify({
        type: body.type,
        options: body.options ?? {},
      }),
    })

    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text().catch(() => 'Unknown error')
      return Response.json({ success: false, error: `Bridge error: ${errText}` }, { status: bridgeRes.status })
    }

    const bridgeData = await bridgeRes.json() as { task_id: string }

    // Create new artifact entry
    const newArtifact: NotebookArtifact = {
      type: body.type,
      status: 'processing',
      taskId: bridgeData.task_id,
      options: body.options ?? {},
      createdAt: new Date().toISOString(),
    }

    // Replace existing artifact of same type or append
    const existingIdx = notebookLM.artifacts.findIndex((a) => a.type === body.type)
    const updatedArtifacts = existingIdx >= 0
      ? notebookLM.artifacts.map((a, i) => i === existingIdx ? newArtifact : a)
      : [...notebookLM.artifacts, newArtifact]

    const updated = {
      ...notebookLM,
      artifacts: updatedArtifacts,
    }

    await saveProjectNotebookLM(id, updated)

    return Response.json({ success: true, data: { taskId: bridgeData.task_id, artifact: newArtifact } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
