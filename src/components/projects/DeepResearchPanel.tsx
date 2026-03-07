'use client'

import { useState, useCallback } from 'react'
import type { ProjectStatus } from '@/types'
import type { ReportOutline } from '@/lib/deep-research/types'
import { useDeepResearch, type ResearchPhase, type SectionStepStatus, type SectionState } from '@/hooks/useDeepResearch'
import { OutlineEditor } from './OutlineEditor'
import type { ResearchOptions } from './OutlineEditor'

interface DeepResearchPanelProps {
  readonly projectId: string
  readonly status: ProjectStatus
  readonly onStatusChange: (status: ProjectStatus) => void
}

const PHASE_STEPS = [
  { key: 'generating_outline' as const, label: '목차 생성' },
  { key: 'editing_outline' as const, label: '목차 편집' },
  { key: 'searching' as const, label: '기사 검색' },
  { key: 'analyzing' as const, label: '섹션 분석' },
  { key: 'compiling' as const, label: '보고서 작성' },
]

function getPhaseIndex(phase: ResearchPhase): number {
  const map: Record<ResearchPhase, number> = {
    idle: -1,
    generating_outline: 0,
    editing_outline: 1,
    searching: 2,
    analyzing: 3,
    compiling: 4,
    complete: 5,
    error: -1,
  }
  return map[phase]
}

function getStepStatus(stepIdx: number, currentPhaseIdx: number, phase: ResearchPhase): 'done' | 'active' | 'pending' {
  if (phase === 'complete') return 'done'
  if (stepIdx < currentPhaseIdx) return 'done'
  if (stepIdx === currentPhaseIdx) return 'active'
  return 'pending'
}

function getSectionStatusLabel(status: SectionStepStatus): string {
  const labels: Record<SectionStepStatus, string> = {
    pending: '대기',
    searching: '검색 중...',
    analyzing: '분석 중...',
    refining: '정제 중...',
    complete: '완료',
    error: '오류',
  }
  return labels[status]
}

function getSectionStatusColor(status: SectionStepStatus): string {
  const colors: Record<SectionStepStatus, string> = {
    pending: 'text-gray-500',
    searching: 'text-blue-400',
    analyzing: 'text-amber-400',
    refining: 'text-purple-400',
    complete: 'text-green-400',
    error: 'text-red-400',
  }
  return colors[status]
}

function getSectionStatusIcon(status: SectionStepStatus): string {
  const icons: Record<SectionStepStatus, string> = {
    pending: '\u25CB',
    searching: '\u25D4',
    analyzing: '\u25D1',
    refining: '\u25D5',
    complete: '\u25CF',
    error: '\u2715',
  }
  return icons[status]
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}\uCD08`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}\uBD84 ${secs}\uCD08` : `${mins}\uBD84`
}

