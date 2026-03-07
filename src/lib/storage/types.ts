export interface StorageAdapter {
  // KV-like operations (small JSON data)
  getJSON<T>(key: string, fallback: T): Promise<T>
  setJSON(key: string, data: unknown): Promise<void>
  deleteKey(key: string): Promise<void>

  // Blob-like operations (large data)
  getBlob(path: string): Promise<Buffer | null>
  getBlobText(path: string): Promise<string | null>
  putBlob(path: string, data: Buffer | string): Promise<void>
  deleteBlob(path: string): Promise<void>

  // Directory-like operations
  listKeys(prefix: string): Promise<string[]>
  listBlobs(prefix: string): Promise<string[]>
}
