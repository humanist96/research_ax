import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { ResearchProject, ProjectStatus, ConversationTurn, ProjectConfig } from '@/types'
import type { ReportIndex, Article, AnalyzedArticle, CollectionLog } from '@/types'
import type { DeepReportMeta } from '@/lib/deep-research/types'

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
