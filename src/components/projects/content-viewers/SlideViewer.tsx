'use client'

import { useState, useCallback } from 'react'
import type { SlideResult } from '@/types/notebooklm'

interface SlideViewerProps {
  readonly data: SlideResult
}

export function SlideViewer({ data }: SlideViewerProps) {
  const [currentIdx, setCurrentIdx] = useState(0)

  const slide = data.slides[currentIdx]

  const handlePrev = useCallback(() => {
    setCurrentIdx((i) => Math.max(0, i - 1))
  }, [])

  const handleNext = useCallback(() => {
    setCurrentIdx((i) => Math.min(data.slides.length - 1, i + 1))
  }, [data.slides.length])

  return (
    <div>
      {/* Slide content */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-white/10 min-h-[160px]">
        <h3 className="text-base font-semibold text-white mb-4">{slide.title}</h3>
        <ul className="space-y-2">
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
              <span className="text-blue-400 mt-0.5 shrink-0">{'\u2022'}</span>
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      {/* Speaker notes */}
      {slide.speakerNotes && (
        <div className="mt-2 px-3 py-2 bg-white/[0.02] rounded-lg">
          <p className="text-xs text-gray-500">{slide.speakerNotes}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={handlePrev}
          disabled={currentIdx === 0}
          className="px-3 py-1.5 text-sm text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"
        >
          이전
        </button>
        <span className="text-xs text-gray-500">
          {currentIdx + 1} / {data.slides.length}
        </span>
        <button
          onClick={handleNext}
          disabled={currentIdx === data.slides.length - 1}
          className="px-3 py-1.5 text-sm text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all"
        >
          다음
        </button>
      </div>
    </div>
  )
}
