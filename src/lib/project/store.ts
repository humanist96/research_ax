import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { ResearchProject, ProjectStatus, ConversationTurn, ProjectConfig } from '@/types'
import type { ReportIndex, Article, AnalyzedArticle, CollectionLog } from '@/types'
import type { DeepReportMeta } from '@/lib/deep-research/types'
import { getStorage } from '@/lib/storage'

function isVercelStorage(): boolean {
  return process.env.STORAGE_BACKEND === 'vercel'
}

// --- Local filesystem helpers ---
const DATA_DIR = path.resolve(process.cwd(), 'data')
const PROJECTS_DIR = path.join(DATA_DIR, 'projects')

function projectDir(id: string): string {
  return path.join(PROJECTS_DIR, id)
}
function projectPath(id: string): string {
  return path.join(projectDir(id), 'project.json')
}
function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}
function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch { return fallback }
}
function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}
function generateId(): string {
  return crypto.randomBytes(8).toString('hex')
}
function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]/g, '')
}

// === All functions are async, supporting both local filesystem and Vercel storage ===

export async function listProjects(): Promise<ResearchProject[]> {
  if (isVercelStorage()) {
    const s = getStorage()
    const keys = await s.listKeys('project')
    // Filter to only direct project keys (not sub-keys like project:id:excluded)
    const projectKeys = keys.filter((k) => k.match(/^project:[^:]+$/))
    const projects: ResearchProject[] = []
    for (const key of projectKeys) {
      const p = await s.getJSON<ResearchProject | null>(key, null)
      if (p) projects.push(p)
    }
    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }
  ensureDir(PROJECTS_DIR)
  try {
    const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    return dirs
      .filter((d) => d.isDirectory())
      .map((d) => readJsonSafe<ResearchProject | null>(path.join(PROJECTS_DIR, d.name, 'project.json'), null))
      .filter((p): p is ResearchProject => p !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch { return [] }
}

export async function getProject(id: string): Promise<ResearchProject | null> {
  if (isVercelStorage()) {
    return getStorage().getJSON<ResearchProject | null>(`project:${id}`, null)
  }
  return readJsonSafe<ResearchProject | null>(projectPath(id), null)
}

export async function createProject(name: string, prompt: string): Promise<ResearchProject> {
  const id = generateId()
  const now = new Date().toISOString()
  const project: ResearchProject = { id, name, prompt, conversation: [], status: 'conversation', config: null, createdAt: now, updatedAt: now }
  if (isVercelStorage()) {
    await getStorage().setJSON(`project:${id}`, project)
  } else {
    ensureDir(projectDir(id))
    ensureDir(path.join(projectDir(id), 'reports'))
    writeJson(projectPath(id), project)
  }
  return project
}

export async function updateProject(id: string, updates: Partial<Pick<ResearchProject, 'name' | 'status' | 'config' | 'conversation'>>): Promise<ResearchProject | null> {
  const project = await getProject(id)
  if (!project) return null
  const updated: ResearchProject = { ...project, ...updates, updatedAt: new Date().toISOString() }
  if (isVercelStorage()) {
    await getStorage().setJSON(`project:${id}`, updated)
  } else {
    writeJson(projectPath(id), updated)
  }
  return updated
}

export async function addConversationTurn(id: string, turn: ConversationTurn): Promise<ResearchProject | null> {
  const project = await getProject(id)
  if (!project) return null
  return updateProject(id, { conversation: [...project.conversation, turn] })
}

export async function setProjectStatus(id: string, status: ProjectStatus): Promise<ResearchProject | null> {
  return updateProject(id, { status })
}

export async function setProjectConfig(id: string, config: ProjectConfig): Promise<ResearchProject | null> {
  return updateProject(id, { config, status: 'ready' })
}

export async function deleteProject(id: string): Promise<boolean> {
  if (isVercelStorage()) {
    const s = getStorage()
    const keys = await s.listKeys(`project:${id}`)
    for (const key of keys) await s.deleteKey(key)
    await s.deleteKey(`project:${id}`)
    const blobs = await s.listBlobs(`projects/${id}`)
    for (const b of blobs) await s.deleteBlob(b)
    return true
  }
  const dir = projectDir(id)
  if (!fs.existsSync(dir)) return false
  fs.rmSync(dir, { recursive: true, force: true })
  return true
}

export async function getExcludedArticleIds(id: string): Promise<string[]> {
  if (isVercelStorage()) return getStorage().getJSON<string[]>(`project:${id}:excluded`, [])
  return readJsonSafe(path.join(projectDir(id), 'excluded-article-ids.json'), [])
}

export async function saveExcludedArticleIds(id: string, ids: readonly string[]): Promise<void> {
  if (isVercelStorage()) { await getStorage().setJSON(`project:${id}:excluded`, ids); return }
  writeJson(path.join(projectDir(id), 'excluded-article-ids.json'), ids)
}

export async function getProjectArticles(id: string): Promise<Article[]> {
  if (isVercelStorage()) {
    const text = await getStorage().getBlobText(`projects/${id}/articles.json`)
    return text ? JSON.parse(text) : []
  }
  return readJsonSafe(path.join(projectDir(id), 'articles.json'), [])
}

export async function saveProjectArticles(id: string, articles: Article[]): Promise<void> {
  if (isVercelStorage()) { await getStorage().putBlob(`projects/${id}/articles.json`, JSON.stringify(articles, null, 2)); return }
  writeJson(path.join(projectDir(id), 'articles.json'), articles)
}

export async function getProjectAnalyzedArticles(id: string): Promise<AnalyzedArticle[]> {
  if (isVercelStorage()) {
    const text = await getStorage().getBlobText(`projects/${id}/analyzed-articles.json`)
    return text ? JSON.parse(text) : []
  }
  return readJsonSafe(path.join(projectDir(id), 'analyzed-articles.json'), [])
}

export async function saveProjectAnalyzedArticles(id: string, articles: AnalyzedArticle[]): Promise<void> {
  if (isVercelStorage()) { await getStorage().putBlob(`projects/${id}/analyzed-articles.json`, JSON.stringify(articles, null, 2)); return }
  writeJson(path.join(projectDir(id), 'analyzed-articles.json'), articles)
}

export async function getProjectCollectionLog(id: string): Promise<CollectionLog[]> {
  if (isVercelStorage()) return getStorage().getJSON<CollectionLog[]>(`project:${id}:collection-log`, [])
  return readJsonSafe(path.join(projectDir(id), 'collection-log.json'), [])
}

export async function saveProjectCollectionLog(id: string, logs: CollectionLog[]): Promise<void> {
  if (isVercelStorage()) { await getStorage().setJSON(`project:${id}:collection-log`, logs); return }
  writeJson(path.join(projectDir(id), 'collection-log.json'), logs)
}

export async function getProjectReportIndex(id: string): Promise<ReportIndex> {
  if (isVercelStorage()) return getStorage().getJSON<ReportIndex>(`project:${id}:reports:index`, { reports: [] })
  return readJsonSafe(path.join(projectDir(id), 'reports', 'index.json'), { reports: [] })
}

export async function saveProjectReportIndex(id: string, index: ReportIndex): Promise<void> {
  if (isVercelStorage()) { await getStorage().setJSON(`project:${id}:reports:index`, index); return }
  ensureDir(path.join(projectDir(id), 'reports'))
  writeJson(path.join(projectDir(id), 'reports', 'index.json'), index)
}

export async function getProjectReportContent(projectId: string, reportId: string): Promise<string | null> {
  if (isVercelStorage()) return getStorage().getBlobText(`projects/${projectId}/reports/${sanitize(reportId)}.md`)
  const filePath = path.join(projectDir(projectId), 'reports', `${sanitize(reportId)}.md`)
  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch { return null }
}

export async function saveProjectReport(projectId: string, reportId: string, content: string): Promise<void> {
  if (isVercelStorage()) { await getStorage().putBlob(`projects/${projectId}/reports/${sanitize(reportId)}.md`, content); return }
  const safeName = sanitize(reportId)
  ensureDir(path.join(projectDir(projectId), 'reports'))
  fs.writeFileSync(path.join(projectDir(projectId), 'reports', `${safeName}.md`), content, 'utf-8')
}

export function getProjectDir(id: string): string {
  return projectDir(id)
}

// --- Deep Report ---

function deepReportDir(projectId: string, reportId: string): string {
  return path.join(projectDir(projectId), 'reports', sanitize(reportId))
}
function deepSectionsDir(projectId: string, reportId: string): string {
  return path.join(deepReportDir(projectId, reportId), 'sections')
}

export async function saveDeepReportMeta(projectId: string, reportId: string, meta: DeepReportMeta): Promise<void> {
  if (isVercelStorage()) { await getStorage().setJSON(`project:${projectId}:deep:${reportId}:meta`, meta); return }
  const dir = deepReportDir(projectId, reportId)
  ensureDir(dir)
  writeJson(path.join(dir, 'meta.json'), meta)
}

export async function getDeepReportMeta(projectId: string, reportId: string): Promise<DeepReportMeta | null> {
  if (isVercelStorage()) return getStorage().getJSON<DeepReportMeta | null>(`project:${projectId}:deep:${reportId}:meta`, null)
  const filePath = path.join(deepReportDir(projectId, reportId), 'meta.json')
  return readJsonSafe<DeepReportMeta | null>(filePath, null)
}

export async function getLatestDeepReportMeta(projectId: string): Promise<DeepReportMeta | null> {
  if (isVercelStorage()) {
    const s = getStorage()
    const keys = await s.listKeys(`project:${projectId}:deep`)
    const metaKeys = keys.filter((k) => k.endsWith(':meta'))
    let latest: DeepReportMeta | null = null
    for (const key of metaKeys) {
      const meta = await s.getJSON<DeepReportMeta | null>(key, null)
      if (meta && (!latest || meta.generatedAt > latest.generatedAt)) latest = meta
    }
    return latest
  }
  const reportsDir = path.join(projectDir(projectId), 'reports')
  try {
    if (!fs.existsSync(reportsDir)) return null
    const entries = fs.readdirSync(reportsDir, { withFileTypes: true })
    const deepDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith('deep-'))
      .map((e) => ({ name: e.name, mtime: fs.statSync(path.join(reportsDir, e.name, 'meta.json')).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
    if (deepDirs.length === 0) return null
    return readJsonSafe<DeepReportMeta | null>(path.join(reportsDir, deepDirs[0].name, 'meta.json'), null)
  } catch { return null }
}

export async function saveDeepReportSection(projectId: string, reportId: string, sectionId: string, content: string): Promise<void> {
  if (isVercelStorage()) {
    await getStorage().putBlob(`projects/${projectId}/reports/${sanitize(reportId)}/sections/${sanitize(sectionId)}.md`, content)
    return
  }
  const dir = deepSectionsDir(projectId, reportId)
  ensureDir(dir)
  fs.writeFileSync(path.join(dir, `${sanitize(sectionId)}.md`), content, 'utf-8')
}

export async function getDeepReportSection(projectId: string, reportId: string, sectionId: string): Promise<string | null> {
  if (isVercelStorage()) {
    return getStorage().getBlobText(`projects/${projectId}/reports/${sanitize(reportId)}/sections/${sanitize(sectionId)}.md`)
  }
  const filePath = path.join(deepSectionsDir(projectId, reportId), `${sanitize(sectionId)}.md`)
  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch { return null }
}

export async function listDeepReportSections(projectId: string, reportId: string): Promise<string[]> {
  if (isVercelStorage()) {
    const blobs = await getStorage().listBlobs(`projects/${projectId}/reports/${sanitize(reportId)}/sections`)
    return blobs.filter((b) => b.endsWith('.md')).map((b) => b.split('/').pop()!.replace('.md', ''))
  }
  const dir = deepSectionsDir(projectId, reportId)
  try {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''))
  } catch { return [] }
}

export async function saveDeepReportMerged(projectId: string, reportId: string, format: 'md' | 'pdf', content: Buffer | string): Promise<void> {
  const filename = format === 'md' ? 'merged.md' : 'merged.pdf'
  if (isVercelStorage()) {
    await getStorage().putBlob(`projects/${projectId}/reports/${sanitize(reportId)}/${filename}`, content)
    return
  }
  const dir = deepReportDir(projectId, reportId)
  ensureDir(dir)
  fs.writeFileSync(path.join(dir, filename), content)
}

export async function getDeepReportMerged(projectId: string, reportId: string, format: 'md' | 'pdf'): Promise<Buffer | string | null> {
  const filename = format === 'md' ? 'merged.md' : 'merged.pdf'
  if (isVercelStorage()) {
    const s = getStorage()
    const blobPath = `projects/${projectId}/reports/${sanitize(reportId)}/${filename}`
    return format === 'md' ? s.getBlobText(blobPath) : s.getBlob(blobPath)
  }
  const filePath = path.join(deepReportDir(projectId, reportId), filename)
  try {
    if (!fs.existsSync(filePath)) return null
    return format === 'pdf' ? fs.readFileSync(filePath) : fs.readFileSync(filePath, 'utf-8')
  } catch { return null }
}
