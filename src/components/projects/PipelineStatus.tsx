'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ProjectStatus } from '@/types'

interface PipelineStatusProps {
  readonly projectId: string
  readonly status: ProjectStatus
  readonly onStatusChange: (status: ProjectStatus) => void
}

interface PipelineStats {
  readonly articlesCollected: number
  readonly articlesAnalyzed: number
  readonly reportGenerated: boolean
}

interface AnalysisProgress {
  readonly analyzed: number
  readonly total: number
}

const PIPELINE_STEPS = [
  { key: 'collecting', label: '뉴스 수집' },
  { key: 'analyzing', label: 'AI 분석' },
  { key: 'reporting', label: '리포트 생성' },
] as const

const MAX_LOGS = 30

export function PipelineStatus({ projectId, status, onStatusChange }: PipelineStatusProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<string | null>(null)
  const [logs, setLogs] = useState<readonly string[]>([])
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)
  const [stats, setStats] = useState<PipelineStats | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const isPipelineActive = ['collecting', 'analyzing', 'reporting', 'researching'].includes(status)

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  const addLog = useCallback((message: string) => {
    setLogs((prev) => {
      const next = [...prev, message]
      return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
    })
  }, [])

  async function runPipeline() {
    setIsRunning(true)
    setError(null)
    setLogs([])
    setProgress(null)
    setStats(null)
    setCurrentPhase(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/pipeline`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? `HTTP ${res.status}`)
        onStatusChange('error')
        setIsRunning(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setError('스트림을 읽을 수 없습니다')
        onStatusChange('error')
        setIsRunning(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue

          try {
            const event = JSON.parse(trimmed.slice(6))
            handleEvent(event)
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim().startsWith('data: ')) {
        try {
          const event = JSON.parse(buffer.trim().slice(6))
          handleEvent(event)
        } catch {
          // skip
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      onStatusChange('error')
    } finally {
      setIsRunning(false)
    }
  }

  function handleEvent(event: Record<string, unknown>) {
    switch (event.type) {
      case 'phase': {
        const phase = event.phase as string
        setCurrentPhase(phase)
        addLog(event.message as string)

        if (phase === 'collecting' || phase === 'analyzing' || phase === 'reporting') {
          onStatusChange(phase as ProjectStatus)
        } else if (phase === 'complete') {
          onStatusChange('complete')
        } else if (phase === 'error') {
          onStatusChange('error')
        }
        break
      }
      case 'source_search':
        addLog(event.message as string)
        break
      case 'collection_progress':
        addLog(event.message as string)
        break
      case 'analysis_batch':
        addLog(event.message as string)
        break
      case 'analysis_progress':
        setProgress({
          analyzed: event.analyzed as number,
          total: event.total as number,
        })
        addLog(event.message as string)
        break
      case 'report_progress':
        addLog(event.message as string)
        break
      case 'stats':
        setStats({
          articlesCollected: event.articlesCollected as number,
          articlesAnalyzed: event.articlesAnalyzed as number,
          reportGenerated: event.reportGenerated as boolean,
        })
        break
      case 'error':
        setError(event.message as string)
        addLog(`오류: ${event.message as string}`)
        break
    }
  }

  function getStepStatus(stepKey: string): 'done' | 'active' | 'pending' {
    const stepOrder = ['collecting', 'analyzing', 'reporting']
    const activePhase = currentPhase ?? status
    const currentIdx = stepOrder.indexOf(activePhase)
    const stepIdx = stepOrder.indexOf(stepKey)

    if (activePhase === 'complete') return 'done'
    if (currentIdx === -1) return 'pending'
    if (stepIdx < currentIdx) return 'done'
    if (stepIdx === currentIdx) return 'active'
    return 'pending'
  }

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.analyzed / progress.total) * 100)
    : null

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">패스트 리서치</h3>
        <button
          onClick={runPipeline}
          disabled={isRunning || isPipelineActive}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
        >
          {isRunning || isPipelineActive ? '실행 중...' : '패스트 리서치 실행'}
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {PIPELINE_STEPS.map((step, i) => {
          const stepStatus = getStepStatus(step.key)
          return (
            <div key={step.key} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 flex-1 p-3 rounded-lg text-sm ${
                stepStatus === 'done'
                  ? 'bg-green-500/10 text-green-400'
                  : stepStatus === 'active'
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-white/5 text-gray-500'
              }`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  stepStatus === 'done'
                    ? 'bg-green-500 text-white'
                    : stepStatus === 'active'
                    ? 'bg-blue-500 text-white animate-pulse'
                    : 'bg-white/10 text-gray-500'
                }`}>
                  {stepStatus === 'done' ? '\u2713' : i + 1}
                </span>
                <span className="font-medium">{step.label}</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <span className="text-gray-600">&rarr;</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Progress bar for analysis phase */}
      {progressPercent !== null && currentPhase === 'analyzing' && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>분석 진행률</span>
            <span>{progress!.analyzed}/{progress!.total} ({progressPercent}%)</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats counters */}
      {stats && (
        <div className="mt-4 flex gap-4">
          <div className="flex-1 bg-white/5 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-400">{stats.articlesCollected}</div>
            <div className="text-xs text-gray-400">수집 기사</div>
          </div>
          <div className="flex-1 bg-white/5 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-cyan-400">{stats.articlesAnalyzed}</div>
            <div className="text-xs text-gray-400">분석 기사</div>
          </div>
          <div className="flex-1 bg-white/5 rounded-lg p-3 text-center">
            <div className={`text-lg font-bold ${stats.reportGenerated ? 'text-green-400' : 'text-gray-500'}`}>
              {stats.reportGenerated ? '\u2713' : '-'}
            </div>
            <div className="text-xs text-gray-400">리포트</div>
          </div>
        </div>
      )}

      {/* Real-time log area */}
      {logs.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-gray-400 mb-1">실행 로그</div>
          <div
            ref={logContainerRef}
            className="bg-black/30 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1"
          >
            {logs.map((log, i) => (
              <div key={i} className="text-gray-300">
                <span className="text-gray-500 mr-2">&gt;</span>
                {log}
              </div>
            ))}
            {isRunning && (
              <div className="text-blue-400 animate-pulse">
                <span className="text-gray-500 mr-2">&gt;</span>
                처리 중...
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
