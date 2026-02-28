'use client'

import { usePathname } from 'next/navigation'

export function Navigation() {
  const pathname = usePathname()
  const isLanding = pathname === '/'

  return (
    <nav
      className={`${
        isLanding
          ? 'absolute top-0 left-0 right-0 z-50 bg-transparent'
          : 'sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <a href="/" className="text-white font-bold text-xl">
              <span className="gradient-text">Koscom <span className="text-[#d4a06e]">AI</span> Report</span>
            </a>
            {!isLanding && (
              <div className="ml-10 flex items-baseline space-x-1">
                <a
                  href="/projects"
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  워크스페이스
                </a>
              </div>
            )}
          </div>
          {isLanding && (
            <a
              href="/projects"
              className="px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 backdrop-blur transition-colors border border-white/10"
            >
              시작하기
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
