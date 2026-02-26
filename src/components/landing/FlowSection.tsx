'use client'

import { AnimatedSection } from '@/components/ui/AnimatedSection'

const STEPS = [
  {
    number: '01',
    title: '대화형 설정',
    description: 'AI와 대화하며 리서치 주제와 범위를 정의합니다',
    gradient: 'from-indigo-500 to-violet-500',
  },
  {
    number: '02',
    title: '멀티소스 수집',
    description: 'Google, Naver, Daum, RSS에서 관련 기사를 수집합니다',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    number: '03',
    title: 'AI 분석',
    description: '기사를 분류하고 핵심 내용을 요약합니다',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    number: '04',
    title: '보고서 생성',
    description: '분석 결과를 종합한 전문 보고서를 생성합니다',
    gradient: 'from-pink-500 to-rose-500',
  },
]

export function FlowSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            간단한 4단계 워크플로우
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            복잡한 리서치 과정을 직관적인 워크플로우로 자동화
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <AnimatedSection key={step.number} delay={i * 0.15}>
              <div className="relative text-center">
                <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg`}>
                  {step.number}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-gradient-to-r from-white/20 to-transparent" />
                )}
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  )
}
