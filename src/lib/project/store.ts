import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { ResearchProject, ProjectStatus, ConversationTurn, ProjectConfig } from '@/types'
import type { ReportIndex, Article, AnalyzedArticle, CollectionLog } from '@/types'
import type { DeepReportMeta } from '@/lib/deep-research/types'
import { getStorage } from '@/lib/storage'

// Legacy filesystem paths (used only by STORAGE_BACKEND=local for backward compat)
const DATA_DIR = path.resolve(process.cwd(), 'data')
const PROJECTS_DIR = path.join(DATA_DIR, 'projects')

function useStorageAdapter(): boolean {
  return process.env.STORAGE_BACKEND === 'vercel'
}

// --- Legacy filesystem helpers (kept for local mode) ---

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
  } catch {
    return fallback
  }
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

// --- Async storage-backed functions ---

export async function listProjectsAsync(): Promise<ResearchProject[]> {
  if (useStorageAdapter()) {
    const storage = getStorage()
    const keys = await storage.listKeys('project')
    const projects: ResearchProject[] = []
    for (const key of keys) {
      const project = await storage.getJSON<ResearchProject | null>(key, null)
      if (project) projects.push(project)
    }
    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }
  return listProjects()
}

export async function getProjectAsync(id: string): Promise<ResearchProject | null> {
  if (useStorageAdapter()) {
    return getStorage().getJSON<ResearchProject | null>(`project:${id}`, null)
  }
  return getProject(id)
}

export async function createProjectAsync(name: string, prompt: string): Promise<ResearchProject> {
  const id = generateId()
  const now = new Date().toISOString()

  const project: ResearchProject = {
    id,
    name,
    prompt,
    conversation: [],
    status: 'conversation',
    config: null,
    createdAt: now,
    updatedAt: now,
  }

  if (useStorageAdapter()) {
    await getStorage().setJSON(`project:${id}`, project)
  } else {
    ensureDir(projectDir(id))
    ensureDir(path.join(projectDir(id), 'reports'))
    writeJson(projectPath(id), project)
  }

  return project
}

