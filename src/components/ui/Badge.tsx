interface BadgeProps {
  readonly children: React.ReactNode
  readonly variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'blue'
  readonly className?: string
  readonly pulse?: boolean
}

const VARIANT_CLASSES: Record<string, string> = {
  default: 'bg-gray-500/20 text-gray-300',
  success: 'bg-green-500/20 text-green-300',
  warning: 'bg-yellow-500/20 text-yellow-300',
  error: 'bg-red-500/20 text-red-300',
  info: 'bg-blue-500/20 text-blue-300',
  purple: 'bg-purple-500/20 text-purple-300',
  blue: 'bg-blue-500/20 text-blue-300',
}

export function Badge({ children, variant = 'default', className = '', pulse = false }: BadgeProps) {
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${VARIANT_CLASSES[variant]} ${className}`}>
      {pulse && (
        <span className="w-2 h-2 rounded-full bg-current mr-1 animate-pulse" />
      )}
      {children}
    </span>
  )
}
