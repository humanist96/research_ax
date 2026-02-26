'use client'

import { motion } from 'framer-motion'

interface GlassCardProps {
  readonly children: React.ReactNode
  readonly className?: string
  readonly hover?: boolean
}

export function GlassCard({ children, className = '', hover = true }: GlassCardProps) {
  if (!hover) {
    return (
      <div className={`glass rounded-xl ${className}`}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={`glass glass-hover rounded-xl ${className}`}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  )
}
