import type { StorageAdapter } from './types'
import { createLocalStorage } from './local'

export type { StorageAdapter } from './types'

let storageInstance: StorageAdapter | null = null

export function getStorage(): StorageAdapter {
  if (storageInstance) return storageInstance

  const backend = process.env.STORAGE_BACKEND ?? 'local'

  if (backend === 'vercel') {
    // Dynamic import to avoid bundling vercel packages locally
    const { createVercelStorage } = require('./vercel') as typeof import('./vercel')
    storageInstance = createVercelStorage()
  } else {
    storageInstance = createLocalStorage()
  }

  return storageInstance
}
