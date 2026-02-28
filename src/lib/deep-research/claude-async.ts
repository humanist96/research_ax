import { spawn } from 'child_process'

export interface ClaudeOptions {
  readonly model?: string
  readonly maxTokens?: number
  readonly maxRetries?: number
}

const DEFAULT_MAX_TOKENS: Record<string, number> = {
  opus: 8192,
  sonnet: 4096,
  haiku: 2048,
}

function spawnClaude(prompt: string, options?: ClaudeOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    delete env.CLAUDECODE

    const model = options?.model ?? 'opus'
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS[model] ?? 4096
    const args = ['--print', '--model', model, '--max-tokens', String(maxTokens)]

    const child = spawn('claude', args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8')
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8')
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`))
        return
      }
      resolve(stdout.trim())
    })

    child.on('error', (err) => {
      reject(err)
    })

    child.stdin.write(prompt)
    child.stdin.end()
  })
}

export async function callClaudeAsync(
  prompt: string,
  options?: ClaudeOptions,
): Promise<string> {
  const maxRetries = options?.maxRetries ?? 2

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await spawnClaude(prompt, options)
    } catch (error) {
      const isLastAttempt = attempt === maxRetries
      if (isLastAttempt) {
        throw error
      }

      const backoffMs = 3000 * Math.pow(3, attempt) // 3s, 9s
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Claude CLI] Attempt ${attempt + 1} failed: ${msg}. Retrying in ${backoffMs / 1000}s...`)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }

  throw new Error('Unreachable: retry loop exited without returning or throwing')
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
