'use client'

import { useEffect, useRef, useState, useId } from 'react'

let mermaidInstance: typeof import('mermaid')['default'] | null = null
let initPromise: Promise<void> | null = null

function ensureMermaidInit(): Promise<void> {
  if (mermaidInstance) return Promise.resolve()
  if (initPromise) return initPromise

  initPromise = import('mermaid').then((mod) => {
    mermaidInstance = mod.default
    mermaidInstance.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#1e1e2e',
        primaryColor: '#2563eb',
        primaryTextColor: '#e2e8f0',
        primaryBorderColor: '#60a5fa',
        lineColor: '#94a3b8',
        secondaryColor: '#334155',
        tertiaryColor: '#1e293b',
      },
      flowchart: { curve: 'basis', padding: 16 },
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
    })
  })

  return initPromise
}

interface MermaidDiagramProps {
  readonly code: string
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uniqueId = useId().replace(/:/g, '-')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        await ensureMermaidInit()
        if (cancelled || !containerRef.current || !mermaidInstance) return

        const { svg } = await mermaidInstance.render(`mermaid-${uniqueId}`, code)
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = svg
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Mermaid rendering failed')
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [code, uniqueId])

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
        <p className="mb-2 text-xs text-yellow-400">Diagram rendering failed</p>
        <pre className="overflow-x-auto text-sm text-gray-400">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto rounded-lg border border-white/10 bg-white/5 p-4"
    />
  )
}
