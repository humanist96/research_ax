export interface ReportOutline {
  readonly title: string
  readonly sections: readonly OutlineSection[]
  readonly executiveSummaryGuidance: string
}

export interface OutlineSection {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly searchQueries: readonly string[]
  readonly keyPoints: readonly string[]
}

export interface SectionResearchResult {
  readonly sectionId: string
  readonly title: string
  readonly content: string
  readonly sources: readonly SourceReference[]
}

export interface SourceReference {
  readonly title: string
  readonly url: string
  readonly source: string
  readonly publishedAt: string
}

export interface DeepReportMeta {
  readonly reportId: string
  readonly title: string
  readonly outline: ReportOutline
  readonly generatedAt: string
  readonly totalSources: number
  readonly sections: readonly DeepReportSectionMeta[]
}

export interface DeepReportSectionMeta {
  readonly id: string
  readonly title: string
  readonly sourcesCount: number
  readonly status: 'complete' | 'error'
}

export type DeepResearchEvent =
  | { readonly type: 'phase'; readonly phase: 'outline' | 'researching' | 'compiling' | 'pdf' | 'complete' | 'error'; readonly message: string }
  | { readonly type: 'outline'; readonly outline: ReportOutline }
  | { readonly type: 'section_status'; readonly sectionId: string; readonly status: 'pending' | 'searching' | 'analyzing' | 'deepening' | 'refining' | 'complete' | 'error'; readonly sourcesFound?: number; readonly message: string }
  | { readonly type: 'section_saved'; readonly sectionId: string; readonly title: string }
  | { readonly type: 'report_complete'; readonly reportId: string }
  | { readonly type: 'error'; readonly message: string }
