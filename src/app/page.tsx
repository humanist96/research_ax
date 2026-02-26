import { CreateProjectForm } from '@/components/projects/CreateProjectForm'
import { ProjectList } from '@/components/projects/ProjectList'

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Koscom AI Report</h1>
        <p className="text-gray-500 mt-1">
          리서치 주제를 입력하면 대화를 통해 범위를 설정하고, 자동으로 뉴스를 수집/분석하여 보고서를 생성합니다.
        </p>
      </div>

      <CreateProjectForm />

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">프로젝트 목록</h2>
        <ProjectList />
      </div>
    </div>
  )
}
