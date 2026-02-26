'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { ResearchProject } from '@/types'
import { ChatInterface } from '@/components/projects/ChatInterface'
import { PageSkeleton } from '@/components/ui/Skeleton'

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
    return <PageSkeleton />
  }

  if (error || !project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12 text-red-400">
          <p>{error ?? 'Project not found'}</p>
          <a href="/projects" className="text-indigo-400 hover:underline text-sm mt-2 inline-block">
            워크스페이스로 돌아가기
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ChatInterface
        projectId={id}
        projectName={project.name}
        initialPrompt={project.prompt}
        initialConversation={project.conversation}
        onFinalized={() => router.push(`/projects/${id}`)}
      />
    </div>
  )
}
