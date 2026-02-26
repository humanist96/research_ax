'use client'

import { useState, useCallback } from 'react'
import type { ReportOutline, OutlineSection } from '@/lib/deep-research/types'

interface OutlineEditorProps {
  readonly projectId: string
  readonly outline: ReportOutline
  readonly onStartResearch: (outline: ReportOutline) => void
  readonly onRegenerate: () => void
  readonly isRegenerating: boolean
}

interface AddSectionFormData {
  readonly title: string
  readonly description: string
}

function generateSectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[가-힣]+/g, (match) => match.slice(0, 2))
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30) || `section-${Date.now()}`
}

function SectionCard({
  section,
  index,
  total,
  collapsed,
  regeneratingSectionId,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
  onDelete,
  onRegenerateSection,
}: {
  readonly section: OutlineSection
  readonly index: number
  readonly total: number
  readonly collapsed: boolean
  readonly regeneratingSectionId: string | null
  readonly onToggleCollapse: () => void
  readonly onMoveUp: () => void
  readonly onMoveDown: () => void
  readonly onDelete: () => void
  readonly onRegenerateSection: () => void
}) {
  const isRegenerating = regeneratingSectionId === section.id

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-white/5">
        <button
          onClick={onToggleCollapse}
          className="text-gray-400 hover:text-white transition-colors text-sm w-5"
        >
          {collapsed ? '▶' : '▼'}
        </button>
        <span className="text-xs text-gray-500 font-mono w-6">{index + 1}.</span>
        <span className="text-gray-200 font-medium flex-1">{section.title}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
            title="위로 이동"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
            title="아래로 이동"
          >
            ↓
          </button>
          <button
            onClick={onRegenerateSection}
            disabled={isRegenerating}
            className="p-1 text-gray-400 hover:text-amber-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
            title="AI 재생성"
          >
            {isRegenerating ? (
              <span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              '↻'
            )}
          </button>
          <button
            onClick={onDelete}
            disabled={total <= 1}
            className="p-1 text-gray-400 hover:text-red-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
            title="삭제"
          >
            ×
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="px-4 py-3 text-sm space-y-2">
          <p className="text-gray-400">{section.description}</p>
          {section.searchQueries.length > 0 && (
            <div>
              <span className="text-gray-500 text-xs">검색 쿼리:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {section.searchQueries.map((q) => (
                  <span key={q} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}
          {section.keyPoints.length > 0 && (
            <div>
              <span className="text-gray-500 text-xs">핵심 포인트:</span>
              <ul className="mt-1 space-y-0.5">
                {section.keyPoints.map((p) => (
                  <li key={p} className="text-gray-400 text-xs flex items-start gap-1">
                    <span className="text-gray-600 mt-0.5">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddSectionForm({
  onAdd,
  onCancel,
}: {
  readonly onAdd: (data: AddSectionFormData) => void
  readonly onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), description: description.trim() })
    setTitle('')
    setDescription('')
  }

  return (
    <form onSubmit={handleSubmit} className="border border-dashed border-white/20 rounded-lg p-4 space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="섹션 제목"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        autoFocus
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="섹션 설명 (선택사항)"
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!title.trim()}
          className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          추가
        </button>
      </div>
    </form>
  )
}

export function OutlineEditor({
  projectId,
  outline: initialOutline,
  onStartResearch,
  onRegenerate,
  isRegenerating,
}: OutlineEditorProps) {
  const [sections, setSections] = useState<OutlineSection[]>([...initialOutline.sections])
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null)

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const moveSection = useCallback((index: number, direction: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev]
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }, [])

  const deleteSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const addSection = useCallback((data: AddSectionFormData) => {
    const newSection: OutlineSection = {
      id: generateSectionId(data.title),
      title: data.title,
      description: data.description,
      searchQueries: [],
      keyPoints: [],
    }
    setSections((prev) => [...prev, newSection])
    setShowAddForm(false)
  }, [])

  const handleRegenerateSection = useCallback(async (sectionId: string) => {
    setRegeneratingSectionId(sectionId)
    try {
      const currentOutline: ReportOutline = {
        ...initialOutline,
        sections,
      }
      const res = await fetch(`/api/projects/${projectId}/deep-research/outline/regenerate-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline: currentOutline, sectionId }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        setSections((prev) =>
          prev.map((s) => (s.id === sectionId ? data.data : s)),
        )
      }
    } catch {
      // Silently handle — user can retry
    } finally {
      setRegeneratingSectionId(null)
    }
  }, [projectId, initialOutline, sections])

  const handleStartResearch = useCallback(() => {
    const editedOutline: ReportOutline = {
      ...initialOutline,
      sections,
    }
    onStartResearch(editedOutline)
  }, [initialOutline, sections, onStartResearch])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-white font-medium">{initialOutline.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{sections.length}개 섹션 — 순서 변경, 추가, 삭제 후 리서치를 시작하세요</p>
        </div>
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="px-3 py-1.5 text-xs text-gray-400 border border-white/10 rounded-lg hover:text-white hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isRegenerating ? '재생성 중...' : '전체 재생성'}
        </button>
      </div>

      <div className="space-y-2">
        {sections.map((section, index) => (
          <SectionCard
            key={section.id}
            section={section}
            index={index}
            total={sections.length}
            collapsed={collapsedIds.has(section.id)}
            regeneratingSectionId={regeneratingSectionId}
            onToggleCollapse={() => toggleCollapse(section.id)}
            onMoveUp={() => moveSection(index, -1)}
            onMoveDown={() => moveSection(index, 1)}
            onDelete={() => deleteSection(index)}
            onRegenerateSection={() => handleRegenerateSection(section.id)}
          />
        ))}
      </div>

      {showAddForm ? (
        <AddSectionForm onAdd={addSection} onCancel={() => setShowAddForm(false)} />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-2 border border-dashed border-white/20 rounded-lg text-sm text-gray-400 hover:text-white hover:border-white/30 transition-all"
        >
          + 섹션 추가
        </button>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={handleStartResearch}
          disabled={sections.length === 0}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
        >
          리서치 시작
        </button>
      </div>
    </div>
  )
}
