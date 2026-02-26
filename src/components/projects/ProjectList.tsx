'use client'

import { useState, useEffect } from 'react'
import type { ResearchProject } from '@/types'
import { ProjectCard } from './ProjectCard'

export function ProjectList() {
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects')
        const data = await res.json()
        if (data.success) {
          setProjects(data.data)
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
    loadProjects()
  }, [])

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>프로젝트 목록을 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>{error}</p>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg mb-2">아직 프로젝트가 없습니다</p>
        <p className="text-sm">위 입력란에 리서치 주제를 입력하여 첫 프로젝트를 시작하세요.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
