'use client'

import { useState, useCallback } from 'react'
import { useNotebookLM } from '@/hooks/useNotebookLM'
import type { ArtifactType, ArtifactStatus } from '@/types/notebooklm'

interface NotebookLMPanelProps {
  readonly projectId: string
  readonly reportReady: boolean
}

interface ArtifactCardConfig {
  readonly type: ArtifactType
  readonly icon: string
  readonly label: string
  readonly description: string
}

const ARTIFACT_CARDS: readonly ArtifactCardConfig[] = [
  { type: 'audio', icon: '\u266B', label: '\uC624\uB514\uC624', description: 'AI \uB300\uD654\uD615 \uD31C\uCE90\uC2A4\uD2B8 \uC0DD\uC131' },
  { type: 'video', icon: '\u25B6', label: '\uBE44\uB514\uC624', description: '\uC560\uB2C8\uBA54\uC774\uC158/\uD654\uC774\uD2B8\uBCF4\uB4DC \uC601\uC0C1' },
  { type: 'slide-deck', icon: '\u25A3', label: '\uC2AC\uB77C\uC774\uB4DC', description: '\uBC1C\uD45C\uC6A9 \uC2AC\uB77C\uC774\uB4DC \uB371' },
  { type: 'quiz', icon: '\u2753', label: '\uD000\uC988', description: '\uC774\uD574\uB3C4 \uD14C\uC2A4\uD2B8 \uBB38\uC81C' },
  { type: 'flashcards', icon: '\u2B50', label: '\uD50C\uB798\uC2DC\uCE74\uB4DC', description: '\uD575\uC2EC \uAC1C\uB150 \uCE74\uB4DC' },
  { type: 'mind-map', icon: '\u26A1', label: '\uB9C8\uC778\uB4DC\uB9F5', description: '\uC8FC\uC81C \uAD00\uACC4\uB3C4' },
  { type: 'infographic', icon: '\u25C9', label: '\uC778\uD3EC\uADF8\uB798\uD53D', description: '\uC2DC\uAC01\uC801 \uC694\uC57D \uC774\uBBF8\uC9C0' },
  { type: 'data-table', icon: '\u2261', label: '\uB370\uC774\uD130 \uD14C\uC774\uBE14', description: '\uAD6C\uC870\uD654\uB41C \uB370\uC774\uD130 \uCD94\uCD9C' },
]

const AUDIO_STYLES = [
  { value: 'deep-dive', label: '\uB525 \uB2E4\uC774\uBE0C' },
  { value: 'conversation', label: '\uB300\uD654\uD615' },
  { value: 'briefing', label: '\uBE0C\uB9AC\uD551' },
  { value: 'summary', label: '\uC694\uC57D' },
] as const

const VIDEO_STYLES = [
  { value: 'whiteboard', label: '\uD654\uC774\uD2B8\uBCF4\uB4DC' },
  { value: 'anime', label: '\uC560\uB2C8\uBA54' },
  { value: 'kawaii', label: '\uCE74\uC640\uC774' },
  { value: 'documentary', label: '\uB2E4\uD050\uBA58\uD130\uB9AC' },
  { value: 'sketch', label: '\uC2A4\uCF00\uCE58' },
] as const

function getStatusColor(status: ArtifactStatus): string {
  const colors: Record<ArtifactStatus, string> = {
    pending: 'text-gray-500',
    processing: 'text-blue-400',
    complete: 'text-green-400',
    error: 'text-red-400',
  }
  return colors[status]
}

function getStatusLabel(status: ArtifactStatus): string {
  const labels: Record<ArtifactStatus, string> = {
    pending: '\uB300\uAE30',
    processing: '\uC0DD\uC131 \uC911...',
    complete: '\uC644\uB8CC',
    error: '\uC624\uB958',
  }
  return labels[status]
}

