import { spawn } from 'child_process'

export interface ClaudeOptions {
  readonly model?: string
  readonly maxTokens?: number
}

export function callClaudeAsync(prompt: string, options?: ClaudeOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    delete env.CLAUDECODE

    const model = options?.model ?? 'opus'
    const args = ['--print', '--model', model]

    if (options?.maxTokens) {
      args.push('--max-tokens', String(options.maxTokens))
    }

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
