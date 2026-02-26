import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Koscom AI Report',
  description: '대화형 리서치 설정으로 최적의 뉴스 분석 보고서를 자동 생성합니다',
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
    >
      {children}
    </a>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-gray-900 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <a href="/" className="text-white font-bold text-xl">
                  Koscom AI Report
                </a>
                <div className="ml-10 flex items-baseline space-x-1">
                  <NavLink href="/">홈</NavLink>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="bg-gray-900 text-gray-400 py-6 mt-16">
          <div className="max-w-7xl mx-auto px-4 text-center text-sm">
            Koscom AI Report - 범용 리서치 리포트 플랫폼
          </div>
        </footer>
      </body>
    </html>
  )
}
