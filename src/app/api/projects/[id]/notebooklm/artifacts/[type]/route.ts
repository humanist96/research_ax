import { NextRequest } from 'next/server'
import { getProject, getProjectNotebookLM, getNotebookAudioBlob } from '@/lib/project/store'
import type { ArtifactType } from '@/types/notebooklm'

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

  const notebookLM = await getProjectNotebookLM(id)
  if (!notebookLM) {
    return Response.json({ success: false, error: 'Notebook not created yet' }, { status: 400 })
  }

  const artifact = notebookLM.artifacts.find((a) => a.type === artifactType)
  if (!artifact || artifact.status !== 'complete') {
    return Response.json({ success: false, error: 'Artifact not ready' }, { status: 400 })
  }

  try {
    if (artifactType === 'audio') {
      const buffer = await getNotebookAudioBlob(id)
      if (!buffer) {
        return Response.json({ success: false, error: 'Audio file not found' }, { status: 404 })
      }
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'attachment; filename="podcast.mp3"',
        },
      })
    }

    // JSON artifacts - return resultData directly
    if (artifact.resultData) {
      return Response.json({ success: true, data: artifact.resultData })
    }

    return Response.json({ success: false, error: 'No artifact data' }, { status: 404 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
