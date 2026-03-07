import * as fs from 'fs'
import * as path from 'path'
import type { StorageAdapter } from './types'

const DATA_DIR = path.resolve(process.cwd(), 'data')

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function kvPath(key: string): string {
  // key format: "project:{id}" → "data/kv/project/{id}.json"
  const segments = key.split(':')
  return path.join(DATA_DIR, 'kv', ...segments) + '.json'
}

function blobPath(blobKey: string): string {
  return path.join(DATA_DIR, 'blobs', blobKey)
}

export function createLocalStorage(): StorageAdapter {
  return {
    async getJSON<T>(key: string, fallback: T): Promise<T> {
      const filePath = kvPath(key)
      try {
        if (!fs.existsSync(filePath)) return fallback
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      } catch {
        return fallback
      }
    },

    async setJSON(key: string, data: unknown): Promise<void> {
      const filePath = kvPath(key)
      ensureDir(path.dirname(filePath))
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    },

    async deleteKey(key: string): Promise<void> {
      const filePath = kvPath(key)
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch { /* ignore */ }
    },

    async getBlob(blobKey: string): Promise<Buffer | null> {
      const filePath = blobPath(blobKey)
      try {
        if (!fs.existsSync(filePath)) return null
        return fs.readFileSync(filePath)
      } catch {
        return null
      }
    },

    async getBlobText(blobKey: string): Promise<string | null> {
      const filePath = blobPath(blobKey)
      try {
        if (!fs.existsSync(filePath)) return null
        return fs.readFileSync(filePath, 'utf-8')
      } catch {
        return null
      }
    },

    async putBlob(blobKey: string, data: Buffer | string): Promise<void> {
      const filePath = blobPath(blobKey)
      ensureDir(path.dirname(filePath))
      fs.writeFileSync(filePath, data)
    },

    async deleteBlob(blobKey: string): Promise<void> {
      const filePath = blobPath(blobKey)
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch { /* ignore */ }
    },

    async listKeys(prefix: string): Promise<string[]> {
      const dir = path.join(DATA_DIR, 'kv', ...prefix.split(':'))
      try {
        if (!fs.existsSync(dir)) return []
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        return entries
          .filter((e) => e.isFile() && e.name.endsWith('.json'))
          .map((e) => `${prefix}:${e.name.replace('.json', '')}`)
      } catch {
        return []
      }
    },

    async listBlobs(prefix: string): Promise<string[]> {
      const dir = path.join(DATA_DIR, 'blobs', prefix)
      try {
        if (!fs.existsSync(dir)) return []
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        return entries
          .filter((e) => e.isFile())
          .map((e) => `${prefix}/${e.name}`)
      } catch {
        return []
      }
    },
  }
}
