import {
  PRIMARY_KEYWORDS,
  SECONDARY_KEYWORDS,
  SECURITIES_FIRMS,
  KEYWORD_WEIGHTS,
  MIN_RELEVANCE_SCORE,
} from '@/lib/config/sources'
import type { ProjectConfig } from '@/types'

interface MatchResult {
  readonly matchedKeywords: readonly string[]
  readonly relevanceScore: number
}

export function matchKeywords(
  title: string,
  content: string
): MatchResult {
  const text = `${title} ${content}`.toLowerCase()

  const matchedKeywords: string[] = []
  let relevanceScore = 0

  for (const keyword of PRIMARY_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword)
      relevanceScore += KEYWORD_WEIGHTS.primary
    }
  }

  for (const keyword of SECONDARY_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword)
      relevanceScore += KEYWORD_WEIGHTS.secondary
    }
  }

  for (const firm of SECURITIES_FIRMS) {
    if (text.includes(firm.toLowerCase())) {
      matchedKeywords.push(firm)
      relevanceScore += KEYWORD_WEIGHTS.securitiesFirm
    }
  }

  return { matchedKeywords, relevanceScore }
}

export function matchDynamicKeywords(
  title: string,
  content: string,
  config: ProjectConfig
): MatchResult {
  const text = `${title} ${content}`.toLowerCase()

  const matchedKeywords: string[] = []
  let relevanceScore = 0

  for (const keyword of config.keywords.primary) {
    if (text.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword)
      relevanceScore += config.keywordWeights.primary
    }
  }

  for (const keyword of config.keywords.secondary) {
    if (text.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword)
      relevanceScore += config.keywordWeights.secondary
    }
  }

  for (const entity of config.keywords.entities) {
    if (text.includes(entity.toLowerCase())) {
      matchedKeywords.push(entity)
      relevanceScore += config.keywordWeights.entity
    }
  }

  return { matchedKeywords, relevanceScore }
}

export function isRelevant(score: number, minScore?: number): boolean {
  return score >= (minScore ?? MIN_RELEVANCE_SCORE)
}
