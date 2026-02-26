import type { Metadata } from 'next'
import { Navigation } from '@/components/ui/Navigation'
import './globals.css'

export const metadata: Metadata = {
  title: 'Koscom AI Report',
  description: '대화형 리서치 설정으로 최적의 뉴스 분석 보고서를 자동 생성합니다',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-slate-950 text-gray-100 min-h-screen">
        <Navigation />
        <main>
          {children}
        </main>
        <footer className="bg-slate-900/50 border-t border-white/5 text-gray-500 py-6 mt-16">
          <div className="max-w-7xl mx-auto px-4 text-center text-sm">
            Koscom AI Report - AI 기반 종합 리서치 플랫폼
          </div>
        </footer>
      </body>
    </html>
  )
}
