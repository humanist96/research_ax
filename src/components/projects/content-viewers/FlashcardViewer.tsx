'use client'

import { useState, useCallback } from 'react'
import type { FlashcardsResult } from '@/types/notebooklm'

interface FlashcardViewerProps {
  readonly data: FlashcardsResult
}

export function FlashcardViewer({ data }: FlashcardViewerProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  const card = data.cards[currentIdx]

  const handleFlip = useCallback(() => {
    setIsFlipped((f) => !f)
  }, [])

  const handlePrev = useCallback(() => {
    setCurrentIdx((i) => Math.max(0, i - 1))
    setIsFlipped(false)
  }, [])

  const handleNext = useCallback(() => {
    setCurrentIdx((i) => Math.min(data.cards.length - 1, i + 1))
    setIsFlipped(false)
  }, [data.cards.length])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{currentIdx + 1} / {data.cards.length}</span>
        {card.category && <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{card.category}</span>}
      </div>

      <button
        onClick={handleFlip}
        className="w-full min-h-[120px] p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all text-center cursor-pointer"
      >
        {isFlipped ? (
          <div>
            <p className="text-xs text-gray-500 mb-2">답변</p>
            <p className="text-sm text-gray-200 leading-relaxed">{card.back}</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-500 mb-2">클릭하여 뒤집기</p>
            <p className="text-base font-medium text-white">{card.front}</p>
          </div>
        )}
      </button>

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={handlePrev}
          disabled={currentIdx === 0}
          className="px-3 py-1.5 text-sm text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"
        >
          이전
        </button>
        <button
          onClick={handleNext}
          disabled={currentIdx === data.cards.length - 1}
          className="px-3 py-1.5 text-sm text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"
        >
          다음
        </button>
      </div>
    </div>
  )
}
