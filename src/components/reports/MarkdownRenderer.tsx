'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  readonly content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert prose-gray max-w-none prose-headings:text-white prose-p:text-gray-300 prose-a:text-indigo-400 prose-strong:text-white prose-code:text-indigo-300 prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-td:text-gray-300 prose-th:text-gray-200">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
