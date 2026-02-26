'use client'

import { AnimatedSection } from '@/components/ui/AnimatedSection'

export function CTASection() {
  return (
    <section className="py-24 px-4">
      <AnimatedSection>
        <div className="max-w-4xl mx-auto text-center glass rounded-2xl p-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-8 text-lg">
            리서치 주제를 입력하면 AI가 대화를 통해 범위를 설정하고, 자동으로 뉴스를 수집/분석하여 보고서를 생성합니다.
          </p>
          <a
            href="/projects"
            className="inline-block px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-semibold text-lg hover:from-indigo-600 hover:to-violet-600 transition-all shadow-lg shadow-indigo-500/25"
          >
            리서치 시작하기
          </a>
        </div>
      </AnimatedSection>
    </section>
  )
}
