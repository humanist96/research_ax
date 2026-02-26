'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatedSection } from '@/components/ui/AnimatedSection'

function useCountUp(end: number, duration: number = 2000) {
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
            if (progress < 1) {
              requestAnimationFrame(update)
            }
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

const STATS = [
  { label: 'Google News', value: 4, suffix: '개 소스', gradient: 'from-blue-500 to-cyan-400' },
  { label: 'Naver API', value: 100, suffix: '건+', gradient: 'from-green-500 to-emerald-400' },
  { label: 'Daum API', value: 100, suffix: '건+', gradient: 'from-yellow-500 to-orange-400' },
  { label: 'RSS 피드', value: 20, suffix: '개+', gradient: 'from-violet-500 to-purple-400' },
]

export function StatsSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            폭넓은 소스 커버리지
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            다양한 소스에서 관련 뉴스를 빠짐없이 수집합니다
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StatCard({ label, value, suffix, gradient }: { label: string; value: number; suffix: string; gradient: string }) {
  const { count, ref } = useCountUp(value)

  return (
    <AnimatedSection>
      <div ref={ref} className="glass rounded-xl p-6 text-center">
        <div className={`text-4xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent mb-1`}>
          {count}{suffix.startsWith('+') ? '' : ''}<span className="text-lg">{suffix}</span>
        </div>
        <div className="text-gray-400 text-sm">{label}</div>
      </div>
    </AnimatedSection>
  )
}
