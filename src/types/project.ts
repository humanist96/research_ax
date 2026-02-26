import type { RssSource } from './index'

export interface ResearchProject {
  readonly id: string
  readonly name: string
  readonly prompt: string
  readonly conversation: readonly ConversationTurn[]
  readonly status: ProjectStatus
  readonly config: ProjectConfig | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ConversationTurn {
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly timestamp: string
}

export type ProjectStatus =
  | 'conversation'
  | 'configuring'
  | 'ready'
  | 'collecting'
  | 'analyzing'
  | 'reporting'
  | 'researching'
  | 'complete'
  | 'error'

export interface ProjectConfig {
  readonly keywords: {
    readonly primary: readonly string[]
    readonly secondary: readonly string[]
    readonly entities: readonly string[]
  }
  readonly categories: readonly CategoryDefinition[]
  readonly searchQueries: readonly string[]
  readonly rssSources: readonly RssSource[]
  readonly domainContext: string
  readonly reportTitle: string
  readonly keywordWeights: {
    readonly primary: number
    readonly secondary: number
    readonly entity: number
  }
  readonly minRelevanceScore: number
}

export interface CategoryDefinition {
  readonly id: string
  readonly label: string
  readonly description: string
}
