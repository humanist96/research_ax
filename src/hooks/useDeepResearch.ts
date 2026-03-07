'use client'

import { useState, useCallback, useRef } from 'react'
import type { ReportOutline, SectionResearchResult, OutlineSection } from '@/lib/deep-research/types'

export type ResearchPhase =
  | 'idle'
  | 'generating_outline'
  | 'editing_outline'
  | 'searching'
  | 'analyzing'
  | 'compiling'
  | 'complete'
  | 'error'

export type SectionStepStatus = 'pending' | 'searching' | 'analyzing' | 'refining' | 'complete' | 'error'

export interface SectionState {
  readonly id: string
  readonly title: string
  readonly status: SectionStepStatus
  readonly sourcesFound?: number
  readonly message: string
  readonly articles?: readonly ArticleData[]
  readonly result?: SectionResearchResult
  readonly error?: string
}

interface ArticleData {
  readonly title: string
  readonly content: string
  readonly link: string
  readonly source: string
  readonly pubDate: string
}

interface SearchResponse {
  readonly success: boolean
  readonly error?: string
  readonly data?: {
    readonly sectionId: string
    readonly articles: readonly ArticleData[]
  }
}

interface AnalyzeResponse {
  readonly success: boolean
  readonly error?: string
  readonly data?: SectionResearchResult
}

interface CompileResponse {
  readonly success: boolean
  readonly error?: string
  readonly data?: {
    readonly reportId: string
  }
}

export interface UseDeepResearchReturn {
  readonly phase: ResearchPhase
  readonly sections: readonly SectionState[]
  readonly outline: ReportOutline | null
  readonly reportId: string | null
  readonly error: string | null
  readonly generateOutline: () => Promise<void>
  readonly regenerateOutline: () => Promise<void>
  readonly isRegeneratingOutline: boolean
  readonly startResearch: (outline: ReportOutline, keywordBlacklist?: readonly string[]) => Promise<void>
  readonly retrySection: (sectionId: string) => Promise<void>
  readonly abort: () => void
  readonly reset: () => void
  readonly completedCount: number
  readonly totalCount: number
  readonly estimatedTimeLeft: number | null
}

const SEARCH_CONCURRENCY = 3
const ANALYZE_CONCURRENCY = 2