export async function updateProjectAsync(
  id: string,
  updates: Partial<Pick<ResearchProject, 'name' | 'status' | 'config' | 'conversation'>>,
): Promise<ResearchProject | null> {
  const project = await getProjectAsync(id)
  if (!project) return null

  const updated: ResearchProject = {
    ...project,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  if (useStorageAdapter()) {
    await getStorage().setJSON(`project:${id}`, updated)
  } else {
    writeJson(projectPath(id), updated)
  }

  return updated
}

export async function addConversationTurnAsync(id: string, turn: ConversationTurn): Promise<ResearchProject | null> {
  const project = await getProjectAsync(id)
  if (!project) return null
  return updateProjectAsync(id, { conversation: [...project.conversation, turn] })
}

export async function setProjectStatusAsync(id: string, status: ProjectStatus): Promise<ResearchProject | null> {
  return updateProjectAsync(id, { status })
}

export async function setProjectConfigAsync(id: string, config: ProjectConfig): Promise<ResearchProject | null> {
  return updateProjectAsync(id, { config, status: 'ready' })
}

export async function deleteProjectAsync(id: string): Promise<boolean> {
  if (useStorageAdapter()) {
    const storage = getStorage()
    await storage.deleteKey(`project:${id}`)
    await storage.deleteKey(`project:${id}:excluded`)
    await storage.deleteKey(`project:${id}:collection-log`)
    await storage.deleteKey(`project:${id}:reports:index`)
    // Delete blobs
    const blobs = await storage.listBlobs(`projects/${id}`)
    for (const blob of blobs) {
      await storage.deleteBlob(blob)
    }
    return true
  }
  return deleteProject(id)
}

export async function getProjectArticlesAsync(id: string): Promise<Article[]> {
  if (useStorageAdapter()) {
    const text = await getStorage().getBlobText(`projects/${id}/articles.json`)
    return text ? JSON.parse(text) : []
  }
  return getProjectArticles(id)
}

export async function saveProjectArticlesAsync(id: string, articles: Article[]): Promise<void> {
  if (useStorageAdapter()) {
    await getStorage().putBlob(`projects/${id}/articles.json`, JSON.stringify(articles, null, 2))
  } else {
    saveProjectArticles(id, articles)
  }
}

export async function getProjectAnalyzedArticlesAsync(id: string): Promise<AnalyzedArticle[]> {
  if (useStorageAdapter()) {
    const text = await getStorage().getBlobText(`projects/${id}/analyzed-articles.json`)
    return text ? JSON.parse(text) : []
  }
  return getProjectAnalyzedArticles(id)
}

export async function saveProjectAnalyzedArticlesAsync(id: string, articles: AnalyzedArticle[]): Promise<void> {
  if (useStorageAdapter()) {
    await getStorage().putBlob(`projects/${id}/analyzed-articles.json`, JSON.stringify(articles, null, 2))
  } else {
    saveProjectAnalyzedArticles(id, articles)
  }
}

export async function getExcludedArticleIdsAsync(id: string): Promise<string[]> {
  if (useStorageAdapter()) {
    return getStorage().getJSON<string[]>(`project:${id}:excluded`, [])
  }
  return getExcludedArticleIds(id)
}

export async function saveExcludedArticleIdsAsync(id: string, ids: readonly string[]): Promise<void> {
  if (useStorageAdapter()) {
    await getStorage().setJSON(`project:${id}:excluded`, ids)
  } else {
    saveExcludedArticleIds(id, ids)
  }
}

export async function getProjectCollectionLogAsync(id: string): Promise<CollectionLog[]> {
  if (useStorageAdapter()) {
    return getStorage().getJSON<CollectionLog[]>(`project:${id}:collection-log`, [])
  }
  return getProjectCollectionLog(id)
}

export async function saveProjectCollectionLogAsync(id: string, logs: CollectionLog[]): Promise<void> {
  if (useStorageAdapter()) {
    await getStorage().setJSON(`project:${id}:collection-log`, logs)
  } else {
    saveProjectCollectionLog(id, logs)
  }
}

export async function getProjectReportIndexAsync(id: string): Promise<ReportIndex> {
  if (useStorageAdapter()) {
    return getStorage().getJSON<ReportIndex>(`project:${id}:reports:index`, { reports: [] })
  }
  return getProjectReportIndex(id)
}

export async function saveProjectReportIndexAsync(id: string, index: ReportIndex): Promise<void> {
  if (useStorageAdapter()) {
    await getStorage().setJSON(`project:${id}:reports:index`, index)
  } else {
    saveProjectReportIndex(id, index)
  }
}

export async function getProjectReportContentAsync(projectId: string, reportId: string): Promise<string | null> {
  if (useStorageAdapter()) {
    return getStorage().getBlobText(`projects/${projectId}/reports/${sanitize(reportId)}.md`)
  }
  return getProjectReportContent(projectId, reportId)
}

export async function saveProjectReportAsync(projectId: string, reportId: string, content: string): Promise<void> {
  if (useStorageAdapter()) {
    await getStorage().putBlob(`projects/${projectId}/reports/${sanitize(reportId)}.md`, content)
  } else {
    saveProjectReport(projectId, reportId, content)
  }
}

export async function saveDeepReportMetaAsync(projectId: string, reportId: string, meta: DeepReportMeta): Promise<void> {
  if (useStorageAdapter()) {
    await getStorage().setJSON(`project:${projectId}:deep:${reportId}:meta`, meta)
  } else {
    saveDeepReportMeta(projectId, reportId, meta)
  }
}

export async function getDeepReportMetaAsync(projectId: string, reportId: string): Promise<DeepReportMeta | null> {
  if (useStorageAdapter()) {
    return getStorage().getJSON<DeepReportMeta | null>(`project:${projectId}:deep:${reportId}:meta`, null)
  }
  return getDeepReportMeta(projectId, reportId)
}

export async function getLatestDeepReportMetaAsync(projectId: string): Promise<DeepReportMeta | null> {
  if (useStorageAdapter()) {
    const storage = getStorage()
    const keys = await storage.listKeys(`project:${projectId}:deep`)
    const metaKeys = keys.filter((k) => k.endsWith(':meta'))
    let latest: DeepReportMeta | null = null
    for (const key of metaKeys) {
      const meta = await storage.getJSON<DeepReportMeta | null>(key, null)
      if (meta && (!latest || meta.generatedAt > latest.generatedAt)) {
        latest = meta
      }
    }
    return latest
  }
  return getLatestDeepReportMeta(projectId)
}

export async function saveDeepReportSectionAsync(projectId: string, reportId: string, sectionId: string, content: string): Promise<void> {
  if (useStorageAdapter()) {
    await getStorage().putBlob(`projects/${projectId}/reports/deep-${sanitize(reportId)}/sections/${sanitize(sectionId)}.md`, content)
  } else {
    saveDeepReportSection(projectId, reportId, sectionId, content)
  }
}

export async function getDeepReportSectionAsync(projectId: string, reportId: string, sectionId: string): Promise<string | null> {
  if (useStorageAdapter()) {
    return getStorage().getBlobText(`projects/${projectId}/reports/deep-${sanitize(reportId)}/sections/${sanitize(sectionId)}.md`)
  }
  return getDeepReportSection(projectId, reportId, sectionId)
}

export async function listDeepReportSectionsAsync(projectId: string, reportId: string): Promise<string[]> {
  if (useStorageAdapter()) {
    const blobs = await getStorage().listBlobs(`projects/${projectId}/reports/deep-${sanitize(reportId)}/sections`)
    return blobs
      .filter((b) => b.endsWith('.md'))
      .map((b) => b.split('/').pop()!.replace('.md', ''))
  }
  return listDeepReportSections(projectId, reportId)
}

export async function saveDeepReportMergedAsync(projectId: string, reportId: string, format: 'md' | 'pdf', content: Buffer | string): Promise<void> {
  if (useStorageAdapter()) {
    const filename = format === 'md' ? 'merged.md' : 'merged.pdf'
    await getStorage().putBlob(`projects/${projectId}/reports/deep-${sanitize(reportId)}/${filename}`, content)
  } else {
    saveDeepReportMerged(projectId, reportId, format, content)
  }
}

export async function getDeepReportMergedAsync(projectId: string, reportId: string, format: 'md' | 'pdf'): Promise<Buffer | string | null> {
  if (useStorageAdapter()) {
    const storage = getStorage()
    const filename = format === 'md' ? 'merged.md' : 'merged.pdf'
    const blobPath = `projects/${projectId}/reports/deep-${sanitize(reportId)}/${filename}`
    return format === 'md' ? storage.getBlobText(blobPath) : storage.getBlob(blobPath)
  }
  return getDeepReportMerged(projectId, reportId, format)
}

// --- Synchronous functions (kept for backward compatibility in local mode) ---

export function listProjects(): ResearchProject[] {
  ensureDir(PROJECTS_DIR)
  try {
    const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    return dirs
      .filter((d) => d.isDirectory())
      .map((d) => readJsonSafe<ResearchProject | null>(path.join(PROJECTS_DIR, d.name, 'project.json'), null))
      .filter((p): p is ResearchProject => p !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch {
    return []
  }
}

export function getProject(id: string): ResearchProject | null {
  return readJsonSafe<ResearchProject | null>(projectPath(id), null)
}

export function createProject(name: string, prompt: string): ResearchProject {
  const id = generateId()
  const now = new Date().toISOString()

  const project: ResearchProject = {
    id,
    name,
    prompt,
    conversation: [],
    status: 'conversation',
    config: null,
    createdAt: now,
    updatedAt: now,
  }

  ensureDir(projectDir(id))
  ensureDir(path.join(projectDir(id), 'reports'))
  writeJson(projectPath(id), project)
  return project
}

export function updateProject(id: string, updates: Partial<Pick<ResearchProject, 'name' | 'status' | 'config' | 'conversation'>>): ResearchProject | null {
  const project = getProject(id)
  if (!project) return null

  const updated: ResearchProject = {
    ...project,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  writeJson(projectPath(id), updated)
  return updated
}

export function addConversationTurn(id: string, turn: ConversationTurn): ResearchProject | null {
  const project = getProject(id)
  if (!project) return null

  return updateProject(id, {
    conversation: [...project.conversation, turn],
  })
}

export function setProjectStatus(id: string, status: ProjectStatus): ResearchProject | null {
  return updateProject(id, { status })
}

export function setProjectConfig(id: string, config: ProjectConfig): ResearchProject | null {
  return updateProject(id, { config, status: 'ready' })
}

export function deleteProject(id: string): boolean {
  const dir = projectDir(id)
  if (!fs.existsSync(dir)) return false
  fs.rmSync(dir, { recursive: true, force: true })
  return true
}

export function getExcludedArticleIds(id: string): string[] {
  return readJsonSafe(path.join(projectDir(id), 'excluded-article-ids.json'), [])
}

export function saveExcludedArticleIds(id: string, ids: readonly string[]): void {
  writeJson(path.join(projectDir(id), 'excluded-article-ids.json'), ids)
}

export function getProjectArticles(id: string): Article[] {
  return readJsonSafe(path.join(projectDir(id), 'articles.json'), [])
}

export function saveProjectArticles(id: string, articles: Article[]): void {
  writeJson(path.join(projectDir(id), 'articles.json'), articles)
}

export function getProjectAnalyzedArticles(id: string): AnalyzedArticle[] {
  return readJsonSafe(path.join(projectDir(id), 'analyzed-articles.json'), [])
}

export function saveProjectAnalyzedArticles(id: string, articles: AnalyzedArticle[]): void {
  writeJson(path.join(projectDir(id), 'analyzed-articles.json'), articles)
}

export function getProjectCollectionLog(id: string): CollectionLog[] {
  return readJsonSafe(path.join(projectDir(id), 'collection-log.json'), [])
}

export function saveProjectCollectionLog(id: string, logs: CollectionLog[]): void {
  writeJson(path.join(projectDir(id), 'collection-log.json'), logs)
}

export function getProjectReportIndex(id: string): ReportIndex {
  return readJsonSafe(path.join(projectDir(id), 'reports', 'index.json'), { reports: [] })
}

export function saveProjectReportIndex(id: string, index: ReportIndex): void {
  ensureDir(path.join(projectDir(id), 'reports'))
  writeJson(path.join(projectDir(id), 'reports', 'index.json'), index)
}

export function getProjectReportContent(projectId: string, reportId: string): string | null {
  const safeName = sanitize(reportId)
  const filePath = path.join(projectDir(projectId), 'reports', `${safeName}.md`)
  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

export function saveProjectReport(projectId: string, reportId: string, content: string): void {
  const safeName = sanitize(reportId)
  ensureDir(path.join(projectDir(projectId), 'reports'))
  fs.writeFileSync(path.join(projectDir(projectId), 'reports', `${safeName}.md`), content, 'utf-8')
}

export function getProjectDir(id: string): string {
  return projectDir(id)
}

// --- Deep Report directory-based storage ---

function deepReportDir(projectId: string, reportId: string): string {
  return path.join(projectDir(projectId), 'reports', sanitize(reportId))
}

function deepSectionsDir(projectId: string, reportId: string): string {
  return path.join(deepReportDir(projectId, reportId), 'sections')
}

export function saveDeepReportMeta(projectId: string, reportId: string, meta: DeepReportMeta): void {
  const dir = deepReportDir(projectId, reportId)
  ensureDir(dir)
  writeJson(path.join(dir, 'meta.json'), meta)
}

export function getDeepReportMeta(projectId: string, reportId: string): DeepReportMeta | null {
  const filePath = path.join(deepReportDir(projectId, reportId), 'meta.json')
  return readJsonSafe<DeepReportMeta | null>(filePath, null)
}

export function getLatestDeepReportMeta(projectId: string): DeepReportMeta | null {
  const reportsDir = path.join(projectDir(projectId), 'reports')
  try {
    if (!fs.existsSync(reportsDir)) return null
    const entries = fs.readdirSync(reportsDir, { withFileTypes: true })
    const deepDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith('deep-'))
      .map((e) => ({
        name: e.name,
        mtime: fs.statSync(path.join(reportsDir, e.name, 'meta.json')).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)

    if (deepDirs.length === 0) return null
    return readJsonSafe<DeepReportMeta | null>(
      path.join(reportsDir, deepDirs[0].name, 'meta.json'),
      null,
    )
  } catch {
    return null
  }
}

export function saveDeepReportSection(projectId: string, reportId: string, sectionId: string, content: string): void {
  const dir = deepSectionsDir(projectId, reportId)
  ensureDir(dir)
  fs.writeFileSync(path.join(dir, `${sanitize(sectionId)}.md`), content, 'utf-8')
}

export function getDeepReportSection(projectId: string, reportId: string, sectionId: string): string | null {
  const filePath = path.join(deepSectionsDir(projectId, reportId), `${sanitize(sectionId)}.md`)
  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

export function listDeepReportSections(projectId: string, reportId: string): string[] {
  const dir = deepSectionsDir(projectId, reportId)
  try {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''))
  } catch {
    return []
  }
}

export function saveDeepReportMerged(projectId: string, reportId: string, format: 'md' | 'pdf', content: Buffer | string): void {
  const dir = deepReportDir(projectId, reportId)
  ensureDir(dir)
  const filename = format === 'md' ? 'merged.md' : 'merged.pdf'
  fs.writeFileSync(path.join(dir, filename), content)
}

export function getDeepReportMerged(projectId: string, reportId: string, format: 'md' | 'pdf'): Buffer | string | null {
  const filename = format === 'md' ? 'merged.md' : 'merged.pdf'
  const filePath = path.join(deepReportDir(projectId, reportId), filename)
  try {
    if (!fs.existsSync(filePath)) return null
    if (format === 'pdf') {
      return fs.readFileSync(filePath)
    }
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}
