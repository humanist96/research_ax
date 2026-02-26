import { CreateProjectForm } from '@/components/projects/CreateProjectForm'
import { ProjectList } from '@/components/projects/ProjectList'

export default function WorkspacePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">워크스페이스</h1>
        <p className="text-gray-400 mt-1">
          리서치 주제를 입력하면 대화를 통해 범위를 설정하고, 자동으로 뉴스를 수집/분석하여 보고서를 생성합니다.
        </p>
      </div>

      <CreateProjectForm />

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">프로젝트 목록</h2>
        <ProjectList />
      </div>
    </div>
  )
}
