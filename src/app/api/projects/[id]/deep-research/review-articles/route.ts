import { NextRequest, NextResponse } from 'next/server'
import { getProject } from '@/lib/project/store'
import { getLatestDeepReportMeta } from '@/lib/project/store'
import { submitArticleReview, hasPendingReview } from '@/lib/deep-research/article-review-store'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)

  if (!project) {
    return NextResponse.json(
      { success: false, error: 'Project not found' },
      { status: 404 },
    )
  }

  let body: { excludedBySection?: Record<string, string[]> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 },
    )
  }

  const excludedBySection = body.excludedBySection ?? {}

  // Find the latest deep report that is pending review
  const meta = getLatestDeepReportMeta(id)
  if (!meta) {
    return NextResponse.json(
      { success: false, error: 'No active deep research found' },
      { status: 404 },
    )
  }

  if (!hasPendingReview(meta.reportId)) {
    return NextResponse.json(
      { success: false, error: 'No pending article review for this report' },
      { status: 409 },
    )
  }

  const excludedMap = new Map<string, readonly string[]>(
    Object.entries(excludedBySection),
  )

  const submitted = submitArticleReview(meta.reportId, excludedMap)
  if (!submitted) {
    return NextResponse.json(
      { success: false, error: 'Failed to submit review — no pending review found' },
      { status: 409 },
    )
  }

  return NextResponse.json({ success: true })
}
