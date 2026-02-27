'use client'

import { useState } from 'react'
import type { ProjectConfig } from '@/types'
import type { ConversationTurn } from '@/types/project'

interface UserChoice {
  readonly label: string
  readonly value: string
}

function parseUserChoices(conversation: readonly ConversationTurn[]): readonly UserChoice[] {
  const choices: UserChoice[] = []

  for (const turn of conversation) {
    if (turn.role !== 'user') continue

    const lines = turn.content.split('\n')
    for (const line of lines) {
      const match = line.match(/^\[(.+?)\]\s*(.+)$/)
      if (match) {
        choices.push({ label: match[1], value: match[2] })
      }
    }
  }

  return choices
}

const SOURCE_LABELS: Record<string, string> = {
  googleNews: 'Google 뉴스',
  rss: 'RSS 피드',
  naverNews: '네이버 뉴스',
  naverBlog: '네이버 블로그',
  daumWeb: '다음 웹',
  daumBlog: '다음 블로그',
}

interface ConfigPreviewProps {
  readonly config: ProjectConfig
  readonly conversation: readonly ConversationTurn[]
  readonly initialPrompt: string
  readonly defaultExpanded?: boolean
}

export function ConfigPreview({
  config,
  conversation,
  initialPrompt,
  defaultExpanded = true,
}: ConfigPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const userChoices = parseUserChoices(conversation)

  const enabledSources = config.collectionSources
    ? Object.entries(config.collectionSources)
        .filter(([, enabled]) => enabled)
        .map(([key]) => SOURCE_LABELS[key] ?? key)
    : []

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header — always visible, toggles expand */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
      >
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span className="text-base">리서치 설정</span>
        </h3>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 space-y-5">
          {/* Section 1: Title + Domain Context */}
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                리포트 제목
              </h4>
              <p className="text-sm text-white font-medium">{config.reportTitle}</p>
            </div>

            {config.domainContext && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  리서치 범위
                </h4>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {config.domainContext}
                </p>
              </div>
            )}
          </div>

          {/* Section 2: User Choices */}
          {userChoices.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                내가 선택한 설정
              </h4>
              <div className="space-y-2">
                {userChoices.map((choice, i) => (
                  <div key={`${choice.label}-${i}`} className="flex items-start gap-2 text-sm">
                    <span className="text-gray-500 shrink-0">{choice.label}</span>
                    <span className="text-gray-600 shrink-0">—</span>
                    <span className="text-gray-200">{choice.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: AI Generated Config (collapsible) */}
          <div className="border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setIsDetailOpen((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
            >
              <span>AI가 구성한 상세 설정</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform ${isDetailOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isDetailOpen && (
              <div className="mt-3 space-y-4">
                {/* Primary Keywords */}
                <div>
                  <h5 className="text-sm font-medium text-gray-300 mb-2">핵심 키워드</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {config.keywords.primary.map((kw) => (
                      <span
                        key={kw}
                        className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Secondary Keywords */}
                {config.keywords.secondary.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-300 mb-2">보조 키워드</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {config.keywords.secondary.map((kw) => (
                        <span
                          key={kw}
                          className="text-xs bg-gray-500/20 text-gray-300 px-2 py-1 rounded"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Entities */}
                {config.keywords.entities.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-300 mb-2">주요 기업/엔터티</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {config.keywords.entities.map((ent) => (
                        <span
                          key={ent}
                          className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded"
                        >
                          {ent}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories */}
                <div>
                  <h5 className="text-sm font-medium text-gray-300 mb-2">분석 카테고리</h5>
                  <div className="space-y-1">
                    {config.categories.map((cat) => (
                      <div key={cat.id} className="text-sm">
                        <span className="font-medium text-gray-300">{cat.label}</span>
                        <span className="text-gray-500 ml-2">— {cat.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Search Queries */}
                <div>
                  <h5 className="text-sm font-medium text-gray-300 mb-2">검색 쿼리</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {config.searchQueries.map((q) => (
                      <span
                        key={q}
                        className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded"
                      >
                        {q}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Collection Sources */}
                <div>
                  <h5 className="text-sm font-medium text-gray-300 mb-2">수집 소스</h5>
                  {enabledSources.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {enabledSources.map((source) => (
                        <span
                          key={source}
                          className="inline-flex items-center gap-1 text-xs text-emerald-300 bg-emerald-500/15 px-2 py-1 rounded"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {source}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {config.rssSources.length}개 RSS 피드
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Initial Prompt (subtle footer) */}
          {initialPrompt && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs text-gray-600">
                <span className="text-gray-500">초기 요청:</span> {initialPrompt}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
