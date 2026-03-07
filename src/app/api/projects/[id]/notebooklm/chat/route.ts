import { NextRequest } from 'next/server'
import { getProject, getProjectNotebookLM } from '@/lib/project/store'

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
    const body = await request.json() as { question: string }

    if (!body.question || typeof body.question !== 'string') {
      return Response.json({ success: false, error: 'question is required' }, { status: 400 })
    }

    const bridgeRes = await fetch(
      `${bridge.baseUrl}/api/notebooks/${notebookLM.notebookId}/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': bridge.apiKey,
        },
        body: JSON.stringify({ question: body.question }),
      },
    )

    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text().catch(() => 'Unknown error')
      return Response.json({ success: false, error: `Bridge error: ${errText}` }, { status: bridgeRes.status })
    }

    const bridgeData = await bridgeRes.json() as { answer: string }

    return Response.json({ success: true, data: { answer: bridgeData.answer } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
