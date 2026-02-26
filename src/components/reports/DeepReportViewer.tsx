'use client'

import { useState } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'
import type { DeepReportMeta } from '@/lib/deep-research/types'

interface SectionData {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly sourcesCount: number
  readonly status: 'complete' | 'error'
}

interface DeepReportViewerProps {
  readonly projectId: string
  readonly reportId: string
  readonly meta: DeepReportMeta
  readonly sections: readonly SectionData[]
  readonly mergedContent?: string
}

export function DeepReportViewer({ projectId, reportId, meta, sections, mergedContent }: DeepReportViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.id ?? null)
  const [showAll, setShowAll] = useState(false)

  const selectedSection = sections.find((s) => s.id === selectedId)
  const currentIndex = sections.findIndex((s) => s.id === selectedId)

  function handlePrev() {
    if (currentIndex > 0) {
      setSelectedId(sections[currentIndex - 1].id)
      setShowAll(false)
    }
  }

  function handleNext() {
    if (currentIndex < sections.length - 1) {
      setSelectedId(sections[currentIndex + 1].id)
      setShowAll(false)
    }
  }

  function handleSelectSection(id: string) {
    setSelectedId(id)
    setShowAll(false)
  }

  function handleShowAll() {
    setShowAll(true)
    setSelectedId(null)
  }

  const downloadUrl = (format: 'md' | 'pdf') =>
    `/api/projects/${projectId}/reports/${reportId}/download?format=${format}`

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{meta.title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta.generatedAt.split('T')[0]} · {meta.totalSources}건 소스 · {meta.sections.length}개 섹션
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={downloadUrl('md')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <DownloadIcon />
            MD
          </a>
          <a
            href={downloadUrl('pdf')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
          >
            <DownloadIcon />
            PDF
          </a>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex min-h-[600px]">
        {/* Sidebar TOC */}
        <nav className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">목차</p>
          <ul className="space-y-1">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => handleSelectSection(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    !showAll && selectedId === s.id
                      ? 'bg-indigo-100 text-indigo-800 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      s.status === 'complete' ? 'bg-green-500' : 'bg-red-400'
                    }`} />
                    <span className="truncate">{s.title}</span>
                  </span>
                  {s.sourcesCount > 0 && (
                    <span className="text-xs text-gray-400 ml-5">{s.sourcesCount}건</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleShowAll}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                showAll
                  ? 'bg-indigo-100 text-indigo-800 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              전체 보기
            </button>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {showAll && mergedContent ? (
            <MarkdownRenderer content={mergedContent} />
          ) : selectedSection ? (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedSection.title}</h2>
              <MarkdownRenderer content={selectedSection.content} />
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              섹션을 선택해주세요
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      {!showAll && selectedSection && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handlePrev}
            disabled={currentIndex <= 0}
            className="text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            &larr; 이전 섹션
          </button>
          <span className="text-xs text-gray-400">
            {currentIndex + 1} / {sections.length}
          </span>
          <button
            onClick={handleNext}
            disabled={currentIndex >= sections.length - 1}
            className="text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            다음 섹션 &rarr;
          </button>
        </div>
      )}
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
