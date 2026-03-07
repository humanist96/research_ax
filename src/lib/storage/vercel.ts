import { Redis } from '@upstash/redis'
import type { StorageAdapter } from './types'

export function createVercelStorage(): StorageAdapter {
  const redis = Redis.fromEnv()

  // Use a prefix for blob-like keys to separate them from KV keys
  const blobKey = (path: string) => `blob:${path}`

  return {
    async getJSON<T>(key: string, fallback: T): Promise<T> {
      try {
        const data = await redis.get<T>(key)
        return data ?? fallback
      } catch {
        return fallback
      }
    },

    async setJSON(key: string, data: unknown): Promise<void> {
      await redis.set(key, JSON.stringify(data))
    },

    async deleteKey(key: string): Promise<void> {
      await redis.del(key)
    },

    async getBlob(path: string): Promise<Buffer | null> {
      try {
        const data = await redis.get<string>(blobKey(path))
        if (data === null) return null
        return Buffer.from(data, 'base64')
      } catch {
        return null
      }
    },

    async getBlobText(path: string): Promise<string | null> {
      try {
        const data = await redis.get<string>(blobKey(path))
        return data ?? null
      } catch {
        return null
      }
    },

    async putBlob(path: string, data: Buffer | string): Promise<void> {
      if (Buffer.isBuffer(data)) {
        await redis.set(blobKey(path), data.toString('base64'))
      } else {
        await redis.set(blobKey(path), data)
      }
    },

    async deleteBlob(path: string): Promise<void> {
      await redis.del(blobKey(path))
    },

    async listKeys(prefix: string): Promise<string[]> {
      try {
        const keys: string[] = []
        let cursor = '0'
        do {
          const [nextCursor, batch] = await redis.scan(cursor, { match: `${prefix}:*`, count: 100 }) as [string, string[]]
          cursor = nextCursor
          keys.push(...batch)
        } while (cursor !== '0')
        return keys
      } catch {
        return []
      }
    },

    async listBlobs(prefix: string): Promise<string[]> {
      try {
        const keys: string[] = []
        let cursor = '0'
        do {
          const [nextCursor, batch] = await redis.scan(cursor, { match: `blob:${prefix}*`, count: 100 }) as [string, string[]]
          cursor = nextCursor
          keys.push(...batch)
        } while (cursor !== '0')
        // Strip the "blob:" prefix to return clean paths
        return keys.map((k) => k.slice(5))
      } catch {
        return []
      }
    },
  }
}
