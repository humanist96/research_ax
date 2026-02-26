'use client'

import { useState, useCallback } from 'react'
import type { ProjectStatus } from '@/types'
import type { ReportOutline, DeepResearchEvent } from '@/lib/deep-research/types'

interface DeepResearchPanelProps {
  readonly projectId: string
  readonly status: ProjectStatus
  readonly onStatusChange: (status: ProjectStatus) => void
}

type Phase = 'idle' | 'outline' | 'researching' | 'compiling' | 'pdf' | 'complete' | 'error'

interface SectionState {
  readonly id: string
  readonly title: string
  readonly status: 'pending' | 'searching' | 'analyzing' | 'complete' | 'error'
  readonly sourcesFound?: number
  readonly message: string
}

const PHASE_STEPS = [
  { key: 'outline' as const, label: '목차 생성' },
  { key: 'researching' as const, label: '섹션 리서치' },
  { key: 'compiling' as const, label: '보고서 작성' },
  { key: 'pdf' as const, label: 'PDF 생성' },
]

function getPhaseIndex(phase: Phase): number {
  const map: Record<Phase, number> = {
    idle: -1,
    outline: 0,
    researching: 1,
    compiling: 2,
    pdf: 3,
    complete: 4,
    error: -1,
  }
  return map[phase]
}

function getStepStatus(stepIdx: number, currentPhaseIdx: number, phase: Phase): 'done' | 'active' | 'pending' {
  if (phase === 'complete') return 'done'
  if (stepIdx < currentPhaseIdx) return 'done'
  if (stepIdx === currentPhaseIdx) return 'active'
  return 'pending'
}

function getSectionStatusLabel(status: SectionState['status']): string {
  const labels: Record<SectionState['status'], string> = {
    pending: '대기',
    searching: '검색 중...',
    analyzing: '분석 중...',
    complete: '완료',
    error: '오류',
  }
  return labels[status]
}

function getSectionStatusColor(status: SectionState['status']): string {
  const colors: Record<SectionState['status'], string> = {
    pending: 'text-gray-400',
    searching: 'text-blue-600',
    analyzing: 'text-amber-600',
    complete: 'text-green-600',
    error: 'text-red-600',
  }
  return colors[status]
}

export function DeepResearchPanel({ projectId, status, onStatusChange }: DeepResearchPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [sections, setSections] = useState<SectionState[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)

  const isRunning = phase !== 'idle' && phase !== 'complete' && phase !== 'error'
  const isDisabled = isRunning || status === 'researching' || status === 'collecting' || status === 'analyzing' || status === 'reporting'

  const startResearch = useCallback(async () => {
    setPhase('outline')
    setError(null)
    setSections([])
    setReportId(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/deep-research`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)

          try {
            const event: DeepResearchEvent = JSON.parse(jsonStr)

            if (event.type === 'phase') {
              setPhase(event.phase as Phase)
              if (event.phase === 'complete') {
                onStatusChange('complete')
              } else if (event.phase === 'error') {
                setError(event.message)
                onStatusChange('error')
              }
            } else if (event.type === 'outline') {
              const initialSections: SectionState[] = event.outline.sections.map((s) => ({
                id: s.id,
                title: s.title,
                status: 'pending',
                message: '대기',
              }))
              setSections(initialSections)
            } else if (event.type === 'section_status') {
              setSections((prev) =>
                prev.map((s) =>
                  s.id === event.sectionId
                    ? { ...s, status: event.status, sourcesFound: event.sourcesFound ?? s.sourcesFound, message: event.message }
                    : s,
                ),
              )
            } else if (event.type === 'report_complete') {
              setReportId(event.reportId)
            } else if (event.type === 'error') {
              setError(event.message)
            }
          } catch {
            // partial JSON, skip
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setPhase('error')
      onStatusChange('error')
    }
  }, [projectId, onStatusChange])

  const currentPhaseIdx = getPhaseIndex(phase)
  const completedSections = sections.filter((s) => s.status === 'complete').length

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">딥 리서치</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            AI가 주제를 심층 분석하여 종합 보고서를 생성합니다
          </p>
        </div>
        <button
          onClick={startResearch}
          disabled={isDisabled}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {isRunning ? '리서치 중...' : '딥 리서치 실행'}
        </button>
      </div>

      {phase !== 'idle' && (
        <>
          {/* 3-step progress bar */}
          <div className="flex items-center gap-2 mb-4">
            {PHASE_STEPS.map((step, i) => {
              const stepStatus = getStepStatus(i, currentPhaseIdx, phase)
              return (
                <div key={step.key} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-2 flex-1 p-3 rounded-lg text-sm ${
                    stepStatus === 'done'
                      ? 'bg-green-50 text-green-700'
                      : stepStatus === 'active'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'bg-gray-50 text-gray-400'
                  }`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      stepStatus === 'done'
                        ? 'bg-green-500 text-white'
                        : stepStatus === 'active'
                        ? 'bg-indigo-500 text-white animate-pulse'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {stepStatus === 'done' ? '\u2713' : i + 1}
                    </span>
                    <span className="font-medium">{step.label}</span>
                  </div>
                  {i < PHASE_STEPS.length - 1 && (
                    <span className="text-gray-300">&rarr;</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Section status list */}
          {sections.length > 0 && (
            <div className="border rounded-lg divide-y">
              {sections.map((section) => (
                <div key={section.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-gray-800 font-medium">{section.title}</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${getSectionStatusColor(section.status)}`}>
                      {section.status === 'searching' || section.status === 'analyzing' ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                          {getSectionStatusLabel(section.status)}
                        </span>
                      ) : (
                        getSectionStatusLabel(section.status)
                      )}
                    </span>
                    {section.sourcesFound !== undefined && section.sourcesFound > 0 && (
                      <span className="text-gray-400 text-xs">{section.sourcesFound}건</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {sections.length > 0 && (
            <p className="mt-3 text-sm text-gray-500">
              {completedSections}/{sections.length} 섹션 완료
            </p>
          )}

          {/* Complete message */}
          {phase === 'complete' && reportId && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg text-sm text-green-700 flex items-center justify-between">
              <span>딥 리서치가 완료되었습니다.</span>
              <a
                href={`/projects/${projectId}/reports/${reportId}`}
                className="font-medium bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
              >
                보고서 보기
              </a>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </>
      )}
    </div>
  )
}
