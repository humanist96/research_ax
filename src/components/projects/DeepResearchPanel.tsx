'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ProjectStatus } from '@/types'
import type { DeepResearchEvent, ReportOutline, ArticlesForReview } from '@/lib/deep-research/types'
import { OutlineEditor } from './OutlineEditor'
import type { ResearchOptions } from './OutlineEditor'
import { ArticleReviewPanel } from './ArticleReviewPanel'

interface DeepResearchPanelProps {
  readonly projectId: string
  readonly status: ProjectStatus
  readonly onStatusChange: (status: ProjectStatus) => void
}

type Phase =
  | 'idle'
  | 'generating_outline'
  | 'editing_outline'
  | 'outline'
  | 'researching'
  | 'reviewing_articles'
  | 'compiling'
  | 'pdf'
  | 'complete'
  | 'error'

interface SectionState {
  readonly id: string
  readonly title: string
  readonly status: 'pending' | 'searching' | 'analyzing' | 'deepening' | 'refining' | 'complete' | 'error'
  readonly sourcesFound?: number
  readonly message: string
}

interface ProgressData {
  readonly active: boolean
  readonly reportId: string | null
  readonly phase: string | null
  readonly outline: ReportOutline | null
  readonly sections: readonly {
    readonly id: string
    readonly title: string
    readonly status: SectionState['status']
    readonly sourcesCount: number
  }[]
}

const PHASE_STEPS_DEFAULT = [
  { key: 'generating_outline' as const, label: '목차 생성' },
  { key: 'editing_outline' as const, label: '목차 편집' },
  { key: 'researching' as const, label: '섹션 리서치' },
  { key: 'compiling' as const, label: '보고서 작성' },
  { key: 'pdf' as const, label: 'PDF 생성' },
]

const PHASE_STEPS_WITH_REVIEW = [
  { key: 'generating_outline' as const, label: '목차 생성' },
  { key: 'editing_outline' as const, label: '목차 편집' },
  { key: 'researching' as const, label: '기사 검색' },
  { key: 'reviewing_articles' as const, label: '기사 리뷰' },
  { key: 'compiling' as const, label: '보고서 작성' },
  { key: 'pdf' as const, label: 'PDF 생성' },
]

const POLL_INTERVAL_MS = 3000

function getPhaseIndex(phase: Phase, hasReview: boolean): number {
  if (hasReview) {
    const map: Record<Phase, number> = {
      idle: -1,
      generating_outline: 0,
      editing_outline: 1,
      outline: 0,
      researching: 2,
      reviewing_articles: 3,
      compiling: 4,
      pdf: 5,
      complete: 6,
      error: -1,
    }
    return map[phase]
  }
  const map: Record<Phase, number> = {
    idle: -1,
    generating_outline: 0,
    editing_outline: 1,
    outline: 0,
    researching: 2,
    reviewing_articles: 2,
    compiling: 3,
    pdf: 4,
    complete: 5,
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
    deepening: '심화 검색 중...',
    refining: '품질 개선 중...',
    complete: '완료',
    error: '오류',
  }
  return labels[status]
}

function getSectionStatusColor(status: SectionState['status']): string {
  const colors: Record<SectionState['status'], string> = {
    pending: 'text-gray-500',
    searching: 'text-blue-400',
    analyzing: 'text-amber-400',
    deepening: 'text-cyan-400',
    refining: 'text-purple-400',
    complete: 'text-green-400',
    error: 'text-red-400',
  }
  return colors[status]
}

function mapProgressPhase(phase: string | null): Phase {
  if (!phase) return 'idle'
  const valid: Phase[] = ['outline', 'researching', 'reviewing_articles', 'compiling', 'pdf', 'complete', 'error']
  return valid.includes(phase as Phase) ? (phase as Phase) : 'researching'
}

