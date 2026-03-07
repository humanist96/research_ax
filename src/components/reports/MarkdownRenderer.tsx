'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MermaidDiagram } from './MermaidDiagram'

interface MarkdownRendererProps {
  readonly content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert prose-gray max-w-none prose-headings:text-white prose-p:text-gray-300 prose-a:text-blue-400 prose-strong:text-white prose-code:text-blue-300 prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-td:text-gray-300 prose-th:text-gray-200 prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-500/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic">
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
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-full divide-y divide-white/10">
                  {children}
                </table>
              </div>
            )
          },
          thead({ children }) {
            return (
              <thead className="bg-white/5">
                {children}
              </thead>
            )
          },
          th({ children }) {
            return (
              <th className="px-4 py-2.5 text-left text-sm font-semibold text-gray-200 whitespace-nowrap">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="px-4 py-2 text-sm text-gray-300 border-t border-white/5">
                {children}
              </td>
            )
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-4 border-l-4 border-blue-500 bg-blue-500/5 rounded-r-lg py-3 px-5 text-gray-200 not-italic [&>p]:mb-0">
                {children}
              </blockquote>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
