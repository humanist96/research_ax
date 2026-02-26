'use client'

import { useState } from 'react'
import type { ProjectStatus } from '@/types'

interface PipelineStatusProps {
  readonly projectId: string
  readonly status: ProjectStatus
  readonly onStatusChange: (status: ProjectStatus) => void
}

const PIPELINE_STEPS = [
  { key: 'collecting', label: '뉴스 수집' },
  { key: 'analyzing', label: 'AI 분석' },
  { key: 'reporting', label: '리포트 생성' },
] as const

export function PipelineStatus({ projectId, status, onStatusChange }: PipelineStatusProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPipelineActive = ['collecting', 'analyzing', 'reporting', 'researching'].includes(status)

  async function runPipeline() {
    setIsRunning(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/pipeline`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        onStatusChange('complete')
      } else {
        setError(data.error)
        onStatusChange('error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      onStatusChange('error')
    } finally {
      setIsRunning(false)
    }
  }

  function getStepStatus(stepKey: string): 'done' | 'active' | 'pending' {
    const stepOrder = ['collecting', 'analyzing', 'reporting']
    const currentIdx = stepOrder.indexOf(status)
    const stepIdx = stepOrder.indexOf(stepKey)

    if (status === 'complete') return 'done'
    if (currentIdx === -1) return 'pending'
    if (stepIdx < currentIdx) return 'done'
    if (stepIdx === currentIdx) return 'active'
    return 'pending'
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">파이프라인</h3>
        <button
          onClick={runPipeline}
          disabled={isRunning || isPipelineActive}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {isRunning || isPipelineActive ? '실행 중...' : '파이프라인 실행'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {PIPELINE_STEPS.map((step, i) => {
          const stepStatus = getStepStatus(step.key)
          return (
            <div key={step.key} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 flex-1 p-3 rounded-lg text-sm ${
                stepStatus === 'done'
                  ? 'bg-green-50 text-green-700'
                  : stepStatus === 'active'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-gray-50 text-gray-400'
              }`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  stepStatus === 'done'
                    ? 'bg-green-500 text-white'
                    : stepStatus === 'active'
                    ? 'bg-blue-500 text-white animate-pulse'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {stepStatus === 'done' ? '\u2713' : i + 1}
                </span>
                <span className="font-medium">{step.label}</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <span className="text-gray-300">&rarr;</span>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
