import { NextRequest } from 'next/server'
import { getProject, getLatestDeepReportMeta, getDeepReportMerged } from '@/lib/project/store'
import { callAI } from '@/lib/ai'

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = await getProject(id)

  if (!project) {
    return Response.json({ success: false, error: 'Project not found' }, { status: 404 })
  }

  try {
    const body = await request.json() as { question: string }

    if (!body.question || typeof body.question !== 'string') {
      return Response.json({ success: false, error: 'question is required' }, { status: 400 })
    }

    const meta = await getLatestDeepReportMeta(id)
    if (!meta) {
      return Response.json({ success: false, error: 'No report found' }, { status: 400 })
    }

    const markdown = await getDeepReportMerged(id, meta.reportId, 'md')
    if (!markdown || typeof markdown !== 'string') {
      return Response.json({ success: false, error: 'Report content not found' }, { status: 400 })
    }

    // Truncate report for context window
    const reportContext = markdown.slice(0, 12000)

    const answer = await callAI(
      `아래 보고서를 기반으로 질문에 답변하세요. 보고서에 없는 내용은 "보고서에 해당 내용이 없습니다"라고 답하세요.

## 보고서
${reportContext}

## 질문
${body.question}

간결하고 정확하게 답변하세요. 관련 수치가 있으면 포함하세요.`,
      { model: 'general', maxTokens: 2048 }
    )

    return Response.json({ success: true, data: { answer } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
