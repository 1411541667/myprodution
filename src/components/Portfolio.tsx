import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight, Bookmark, Heart, MapPin, Menu, MessageCircle,
  Moon, Search, Send, Sparkles, Sun, X,
} from 'lucide-react'
import { uid } from '../data'
import { readFavorites, readSession, readTheme, writeFavorites, writeSession, writeTheme } from '../storage'
import type { Project, SiteState, StateChangeHandler, ThemeName } from '../types'
import ProjectDetail from './ProjectDetail'

interface Props { state: SiteState; onChange: StateChangeHandler }

const themeLabels: Record<ThemeName, string> = { cream: '暖白', sage: '青绿', night: '夜色' }

export default function Portfolio({ state, onChange }: Props) {
  const [entered, setEntered] = useState(() => readSession('youzai-entered'))
  const [leaving, setLeaving] = useState(false)
  const [theme, setTheme] = useState<ThemeName>(readTheme)
  const [themeOpen, setThemeOpen] = useState(false)
  const [selected, setSelected] = useState<Project | null>(null)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('全部')
  const [favorites, setFavorites] = useState<string[]>(readFavorites)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  const enter = () => {
    setLeaving(true)
    window.setTimeout(() => {
      writeSession('youzai-entered', true)
      setEntered(true)
    }, 500)
  }

  const changeTheme = (next: ThemeName) => {
    setTheme(next); writeTheme(next); setThemeOpen(false)
  }

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id]
    setFavorites(next); writeFavorites(next)
  }

  const projects = state.projects.filter(project => project.published)
  const tags = ['全部', ...Array.from(new Set(projects.flatMap(project => project.tags)))]
  const visibleProjects = useMemo(() => projects.filter(project => {
    const query = search.trim().toLowerCase()
    return (!query || `${project.title} ${project.summary} ${project.tags.join(' ')}`.toLowerCase().includes(query))
      && (tag === '全部' || project.tags.includes(tag))
      && (!onlyFavorites || favorites.includes(project.id))
  }), [projects, search, tag, onlyFavorites, favorites])

  if (!entered) {
    return <main className={`entry ${leaving ? 'entry--leaving' : ''}`}>
      <button className="entry__button" onClick={enter}>
        <span>进入悠哉的小屋</span><span className="entry__dot">·</span>
      </button>
    </main>
  }

  const p = state.profile
  const isEmpty = !p.name && projects.length === 0 && state.moments.length === 0
  return <div className={`site theme-${theme}`}>
    <header className="nav shell">
      <button className="wordmark" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>悠哉<span>の</span>小屋</button>
      <nav className={mobileNav ? 'nav__links nav__links--open' : 'nav__links'}>
        <a href="#about" onClick={() => setMobileNav(false)}>关于我</a>
        <a href="#moments" onClick={() => setMobileNav(false)}>生活切片</a>
        <a href="#projects" onClick={() => setMobileNav(false)}>我的作品</a>
        <a href="#guestbook" onClick={() => setMobileNav(false)}>留言簿</a>
      </nav>
      <div className="nav__actions">
        <div className="theme-picker">
          <button className="icon-button" aria-label="切换主题" onClick={() => setThemeOpen(!themeOpen)}>{theme === 'night' ? <Moon /> : <Sun />}</button>
          {themeOpen && <div className="theme-menu">{(Object.keys(themeLabels) as ThemeName[]).map(item => <button key={item} onClick={() => changeTheme(item)} className={theme === item ? 'active' : ''}>{themeLabels[item]}</button>)}</div>}
        </div>
        <button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="打开菜单"><Menu /></button>
      </div>
    </header>

    {isEmpty ? <EmptyHome /> : <>
      <section className="hero shell" id="about">
        <div className="hero__cover">{p.cover ? <img src={p.cover} alt="个人主页封面" /> : <div className="cover-placeholder"><span>慢一点，生活很长。</span></div>}</div>
        <div className="profile-card">
          <div className="profile-card__avatar">{p.avatar ? <img src={p.avatar} alt={p.name} /> : <span>{p.name?.slice(0, 1) || '悠'}</span>}</div>
          <div className="profile-card__main">
            <div><p className="eyebrow">HELLO, NICE TO MEET YOU</p><h1>{p.name || '尚未填写名字'}</h1><span className="handle">{p.handle}</span></div>
            <p className="profile-card__bio">{p.bio || '这里会出现你的个人介绍。'}</p>
            <div className="profile-card__meta">{p.location && <span><MapPin />{p.location}</span>}{p.tags.map(item => <span className="soft-tag" key={item}>{item}</span>)}</div>
          </div>
          <Sparkles className="profile-card__sparkle" />
        </div>
      </section>

      <section className="moments shell" id="moments">
        <SectionTitle eyebrow="LITTLE MOMENTS" title="最近在想什么" note="把日常揉成轻轻的一句话" />
        {state.moments.length ? <div className="timeline">{state.moments.map((moment, index) => <article className="moment" key={moment.id}>
          <span className="moment__index">{String(index + 1).padStart(2, '0')}</span><div><time>{moment.date}</time><p>{moment.content}</p></div>
        </article>)}</div> : <p className="empty-inline">这里还安安静静的，等一条生活动态。</p>}
      </section>

      <section className="projects shell" id="projects">
        <SectionTitle eyebrow="SELECTED WORKS" title="最近完成的作品" note={`${projects.length} 个项目，慢慢看`} />
        <div className="project-tools">
          <label className="search-box"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索标题、标签或关键词" /></label>
          <button className={onlyFavorites ? 'filter-button active' : 'filter-button'} onClick={() => setOnlyFavorites(!onlyFavorites)}><Heart fill={onlyFavorites ? 'currentColor' : 'none'} />收藏</button>
        </div>
        <div className="tag-row">{tags.map(item => <button className={tag === item ? 'active' : ''} onClick={() => setTag(item)} key={item}>{item}</button>)}</div>
        {visibleProjects.length ? <div className="masonry">{visibleProjects.map(project => <ProjectCard key={project.id} project={project} favorite={favorites.includes(project.id)} onFavorite={() => toggleFavorite(project.id)} onOpen={() => setSelected(project)} />)}</div> : <div className="empty-filter"><Search /><p>没有找到合适的作品</p><span>换个关键词或筛选条件试试吧</span></div>}
      </section>

      <Guestbook state={state} onChange={onChange} />
    </>}

    <footer className="footer shell"><span>© {new Date().getFullYear()} 悠哉的小屋</span><span>认真生活，也认真创造。</span></footer>
    {selected && <ProjectModal project={selected} favorite={favorites.includes(selected.id)} onFavorite={() => toggleFavorite(selected.id)} onClose={() => setSelected(null)} />}
  </div>
}

