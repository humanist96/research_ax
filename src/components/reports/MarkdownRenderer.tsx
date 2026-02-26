'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MermaidDiagram } from './MermaidDiagram'

interface MarkdownRendererProps {
  readonly content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert prose-gray max-w-none prose-headings:text-white prose-p:text-gray-300 prose-a:text-indigo-400 prose-strong:text-white prose-code:text-indigo-300 prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-td:text-gray-300 prose-th:text-gray-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? '')
            if (match?.[1] === 'mermaid') {
              return <MermaidDiagram code={String(children).trim()} />
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
