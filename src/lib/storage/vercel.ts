import type { StorageAdapter } from './types'

export function createVercelStorage(): StorageAdapter {
  // Lazy imports to avoid errors when packages aren't installed
  let kvModule: typeof import('@vercel/kv') | null = null
  let blobModule: typeof import('@vercel/blob') | null = null

  async function getKV() {
    if (!kvModule) {
      kvModule = await import('@vercel/kv')
    }
    return kvModule.kv
  }

  async function getBlob() {
    if (!blobModule) {
      blobModule = await import('@vercel/blob')
    }
    return blobModule
  }

  return {
    async getJSON<T>(key: string, fallback: T): Promise<T> {
      try {
        const kv = await getKV()
        const data = await kv.get<T>(key)
        return data ?? fallback
      } catch {
        return fallback
      }
    },

    async setJSON(key: string, data: unknown): Promise<void> {
      const kv = await getKV()
      await kv.set(key, data)
    },

    async deleteKey(key: string): Promise<void> {
      const kv = await getKV()
      await kv.del(key)
    },

    async getBlob(blobPath: string): Promise<Buffer | null> {
      try {
        const blob = await getBlob()
        const { blobs } = await blob.list({ prefix: blobPath, limit: 1 })
        if (blobs.length === 0) return null
        const response = await fetch(blobs[0].url)
        const arrayBuffer = await response.arrayBuffer()
        return Buffer.from(arrayBuffer)
      } catch {
        return null
      }
    },

    async getBlobText(blobPath: string): Promise<string | null> {
      try {
        const blob = await getBlob()
        const { blobs } = await blob.list({ prefix: blobPath, limit: 1 })
        if (blobs.length === 0) return null
        const response = await fetch(blobs[0].url)
        return response.text()
      } catch {
        return null
      }
    },

    async putBlob(blobPath: string, data: Buffer | string): Promise<void> {
      const blob = await getBlob()
      await blob.put(blobPath, data, { access: 'public', addRandomSuffix: false })
    },

    async deleteBlob(blobPath: string): Promise<void> {
      try {
        const blob = await getBlob()
        const { blobs } = await blob.list({ prefix: blobPath })
        for (const entry of blobs) {
          await blob.del(entry.url)
        }
      } catch { /* ignore */ }
    },

    async listKeys(prefix: string): Promise<string[]> {
      try {
        const kv = await getKV()
        const keys = await kv.keys(`${prefix}:*`)
        return keys
      } catch {
        return []
      }
    },

    async listBlobs(prefix: string): Promise<string[]> {
      try {
        const blob = await getBlob()
        const { blobs } = await blob.list({ prefix })
        return blobs.map((b) => b.pathname)
      } catch {
        return []
      }
    },
  }
}
