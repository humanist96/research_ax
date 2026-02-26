export interface Article {
  readonly id: string
  readonly title: string
  readonly url: string
  readonly source: string
  readonly publishedAt: string
  readonly content: string
  readonly matchedKeywords: readonly string[]
  readonly relevanceScore: number
  readonly collectedAt: string
}

export interface AnalyzedArticle extends Article {
  readonly category: string
  readonly summary: string
  readonly analyzedAt: string
}

export interface RssSource {
  readonly name: string
  readonly url: string
  readonly category: string
}

export interface CollectionLog {
  readonly timestamp: string
  readonly sourcesChecked: number
  readonly articlesFound: number
  readonly articlesAdded: number
  readonly errors: readonly string[]
}

export interface ReportMeta {
  readonly id: string
  readonly title: string
  readonly startDate: string
  readonly endDate: string
  readonly generatedAt: string
  readonly totalArticles: number
  readonly categoryBreakdown: Record<string, number>
  readonly type?: 'standard' | 'deep-research'
  readonly sectionLabels?: Record<string, string>
}

export interface ReportIndex {
  readonly reports: readonly ReportMeta[]
}

export type { ResearchProject, ProjectConfig, ProjectStatus, ConversationTurn, CategoryDefinition } from './project'