export function useDeepResearch(projectId: string): UseDeepResearchReturn {
  const [phase, setPhase] = useState<ResearchPhase>('idle')
  const [sections, setSections] = useState<SectionState[]>([])
  const [outline, setOutline] = useState<ReportOutline | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRegeneratingOutline, setIsRegeneratingOutline] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const sectionTimesRef = useRef<number[]>([])
  const reportIdRef = useRef<string | null>(null)

  const updateSection = useCallback((sectionId: string, updates: Partial<SectionState>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
    )
  }, [])

  const generateOutline = useCallback(async () => {
    setPhase('generating_outline')
    setError(null)
    setSections([])
    setReportId(null)
    setOutline(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/deep-research/outline`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
      setOutline(data.data)
      setPhase('editing_outline')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }, [projectId])

  const regenerateOutline = useCallback(async () => {
    setIsRegeneratingOutline(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/deep-research/outline`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
      setOutline(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsRegeneratingOutline(false)
    }
  }, [projectId])

  // Run search for a single section
  const searchSection = useCallback(async (
    section: OutlineSection,
    signal: AbortSignal,
    keywordBlacklist?: readonly string[],
  ): Promise<readonly ArticleData[]> => {
    const res = await fetch(`/api/projects/${projectId}/deep-research/section/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, keywordBlacklist }),
      signal,
    })
    const json: SearchResponse = await res.json()
    if (!json.success) throw new Error(json.error ?? 'Search failed')
    return json.data?.articles ?? []
  }, [projectId])

  // Run analysis for a single section
  const analyzeOneSection = useCallback(async (
    section: OutlineSection,
    articles: readonly ArticleData[],
    rId: string,
    signal: AbortSignal,
  ): Promise<SectionResearchResult> => {
    const res = await fetch(`/api/projects/${projectId}/deep-research/section/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, articles, reportId: rId }),
      signal,
    })
    const json: AnalyzeResponse = await res.json()
    if (!json.success) throw new Error(json.error ?? 'Analysis failed')
    return json.data!
  }, [projectId])

  // Run compile (executive summary + conclusion + merge)
  const compileReport = useCallback(async (
    rId: string,
    outlineData: ReportOutline,
    sectionResults: readonly SectionResearchResult[],
    signal: AbortSignal,
  ): Promise<string> => {
    const res = await fetch(`/api/projects/${projectId}/deep-research/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: rId, outline: outlineData, sectionResults }),
      signal,
    })
    const json: CompileResponse = await res.json()
    if (!json.success) throw new Error(json.error ?? 'Compile failed')
    return json.data?.reportId ?? rId
  }, [projectId])

  // Concurrency-limited batch executor
  const runWithConcurrency = useCallback(async <T>(
    items: readonly T[],
    concurrency: number,
    fn: (item: T) => Promise<void>,
  ): Promise<void> => {
    const queue = [...items]
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()!
        await fn(item)
      }
    })
    await Promise.all(workers)
  }, [])

  // Main orchestration: search all → analyze all → compile
  const startResearch = useCallback(async (
    editedOutline: ReportOutline,
    keywordBlacklist?: readonly string[],
  ) => {
    const controller = new AbortController()
    abortRef.current = controller
    sectionTimesRef.current = []

    setError(null)
    setReportId(null)

    // Generate a report ID on client
    const rId = `deep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    reportIdRef.current = rId

    // Initialize section states
    const initialSections: SectionState[] = editedOutline.sections.map((s) => ({
      id: s.id,
      title: s.title,
      status: 'pending' as const,
      message: '대기',
    }))
    setSections(initialSections)

    // Set project status to researching
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'researching' }),
    }).catch(() => {})

    try {
      // === PHASE: SEARCHING ===
      setPhase('searching')

      const articlesMap = new Map<string, readonly ArticleData[]>()

      await runWithConcurrency(editedOutline.sections, SEARCH_CONCURRENCY, async (section) => {
        if (controller.signal.aborted) return

        updateSection(section.id, { status: 'searching', message: '검색 중...' })

        try {
          const articles = await searchSection(section, controller.signal, keywordBlacklist)
          articlesMap.set(section.id, articles)
          updateSection(section.id, {
            status: 'pending',
            sourcesFound: articles.length,
            message: `${articles.length}건 검색 완료`,
            articles,
          })
        } catch (err) {
          if (controller.signal.aborted) return
          const msg = err instanceof Error ? err.message : String(err)
          updateSection(section.id, { status: 'error', message: msg, error: msg })
        }
      })

      if (controller.signal.aborted) return

      // === PHASE: ANALYZING ===
      setPhase('analyzing')

      const resultsMap = new Map<string, SectionResearchResult>()

      await runWithConcurrency(editedOutline.sections, ANALYZE_CONCURRENCY, async (section) => {
        if (controller.signal.aborted) return

        const articles = articlesMap.get(section.id)
        if (!articles || articles.length === 0) {
          updateSection(section.id, { status: 'complete', message: '기사 없음 (건너뜀)' })
          return
        }

        updateSection(section.id, { status: 'analyzing', message: '분석 중...' })

        const startTime = Date.now()

        try {
          const result = await analyzeOneSection(section, articles, rId, controller.signal)
          const elapsed = (Date.now() - startTime) / 1000
          sectionTimesRef.current.push(elapsed)
          resultsMap.set(section.id, result)
          updateSection(section.id, {
            status: 'complete',
            message: '완료',
            result,
          })
        } catch (err) {
          if (controller.signal.aborted) return
          const msg = err instanceof Error ? err.message : String(err)
          updateSection(section.id, { status: 'error', message: msg, error: msg })
        }
      })

      if (controller.signal.aborted) return

      const sectionResults = editedOutline.sections
        .map((s) => resultsMap.get(s.id))
        .filter((r): r is SectionResearchResult => r !== undefined)

      if (sectionResults.length === 0) {
        throw new Error('모든 섹션 분석에 실패했습니다')
      }

      // === PHASE: COMPILING ===
      setPhase('compiling')

      const finalReportId = await compileReport(rId, editedOutline, sectionResults, controller.signal)
      setReportId(finalReportId)
      setPhase('complete')
    } catch (err) {
      if (controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setPhase('error')
    }
  }, [projectId, updateSection, searchSection, analyzeOneSection, compileReport, runWithConcurrency])

  // Retry a single failed section
  const retrySection = useCallback(async (sectionId: string) => {
    if (!outline || !reportIdRef.current) return

    const section = outline.sections.find((s) => s.id === sectionId)
    if (!section) return

    const controller = new AbortController()

    // Find existing articles or re-search
    const currentSection = sections.find((s) => s.id === sectionId)
    let articles = currentSection?.articles

    try {
      if (!articles || articles.length === 0) {
        updateSection(sectionId, { status: 'searching', message: '재검색 중...', error: undefined })
        articles = await searchSection(section, controller.signal)
        updateSection(sectionId, { status: 'pending', sourcesFound: articles.length, message: `${articles.length}건`, articles })
      }

      updateSection(sectionId, { status: 'analyzing', message: '분석 중...', error: undefined })
      const result = await analyzeOneSection(section, articles, reportIdRef.current, controller.signal)
      updateSection(sectionId, { status: 'complete', message: '완료', result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      updateSection(sectionId, { status: 'error', message: msg, error: msg })
    }
  }, [outline, sections, updateSection, searchSection, analyzeOneSection])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setPhase('error')
    setError('사용자가 중단했습니다')
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPhase('idle')
    setSections([])
    setOutline(null)
    setReportId(null)
    setError(null)
    sectionTimesRef.current = []
    reportIdRef.current = null
  }, [])

  const completedCount = sections.filter((s) => s.status === 'complete').length
  const totalCount = sections.length

  // Estimate time left based on average section processing time
  const estimatedTimeLeft = (() => {
    const times = sectionTimesRef.current
    if (times.length === 0 || phase !== 'analyzing') return null
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const remaining = totalCount - completedCount
    return Math.round(avg * remaining)
  })()

  return {
    phase,
    sections,
    outline,
    reportId,
    error,
    generateOutline,
    regenerateOutline,
    isRegeneratingOutline,
    startResearch,
    retrySection,
    abort,
    reset,
    completedCount,
    totalCount,
    estimatedTimeLeft,
  }
}
