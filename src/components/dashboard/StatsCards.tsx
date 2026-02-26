'use client'

import { useEffect, useRef, useState } from 'react'
import type { AnalyzedArticle } from '@/types'

interface StatsCardsProps {
  readonly articles: readonly AnalyzedArticle[]
  readonly categoryLabels?: Record<string, string>
}

function useCountUp(end: number, duration: number = 1200) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const counted = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true
          const start = performance.now()
          function update(now: number) {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(eased * end))
            if (progress < 1) requestAnimationFrame(update)
          }
          requestAnimationFrame(update)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration])

  return { count, ref }
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const numericValue = typeof value === 'number' ? value : 0
  const { count, ref } = useCountUp(numericValue)
  const displayValue = typeof value === 'number' ? count : value

  return (
    <div ref={ref} className="glass rounded-xl p-6">
      <div className={`inline-block px-2 py-1 rounded text-white text-xs ${color} mb-2`}>
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{displayValue}</div>
    </div>
  )
}

export function StatsCards({ articles, categoryLabels = {} }: StatsCardsProps) {
  const totalArticles = articles.length
  const todayStr = new Date().toISOString().split('T')[0]
  const todayCount = articles.filter(
    (a) => a.collectedAt.split('T')[0] === todayStr
  ).length

  const categoryCounts: Record<string, number> = {}
  for (const article of articles) {
    categoryCounts[article.category] = (categoryCounts[article.category] ?? 0) + 1
  }
  const categoryCount = Object.keys(categoryCounts).length

  const topCategory = Object.entries(categoryCounts).reduce(
    (max, [cat, count]) => (count > max.count ? { category: cat, count } : max),
    { category: '', count: 0 }
  )

  const topCategoryLabel = categoryLabels[topCategory.category] ?? topCategory.category

  const stats = [
    { label: '총 기사 수', value: totalArticles, color: 'bg-blue-500' },
    { label: '오늘 수집', value: todayCount, color: 'bg-green-500' },
    { label: '카테고리', value: categoryCount, color: 'bg-purple-500' },
    {
      label: '최다 카테고리',
      value: topCategoryLabel || '-',
      color: 'bg-orange-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  )
}
