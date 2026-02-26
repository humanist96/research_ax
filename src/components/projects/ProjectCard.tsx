import type { ResearchProject } from '@/types'

interface ProjectCardProps {
  readonly project: ResearchProject
}

const STATUS_LABELS: Record<string, string> = {
  conversation: '대화 설정 중',
  configuring: '설정 생성 중',
  ready: '실행 대기',
  collecting: '뉴스 수집 중',
  analyzing: '분석 중',
  reporting: '리포트 생성 중',
  complete: '완료',
  error: '오류',
}

const STATUS_COLORS: Record<string, string> = {
  conversation: 'bg-yellow-100 text-yellow-800',
  configuring: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-blue-100 text-blue-800',
  collecting: 'bg-purple-100 text-purple-800',
  analyzing: 'bg-purple-100 text-purple-800',
  reporting: 'bg-purple-100 text-purple-800',
  complete: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
}

export function ProjectCard({ project }: ProjectCardProps) {
  const statusLabel = STATUS_LABELS[project.status] ?? project.status
  const statusColor = STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-800'
  const isActive = ['collecting', 'analyzing', 'reporting', 'configuring'].includes(project.status)

  const href = project.status === 'conversation'
    ? `/projects/${project.id}/chat`
    : `/projects/${project.id}`

  return (
    <a href={href} className="block">
      <div className="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.prompt}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${statusColor}`}>
            {isActive && (
              <span className="inline-block w-2 h-2 rounded-full bg-current mr-1 animate-pulse" />
            )}
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span>생성: {new Date(project.createdAt).toLocaleDateString('ko-KR')}</span>
          <span>수정: {new Date(project.updatedAt).toLocaleDateString('ko-KR')}</span>
          {project.config && (
            <span>{project.config.categories.length}개 카테고리</span>
          )}
        </div>
      </div>
    </a>
  )
}
