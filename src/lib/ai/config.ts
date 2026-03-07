export interface AIModelConfig {
  readonly reasoning: string
  readonly general: string
  readonly fast: string
}

const DEFAULT_MODELS: AIModelConfig = {
  reasoning: 'gpt-4o',
  general: 'gpt-4o',
  fast: 'gpt-4o-mini',
}

const DEFAULT_MAX_TOKENS: Record<string, number> = {
  reasoning: 16384,
  general: 8192,
  fast: 4096,
}

export type AIModelRole = keyof AIModelConfig

const MODEL_ROLE_MAP: Record<string, AIModelRole> = {
  opus: 'reasoning',
  sonnet: 'general',
  haiku: 'fast',
}

export function getModelConfig(override?: Partial<AIModelConfig>): AIModelConfig {
  return {
    reasoning: override?.reasoning ?? process.env.AI_MODEL_REASONING ?? DEFAULT_MODELS.reasoning,
    general: override?.general ?? process.env.AI_MODEL_GENERAL ?? DEFAULT_MODELS.general,
    fast: override?.fast ?? process.env.AI_MODEL_FAST ?? DEFAULT_MODELS.fast,
  }
}

export function resolveModel(role: AIModelRole | string, override?: Partial<AIModelConfig>): string {
  const mapped = MODEL_ROLE_MAP[role] ?? role
  const config = getModelConfig(override)
  if (mapped in config) {
    return config[mapped as AIModelRole]
  }
  return role
}

export function resolveMaxTokens(role: AIModelRole | string, explicit?: number): number {
  if (explicit !== undefined) return explicit
  const mapped = MODEL_ROLE_MAP[role] ?? role
  return DEFAULT_MAX_TOKENS[mapped] ?? 4096
}
