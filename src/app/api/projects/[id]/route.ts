import { NextRequest, NextResponse } from 'next/server'
import { getProject, deleteProject, setProjectStatus } from '@/lib/project/store'
import type { ProjectStatus } from '@/types'

export async function GET(
  _request: NextRequest,
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
    return NextResponse.json({ success: true, data: project })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json() as { status?: ProjectStatus }
    if (body.status) {
      const updated = await setProjectStatus(id, body.status)
      if (!updated) {
        return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: updated })
    }
    return NextResponse.json({ success: false, error: 'No updates provided' }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deleted = await deleteProject(id)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
