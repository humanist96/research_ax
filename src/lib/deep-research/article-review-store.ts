interface PendingReview {
  readonly resolve: (excluded: ReadonlyMap<string, readonly string[]>) => void
  readonly reject: (reason: Error) => void
}

const pendingReviews = new Map<string, PendingReview>()

export function waitForArticleReview(reportId: string): Promise<ReadonlyMap<string, readonly string[]>> {
  return new Promise<ReadonlyMap<string, readonly string[]>>((resolve, reject) => {
    pendingReviews.set(reportId, { resolve, reject })
  })
}

export function submitArticleReview(reportId: string, excludedBySection: ReadonlyMap<string, readonly string[]>): boolean {
  const pending = pendingReviews.get(reportId)
  if (!pending) return false

  pendingReviews.delete(reportId)
  pending.resolve(excludedBySection)
  return true
}

export function cancelArticleReview(reportId: string): void {
  const pending = pendingReviews.get(reportId)
  if (!pending) return

  pendingReviews.delete(reportId)
  pending.reject(new Error('Article review cancelled'))
}

export function hasPendingReview(reportId: string): boolean {
  return pendingReviews.has(reportId)
}
