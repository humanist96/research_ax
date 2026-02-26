export type CollectionSourceType =
  | 'google-news'
  | 'rss'
  | 'naver-news'
  | 'naver-blog'
  | 'daum-web'
  | 'daum-blog'

export interface SearchResult {
  readonly title: string
  readonly link: string
  readonly content: string
  readonly pubDate: string
  readonly source: string
  readonly sourceType: CollectionSourceType
}

export interface SearchOptions {
  readonly maxResults?: number
  readonly timeoutMs?: number
}

export interface AggregateSearchOptions {
  readonly queries: readonly string[]
  readonly maxResultsPerSource?: number
  readonly enrichBodies?: boolean
  readonly maxEnrichConcurrency?: number
}

export interface CollectionSourceConfig {
  readonly googleNews?: boolean
  readonly rss?: boolean
  readonly naverNews?: boolean
  readonly naverBlog?: boolean
  readonly daumWeb?: boolean
  readonly daumBlog?: boolean
}
