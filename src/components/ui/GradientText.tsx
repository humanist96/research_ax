interface GradientTextProps {
  readonly children: React.ReactNode
  readonly as?: 'h1' | 'h2' | 'h3' | 'span' | 'p'
  readonly className?: string
}

export function GradientText({ children, as: Tag = 'span', className = '' }: GradientTextProps) {
  return (
    <Tag className={`gradient-text ${className}`}>
      {children}
    </Tag>
  )
}
