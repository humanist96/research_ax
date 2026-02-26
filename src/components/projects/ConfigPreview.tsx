import type { ProjectConfig } from '@/types'

interface ConfigPreviewProps {
  readonly config: ProjectConfig
}

export function ConfigPreview({ config }: ConfigPreviewProps) {
  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-white">리서치 설정</h3>

      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">리포트 제목</h4>
        <p className="text-sm text-gray-400">{config.reportTitle}</p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">핵심 키워드</h4>
        <div className="flex flex-wrap gap-1">
          {config.keywords.primary.map((kw) => (
            <span key={kw} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
              {kw}
            </span>
          ))}
        </div>
      </div>

      {config.keywords.secondary.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">보조 키워드</h4>
          <div className="flex flex-wrap gap-1">
            {config.keywords.secondary.map((kw) => (
              <span key={kw} className="text-xs bg-gray-500/20 text-gray-300 px-2 py-1 rounded">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {config.keywords.entities.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">주요 엔터티</h4>
          <div className="flex flex-wrap gap-1">
            {config.keywords.entities.map((ent) => (
              <span key={ent} className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                {ent}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">분석 카테고리</h4>
        <div className="space-y-1">
          {config.categories.map((cat) => (
            <div key={cat.id} className="text-sm">
              <span className="font-medium text-gray-300">{cat.label}</span>
              <span className="text-gray-500 ml-2">- {cat.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">검색 쿼리</h4>
        <div className="flex flex-wrap gap-1">
          {config.searchQueries.map((q) => (
            <span key={q} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
              {q}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">RSS 소스</h4>
        <p className="text-sm text-gray-500">{config.rssSources.length}개 RSS 피드</p>
      </div>
    </div>
  )
}