function SectionCard({
  section,
  isExpanded,
  onToggleExpand,
  onRetry,
}: {
  readonly section: SectionState
  readonly isExpanded: boolean
  readonly onToggleExpand: () => void
  readonly onRetry: () => void
}) {
  const hasPreview = section.status === 'complete' && section.result?.content

  return (
    <div
      className={`rounded-lg border transition-all ${
        section.status === 'complete'
          ? 'border-green-500/20 bg-green-500/5'
          : section.status === 'error'
          ? 'border-red-500/20 bg-red-500/5'
          : section.status === 'analyzing' || section.status === 'searching' || section.status === 'refining'
          ? 'border-blue-500/20 bg-blue-500/5'
          : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-base shrink-0 ${getSectionStatusColor(section.status)}`}>
            {getSectionStatusIcon(section.status)}
          </span>
          <div className="min-w-0">
            <span className="text-sm text-gray-200 font-medium block truncate">{section.title}</span>
            {section.status === 'error' && section.error && (
              <span className="text-xs text-red-400 block truncate">{section.error}</span>
            )}
            {section.retryCount !== undefined && section.retryCount > 0 && section.status !== 'complete' && (
              <span className="text-xs text-gray-500 block">{section.retryCount}회 재시도</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-medium ${getSectionStatusColor(section.status)}`}>
            {section.status === 'searching' || section.status === 'analyzing' || section.status === 'refining' ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {getSectionStatusLabel(section.status)}
              </span>
            ) : (
              getSectionStatusLabel(section.status)
            )}
          </span>
          {section.sourcesFound !== undefined && section.sourcesFound > 0 && (
            <span className="text-gray-500 text-xs tabular-nums">{section.sourcesFound}건</span>
          )}
          {hasPreview && (
            <button
              onClick={onToggleExpand}
              className="px-2 py-1 text-xs text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/10 transition-all"
            >
              {isExpanded ? '접기' : '미리보기'}
            </button>
          )}
          {section.status === 'error' && (
            <button
              onClick={onRetry}
              className="px-2 py-1 text-xs text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/10 transition-all"
            >
              재시도
            </button>
          )}
        </div>
      </div>

      {/* Expandable preview */}
      {isExpanded && hasPreview && (
        <div className="px-4 pb-4 border-t border-white/5">
          <div className="mt-3 max-h-64 overflow-y-auto text-sm text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(section.result!.content.slice(0, 2000)) }} />
            {section.result!.content.length > 2000 && (
              <p className="text-xs text-gray-500 mt-2 italic">... (전체 내용은 보고서에서 확인)</p>
            )}
          </div>
          {section.result!.sources && section.result!.sources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <span className="text-xs text-gray-500">{section.result!.sources.length}개 출처</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 class="text-gray-200 font-medium mt-3 mb-1">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-200">$1</strong>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>')
    .replace(/^/, '<p class="mb-2">')
    .replace(/$/, '</p>')
}

export function DeepResearchPanel({ projectId, status, onStatusChange }: DeepResearchPanelProps) {
  const research = useDeepResearch(projectId)
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null)

  const isRunning = research.phase !== 'idle' && research.phase !== 'complete' && research.phase !== 'error' && research.phase !== 'editing_outline'
  const isDisabled = isRunning || research.phase === 'editing_outline' || status === 'researching' || status === 'collecting' || status === 'analyzing' || status === 'reporting'

  const handleStartResearch = useCallback((editedOutline: ReportOutline, options?: ResearchOptions) => {
    research.startResearch(editedOutline, options?.keywordBlacklist)
  }, [research])

  const handleToggleExpand = useCallback((sectionId: string) => {
    setExpandedSectionId((prev) => (prev === sectionId ? null : sectionId))
  }, [])

  const handleCopyShareLink = useCallback(() => {
    if (!research.reportId) return
    const url = `${window.location.origin}/projects/${projectId}/reports/${research.reportId}`
    navigator.clipboard.writeText(url).catch(() => {})
  }, [projectId, research.reportId])

  const handleDownloadMd = useCallback(async () => {
    if (!research.reportId) return
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${research.reportId}/download?format=md`)
      if (!res.ok) return
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${research.reportId}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
  }, [projectId, research.reportId])

  // Sync status changes
  if (research.phase === 'complete' && status !== 'complete') {
    onStatusChange('complete')
  }

  const currentPhaseIdx = getPhaseIndex(research.phase)
  const progressPercent = research.totalCount > 0
    ? Math.round((research.completedCount / research.totalCount) * 100)
    : 0

  return (
    <div className="glass rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">딥 리서치</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            AI가 주제를 심층 분석하여 종합 보고서를 생성합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={research.abort}
              className="px-3 py-2 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all"
            >
              중단
            </button>
          )}
          <button
            onClick={research.phase === 'error' || research.phase === 'complete' ? research.reset : research.generateOutline}
            disabled={isDisabled}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
          >
            {research.phase === 'error' || research.phase === 'complete' ? '새 리서치' : isRunning ? '리서치 중...' : '딥 리서치 실행'}
          </button>
        </div>
      </div>

      {research.phase !== 'idle' && (
        <>
          {/* Phase Progress Bar */}
          <div className="flex items-center gap-1.5 mb-4">
            {PHASE_STEPS.map((step, i) => {
              const stepStatus = getStepStatus(i, currentPhaseIdx, research.phase)
              return (
                <div key={step.key} className="flex items-center gap-1.5 flex-1">
                  <div className={`flex items-center gap-1.5 flex-1 px-2.5 py-2 rounded-lg text-xs transition-all ${
                    stepStatus === 'done'
                      ? 'bg-green-500/10 text-green-400'
                      : stepStatus === 'active'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-white/5 text-gray-500'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      stepStatus === 'done'
                        ? 'bg-green-500 text-white'
                        : stepStatus === 'active'
                        ? 'bg-blue-500 text-white animate-pulse'
                        : 'bg-white/10 text-gray-500'
                    }`}>
                      {stepStatus === 'done' ? '\u2713' : i + 1}
                    </span>
                    <span className="font-medium truncate">{step.label}</span>
                  </div>
                  {i < PHASE_STEPS.length - 1 && (
                    <span className="text-gray-600 shrink-0">&rarr;</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Outline Generation */}
          {research.phase === 'generating_outline' && (
            <div className="flex items-center gap-3 py-8 justify-center text-gray-400 text-sm">
              <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              목차를 생성하고 있습니다...
            </div>
          )}

          {/* Outline Editor */}
          {research.phase === 'editing_outline' && research.outline && (
            <OutlineEditor
              projectId={projectId}
              outline={research.outline}
              onStartResearch={handleStartResearch}
              onRegenerate={research.regenerateOutline}
              isRegenerating={research.isRegeneratingOutline}
            />
          )}

          {/* Progress Summary Bar */}
          {research.sections.length > 0 && research.phase !== 'editing_outline' && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-300 font-medium">
                  {research.completedCount}/{research.totalCount} 섹션 완료
                  {research.failedCount > 0 && ` (${research.failedCount}개 오류)`}
                  {research.phase === 'searching' && ' \u2014 검색 단계'}
                  {research.phase === 'analyzing' && ' \u2014 분석 단계'}
                  {research.phase === 'compiling' && ' \u2014 보고서 작성 중'}
                </span>
                {research.estimatedTimeLeft !== null && (
                  <span className="text-xs text-gray-500">
                    약 {formatTime(research.estimatedTimeLeft)} 남음
                  </span>
                )}
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(progressPercent, research.phase === 'compiling' ? 90 : 0)}%` }}
                />
              </div>
            </div>
          )}

          {/* Section Cards */}
          {research.sections.length > 0 && research.phase !== 'editing_outline' && (
            <div className="space-y-1.5">
              {research.sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  isExpanded={expandedSectionId === section.id}
                  onToggleExpand={() => handleToggleExpand(section.id)}
                  onRetry={() => research.retrySection(section.id)}
                />
              ))}
            </div>
          )}

          {/* Failed sections action bar */}
          {research.failedCount > 0 && (research.phase === 'analyzing' || research.phase === 'error') && research.completedCount > 0 && (
            <div className="mt-3 flex items-center justify-between p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <span className="text-sm text-amber-400">
                {research.failedCount}개 섹션 실패
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={research.retryAllFailed}
                  className="px-3 py-1.5 text-xs text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-all"
                >
                  전체 재시도
                </button>
                <button
                  onClick={research.skipFailedAndCompile}
                  className="px-3 py-1.5 text-xs text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 transition-all"
                >
                  실패 건너뛰고 보고서 생성
                </button>
              </div>
            </div>
          )}

          {/* Compiling indicator */}
          {research.phase === 'compiling' && (
            <div className="mt-3 flex items-center gap-3 py-4 justify-center text-gray-400 text-sm">
              <span className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              핵심 요약과 결론을 생성하고 있습니다...
            </div>
          )}

          {/* Completion Card */}
          {research.phase === 'complete' && research.reportId && (
            <div className="mt-4 p-5 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-400 font-medium">딥 리서치가 완료되었습니다</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {research.completedCount}개 섹션 · {research.sections.reduce((sum, s) => sum + (s.sourcesFound ?? 0), 0)}건 소스
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyShareLink}
                    className="px-3 py-2 text-xs text-gray-400 border border-white/10 rounded-lg hover:text-white hover:border-white/20 transition-all"
                    title="공유 링크 복사"
                  >
                    링크 복사
                  </button>
                  <button
                    onClick={handleDownloadMd}
                    className="px-3 py-2 text-xs text-gray-400 border border-white/10 rounded-lg hover:text-white hover:border-white/20 transition-all"
                    title="마크다운 다운로드"
                  >
                    MD 다운로드
                  </button>
                  <a
                    href={`/projects/${projectId}/reports/${research.reportId}`}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    보고서 보기
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {research.error && research.phase === 'error' && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{research.error}</p>
              <div className="mt-2 flex items-center gap-2">
                {research.failedCount > 0 && research.completedCount > 0 && (
                  <button
                    onClick={research.skipFailedAndCompile}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    완료된 {research.completedCount}개 섹션으로 보고서 생성
                  </button>
                )}
                <button
                  onClick={research.reset}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  처음부터 다시 시작
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
