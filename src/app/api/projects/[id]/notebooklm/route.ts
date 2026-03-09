import { NextRequest } from 'next/server'
import * as crypto from 'crypto'
import { getProject, getProjectNotebookLM, saveProjectNotebookLM, getProjectReportIndex } from '@/lib/project/store'
import type { ProjectNotebookLM } from '@/types/notebooklm'

async function hasAnyReport(projectId: string): Promise<boolean> {
  const index = await getProjectReportIndex(projectId)
  return index.reports.length > 0
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = await getProject(id)

  if (!project) {
    return Response.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  try {
    const existing = await getProjectNotebookLM(id)
    if (existing) {
      return Response.json({ success: true, data: existing })
    }

    const hasReport = await hasAnyReport(id)
    if (!hasReport) {
      return Response.json({ success: false, error: '보고서가 없습니다. 먼저 리포트를 생성하세요.' }, { status: 400 })
    }

    const notebookLM: ProjectNotebookLM = {
      notebookId: crypto.randomBytes(8).toString('hex'),
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

  // Check if any report exists (standard or deep)
  const hasReport = await hasAnyReport(id)
  if (!hasReport) {
    return Response.json({ success: true, data: null, configured: false })
  }

  try {
    const notebookLM = await getProjectNotebookLM(id)
    return Response.json({ success: true, data: notebookLM, configured: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
