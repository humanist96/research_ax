'use client'

import { useState, useCallback } from 'react'
import type { Suggestion } from './StructuredForm'

interface SuggestionBubblesProps {
  readonly suggestions: readonly Suggestion[]
  readonly onSend: (text: string) => void
  readonly disabled?: boolean
}

export function SuggestionBubbles({ suggestions, onSend, disabled }: SuggestionBubblesProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [editedPrompt, setEditedPrompt] = useState('')

  const handleBubbleClick = useCallback((index: number) => {
    setSelectedIndex(index)
    setEditedPrompt(suggestions[index].prompt)
  }, [suggestions])

  const handleCancel = useCallback(() => {
    setSelectedIndex(null)
    setEditedPrompt('')
  }, [])

  const handleSend = useCallback(() => {
    if (!editedPrompt.trim()) return
    onSend(editedPrompt.trim())
    setSelectedIndex(null)
    setEditedPrompt('')
  }, [editedPrompt, onSend])

  if (selectedIndex !== null) {
    const selected = suggestions[selectedIndex]
    if (!selected) {
      setSelectedIndex(null)
      return null
    }
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-sm font-medium text-purple-800">
            &ldquo;{selected.label}&rdquo; 시나리오
          </span>
          <span className="text-xs text-gray-400">수정 가능</span>
        </div>
        <textarea
          value={editedPrompt}
          onChange={(e) => setEditedPrompt(e.target.value)}
          disabled={disabled}
          rows={6}
          className="w-full px-3 py-2.5 text-sm border border-purple-200 rounded-lg bg-purple-50/30 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 resize-y disabled:opacity-50"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={disabled}
            className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !editedPrompt.trim()}
            className="px-4 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            이 답변으로 전송
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-purple-600">
        빠른 답변 시나리오
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            type="button"
            onClick={() => handleBubbleClick(index)}
            disabled={disabled}
            className="px-3.5 py-1.5 text-sm border border-purple-300 text-purple-700 bg-purple-50 rounded-full hover:bg-purple-100 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  )
}
