import type { ThemeName } from './types'

const THEME_KEY = 'youzai-theme'
const FAVORITES_KEY = 'youzai-favorites'
const THEMES: ThemeName[] = ['cream', 'sage', 'night']

/**
 * 浏览器本地偏好集中读写，并对损坏数据做兜底，
 * 避免用户清理/改写 localStorage 后访客页面直接白屏。
 */
export function readTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return THEMES.includes(stored as ThemeName) ? (stored as ThemeName) : 'cream'
  } catch {
    return 'cream'
  }
}

export function writeTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* 隐私模式下写入失败时忽略，仅本次会话生效 */
  }
}

export function readFavorites(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function writeFavorites(ids: string[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
  } catch {
    /* 同上，忽略写入失败 */
  }
}

export function readSession(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === 'yes'
  } catch {
    return false
  }
}

export function writeSession(key: string, value: boolean): void {
  try {
    if (value) sessionStorage.setItem(key, 'yes')
    else sessionStorage.removeItem(key)
  } catch {
    /* 忽略 */
  }
}

const BACKUP_KEY = 'youzai-last-backup'

/** 记录最近一次成功导出的时间，用于后台完整度提醒。 */
export function readLastBackup(): string {
  try {
    return localStorage.getItem(BACKUP_KEY) || ''
  } catch {
    return ''
  }
}

export function writeLastBackup(at: string = new Date().toISOString()): void {
  try {
    localStorage.setItem(BACKUP_KEY, at)
  } catch {
    /* 忽略 */
  }
}
