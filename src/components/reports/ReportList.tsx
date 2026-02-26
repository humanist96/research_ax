'use client'

import { useState } from 'react'
import type { ReportMeta } from '@/types'
import { MarkdownRenderer } from './MarkdownRenderer'

interface ReportListProps {
  readonly projectId: string
  readonly reports: readonly ReportMeta[]
  readonly reportContents: Record<string, string>
  readonly categoryLabels?: Record<string, string>
}

export function ReportList({ projectId, reports, reportContents, categoryLabels = {} }: ReportListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg mb-2">생성된 리포트가 없습니다</p>
        <p className="text-sm">파이프라인을 실행하여 리포트를 생성해주세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => {
        const isDeepResearch = report.type === 'deep-research'
        const isExpanded = expandedId === report.id
        const content = reportContents[report.id]

        return (
          <div key={report.id} className="glass rounded-xl overflow-hidden">
            {isDeepResearch ? (
              <a
                href={`/projects/${projectId}/reports/${report.id}`}
                className="block w-full text-left p-6 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{report.title}</h3>
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                        딥 리서치
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {report.generatedAt?.split('T')[0] ?? report.startDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-indigo-400">{report.totalArticles}</div>
                      <div className="text-xs text-gray-500">소스</div>
                    </div>
                    <span className="text-gray-500 text-xl">&rarr;</span>
                  </div>
                </div>
                {report.sectionLabels && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(report.sectionLabels).map(([id, label]) => (
                      <span
                        key={id}
                        className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            ) : (
              <>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  className="w-full text-left p-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{report.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {report.startDate} ~ {report.endDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-400">{report.totalArticles}</div>
                        <div className="text-xs text-gray-500">기사</div>
                      </div>
                      <span className="text-gray-500 text-xl">
                        {isExpanded ? '\u25B2' : '\u25BC'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(report.categoryBreakdown)
                      .filter(([, count]) => count > 0)
                      .map(([cat, count]) => (
                        <span
                          key={cat}
                          className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded"
                        >
                          {categoryLabels[cat] ?? cat} ({count})
                        </span>
                      ))}
                  </div>
                </button>

                {isExpanded && content && (
                  <div className="border-t border-white/10 p-6">
                    <MarkdownRenderer content={content} />
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
