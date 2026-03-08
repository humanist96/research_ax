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
  readonly configured?: boolean
}

export function useNotebookLM(projectId: string) {
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const [artifacts, setArtifacts] = useState<readonly NotebookArtifact[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [generatingType, setGeneratingType] = useState<ArtifactType | null>(null)
  const [chatMessages, setChatMessages] = useState<readonly ChatMessage[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const mountedRef = useRef(true)

  // Load saved state on mount
  useEffect(() => {
    mountedRef.current = true
    async function loadState() {
      try {
        const res = await fetch(`/api/projects/${projectId}/notebooklm`)
        const json = await res.json() as ApiResponse<ProjectNotebookLM | null>
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

  const createNotebook = useCallback(async () => {
    setIsCreating(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/notebooklm`, { method: 'POST' })
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
    setGeneratingType(type)

    // Optimistically set processing status
    setArtifacts((prev) => {
      const processingArtifact: NotebookArtifact = {
        type,
        status: 'processing',
        options: options ?? {},
        createdAt: new Date().toISOString(),
      }
      const idx = prev.findIndex((a) => a.type === type)
      if (idx >= 0) return prev.map((a, i) => i === idx ? processingArtifact : a)
      return [...prev, processingArtifact]
    })

    try {
      const res = await fetch(`/api/projects/${projectId}/notebooklm/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, options: options ?? {} }),
      })
      const json = await res.json() as ApiResponse<{ artifact: NotebookArtifact }>

      if (json.success && json.data) {
        setArtifacts((prev) =>
          prev.map((a) => a.type === type ? json.data!.artifact : a)
        )
      } else {
        setError(json.error ?? 'Generation failed')
        setArtifacts((prev) =>
          prev.map((a) => a.type === type ? { ...a, status: 'error' as const, error: json.error } : a)
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setArtifacts((prev) =>
        prev.map((a) => a.type === type ? { ...a, status: 'error' as const, error: msg } : a)
      )
    } finally {
      setGeneratingType(null)
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
        setChatMessages((prev) => [...prev, {
          role: 'assistant',
          content: json.data!.answer,
          timestamp: new Date().toISOString(),
        }])
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
    generatingType,
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
