// Content types that can be generated from reports via OpenAI
export type ArtifactType = 'quiz' | 'flashcards' | 'mind-map' | 'audio' | 'slide-deck'

export type ArtifactStatus = 'pending' | 'processing' | 'complete' | 'error'

// --- Result types ---

export interface QuizQuestion {
  readonly question: string
  readonly choices: readonly string[]
  readonly correctIndex: number
  readonly explanation: string
}

export interface QuizResult {
  readonly questions: readonly QuizQuestion[]
}

export interface Flashcard {
  readonly front: string
  readonly back: string
  readonly category?: string
}

export interface FlashcardsResult {
  readonly cards: readonly Flashcard[]
}

export interface MindMapNode {
  readonly id: string
  readonly label: string
  readonly children?: readonly MindMapNode[]
}

export interface MindMapResult {
  readonly root: MindMapNode
}

export interface Slide {
  readonly title: string
  readonly bullets: readonly string[]
  readonly speakerNotes?: string
}

export interface SlideResult {
  readonly slides: readonly Slide[]
}

// --- Artifact storage ---

export interface NotebookArtifact {
  readonly type: ArtifactType
  readonly status: ArtifactStatus
  readonly options: Record<string, unknown>
  readonly createdAt: string
  readonly completedAt?: string
  readonly error?: string
  readonly resultData?: unknown
  readonly resultPath?: string
}

export interface ProjectNotebookLM {
  readonly notebookId: string
  readonly createdAt: string
  readonly artifacts: readonly NotebookArtifact[]
}

// --- Generation options ---

export interface AudioOptions {
  readonly style?: 'deep-dive' | 'conversation' | 'briefing' | 'summary'
  readonly length?: 'short' | 'medium' | 'long'
}

export interface QuizOptions {
  readonly difficulty?: 'easy' | 'medium' | 'hard'
  readonly quantity?: 'less' | 'default' | 'more'
}

export interface SlideOptions {
  readonly slideCount?: number
}
