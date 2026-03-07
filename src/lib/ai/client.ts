import OpenAI from 'openai'
import type { AIModelConfig, AIModelRole } from './config'
import { resolveModel, resolveMaxTokens } from './config'

let clientInstance: OpenAI | null = null

function getClient(): OpenAI {
  if (!clientInstance) {
    clientInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return clientInstance
}

export interface CallAIOptions {
  readonly model?: AIModelRole | string
  readonly maxTokens?: number
  readonly maxRetries?: number
  readonly modelOverride?: Partial<AIModelConfig>
  readonly temperature?: number
}

export async function callAI(
  prompt: string,
  options?: CallAIOptions,
): Promise<string> {
  const maxRetries = options?.maxRetries ?? 2
  const model = resolveModel(options?.model ?? 'general', options?.modelOverride)
  const maxTokens = resolveMaxTokens(options?.model ?? 'general', options?.maxTokens)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const client = getClient()
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        temperature: options?.temperature ?? 0.7,
        messages: [{ role: 'user', content: prompt }],
      })

      return response.choices[0]?.message?.content?.trim() ?? ''
    } catch (error) {
      const isLastAttempt = attempt === maxRetries
      if (isLastAttempt) {
        throw error
      }

      const backoffMs = 3000 * Math.pow(3, attempt)
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[AI] Attempt ${attempt + 1} failed: ${msg}. Retrying in ${backoffMs / 1000}s...`)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }

  throw new Error('Unreachable: retry loop exited without returning or throwing')
}

export async function* streamAI(
  prompt: string,
  options?: CallAIOptions,
): AsyncGenerator<string, string, undefined> {
  const model = resolveModel(options?.model ?? 'general', options?.modelOverride)
  const maxTokens = resolveMaxTokens(options?.model ?? 'general', options?.maxTokens)
  const client = getClient()

  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature: options?.temperature ?? 0.7,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  })

  let fullText = ''

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content ?? ''
    if (content) {
      fullText += content
      yield content
    }
  }

  return fullText
}

interface ConcurrencyLimiter {
  run<T>(fn: () => Promise<T>): Promise<T>
}

export function createConcurrencyLimiter(max: number): ConcurrencyLimiter {
  let activeCount = 0
  const queue: Array<() => void> = []

  function tryNext(): void {
    if (activeCount >= max || queue.length === 0) return
    activeCount++
    const next = queue.shift()!
    next()
  }

  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        queue.push(() => {
          fn()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              activeCount--
              tryNext()
            })
        })
        tryNext()
      })
    },
  }
}