export function DeepResearchPanel({ projectId, status, onStatusChange }: DeepResearchPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [sections, setSections] = useState<SectionState[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [outline, setOutline] = useState<ReportOutline | null>(null)
  const [isRegeneratingOutline, setIsRegeneratingOutline] = useState(false)
  const [articlesForReview, setArticlesForReview] = useState<readonly ArticlesForReview[] | null>(null)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [hasArticleReview, setHasArticleReview] = useState(false)
  const isStreamingRef = useRef(false)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasRestoredRef = useRef(false)

  const isRunning = phase !== 'idle' && phase !== 'complete' && phase !== 'error' && phase !== 'editing_outline' && phase !== 'reviewing_articles'
  const isDisabled = isRunning || phase === 'editing_outline' || phase === 'reviewing_articles' || status === 'researching' || status === 'collecting' || status === 'analyzing' || status === 'reporting'

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const applyProgress = useCallback((data: ProgressData) => {
    const mappedPhase = mapProgressPhase(data.phase)

    if (data.reportId) {
      setReportId(data.reportId)
    }

    if (data.outline) {
      setOutline(data.outline)
    }

    if (data.sections.length > 0) {
      setSections(data.sections.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        sourcesFound: s.sourcesCount > 0 ? s.sourcesCount : undefined,
        message: getSectionStatusLabel(s.status),
      })))
    }

    setPhase(mappedPhase)

    if (mappedPhase === 'complete') {
      onStatusChange('complete')
    } else if (mappedPhase === 'error') {
      onStatusChange('error')
    }
  }, [onStatusChange])

  const fetchProgress = useCallback(async (): Promise<ProgressData | null> => {
    try {
      const res = await fetch(`/api/projects/${projectId}/deep-research/progress`)
      const json = await res.json()
      if (json.success) return json.data as ProgressData
    } catch {
      // Network error — ignore and retry next poll
    }
    return null
  }, [projectId])

  const startPolling = useCallback(() => {
    stopPolling()
    pollTimerRef.current = setInterval(async () => {
      if (isStreamingRef.current) return

      const data = await fetchProgress()
      if (!data) return

      applyProgress(data)

      if (!data.active || data.phase === 'complete' || data.phase === 'error') {
        stopPolling()
      }
    }, POLL_INTERVAL_MS)
  }, [stopPolling, fetchProgress, applyProgress])

  // Restore progress on mount if project is in 'researching' status
  useEffect(() => {
    if (hasRestoredRef.current) return
    if (status !== 'researching') return

    hasRestoredRef.current = true

    ;(async () => {
      const data = await fetchProgress()
      if (!data) return

      applyProgress(data)

      if (data.active && data.phase !== 'complete' && data.phase !== 'error') {
        startPolling()
      }
    })()

    return () => {
      stopPolling()
    }
  }, [status, fetchProgress, applyProgress, startPolling, stopPolling])

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  const generateOutline = useCallback(async () => {
    setPhase('generating_outline')
    setError(null)
    setSections([])
    setReportId(null)
    setOutline(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/deep-research/outline`, {
        method: 'POST',
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      setOutline(data.data)
      setPhase('editing_outline')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setPhase('error')
    }
  }, [projectId])

  const regenerateFullOutline = useCallback(async () => {
    setIsRegeneratingOutline(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/deep-research/outline`, {
        method: 'POST',
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      setOutline(data.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setIsRegeneratingOutline(false)
    }
  }, [projectId])

  const startResearchWithOutline = useCallback(async (editedOutline: ReportOutline, options?: ResearchOptions) => {
    setPhase('researching')
    setError(null)
    setSections([])
    setReportId(null)
    setArticlesForReview(null)
    setHasArticleReview(options?.enableArticleReview ?? false)
    isStreamingRef.current = true

    try {
      const res = await fetch(`/api/projects/${projectId}/deep-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline: editedOutline,
          enableArticleReview: options?.enableArticleReview ?? false,
          keywordBlacklist: options?.keywordBlacklist ?? [],
        }),
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
              const mappedPhase = event.phase as Phase
              setPhase(mappedPhase)
              if (event.phase === 'complete') {
                onStatusChange('complete')
              } else if (event.phase === 'error') {
                setError(event.message)
                onStatusChange('error')
              }
            } else if (event.type === 'articles_ready') {
              setArticlesForReview(event.sections)
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
    } finally {
      isStreamingRef.current = false
    }
  }, [projectId, onStatusChange])

  const handleSubmitReview = useCallback(async (excludedBySection: Record<string, string[]>) => {
    setIsSubmittingReview(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/deep-research/review-articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedBySection }),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error ?? 'Failed to submit review')
      }
      setArticlesForReview(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setIsSubmittingReview(false)
    }
  }, [projectId])

  const phaseSteps = hasArticleReview ? PHASE_STEPS_WITH_REVIEW : PHASE_STEPS_DEFAULT
  const currentPhaseIdx = getPhaseIndex(phase, hasArticleReview)
  const completedSections = sections.filter((s) => s.status === 'complete').length

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">딥 리서치</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            AI가 주제를 심층 분석하여 종합 보고서를 생성합니다
          </p>
        </div>
        <button
          onClick={generateOutline}
          disabled={isDisabled}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
        >
          {isRunning ? '리서치 중...' : '딥 리서치 실행'}
        </button>
      </div>

      {phase !== 'idle' && (
        <>
          <div className="flex items-center gap-2 mb-4">
            {phaseSteps.map((step, i) => {
              const stepStatus = getStepStatus(i, currentPhaseIdx, phase)
              return (
                <div key={step.key} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-2 flex-1 p-2 rounded-lg text-xs ${
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
                  {i < phaseSteps.length - 1 && (
                    <span className="text-gray-600 shrink-0">&rarr;</span>
                  )}
                </div>
              )
            })}
          </div>

          {phase === 'generating_outline' && (
            <div className="flex items-center gap-3 py-8 justify-center text-gray-400 text-sm">
              <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              목차를 생성하고 있습니다...
            </div>
          )}

          {phase === 'editing_outline' && outline && (
            <OutlineEditor
              projectId={projectId}
              outline={outline}
              onStartResearch={startResearchWithOutline}
              onRegenerate={regenerateFullOutline}
              isRegenerating={isRegeneratingOutline}
            />
          )}

          {phase === 'reviewing_articles' && articlesForReview && (
            <ArticleReviewPanel
              projectId={projectId}
              sections={articlesForReview}
              onSubmit={handleSubmitReview}
              isSubmitting={isSubmittingReview}
            />
          )}

          {sections.length > 0 && phase !== 'editing_outline' && phase !== 'reviewing_articles' && (
            <div className="border border-white/10 rounded-lg divide-y divide-white/10">
              {sections.map((section) => (
                <div key={section.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-gray-200 font-medium">{section.title}</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${getSectionStatusColor(section.status)}`}>
                      {section.status === 'searching' || section.status === 'analyzing' || section.status === 'deepening' || section.status === 'refining' ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                          {getSectionStatusLabel(section.status)}
                        </span>
                      ) : (
                        getSectionStatusLabel(section.status)
                      )}
                    </span>
                    {section.sourcesFound !== undefined && section.sourcesFound > 0 && (
                      <span className="text-gray-500 text-xs">{section.sourcesFound}건</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {sections.length > 0 && phase !== 'editing_outline' && phase !== 'reviewing_articles' && (
            <p className="mt-3 text-sm text-gray-500">
              {completedSections}/{sections.length} 섹션 완료
            </p>
          )}

          {phase === 'complete' && reportId && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400 flex items-center justify-between">
              <span>딥 리서치가 완료되었습니다.</span>
              <a
                href={`/projects/${projectId}/reports/${reportId}`}
                className="font-medium bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
              >
                보고서 보기
              </a>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}
        </>
      )}
    </div>
  )
}
