import { NextRequest } from 'next/server'
import { getProject, getProjectNotebookLM, saveProjectNotebookLM, getDeepReportMerged, getLatestDeepReportMeta } from '@/lib/project/store'
import type { ProjectNotebookLM } from '@/types/notebooklm'

function getBridgeConfig() {
  const baseUrl = process.env.NOTEBOOKLM_BRIDGE_URL
  const apiKey = process.env.NOTEBOOKLM_API_KEY
  if (!baseUrl || !apiKey) {
    return null
  }
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

  try {
    // Check if notebook already exists
    const existing = await getProjectNotebookLM(id)
    if (existing) {
      return Response.json({ success: true, data: existing })
    }

    // Get latest deep research report markdown
    const meta = await getLatestDeepReportMeta(id)
    if (!meta) {
      return Response.json({ success: false, error: 'No deep research report found' }, { status: 400 })
    }

    const markdown = await getDeepReportMerged(id, meta.reportId, 'md')
    if (!markdown) {
      return Response.json({ success: false, error: 'Report content not found' }, { status: 400 })
    }

    // Call Python Bridge to create notebook
    const bridgeRes = await fetch(`${bridge.baseUrl}/api/notebooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': bridge.apiKey,
      },
      body: JSON.stringify({
        title: meta.title || project.name,
        markdown: typeof markdown === 'string' ? markdown : markdown.toString('utf-8'),
      }),
    })

    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text().catch(() => 'Unknown error')
      return Response.json({ success: false, error: `Bridge error: ${errText}` }, { status: bridgeRes.status })
    }

    const bridgeData = await bridgeRes.json() as { notebook_id: string }

    const notebookLM: ProjectNotebookLM = {
      notebookId: bridgeData.notebook_id,
      createdAt: new Date().toISOString(),
      artifacts: [],
    }

    await saveProjectNotebookLM(id, notebookLM)

    return Response.json({ success: true, data: notebookLM })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = await getProject(id)

  if (!project) {
    return Response.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  try {
    const notebookLM = await getProjectNotebookLM(id)
    return Response.json({ success: true, data: notebookLM })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
