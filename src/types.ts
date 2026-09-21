export type ThemeName = 'cream' | 'sage' | 'night'

export interface Profile {
  name: string
  handle: string
  bio: string
  location: string
  avatar: string
  cover: string
  tags: string[]
}

export interface Moment {
  id: string
  content: string
  date: string
}

export type DetailBlock =
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'image'; content: string; caption?: string }

export interface Project {
  id: string
  title: string
  summary: string
  cover: string
  tags: string[]
  template: 'story' | 'gallery' | 'minimal'
  link: string
  linkLabel: string
  blocks: DetailBlock[]
  published: boolean
  createdAt: string
}

export interface GuestbookEntry {
  id: string
  nickname: string
  content: string
  createdAt: string
  status: 'pending' | 'published'
}

export interface SiteState {
  profile: Profile
  moments: Moment[]
  projects: Project[]
  messages: GuestbookEntry[]
}

/** 站点状态的函数式更新，用于避免并发操作读到过期的 state 快照。 */
export type StateUpdater = (previous: SiteState) => SiteState

/** 组件提交改动：可直接给出新状态，也可给出基于最新状态的更新函数。 */
export type StateChangeHandler = (next: SiteState | StateUpdater) => Promise<void>
