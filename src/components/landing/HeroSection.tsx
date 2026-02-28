'use client'

import { motion } from 'framer-motion'
import { GradientText } from '@/components/ui/GradientText'

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <GradientText as="h1" className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            AI 기반 종합 리서치 플랫폼
          </GradientText>
        </motion.div>

        <motion.p
          className="mt-4 text-xs font-semibold tracking-wider uppercase text-[#d4a06e]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          Financial Research Intelligence
        </motion.p>

        <motion.p
          className="mt-4 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          대화형 설정으로 리서치 범위를 정의하면, AI가 멀티소스 뉴스를 수집하고
          심층 분석하여 전문 보고서를 자동 생성합니다.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <a
            href="/projects"
            className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/25"
          >
            리서치 시작하기
          </a>
          <a
            href="#features"
            className="px-8 py-3.5 text-gray-300 border border-white/10 rounded-xl font-medium text-lg hover:bg-white/5 transition-all"
          >
            기능 알아보기
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
          <div className="w-1.5 h-2.5 bg-white/40 rounded-full" />
        </div>
      </motion.div>
    </section>
  )
}