function ArtifactOptionsModal({
  card,
  onGenerate,
  onClose,
}: {
  readonly card: ArtifactCardConfig
  readonly onGenerate: (options: Record<string, unknown>) => void
  readonly onClose: () => void
}) {
  const [audioStyle, setAudioStyle] = useState('deep-dive')
  const [audioLength, setAudioLength] = useState('medium')
  const [videoStyle, setVideoStyle] = useState('whiteboard')
  const [quizDifficulty, setQuizDifficulty] = useState('medium')
  const [quizQuantity, setQuizQuantity] = useState('default')

  const handleGenerate = useCallback(() => {
    let options: Record<string, unknown> = {}
    if (card.type === 'audio') {
      options = { style: audioStyle, length: audioLength }
    } else if (card.type === 'video') {
      options = { style: videoStyle }
    } else if (card.type === 'quiz') {
      options = { difficulty: quizDifficulty, quantity: quizQuantity }
    }
    onGenerate(options)
  }, [card.type, audioStyle, audioLength, videoStyle, quizDifficulty, quizQuantity, onGenerate])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-semibold">{card.icon} {card.label} {'\uC635\uC158'}</h4>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg">
            {'\u2715'}
          </button>
        </div>

        <div className="space-y-4">
          {card.type === 'audio' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{'\uC2A4\uD0C0\uC77C'}</label>
                <div className="flex flex-wrap gap-2">
                  {AUDIO_STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setAudioStyle(s.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        audioStyle === s.value
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{'\uAE38\uC774'}</label>
                <div className="flex gap-2">
                  {(['short', 'medium', 'long'] as const).map((len) => (
                    <button
                      key={len}
                      onClick={() => setAudioLength(len)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all flex-1 ${
                        audioLength === len
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {{ short: '\uC9E7\uAC8C', medium: '\uBCF4\uD1B5', long: '\uAE38\uAC8C' }[len]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {card.type === 'video' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{'\uC2A4\uD0C0\uC77C'}</label>
              <div className="flex flex-wrap gap-2">
                {VIDEO_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setVideoStyle(s.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      videoStyle === s.value
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {card.type === 'quiz' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{'\uB09C\uC774\uB3C4'}</label>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setQuizDifficulty(d)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all flex-1 ${
                        quizDifficulty === d
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {{ easy: '\uC26C\uC6C0', medium: '\uBCF4\uD1B5', hard: '\uC5B4\uB824\uC6C0' }[d]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{'\uBB38\uC81C \uC218'}</label>
                <div className="flex gap-2">
                  {(['less', 'default', 'more'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuizQuantity(q)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all flex-1 ${
                        quizQuantity === q
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {{ less: '\uC801\uAC8C', default: '\uAE30\uBCF8', more: '\uB9CE\uC774' }[q]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {card.type !== 'audio' && card.type !== 'video' && card.type !== 'quiz' && (
            <p className="text-sm text-gray-400">{'\uAE30\uBCF8 \uC124\uC815\uC73C\uB85C \uC0DD\uC131\uD569\uB2C8\uB2E4.'}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 transition-all"
          >
            {'\uCDE8\uC18C'}
          </button>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:to-cyan-600 text-sm font-medium transition-all"
          >
            {'\uC0DD\uC131 \uC2DC\uC791'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChatSection({
  projectId,
  chatMessages,
  isChatLoading,
  onSendChat,
}: {
  readonly projectId: string
  readonly chatMessages: readonly { role: string; content: string; timestamp: string }[]
  readonly isChatLoading: boolean
  readonly onSendChat: (question: string) => void
}) {
  const [input, setInput] = useState('')

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isChatLoading) return
    onSendChat(trimmed)
    setInput('')
  }, [input, isChatLoading, onSendChat])

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <h4 className="text-sm font-medium text-gray-300 mb-3">{'\uBCF4\uACE0\uC11C \uC9C8\uBB38\uD558\uAE30'}</h4>

      {chatMessages.length > 0 && (
        <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
          {chatMessages.map((msg, i) => (
            <div
              key={`${msg.timestamp}-${i}`}
              className={`text-sm rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-500/10 text-blue-300 ml-8'
                  : 'bg-white/5 text-gray-300 mr-8'
              }`}
            >
              {msg.content}
            </div>
          ))}
          {isChatLoading && (
            <div className="bg-white/5 text-gray-500 rounded-lg px-3 py-2 text-sm mr-8 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {'\uC751\uB2F5 \uC0DD\uC131 \uC911...'}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'\uBCF4\uACE0\uC11C\uC5D0 \uB300\uD574 \uC9C8\uBB38\uD558\uC138\uC694...'}
          disabled={isChatLoading}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isChatLoading || !input.trim()}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
        >
          {'\uC804\uC1A1'}
        </button>
      </form>
    </div>
  )
}

export function NotebookLMPanel({ projectId, reportReady }: NotebookLMPanelProps) {
  const notebook = useNotebookLM(projectId)
  const [selectedCard, setSelectedCard] = useState<ArtifactCardConfig | null>(null)
  const [isChatExpanded, setIsChatExpanded] = useState(false)

  const handleGenerate = useCallback((options: Record<string, unknown>) => {
    if (!selectedCard) return
    notebook.generateArtifact(selectedCard.type, options)
    setSelectedCard(null)
  }, [selectedCard, notebook])

  const handleCardClick = useCallback((card: ArtifactCardConfig) => {
    const existing = notebook.getArtifact(card.type)
    if (existing?.status === 'processing') return
    setSelectedCard(card)
  }, [notebook])

  if (!reportReady) return null

  // Not yet created
  if (!notebook.notebookId) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">NotebookLM{'\uC73C\uB85C \uD655\uC7A5'}</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {'\uBCF4\uACE0\uC11C\uB97C \uC624\uB514\uC624, \uBE44\uB514\uC624, \uD000\uC988 \uB4F1 \uB2E4\uC591\uD55C \uCF58\uD150\uCE20\uB85C \uBCC0\uD658\uD569\uB2C8\uB2E4'}
            </p>
          </div>
          <button
            onClick={notebook.createNotebook}
            disabled={notebook.isCreating}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
          >
            {notebook.isCreating ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {'\uC0DD\uC131 \uC911...'}
              </span>
            ) : (
              'NotebookLM \uC0DD\uC131'
            )}
          </button>
        </div>
        {notebook.error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{notebook.error}</p>
          </div>
        )}
      </div>
    )
  }

  // Notebook created -- show generation hub
  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">NotebookLM {'\uCF58\uD150\uCE20 \uD5C8\uBE0C'}</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            {'\uBCF4\uACE0\uC11C\uB97C \uB2E4\uC591\uD55C \uD615\uD0DC\uB85C \uBCC0\uD658\uD569\uB2C8\uB2E4'}
          </p>
        </div>
      </div>

      {/* Artifact Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ARTIFACT_CARDS.map((card) => {
          const artifact = notebook.getArtifact(card.type)
          const isProcessing = artifact?.status === 'processing'
          const isComplete = artifact?.status === 'complete'
          const isError = artifact?.status === 'error'

          return (
            <div
              key={card.type}
              className={`relative rounded-lg border p-4 transition-all cursor-pointer group ${
                isComplete
                  ? 'border-green-500/20 bg-green-500/5 hover:border-green-500/40'
                  : isProcessing
                  ? 'border-blue-500/20 bg-blue-500/5'
                  : isError
                  ? 'border-red-500/20 bg-red-500/5 hover:border-red-500/40'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
              }`}
              onClick={() => handleCardClick(card)}
            >
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-sm font-medium text-gray-200">{card.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.description}</div>

              {/* Status indicator */}
              {artifact && (
                <div className={`mt-2 text-xs font-medium ${getStatusColor(artifact.status)}`}>
                  {isProcessing && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      {getStatusLabel(artifact.status)}
                    </span>
                  )}
                  {!isProcessing && getStatusLabel(artifact.status)}
                </div>
              )}

              {/* Download button for complete artifacts */}
              {isComplete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    notebook.downloadArtifact(card.type)
                  }}
                  className="absolute top-2 right-2 px-2 py-1 text-xs text-green-400 border border-green-500/30 rounded hover:bg-green-500/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  {'\uB2E4\uC6B4\uB85C\uB4DC'}
                </button>
              )}

              {/* Error tooltip */}
              {isError && artifact.error && (
                <div className="mt-1 text-xs text-red-400 truncate" title={artifact.error}>
                  {artifact.error}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Audio Player for completed audio */}
      {notebook.getArtifact('audio')?.status === 'complete' && (
        <div className="mt-4 p-3 bg-white/[0.02] border border-white/10 rounded-lg">
          <p className="text-xs text-gray-500 mb-2">{'\uC624\uB514\uC624 \uC7AC\uC0DD'}</p>
          <audio
            controls
            className="w-full"
            src={`/api/projects/${projectId}/notebooklm/artifacts/audio`}
          />
        </div>
      )}

      {/* Error Display */}
      {notebook.error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{notebook.error}</p>
        </div>
      )}

      {/* Chat Section Toggle */}
      <div className="mt-4">
        <button
          onClick={() => setIsChatExpanded((prev) => !prev)}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span className={`transition-transform ${isChatExpanded ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
          {'\uBCF4\uACE0\uC11C \uC9C8\uBB38\uD558\uAE30'}
        </button>
        {isChatExpanded && (
          <ChatSection
            projectId={projectId}
            chatMessages={notebook.chatMessages}
            isChatLoading={notebook.isChatLoading}
            onSendChat={notebook.sendChat}
          />
        )}
      </div>

      {/* Options Modal */}
      {selectedCard && (
        <ArtifactOptionsModal
          card={selectedCard}
          onGenerate={handleGenerate}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  )
}
