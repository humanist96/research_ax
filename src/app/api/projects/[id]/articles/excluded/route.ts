import { NextRequest, NextResponse } from 'next/server'
import {
  getProject,
  getProjectArticles,
  getExcludedArticleIds,
  saveExcludedArticleIds,
} from '@/lib/project/store'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = getProject(id)
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    const ids = getExcludedArticleIds(id)
    return NextResponse.json({ success: true, data: ids })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = getProject(id)
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const ids: unknown = body.ids

    if (!Array.isArray(ids) || !ids.every((v) => typeof v === 'string')) {
      return NextResponse.json(
        { success: false, error: 'ids must be a string array' },
        { status: 400 }
      )
    }

    const articles = getProjectArticles(id)
    const validIds = new Set(articles.map((a) => a.id))
    const filtered = ids.filter((articleId: string) => validIds.has(articleId))

    saveExcludedArticleIds(id, filtered)
    return NextResponse.json({ success: true, data: filtered })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
