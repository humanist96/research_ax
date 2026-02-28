'use client'

import { usePathname } from 'next/navigation'

interface ProjectTabsProps {
  readonly projectId: string
}

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const pathname = usePathname()

  const tabs = [
    { href: `/projects/${projectId}`, label: '대시보드' },
    { href: `/projects/${projectId}/news`, label: '뉴스' },
    { href: `/projects/${projectId}/reports`, label: '리포트' },
    { href: `/projects/${projectId}/chat`, label: '대화' },
  ]

  return (
    <div className="border-b border-white/10 mb-6">
      <nav className="flex space-x-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {tab.label}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
