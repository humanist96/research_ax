import { NextRequest } from 'next/server'
import { getProject, getProjectNotebookLM } from '@/lib/project/store'
import type { ArtifactType } from '@/types/notebooklm'

function getBridgeConfig() {
  const baseUrl = process.env.NOTEBOOKLM_BRIDGE_URL
  const apiKey = process.env.NOTEBOOKLM_API_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

const CONTENT_TYPES: Record<ArtifactType, string> = {
  audio: 'audio/mpeg',
  video: 'video/mp4',
  'slide-deck': 'application/pdf',
  quiz: 'application/json',
  flashcards: 'application/json',
  'mind-map': 'image/svg+xml',
  infographic: 'image/png',
  'data-table': 'application/json',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  const { id, type } = await params
  const artifactType = type as ArtifactType
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

  const artifact = notebookLM.artifacts.find((a) => a.type === artifactType)
  if (!artifact || artifact.status !== 'complete') {
    return Response.json({ success: false, error: 'Artifact not ready' }, { status: 400 })
  }

  try {
    const bridgeRes = await fetch(
      `${bridge.baseUrl}/api/notebooks/${notebookLM.notebookId}/artifacts/${artifactType}`,
      {
        headers: { 'X-API-Key': bridge.apiKey },
      },
    )

    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text().catch(() => 'Unknown error')
      return Response.json({ success: false, error: `Bridge error: ${errText}` }, { status: bridgeRes.status })
    }

    const contentType = CONTENT_TYPES[artifactType] ?? 'application/octet-stream'

    return new Response(bridgeRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${artifactType}.${getExtension(artifactType)}"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

function getExtension(type: ArtifactType): string {
  const map: Record<ArtifactType, string> = {
    audio: 'mp3',
    video: 'mp4',
    'slide-deck': 'pdf',
    quiz: 'json',
    flashcards: 'json',
    'mind-map': 'svg',
    infographic: 'png',
    'data-table': 'json',
  }
  return map[type] ?? 'bin'
}
