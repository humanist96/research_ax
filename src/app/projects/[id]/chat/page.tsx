'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { ResearchProject } from '@/types'
import { ChatInterface } from '@/components/projects/ChatInterface'

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [project, setProject] = useState<ResearchProject | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProject() {
      try {
        const res = await fetch(`/api/projects/${id}`)
        const data = await res.json()
        if (data.success) {
          setProject(data.data)
          if (data.data.status !== 'conversation') {
            router.push(`/projects/${id}`)
          }
        } else {
          setError(data.error)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
      } finally {
        setIsLoading(false)
      }
    }
    loadProject()
  }, [id, router])

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>프로젝트를 불러오는 중...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error ?? 'Project not found'}</p>
        <a href="/" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          홈으로 돌아가기
        </a>
      </div>
    )
  }

  return (
    <ChatInterface
      projectId={id}
      projectName={project.name}
      initialPrompt={project.prompt}
      initialConversation={project.conversation}
      onFinalized={() => router.push(`/projects/${id}`)}
    />
  )
}