function SectionTitle({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return <div className="section-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{note}</span></div>
}

function EmptyHome() {
  return <section className="empty-home shell"><div className="empty-home__sun">☀</div><p className="eyebrow">WELCOME HOME</p><h1>小屋正在慢慢布置中</h1><p>主人还没有放入内容，过一会儿再来看看吧。</p></section>
}

function ProjectCard({ project, favorite, onFavorite, onOpen }: { project: Project; favorite: boolean; onFavorite: () => void; onOpen: () => void }) {
  return <article className={`project-card template-${project.template}`}>
    <button className="project-card__open" onClick={onOpen} aria-label={`查看 ${project.title}`}>
      <div className="project-card__image">{project.cover ? <img src={project.cover} alt={project.title} /> : <div className="image-placeholder"><span>{project.title.slice(0, 1)}</span></div>}<span className="view-hint">打开看看 <ArrowUpRight /></span></div>
      <div className="project-card__body"><div className="project-card__tags">{project.tags.slice(0, 3).map(item => <span key={item}>#{item}</span>)}</div><h3>{project.title}</h3><p>{project.summary}</p></div>
    </button>
    <button className={`save-button ${favorite ? 'active' : ''}`} onClick={onFavorite} aria-label="收藏作品"><Bookmark fill={favorite ? 'currentColor' : 'none'} /></button>
  </article>
}

function ProjectModal({ project, favorite, onFavorite, onClose }: { project: Project; favorite: boolean; onFavorite: () => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeydown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <button className="modal-close" ref={closeRef} onClick={onClose} aria-label="关闭"><X /></button>
    <div className="phone-frame" role="dialog" aria-modal="true" aria-label={project.title}>
      <div className="phone-speaker" />
      <div className="phone-content">
        <ProjectDetail project={project} favorite={favorite} onFavorite={onFavorite} />
      </div>
      <div className="phone-home" />
    </div>
  </div>
}

function Guestbook({ state, onChange }: Props) {
  const [nickname, setNickname] = useState('')
  const [content, setContent] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const published = state.messages.filter(item => item.status === 'published')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname.trim() || !content.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const entry = { id: uid(), nickname: nickname.trim(), content: content.trim(), createdAt: new Date().toISOString(), status: 'pending' as const }
      await onChange(previous => ({ ...previous, messages: [entry, ...previous.messages] }))
      setNickname(''); setContent(''); setSent(true)
    } catch {
      setError('留言没能保存，请稍后再试一次。')
    } finally {
      setSending(false)
    }
  }
  return <section className="guestbook shell" id="guestbook">
    <SectionTitle eyebrow="LEAVE A NOTE" title="在门口留句话吧" note="你的留言会在主人查看后出现" />
    <div className="guestbook__grid"><form className="note-form" onSubmit={submit}>
      {sent && <div className="success-note">收到啦！留言会在审核后出现在这里。</div>}
      {error && <div className="form-error">{error}</div>}
      <label>怎么称呼你<input value={nickname} onChange={e => setNickname(e.target.value.slice(0, 20))} required placeholder="一位路过的朋友" /></label>
      <label>想说的话<textarea value={content} onChange={e => setContent(e.target.value.slice(0, 300))} required placeholder="写下一点什么…" rows={5} /></label>
      <button className="primary-button" type="submit" disabled={sending}><Send />{sending ? '正在放进留言簿…' : '放进留言簿'}</button>
    </form><div className="notes-wall">{published.length ? published.map(item => <article className="guest-note" key={item.id}><MessageCircle /><p>{item.content}</p><footer><b>{item.nickname}</b><time>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</time></footer></article>) : <div className="empty-notes">还没有公开留言，来做第一个敲门的人吧。</div>}</div></div>
  </section>
}
