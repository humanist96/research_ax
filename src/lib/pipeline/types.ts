export type PipelineEvent =
  | { readonly type: 'phase'; readonly phase: 'collecting' | 'analyzing' | 'reporting' | 'complete' | 'error'; readonly message: string }
  | { readonly type: 'source_search'; readonly source: string; readonly count: number; readonly message: string }
  | { readonly type: 'collection_progress'; readonly total: number; readonly relevant: number; readonly message: string }
  | { readonly type: 'analysis_batch'; readonly batchIndex: number; readonly totalBatches: number; readonly step: 'categorizing' | 'summarizing'; readonly message: string }
  | { readonly type: 'analysis_progress'; readonly analyzed: number; readonly total: number; readonly message: string }
  | { readonly type: 'curation_progress'; readonly before: number; readonly after: number; readonly clusters: number; readonly message: string }
  | { readonly type: 'report_progress'; readonly message: string }
  | { readonly type: 'stats'; readonly articlesCollected: number; readonly articlesAnalyzed: number; readonly reportGenerated: boolean }
  | { readonly type: 'error'; readonly message: string }
