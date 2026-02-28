'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateProjectForm() {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? 'Failed to create project')
        return
      }

      router.push(`/projects/${data.data.id}/chat`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">새 리서치 시작</h2>
      <div className="flex gap-3">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="리서치 주제를 입력하세요 (예: 반도체 시장 동향 분석)"
          className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-white placeholder-gray-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!prompt.trim() || isLoading}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap transition-all"
        >
          {isLoading ? '생성 중...' : '시작'}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}
    </form>
  )
}
