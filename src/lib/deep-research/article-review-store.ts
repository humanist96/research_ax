const REVIEW_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

interface PendingReview {
  readonly resolve: (excluded: ReadonlyMap<string, readonly string[]>) => void
  readonly reject: (reason: Error) => void
  readonly timer: ReturnType<typeof setTimeout>
}

const pendingReviews = new Map<string, PendingReview>()

export function waitForArticleReview(reportId: string): Promise<ReadonlyMap<string, readonly string[]>> {
  return new Promise<ReadonlyMap<string, readonly string[]>>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingReviews.delete(reportId)
      reject(new Error('Article review timed out after 30 minutes'))
    }, REVIEW_TIMEOUT_MS)

    pendingReviews.set(reportId, { resolve, reject, timer })
  })
}

export function submitArticleReview(reportId: string, excludedBySection: ReadonlyMap<string, readonly string[]>): boolean {
  const pending = pendingReviews.get(reportId)
  if (!pending) return false

  clearTimeout(pending.timer)
  pendingReviews.delete(reportId)
  pending.resolve(excludedBySection)
  return true
}

export function cancelArticleReview(reportId: string): void {
  const pending = pendingReviews.get(reportId)
  if (!pending) return

  clearTimeout(pending.timer)
  pendingReviews.delete(reportId)
  pending.reject(new Error('Article review cancelled'))
}

export function hasPendingReview(reportId: string): boolean {
  const pending = pendingReviews.get(reportId)
  return pending !== undefined
}
