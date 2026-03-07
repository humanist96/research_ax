import { Redis } from '@upstash/redis'
import type { StorageAdapter } from './types'

export function createVercelStorage(): StorageAdapter {
  const redis = Redis.fromEnv()

  const blobKey = (path: string) => `blob:${path}`

  return {
    async getJSON<T>(key: string, fallback: T): Promise<T> {
      try {
        // Upstash redis.get auto-parses JSON, so we get T directly
        const data = await redis.get<T>(key)
        return data ?? fallback
      } catch {
        return fallback
      }
    },

    async setJSON(key: string, data: unknown): Promise<void> {
      // Upstash redis.set auto-serializes objects, so pass data directly (not JSON.stringify)
      await redis.set(key, data)
    },

    async deleteKey(key: string): Promise<void> {
      await redis.del(key)
    },

    async getBlob(path: string): Promise<Buffer | null> {
      try {
        const data = await redis.get<string>(blobKey(path))
        if (data === null) return null
        // If it's a string, treat as base64
        if (typeof data === 'string') return Buffer.from(data, 'base64')
        // Shouldn't happen for blobs, but handle gracefully
        return Buffer.from(JSON.stringify(data))
      } catch {
        return null
      }
    },

    async getBlobText(path: string): Promise<string | null> {
      try {
        const data = await redis.get(blobKey(path))
        if (data === null || data === undefined) return null
        // Upstash auto-parses JSON strings into objects.
        // If the stored value was a JSON string (like articles.json), we get an object back.
        // Re-stringify it so callers get the raw text they expect.
        if (typeof data === 'string') return data
        return JSON.stringify(data)
      } catch {
        return null
      }
    },

    async putBlob(path: string, data: Buffer | string): Promise<void> {
      if (Buffer.isBuffer(data)) {
        // Store binary as base64 string
        await redis.set(blobKey(path), data.toString('base64'))
      } else {
        // Store text as-is — Upstash will store it as a Redis string
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
        return keys.map((k) => k.slice(5))
      } catch {
        return []
      }
    },
  }
}
