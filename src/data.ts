import type { DetailBlock, GuestbookEntry, Moment, Profile, Project, SiteState } from './types'

export const emptyState: SiteState = {
  profile: {
    name: '',
    handle: '',
    bio: '',
    location: '',
    avatar: '',
    cover: '',
    tags: [],
  },
  moments: [],
  projects: [],
  messages: [],
}

const DB_NAME = 'youzai-portfolio'
const STORE = 'content'
const STATE_KEY = 'site-state'

/** 导出文件的外层标记，便于以后识别与迁移。 */
export const BACKUP_FORMAT = 'youzai-portfolio'
export const BACKUP_VERSION = 1

/** 上传图片限制：8 MB 原文件、最长边 2000px，超出后自动压缩。 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_IMAGE_EDGE = 2000
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  counts: { projects: number; moments: number; messages: number }
  state: SiteState
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function normalizeProfile(value: unknown): Profile {
  const source = record(value)
  return {
    name: text(source.name),
    handle: text(source.handle),
    bio: text(source.bio),
    location: text(source.location),
    avatar: text(source.avatar),
    cover: text(source.cover),
    tags: stringList(source.tags),
  }
}

function normalizeMoment(value: unknown): Moment | null {
  const source = record(value)
  const content = text(source.content)
  if (!content) return null
  return {
    id: text(source.id) || uid(),
    content,
    date: text(source.date) || new Date().toISOString().slice(0, 10),
  }
}

function normalizeBlock(value: unknown): DetailBlock | null {
  const source = record(value)
  const type = source.type
  if (type !== 'text' && type !== 'image') return null
  const base = { id: text(source.id) || uid(), content: text(source.content) }
  if (type === 'text') return { ...base, type }
  const caption = text(source.caption)
  return caption ? { ...base, type, caption } : { ...base, type }
}

function normalizeProject(value: unknown): Project | null {
  const source = record(value)
  const title = text(source.title)
  if (!title) return null
  const template = source.template === 'gallery' || source.template === 'minimal' ? source.template : 'story'
  return {
    id: text(source.id) || uid(),
    title,
    summary: text(source.summary),
    cover: text(source.cover),
    tags: stringList(source.tags),
    template,
    link: text(source.link),
    linkLabel: text(source.linkLabel) || '访问项目',
    blocks: Array.isArray(source.blocks)
      ? source.blocks.map(normalizeBlock).filter((item): item is DetailBlock => item !== null)
      : [],
    published: source.published === true,
    createdAt: text(source.createdAt) || new Date().toISOString().slice(0, 10),
  }
}

function normalizeMessage(value: unknown): GuestbookEntry | null {
  const source = record(value)
  const nickname = text(source.nickname)
  const content = text(source.content)
  if (!nickname || !content) return null
  return {
    id: text(source.id) || uid(),
    nickname,
    content,
    createdAt: text(source.createdAt) || new Date().toISOString(),
    status: source.status === 'published' ? 'published' : 'pending',
  }
}

/**
 * 把任意来源（IndexedDB 旧数据、导入的 JSON、手工编辑过的文件）整理成合法的 SiteState。
 * 缺失字段补默认值，非法条目直接丢弃，保证渲染层不会因为脏数据崩溃。
 */
export function normalizeState(value: unknown): SiteState {
  const source = record(value)
  return {
    profile: normalizeProfile(source.profile),
    moments: Array.isArray(source.moments)
      ? source.moments.map(normalizeMoment).filter((item): item is Moment => item !== null)
      : [],
    projects: Array.isArray(source.projects)
      ? source.projects.map(normalizeProject).filter((item): item is Project => item !== null)
      : [],
    messages: Array.isArray(source.messages)
      ? source.messages.map(normalizeMessage).filter((item): item is GuestbookEntry => item !== null)
      : [],
  }
}

export async function loadState(): Promise<SiteState> {
  try {
    const db = await openDatabase()
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(STATE_KEY)
      const finish = (state: SiteState) => {
        db.close()
        resolve(state)
      }
      request.onsuccess = () => finish(normalizeState(request.result))
      request.onerror = () => finish(structuredClone(emptyState))
    })
  } catch {
    return structuredClone(emptyState)
  }
}

export async function saveState(state: SiteState): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(normalizeState(state), STATE_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('写入本地数据库失败'))
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error ?? new Error('本地存储空间不足，写入被中止'))
    }
  })
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法解析这张图片，请换一张试试'))
    image.src = source
  })
}

/**
 * 校验图片格式与体积，超过 2000px 时等比缩小，非 PNG 统一转成压缩后的 WEBP。
 * 校验失败时抛出中文错误信息，由调用方展示，且不会覆盖原有图片。
 */
export async function fileToDataUrl(file?: File): Promise<string> {
  if (!file) return ''
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('仅支持 PNG、JPG 或 WEBP 图片')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('图片不能超过 8 MB，请先压缩后再上传')

  const source = await readFile(file)
  const image = await loadImage(source)
  const longest = Math.max(image.naturalWidth, image.naturalHeight) || 1
  const scale = Math.min(1, MAX_IMAGE_EDGE / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法处理图片')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const outputType = file.type === 'image/png' ? 'image/png' : 'image/webp'
  return canvas.toDataURL(outputType, outputType === 'image/png' ? undefined : 0.86)
}

export function buildBackup(state: SiteState): BackupFile {
  const normalized = normalizeState(state)
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      projects: normalized.projects.length,
      moments: normalized.moments.length,
      messages: normalized.messages.length,
    },
    state: normalized,
  }
}

/** 触发浏览器下载，导出成功后再提示用户。 */
export function exportState(state: SiteState): string {
  const backup = buildBackup(state)
  const payload = JSON.stringify(backup, null, 2)
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const anchor = document.createElement('a')
  const filename = `youzai-backup-${backup.exportedAt.slice(0, 10)}.json`
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
  return filename
}

/** 读取并校验备份文件；兼容裸 SiteState 与带外层信封两种格式。 */
export async function importState(file: File): Promise<SiteState> {
  if (!file.name.toLowerCase().endsWith('.json')) throw new Error('请选择由小屋导出的 JSON 备份文件')
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('文件内容不是有效的 JSON')
  }
  const source = record(parsed)
  const candidate = source.format === BACKUP_FORMAT ? source.state : parsed
  const data = record(candidate)
  const hasAny = 'profile' in data || 'projects' in data || 'moments' in data || 'messages' in data
  if (!hasAny) throw new Error('文件里没有可识别的小屋数据')
  return normalizeState(candidate)
}

export const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** 只允许 http/https 链接，避免后台误填 javascript: 等危险协议。 */
export function safeLink(link: string): string {
  const value = link.trim()
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

/** 上移/下移工具，供项目与详情块排序复用。 */
export function moveItem<T>(items: T[], index: number, offset: number): T[] {
  const target = index + offset
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}
