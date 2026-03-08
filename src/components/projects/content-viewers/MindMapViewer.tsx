'use client'

import { useState, useCallback } from 'react'
import type { MindMapResult, MindMapNode } from '@/types/notebooklm'

interface MindMapViewerProps {
  readonly data: MindMapResult
}

function TreeNode({ node, depth }: { readonly node: MindMapNode; readonly depth: number }) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)
  const hasChildren = node.children && node.children.length > 0

  const toggleExpand = useCallback(() => {
    setIsExpanded((e) => !e)
  }, [])

  const depthColors = [
    'text-blue-400 border-blue-500/30',
    'text-cyan-400 border-cyan-500/30',
    'text-teal-400 border-teal-500/30',
  ]
  const colorClass = depthColors[Math.min(depth, depthColors.length - 1)]

  return (
    <div className={depth > 0 ? 'ml-4 mt-1' : ''}>
      <button
        onClick={hasChildren ? toggleExpand : undefined}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all ${
          hasChildren ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'
        } ${colorClass}`}
      >
        {hasChildren && (
          <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
            {'\u25B6'}
          </span>
        )}
        {!hasChildren && <span className="text-xs text-gray-600">{'\u25CF'}</span>}
        <span className={depth === 0 ? 'font-semibold text-white' : ''}>{node.label}</span>
      </button>

      {isExpanded && hasChildren && (
        <div className={`border-l ${colorClass.split(' ')[1]} ml-3`}>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function MindMapViewer({ data }: MindMapViewerProps) {
  return (
    <div className="max-h-80 overflow-y-auto">
      <TreeNode node={data.root} depth={0} />
    </div>
  )
}
