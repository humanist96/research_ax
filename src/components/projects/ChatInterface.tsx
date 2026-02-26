'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ConversationTurn } from '@/types'
import { StructuredForm } from './StructuredForm'
import type { StructuredData } from './StructuredForm'
import { SuggestionBubbles } from './SuggestionBubbles'

interface ChatInterfaceProps {
  readonly projectId: string
  readonly projectName: string
  readonly initialPrompt: string
  readonly initialConversation: readonly ConversationTurn[]
  readonly onFinalized: () => void
}

export function ChatInterface({
  projectId,
  projectName,
  initialPrompt,
  initialConversation,
  onFinalized,
}: ChatInterfaceProps) {
  const [conversation, setConversation] = useState<ConversationTurn[]>([...initialConversation])
  const [streamingText, setStreamingText] = useState('')
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingStructured, setPendingStructured] = useState<StructuredData | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation, streamingText])

  const streamChat = useCallback(async (message?: string) => {
    setIsLoading(true)
    setError(null)
    setStreamingText('')

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message ? { message } : {}),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Request failed')
        setIsLoading(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setError('Stream not available')
        setIsLoading(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)

          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'chunk') {
              accumulated += event.content
              setStreamingText(accumulated)
            } else if (event.type === 'structured') {
              setStreamingText('')
              const structured = event.structured as StructuredData
              setConversation((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  content: structured.message,
                  timestamp: new Date().toISOString(),
                },
              ])
              if (!structured.done && structured.questions.length > 0) {
                setPendingStructured(structured)
              }
            } else if (event.type === 'done') {
              setStreamingText('')
              setConversation((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  content: event.content,
                  timestamp: new Date().toISOString(),
                },
              ])
            } else if (event.type === 'error') {
              setError(event.content)
            }
          } catch {
            // partial JSON, skip
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setIsLoading(false)
      setStreamingText('')
    }
  }, [projectId])

  useEffect(() => {
    if (initialConversation.length === 0) {
      streamChat()
    }
  }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const message = input.trim()
    setInput('')

    setConversation((prev) => [
      ...prev,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
    ])

    await streamChat(message)
  }

  const handleStructuredSubmit = useCallback(async (formattedText: string) => {
    setPendingStructured(null)

    setConversation((prev) => [
      ...prev,
      { role: 'user', content: formattedText, timestamp: new Date().toISOString() },
    ])

    await streamChat(formattedText)
  }, [streamChat])

  async function handleFinalize() {
    setIsFinalizing(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/finalize`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        onFinalized()
      } else {
        setError(data.error)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setIsFinalizing(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      <div className="glass rounded-t-xl p-4 border-b border-white/10">
        <h2 className="font-semibold text-white">{projectName}</h2>
        <p className="text-sm text-gray-400 mt-1">
          대화를 통해 리서치 범위를 설정합니다. 충분히 구체화되면 &quot;설정 완료&quot;를 누르세요.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-900/50 p-4 space-y-4">
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 text-sm text-indigo-300">
          <span className="font-medium">리서치 주제:</span> {initialPrompt}
        </div>

        {conversation.map((turn, i) => (
          <div
            key={i}
            className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
                turn.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'glass text-gray-200'
              }`}
            >
              {turn.content}
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] glass rounded-lg p-3 text-sm text-gray-200 whitespace-pre-wrap">
              {streamingText}
              <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-text-bottom" />
            </div>
          </div>
        )}

        {isLoading && !streamingText && (
          <div className="flex justify-start">
            <div className="glass rounded-lg p-3 text-sm text-gray-400">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        {pendingStructured && !isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[90%] space-y-3">
              {pendingStructured.suggestions && pendingStructured.suggestions.length > 0 && (
                <div className="glass rounded-lg p-4">
                  <SuggestionBubbles
                    suggestions={pendingStructured.suggestions}
                    onSend={handleStructuredSubmit}
                    disabled={isLoading}
                  />
                </div>
              )}
              <div className="glass rounded-lg p-4">
                <StructuredForm
                  data={pendingStructured}
                  onSubmit={handleStructuredSubmit}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="bg-red-500/10 border-t border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="glass rounded-b-xl p-4 border-t border-white/10">
        {pendingStructured ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {pendingStructured.suggestions && pendingStructured.suggestions.length > 0
                ? '빠른 시나리오를 선택하거나 아래 폼에서 직접 답변해주세요'
                : '위 폼에서 답변을 선택해주세요'}
            </p>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={isLoading || isFinalizing || conversation.length < 2}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap transition-colors"
            >
              {isFinalizing ? '설정 생성 중...' : '설정 완료'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="답변을 입력하세요..."
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-white placeholder-gray-500"
              disabled={isLoading || isFinalizing}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || isFinalizing}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
            >
              전송
            </button>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={isLoading || isFinalizing || conversation.length < 2}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap transition-colors"
            >
              {isFinalizing ? '설정 생성 중...' : '설정 완료'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
