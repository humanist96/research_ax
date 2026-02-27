export function filterByKeywordBlacklist<T extends { readonly title: string; readonly content: string }>(
  articles: readonly T[],
  blacklist: readonly string[],
): readonly T[] {
  if (blacklist.length === 0) return articles

  const lowerBlacklist = blacklist.map((kw) => kw.toLowerCase().trim()).filter(Boolean)
  if (lowerBlacklist.length === 0) return articles

  return articles.filter((article) => {
    const titleLower = article.title.toLowerCase()
    const contentLower = article.content.toLowerCase()
    return !lowerBlacklist.some((kw) => titleLower.includes(kw) || contentLower.includes(kw))
  })
}
