export type ArtifactType = 'audio' | 'video' | 'slide-deck' | 'quiz' | 'flashcards' | 'mind-map' | 'infographic' | 'data-table'
export type ArtifactStatus = 'pending' | 'processing' | 'complete' | 'error'

export interface NotebookArtifact {
  readonly type: ArtifactType
  readonly status: ArtifactStatus
  readonly taskId?: string
  readonly options: Record<string, unknown>
  readonly createdAt: string
  readonly completedAt?: string
  readonly error?: string
}

export interface ProjectNotebookLM {
  readonly notebookId: string
  readonly createdAt: string
  readonly artifacts: readonly NotebookArtifact[]
}

export interface AudioOptions {
  readonly style?: 'deep-dive' | 'conversation' | 'briefing' | 'summary'
  readonly length?: 'short' | 'medium' | 'long'
  readonly language?: string
}

export interface VideoOptions {
  readonly style?: 'whiteboard' | 'anime' | 'kawaii' | 'documentary' | 'sketch'
}

export interface QuizOptions {
  readonly quantity?: 'less' | 'default' | 'more'
  readonly difficulty?: 'easy' | 'medium' | 'hard'
}

export interface SlideOptions {
  readonly layout?: 'standard' | 'compact'
  readonly length?: number
}
