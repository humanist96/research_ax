import type { StorageAdapter } from './types'
import { createLocalStorage } from './local'

export type { StorageAdapter } from './types'

let storageInstance: StorageAdapter | null = null

function shouldUseVercel(): boolean {
  const backend = process.env.STORAGE_BACKEND?.trim()
  if (backend === 'vercel') return true
  if (backend === 'local') return false
  // Auto-detect: Vercel sets VERCEL=1 on all deployments
  return process.env.VERCEL === '1'
}

export function getStorage(): StorageAdapter {
  if (storageInstance) return storageInstance

  if (shouldUseVercel()) {
    const { createVercelStorage } = require('./vercel') as typeof import('./vercel')
    storageInstance = createVercelStorage()
  } else {
    storageInstance = createLocalStorage()
  }

  return storageInstance
}
