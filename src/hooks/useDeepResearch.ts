'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
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
  readonly retryCount?: number
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

interface RefineResponse {
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
  readonly retryAllFailed: () => Promise<void>
  readonly skipFailedAndCompile: () => Promise<void>
  readonly abort: () => void
  readonly reset: () => void
  readonly completedCount: number
  readonly totalCount: number
  readonly failedCount: number
  readonly estimatedTimeLeft: number | null
}

const SEARCH_CONCURRENCY = 3
const ANALYZE_CONCURRENCY = 2
const MAX_AUTO_RETRY = 2
const RETRY_BASE_DELAY_MS = 2000

function storageKey(projectId: string): string {
  return `deep-research:${projectId}`
}

interface PersistedState {
  readonly phase: ResearchPhase
  readonly sections: readonly SectionState[]
  readonly outline: ReportOutline | null
  readonly reportId: string | null
  readonly internalReportId: string | null
}

function saveProgress(projectId: string, state: PersistedState): void {
  try {
    const serializable = {
      ...state,
      sections: state.sections.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        sourcesFound: s.sourcesFound,
        message: s.message,
        error: s.error,
        retryCount: s.retryCount,
      })),
    }
    localStorage.setItem(storageKey(projectId), JSON.stringify(serializable))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function loadProgress(projectId: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

function clearProgress(projectId: string): void {
  try {
    localStorage.removeItem(storageKey(projectId))
  } catch {
    // ignore
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
  const outlineRef = useRef<ReportOutline | null>(null)
  const articlesMapRef = useRef<Map<string, readonly ArticleData[]>>(new Map())
  const resultsMapRef = useRef<Map<string, SectionResearchResult>>(new Map())

  // Restore progress from localStorage on mount
  useEffect(() => {
    const saved = loadProgress(projectId)
    if (!saved || saved.phase === 'idle') return

    // Only restore completed/error states (don't resume in-progress)
    if (saved.phase === 'complete' || saved.phase === 'error') {
      setPhase(saved.phase)
      setSections(saved.sections as SectionState[])
      setOutline(saved.outline)
      setReportId(saved.reportId)
      reportIdRef.current = saved.internalReportId
    }
  }, [projectId])

  // Persist progress on meaningful state changes
  useEffect(() => {
    if (phase === 'idle') return
    saveProgress(projectId, {
      phase,
      sections,
      outline,
      reportId,
      internalReportId: reportIdRef.current,
    })
  }, [projectId, phase, sections, outline, reportId])

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
      outlineRef.current = data.data
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
      outlineRef.current = data.data
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

  // Run analysis for a single section: analyze (gpt-4o) → refine (gpt-4o-mini)
  const analyzeOneSection = useCallback(async (
    section: OutlineSection,
    articles: readonly ArticleData[],
    rId: string,
    signal: AbortSignal,
    sectionUpdater?: (updates: Partial<SectionState>) => void,
    retryAttempt = 0,
  ): Promise<SectionResearchResult> => {
    try {
      // Step 1: Analyze (gpt-4o, ~30-50s)
      const analyzeRes = await fetch(`/api/projects/${projectId}/deep-research/section/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, articles, reportId: rId }),
        signal,
      })
      const analyzeJson: AnalyzeResponse = await analyzeRes.json()
      if (!analyzeJson.success) throw new Error(analyzeJson.error ?? 'Analysis failed')
      const analyzeResult = analyzeJson.data!

      // Step 2: Refine (gpt-4o-mini, ~10-20s)
      sectionUpdater?.({ status: 'refining', message: '품질 개선 중...' })

      const refineRes = await fetch(`/api/projects/${projectId}/deep-research/section/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, analyzeResult, reportId: rId }),
        signal,
      })
      const refineJson: RefineResponse = await refineRes.json()

      // If refine fails, still use the raw analysis (degraded but not broken)
      if (!refineJson.success) {
        console.warn(`Refine failed for ${section.id}, using raw analysis`)
        return analyzeResult
      }

      return refineJson.data!
    } catch (err) {
      if (signal.aborted) throw err
      if (retryAttempt < MAX_AUTO_RETRY) {
        const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, retryAttempt)
        await delay(backoff)
        return analyzeOneSection(section, articles, rId, signal, sectionUpdater, retryAttempt + 1)
      }
      throw err
    }
  }, [projectId])

  // Run compile in 3 sub-steps to stay within 60s per call:
  // 1. Generate executive summary (gpt-4o, ~40s)
  // 2. Generate conclusion (gpt-4o, ~40s) — runs in parallel with summary
  // 3. Finalize: merge markdown, save meta, register report (~5s)
  const compileReport = useCallback(async (
    rId: string,
    outlineData: ReportOutline,
    sectionResults: readonly SectionResearchResult[],
    signal: AbortSignal,
  ): Promise<string> => {
    const compileBody = JSON.stringify({ reportId: rId, outline: outlineData, sectionResults })
    const headers = { 'Content-Type': 'application/json' }

    // Step 1 & 2: summary + conclusion in parallel (each fits in 60s)
    const [summaryRes, conclusionRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/deep-research/compile/summary`, {
        method: 'POST', headers, body: compileBody, signal,
      }),
      fetch(`/api/projects/${projectId}/deep-research/compile/conclusion`, {
        method: 'POST', headers, body: compileBody, signal,
      }),
    ])

    const summaryJson = await summaryRes.json()
    const conclusionJson = await conclusionRes.json()

    if (!summaryJson.success) throw new Error(summaryJson.error ?? 'Summary generation failed')
    if (!conclusionJson.success) throw new Error(conclusionJson.error ?? 'Conclusion generation failed')

    // Step 3: finalize (merge + save, no AI calls, fast)
    const finalizeRes = await fetch(`/api/projects/${projectId}/deep-research/compile/finalize`, {
      method: 'POST', headers, body: compileBody, signal,
    })
    const finalizeJson: CompileResponse = await finalizeRes.json()
    if (!finalizeJson.success) throw new Error(finalizeJson.error ?? 'Finalize failed')

    return finalizeJson.data?.reportId ?? rId
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

  // Main orchestration: search all -> analyze all -> compile
  const startResearch = useCallback(async (
    editedOutline: ReportOutline,
    keywordBlacklist?: readonly string[],
  ) => {
    const controller = new AbortController()
    abortRef.current = controller
    sectionTimesRef.current = []
    outlineRef.current = editedOutline
    articlesMapRef.current = new Map()
    resultsMapRef.current = new Map()

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
      retryCount: 0,
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

      const articlesMap = articlesMapRef.current

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

      const resultsMap = resultsMapRef.current

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
          const sectionUpdater = (updates: Partial<SectionState>) => updateSection(section.id, updates)
          const result = await analyzeOneSection(section, articles, rId, controller.signal, sectionUpdater)
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
      clearProgress(projectId)
    } catch (err) {
      if (controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setPhase('error')
    }
  }, [projectId, updateSection, searchSection, analyzeOneSection, compileReport, runWithConcurrency])

  // Retry a single failed section
  const retrySection = useCallback(async (sectionId: string) => {
    const currentOutline = outlineRef.current ?? outline
    if (!currentOutline || !reportIdRef.current) return

    const section = currentOutline.sections.find((s) => s.id === sectionId)
    if (!section) return

    const controller = new AbortController()

    // Find existing articles or re-search
    const currentSection = sections.find((s) => s.id === sectionId)
    let articles = currentSection?.articles

    const retryCount = (currentSection?.retryCount ?? 0) + 1
    updateSection(sectionId, { retryCount })

    try {
      if (!articles || articles.length === 0) {
        updateSection(sectionId, { status: 'searching', message: '재검색 중...', error: undefined })
        articles = await searchSection(section, controller.signal)
        articlesMapRef.current.set(sectionId, articles)
        updateSection(sectionId, { status: 'pending', sourcesFound: articles.length, message: `${articles.length}건`, articles })
      }

      updateSection(sectionId, { status: 'analyzing', message: '분석 중...', error: undefined })
      const sectionUpdater = (updates: Partial<SectionState>) => updateSection(sectionId, updates)
      const result = await analyzeOneSection(section, articles, reportIdRef.current, controller.signal, sectionUpdater)
      resultsMapRef.current.set(sectionId, result)
      updateSection(sectionId, { status: 'complete', message: '완료', result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      updateSection(sectionId, { status: 'error', message: msg, error: msg })
    }
  }, [outline, sections, updateSection, searchSection, analyzeOneSection])

  // Retry all failed sections at once
  const retryAllFailed = useCallback(async () => {
    const currentOutline = outlineRef.current ?? outline
    if (!currentOutline || !reportIdRef.current) return

    const failedSections = sections.filter((s) => s.status === 'error')
    for (const s of failedSections) {
      await retrySection(s.id)
    }
  }, [outline, sections, retrySection])

  // Skip failed sections and compile with completed ones
  const skipFailedAndCompile = useCallback(async () => {
    const currentOutline = outlineRef.current ?? outline
    const rId = reportIdRef.current
    if (!currentOutline || !rId) return

    const resultsMap = resultsMapRef.current
    const sectionResults = currentOutline.sections
      .map((s) => resultsMap.get(s.id))
      .filter((r): r is SectionResearchResult => r !== undefined)

    if (sectionResults.length === 0) {
      setError('완료된 섹션이 없어 보고서를 생성할 수 없습니다')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      setPhase('compiling')
      const finalReportId = await compileReport(rId, currentOutline, sectionResults, controller.signal)
      setReportId(finalReportId)
      setPhase('complete')
      clearProgress(projectId)
    } catch (err) {
      if (controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setPhase('error')
    }
  }, [outline, projectId, compileReport])

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
    outlineRef.current = null
    articlesMapRef.current = new Map()
    resultsMapRef.current = new Map()
    clearProgress(projectId)
  }, [projectId])

  const completedCount = sections.filter((s) => s.status === 'complete').length
  const totalCount = sections.length
  const failedCount = sections.filter((s) => s.status === 'error').length

  // Estimate time left based on average section processing time
  const estimatedTimeLeft = (() => {
    const times = sectionTimesRef.current
    if (times.length === 0 || phase !== 'analyzing') return null
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const remaining = totalCount - completedCount - failedCount
    return Math.round(avg * Math.max(remaining, 0))
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
    retryAllFailed,
    skipFailedAndCompile,
    abort,
    reset,
    completedCount,
    totalCount,
    failedCount,
    estimatedTimeLeft,
  }
}
