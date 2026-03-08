import { NextRequest } from 'next/server'

// Legacy route - generation is now synchronous, no polling needed
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { taskId } = await params
  return Response.json({
    success: true,
    data: { taskId, status: 'complete' },
  })
}
