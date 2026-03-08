'use client'

import { useState, useCallback } from 'react'
import type { QuizResult } from '@/types/notebooklm'

interface QuizViewerProps {
  readonly data: QuizResult
}

export function QuizViewer({ data }: QuizViewerProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)

  const question = data.questions[currentIdx]
  const isLast = currentIdx === data.questions.length - 1
  const isFinished = answeredCount === data.questions.length

  const handleSelect = useCallback((idx: number) => {
    if (selectedAnswer !== null) return
    setSelectedAnswer(idx)
    setShowExplanation(true)
    setAnsweredCount((c) => c + 1)
    if (idx === question.correctIndex) {
      setScore((s) => s + 1)
    }
  }, [selectedAnswer, question.correctIndex])

  const handleNext = useCallback(() => {
    if (isLast) return
    setCurrentIdx((i) => i + 1)
    setSelectedAnswer(null)
    setShowExplanation(false)
  }, [isLast])

  const handleReset = useCallback(() => {
    setCurrentIdx(0)
    setSelectedAnswer(null)
    setShowExplanation(false)
    setScore(0)
    setAnsweredCount(0)
  }, [])

  if (isFinished && showExplanation && isLast) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-2">{score >= data.questions.length * 0.8 ? '🎉' : score >= data.questions.length * 0.5 ? '👍' : '📚'}</div>
        <p className="text-lg font-semibold text-white">{score} / {data.questions.length} 정답</p>
        <p className="text-sm text-gray-400 mt-1">
          {score >= data.questions.length * 0.8 ? '훌륭합니다!' : score >= data.questions.length * 0.5 ? '잘했습니다!' : '다시 한번 도전해보세요!'}
        </p>
        <button onClick={handleReset} className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          다시 풀기
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{currentIdx + 1} / {data.questions.length}</span>
        <span className="text-xs text-gray-500">점수: {score}</span>
      </div>

      <p className="text-sm font-medium text-white mb-3">{question.question}</p>

      <div className="space-y-2">
        {question.choices.map((choice, i) => {
          let className = 'w-full text-left px-3 py-2 rounded-lg text-sm transition-all border '
          if (selectedAnswer === null) {
            className += 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] text-gray-300'
          } else if (i === question.correctIndex) {
            className += 'border-green-500/40 bg-green-500/10 text-green-300'
          } else if (i === selectedAnswer) {
            className += 'border-red-500/40 bg-red-500/10 text-red-300'
          } else {
            className += 'border-white/5 bg-white/[0.01] text-gray-500'
          }

          return (
            <button key={i} onClick={() => handleSelect(i)} disabled={selectedAnswer !== null} className={className}>
              <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
              {choice}
            </button>
          )
        })}
      </div>

      {showExplanation && (
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-300">{question.explanation}</p>
        </div>
      )}

      {selectedAnswer !== null && !isLast && (
        <button onClick={handleNext} className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          다음 문제
        </button>
      )}
    </div>
  )
}
