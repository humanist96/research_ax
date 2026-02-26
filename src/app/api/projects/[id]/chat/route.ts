import { NextRequest, NextResponse } from 'next/server'
import { getProject, addConversationTurn } from '@/lib/project/store'
import { streamClaudeResponse, buildConversationPrompt } from '@/lib/project/chat-handler'
import type { ConversationTurn } from '@/types'

export async function POST(
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

    if (project.status !== 'conversation') {
      return NextResponse.json(
        { success: false, error: 'Project is not in conversation mode' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { message } = body as { message?: string }

    // First turn: no user message needed, Claude starts the conversation
    if (project.conversation.length === 0 && !message) {
      const prompt = buildConversationPrompt(project.prompt, [])
      return streamResponse(id, project.prompt, [], prompt)
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'message is required' },
        { status: 400 }
      )
    }

    // Save user message first
    const userTurn: ConversationTurn = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    }
    addConversationTurn(id, userTurn)

    const updatedProject = getProject(id)
    if (!updatedProject) {
      return NextResponse.json(
        { success: false, error: 'Project not found after update' },
        { status: 500 }
      )
    }

    // Build prompt with full conversation history (excluding the latest user message
    // since we pass it separately for clarity)
    const historyWithoutLast = updatedProject.conversation.slice(0, -1)
    const prompt = buildConversationPrompt(
      project.prompt,
      historyWithoutLast,
      message.trim()
    )

    return streamResponse(id, project.prompt, updatedProject.conversation, prompt)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

function streamResponse(
  projectId: string,
  _initialPrompt: string,
  _conversation: readonly ConversationTurn[],
  prompt: string
): Response {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      streamClaudeResponse(
        prompt,
        (chunk) => {
          const sseData = `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`
          controller.enqueue(encoder.encode(sseData))
        },
        (fullText) => {
          const assistantTurn: ConversationTurn = {
            role: 'assistant',
            content: fullText,
            timestamp: new Date().toISOString(),
          }
          addConversationTurn(projectId, assistantTurn)

          // Try to parse as structured JSON response
          const parsed = tryParseStructuredResponse(fullText)
          if (parsed) {
            const sseData = `data: ${JSON.stringify({ type: 'structured', content: fullText, structured: parsed })}\n\n`
            controller.enqueue(encoder.encode(sseData))
          } else {
            const sseData = `data: ${JSON.stringify({ type: 'done', content: fullText })}\n\n`
            controller.enqueue(encoder.encode(sseData))
          }
          controller.close()
        },
        (error) => {
          const sseData = `data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`
          controller.enqueue(encoder.encode(sseData))
          controller.close()
        }
      )
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

interface StructuredQuestion {
  readonly id: string
  readonly label: string
  readonly type: 'single' | 'multi' | 'text'
  readonly options?: readonly string[]
  readonly allowCustom?: boolean
  readonly recommended?: string | readonly string[]
  readonly reason?: string
}

interface Suggestion {
  readonly label: string
  readonly prompt: string
}

interface StructuredResponse {
  readonly message: string
  readonly questions: readonly StructuredQuestion[]
  readonly suggestions?: readonly Suggestion[]
  readonly done: boolean
}

function tryParseStructuredResponse(text: string): StructuredResponse | null {
  try {
    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned)

    if (
      typeof parsed.message === 'string' &&
      typeof parsed.done === 'boolean' &&
      Array.isArray(parsed.questions)
    ) {
      // Validate and filter suggestions (graceful degradation)
      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter(
            (s: unknown): s is Suggestion =>
              typeof s === 'object' &&
              s !== null &&
              typeof (s as Suggestion).label === 'string' &&
              (s as Suggestion).label.length > 0 &&
              (s as Suggestion).label.length <= 20 &&
              typeof (s as Suggestion).prompt === 'string' &&
              (s as Suggestion).prompt.length > 0
          )
        : undefined

      return {
        ...parsed,
        suggestions: suggestions && suggestions.length > 0 ? suggestions : undefined,
      } as StructuredResponse
    }
    return null
  } catch {
    return null
  }
}
