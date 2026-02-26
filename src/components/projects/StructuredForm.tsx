'use client'

import { useState, useCallback, useMemo } from 'react'

export interface StructuredQuestion {
  readonly id: string
  readonly label: string
  readonly type: 'single' | 'multi' | 'text'
  readonly options?: readonly string[]
  readonly allowCustom?: boolean
  readonly recommended?: string | readonly string[]
  readonly reason?: string
}

export interface Suggestion {
  readonly label: string   // 버블에 표시 (10자 이내)
  readonly prompt: string  // 보완된 상세 프롬프트
}

export interface StructuredData {
  readonly message: string
  readonly questions: readonly StructuredQuestion[]
  readonly suggestions?: readonly Suggestion[]
  readonly done: boolean
}

interface StructuredFormProps {
  readonly data: StructuredData
  readonly onSubmit: (formattedText: string) => void
  readonly disabled?: boolean
}

type Answers = Record<string, string | readonly string[]>

function isRecommended(question: StructuredQuestion, option: string): boolean {
  if (!question.recommended) return false
  if (Array.isArray(question.recommended)) {
    return question.recommended.includes(option)
  }
  return question.recommended === option
}

export function StructuredForm({ data, onSubmit, disabled }: StructuredFormProps) {
  const [answers, setAnswers] = useState<Answers>({})
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})

  const hasAnyRecommendation = useMemo(
    () => data.questions.some((q) => q.recommended !== undefined),
    [data.questions]
  )

  const handleApplyAll = useCallback(() => {
    const newAnswers: Answers = {}
    for (const q of data.questions) {
      if (q.recommended === undefined) continue
      if (q.type === 'single' && typeof q.recommended === 'string') {
        newAnswers[q.id] = q.recommended
      } else if (q.type === 'multi' && Array.isArray(q.recommended)) {
        newAnswers[q.id] = q.recommended
      } else if (q.type === 'text' && typeof q.recommended === 'string') {
        newAnswers[q.id] = q.recommended
      }
    }
    setAnswers((prev) => ({ ...prev, ...newAnswers }))
  }, [data.questions])

  const handleSingleSelect = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  const handleMultiToggle = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => {
      const current = (prev[questionId] as readonly string[] | undefined) ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [questionId]: next }
    })
  }, [])

  const handleTextChange = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  const handleCustomInputChange = useCallback((questionId: string, value: string) => {
    setCustomInputs((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  const handleSubmit = useCallback(() => {
    const lines = data.questions.map((q) => {
      const answer = answers[q.id]
      const custom = customInputs[q.id]?.trim()

      if (q.type === 'single') {
        return `[${q.label}] ${answer ?? '(미선택)'}`
      }

      if (q.type === 'multi') {
        const selected = (answer as readonly string[] | undefined) ?? []
        const parts = [...selected]
        if (custom) {
          parts.push(`${custom} (직접입력)`)
        }
        return `[${q.label}] ${parts.length > 0 ? parts.join(', ') : '(미선택)'}`
      }

      return `[${q.label}] ${(answer as string)?.trim() || '(미입력)'}`
    })

    onSubmit(lines.join('\n'))
  }, [answers, customInputs, data.questions, onSubmit])

  const isComplete = data.questions.every((q) => {
    const answer = answers[q.id]
    if (q.type === 'text') return (answer as string)?.trim()
    if (q.type === 'single') return !!answer
    if (q.type === 'multi') {
      const selected = (answer as readonly string[] | undefined) ?? []
      const custom = customInputs[q.id]?.trim()
      return selected.length > 0 || !!custom
    }
    return false
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-800">{data.message}</p>

      {hasAnyRecommendation && (
        <button
          type="button"
          onClick={handleApplyAll}
          disabled={disabled}
          className="w-full py-2 bg-amber-50 text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          AI 추천으로 채우기
        </button>
      )}

      {data.questions.map((q) => (
        <div key={q.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {q.label}
          </label>

          {q.type === 'single' && q.options && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt
                const recommended = isRecommended(q, opt)
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSingleSelect(q.id, opt)}
                    disabled={disabled}
                    className={`relative px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : recommended
                          ? 'bg-white text-gray-700 border-amber-400 ring-1 ring-amber-300'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    } disabled:opacity-50`}
                  >
                    {opt}
                    {recommended && !selected && (
                      <span className="ml-1 text-[10px] text-amber-600 font-medium">추천</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {q.type === 'multi' && q.options && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const selected = ((answers[q.id] as readonly string[] | undefined) ?? []).includes(opt)
                  const recommended = isRecommended(q, opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleMultiToggle(q.id, opt)}
                      disabled={disabled}
                      className={`relative px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : recommended
                            ? 'bg-white text-gray-700 border-amber-400 ring-1 ring-amber-300'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      } disabled:opacity-50`}
                    >
                      {selected ? '✓ ' : ''}{opt}
                      {recommended && !selected && (
                        <span className="ml-1 text-[10px] text-amber-600 font-medium">추천</span>
                      )}
                    </button>
                  )
                })}
              </div>
              {q.allowCustom && (
                <input
                  type="text"
                  value={customInputs[q.id] ?? ''}
                  onChange={(e) => handleCustomInputChange(q.id, e.target.value)}
                  placeholder="직접 입력..."
                  disabled={disabled}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          )}

          {q.type === 'text' && (
            <div className="space-y-1">
              <input
                type="text"
                value={(answers[q.id] as string) ?? ''}
                onChange={(e) => handleTextChange(q.id, e.target.value)}
                placeholder={
                  typeof q.recommended === 'string' ? `추천: ${q.recommended}` : '입력하세요...'
                }
                disabled={disabled}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {q.reason && (
            <p className="text-xs text-amber-600/80 mt-1">
              {q.reason}
            </p>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !isComplete}
        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
      >
        답변 제출
      </button>
    </div>
  )
}
