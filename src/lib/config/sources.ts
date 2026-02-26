import type { RssSource } from '@/types'

export const RSS_SOURCES: readonly RssSource[] = [
  {
    name: '한국경제 증권',
    url: 'https://rss.hankyung.com/stock.xml',
    category: 'stock',
  },
  {
    name: '한국경제 IT',
    url: 'https://rss.hankyung.com/it.xml',
    category: 'it',
  },
  {
    name: '매일경제 증권',
    url: 'https://file.mk.co.kr/news/rss/rss_50200011.xml',
    category: 'stock',
  },
  {
    name: '파이낸셜뉴스',
    url: 'https://www.fnnews.com/rss/fn_realnews_it.xml',
    category: 'it',
  },
] as const

export const PRIMARY_KEYWORDS = [
  '증권사 AI',
  '증권 AI',
  '증권 AX',
  '금융 AI',
  'AI 트레이딩',
  '로보어드바이저',
  'AI 투자',
  'AI 자산관리',
  '에이전트 트랜스포메이션',
] as const

export const SECONDARY_KEYWORDS = [
  'RPA',
  '챗봇',
  '디지털전환',
  '퀀트',
  'AI 자산관리',
  '생성형 AI',
  'LLM',
  '대규모 언어모델',
  'GPT',
  'AI 애널리스트',
] as const

export const SECURITIES_FIRMS = [
  '삼성증권',
  '미래에셋증권',
  'NH투자증권',
  'KB증권',
  '한국투자증권',
  '신한투자증권',
  '하나증권',
  '대신증권',
  '키움증권',
  '메리츠증권',
  '유안타증권',
  'IBK투자증권',
  'DB금융투자',
  '교보증권',
  '현대차증권',
  'SK증권',
  '한화투자증권',
  '이베스트투자증권',
  '토스증권',
  '카카오페이증권',
  '코스콤',
] as const

export const GOOGLE_NEWS_RSS_BASE = 'https://news.google.com/rss/search'

export const KEYWORD_WEIGHTS = {
  primary: 3,
  secondary: 1,
  securitiesFirm: 2,
} as const

export const MIN_RELEVANCE_SCORE = 3
