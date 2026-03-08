'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ArtifactType, NotebookArtifact, ProjectNotebookLM } from '@/types/notebooklm'

export interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly timestamp: string
}

interface ApiResponse<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
}

export function useNotebookLM(projectId: string) {
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const [artifacts, setArtifacts] = useState<readonly NotebookArtifact[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [chatMessages, setChatMessages] = useState<readonly ChatMessage[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  // Load saved state on mount
  useEffect(() => {
    mountedRef.current = true
    async function loadState() {
      try {
        const res = await fetch(`/api/projects/${projectId}/notebooklm`)
        const json = await res.json() as ApiResponse<ProjectNotebookLM | null> & { configured?: boolean }
        if (!mountedRef.current) return
        setIsConfigured(json.configured ?? false)
        if (json.success && json.data) {
          setNotebookId(json.data.notebookId)
          setArtifacts(json.data.artifacts)
        }
      } catch {
        if (mountedRef.current) setIsConfigured(false)
      }
    }
    loadState()
    return () => { mountedRef.current = false }
  }, [projectId])

  // Auto-poll for pending/processing artifacts
  useEffect(() => {
    const pendingArtifacts = artifacts.filter(
      (a) => a.status === 'pending' || a.status === 'processing'
    )

    if (pendingArtifacts.length === 0) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    if (pollTimerRef.current) return // Already polling

    pollTimerRef.current = setInterval(async () => {
      for (const artifact of pendingArtifacts) {
        if (!artifact.taskId || !mountedRef.current) continue
        try {
          const res = await fetch(
            `/api/projects/${projectId}/notebooklm/tasks/${artifact.taskId}`
          )
          const json = await res.json() as ApiResponse<{
            taskId: string
            status: string
            error?: string
          }>
          if (json.success && json.data && mountedRef.current) {
            const newStatus = json.data.status as NotebookArtifact['status']
            if (newStatus !== artifact.status) {
              setArtifacts((prev) =>
                prev.map((a) =>
                  a.taskId === artifact.taskId
                    ? {
                        ...a,
                        status: newStatus,
                        completedAt: newStatus === 'complete' ? new Date().toISOString() : a.completedAt,
                        error: newStatus === 'error' ? json.data!.error : undefined,
                      }
                    : a
                )
              )
            }
          }
        } catch {
          // Ignore poll errors
        }
      }
    }, 5000)

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [artifacts, projectId])

  const createNotebook = useCallback(async () => {
    setIsCreating(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/notebooklm`, {
        method: 'POST',
      })
      const json = await res.json() as ApiResponse<ProjectNotebookLM>
      if (json.success && json.data) {
        setNotebookId(json.data.notebookId)
        setArtifacts(json.data.artifacts)
      } else {
        setError(json.error ?? 'Failed to create notebook')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsCreating(false)
    }
  }, [projectId])

  const generateArtifact = useCallback(async (type: ArtifactType, options?: Record<string, unknown>) => {
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/notebooklm/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, options: options ?? {} }),
      })
      const json = await res.json() as ApiResponse<{
        taskId: string
        artifact: NotebookArtifact
      }>
      if (json.success && json.data) {
        setArtifacts((prev) => {
          const existingIdx = prev.findIndex((a) => a.type === type)
          if (existingIdx >= 0) {
            return prev.map((a, i) => i === existingIdx ? json.data!.artifact : a)
          }
          return [...prev, json.data!.artifact]
        })
      } else {
        setError(json.error ?? 'Failed to generate artifact')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [projectId])

  const downloadArtifact = useCallback((type: ArtifactType) => {
    window.open(`/api/projects/${projectId}/notebooklm/artifacts/${type}`, '_blank')
  }, [projectId])

  const sendChat = useCallback(async (question: string) => {
    const userMessage: ChatMessage = {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    }
    setChatMessages((prev) => [...prev, userMessage])
    setIsChatLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/notebooklm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const json = await res.json() as ApiResponse<{ answer: string }>
      if (json.success && json.data) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: json.data.answer,
          timestamp: new Date().toISOString(),
        }
        setChatMessages((prev) => [...prev, assistantMessage])
      } else {
        setError(json.error ?? 'Chat failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsChatLoading(false)
    }
  }, [projectId])

  const getArtifact = useCallback((type: ArtifactType): NotebookArtifact | undefined => {
    return artifacts.find((a) => a.type === type)
  }, [artifacts])

  return {
    notebookId,
    artifacts,
    isCreating,
    isConfigured,
    error,
    chatMessages,
    isChatLoading,
    createNotebook,
    generateArtifact,
    downloadArtifact,
    sendChat,
    getArtifact,
  }
}
