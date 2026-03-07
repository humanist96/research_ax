import { NextRequest, NextResponse } from 'next/server'
import { getProject, getProjectArticles, getProjectAnalyzedArticles } from '@/lib/project/store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await getProject(id)
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') ?? 'analyzed'

    if (type === 'raw') {
      const articles = await getProjectArticles(id)
      return NextResponse.json({ success: true, data: articles })
    }

    const articles = await getProjectAnalyzedArticles(id)
    return NextResponse.json({ success: true, data: articles })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
