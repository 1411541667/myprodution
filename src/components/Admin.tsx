import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft, ArrowDown, ArrowUp, Check, ChevronRight, Clock3, Download, Eye, EyeOff,
  FileText, ImagePlus, LayoutDashboard, LogOut, MessageSquare, Monitor, Pencil, Plus,
  Save, Settings, Sparkles, Trash2, Upload, UserRound, X,
} from 'lucide-react'
import { emptyState, exportState, fileToDataUrl, importState, moveItem, safeLink, uid } from '../data'
import { readLastBackup, readSession, writeLastBackup, writeSession } from '../storage'
import type {
  DetailBlock, Moment, Profile, Project, SiteState, StateChangeHandler, StateUpdater,
} from '../types'
import ProjectDetail from './ProjectDetail'

interface Props { state: SiteState; onChange: StateChangeHandler }
type Tab = 'overview' | 'profile' | 'moments' | 'projects' | 'messages' | 'settings'
const ADMIN_PASSWORD = 'youzai2026'

export default function Admin(props: Props) {
  const [authed, setAuthed] = useState(() => readSession('youzai-admin'))
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />
  return <AdminShell {...props} onLogout={() => { writeSession('youzai-admin', false); setAuthed(false) }} />
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) { writeSession('youzai-admin', true); onLogin() }
    else { setError(true); setPassword('') }
  }
  return <main className="admin-login"><div className="admin-login__card">
    <span className="admin-login__mark"><Sparkles /></span><p className="eyebrow">PRIVATE STUDIO</p><h1>欢迎回来</h1><p>输入管理口令，继续布置你的小屋。</p>
    <form onSubmit={submit}><label>管理口令<input autoFocus type="password" value={password} onChange={e => { setPassword(e.target.value); setError(false) }} placeholder="••••••••" /></label>{error && <span className="form-error">口令不正确，请再试一次。</span>}<button className="primary-button" type="submit">进入工作室<ChevronRight /></button></form>
    <a href="/"><ArrowLeft />返回小屋</a>
  </div></main>
}

function AdminShell({ state, onChange, onLogout }: Props & { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const notify = (text: string, error = false) => {
    setNotice({ text, error })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setNotice(null), error ? 5000 : 2200)
  }

  /** 保存失败时提示原因，并把失败结果返回给调用方，避免界面假装成功。 */
  const save = async (next: SiteState | StateUpdater, message = '更改已保存'): Promise<boolean> => {
    try {
      await onChange(next)
      notify(message)
      return true
    } catch (error) {
      notify(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请稍后重试', true)
      return false
    }
  }

  if (editingProject) {
    const isPublished = state.projects.some(item => item.id === editingProject.id && item.published)
    return <ProjectEditor
      project={editingProject}
      wasPublished={isPublished}
      onCancel={() => setEditingProject(null)}
      onSave={async project => {
        const ok = await save(previous => {
          const exists = previous.projects.some(item => item.id === project.id)
          return {
            ...previous,
            projects: exists ? previous.projects.map(item => item.id === project.id ? project : item) : [project, ...previous.projects],
          }
        }, project.published ? '项目已发布' : '已保存为草稿')
        if (ok) setEditingProject(null)
      }}
    />
  }

  const menu: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'overview', label: '总览', icon: <LayoutDashboard /> },
    { id: 'profile', label: '个人信息', icon: <UserRound /> },
    { id: 'moments', label: '说说与时间线', icon: <Clock3 /> },
    { id: 'projects', label: '项目管理', icon: <FileText /> },
    { id: 'messages', label: '留言审核', icon: <MessageSquare /> },
    { id: 'settings', label: '站点设置', icon: <Settings /> },
  ]
  const pendingCount = state.messages.filter(m => m.status === 'pending').length

  return <div className="admin-layout">
    <aside className="admin-sidebar">
      <a href="/" className="admin-brand">悠哉<span>の</span>小屋<small>内容工作室</small></a>
      <nav>{menu.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.icon}{item.label}{item.id === 'messages' && pendingCount > 0 && <i>{pendingCount}</i>}</button>)}</nav>
      <div className="admin-sidebar__bottom"><a href="/" target="_blank" rel="noreferrer"><Monitor />查看网站</a><button onClick={onLogout}><LogOut />退出后台</button></div>
    </aside>
    <main className="admin-main">
      {tab === 'overview' && <Overview state={state} go={setTab} addProject={() => setEditingProject(newProject())} />}
      {tab === 'profile' && <ProfileEditor profile={state.profile} onSave={profile => save(previous => ({ ...previous, profile }), '个人信息已保存')} />}
      {tab === 'moments' && <MomentsEditor moments={state.moments} onSave={(moments, message) => save(previous => ({ ...previous, moments }), message)} />}
      {tab === 'projects' && <ProjectsManager
        projects={state.projects}
        onAdd={() => setEditingProject(newProject())}
        onEdit={setEditingProject}
        onDelete={id => save(previous => ({ ...previous, projects: previous.projects.filter(item => item.id !== id) }), '项目已删除')}
        onToggle={id => save(previous => ({ ...previous, projects: previous.projects.map(item => item.id === id ? { ...item, published: !item.published } : item) }))}
        onMove={(index, offset) => save(previous => ({ ...previous, projects: moveItem(previous.projects, index, offset) }))}
      />}
      {tab === 'messages' && <MessagesManager messages={state.messages} onChange={messages => save(previous => ({ ...previous, messages }))} />}
      {tab === 'settings' && <SettingsPanel
        state={state}
        onReplace={next => save(next, '备份已导入')}
        onClear={() => save(structuredClone(emptyState), '本地内容已清空')}
        notify={notify}
      />}
    </main>
    {notice && <div className={notice.error ? 'toast toast--error' : 'toast'}>{notice.error ? <X /> : <Check />}{notice.text}</div>}
  </div>
}

function PageHead({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="admin-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>
}

function Overview({ state, go, addProject }: { state: SiteState; go: (tab: Tab) => void; addProject: () => void }) {
  const stats = [
    { label: '已发布项目', value: state.projects.filter(p => p.published).length, note: `${state.projects.filter(p => !p.published).length} 篇草稿` },
    { label: '生活动态', value: state.moments.length, note: '展示在个人主页' },
    { label: '待审留言', value: state.messages.filter(m => m.status === 'pending').length, note: `${state.messages.filter(m => m.status === 'published').length} 条已公开` },
  ]
  return <>
    <PageHead eyebrow="DASHBOARD" title={`早上好，${state.profile.name || '小屋主人'}`} description="今天也来添一点新的故事吧。" action={<button className="primary-button" onClick={addProject}><Plus />快捷上传项目</button>} />
    <div className="stats-grid">{stats.map((item, index) => <article key={item.label}><span>0{index + 1}</span><p>{item.label}</p><strong>{item.value}</strong><small>{item.note}</small></article>)}</div>
    <div className="admin-two-col">
      <section className="admin-panel">
        <div className="panel-title"><h2>最近项目</h2><button onClick={() => go('projects')}>查看全部<ChevronRight /></button></div>
        {state.projects.length
          ? <div className="recent-list">{state.projects.slice(0, 4).map(p => <div key={p.id}>{p.cover ? <img src={p.cover} alt="" /> : <span className="mini-placeholder">{p.title.slice(0, 1)}</span>}<div><b>{p.title}</b><small>{p.published ? '已发布' : '草稿'} · {p.createdAt}</small></div></div>)}</div>
          : <EmptyAdmin text="还没有项目，上传第一个作品吧。" />}
      </section>
      <section className="admin-panel">
        <div className="panel-title"><h2>内容完整度</h2></div>
        <div className="checklist">
          <CheckRow done={!!state.profile.name} text="填写个人资料" onClick={() => go('profile')} />
          <CheckRow done={!!state.profile.avatar} text="上传头像" onClick={() => go('profile')} />
          <CheckRow done={state.moments.length > 0} text="发布第一条动态" onClick={() => go('moments')} />
          <CheckRow done={state.projects.some(p => p.published)} text="发布第一个项目" onClick={addProject} />
          <CheckRow done={!!readLastBackup()} text="导出一次备份" onClick={() => go('settings')} />
        </div>
      </section>
    </div>
  </>
}

function CheckRow({ done, text, onClick, optional }: { done: boolean; text: string; onClick: () => void; optional?: boolean }) {
  const state = done ? 'done' : optional ? 'optional' : ''
  return <button className="check-row" onClick={onClick}><span className={state}>{done ? <Check /> : optional ? '–' : ''}</span>{text}{optional && <small className="check-row__hint">可选</small>}<ChevronRight /></button>
}

function EmptyAdmin({ text }: { text: string }) { return <div className="empty-admin"><Sparkles /><p>{text}</p></div> }

function ProfileEditor({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  const [draft, setDraft] = useState(profile)
  const setImage = async (field: 'avatar' | 'cover', file?: File) => {
    const value = await fileToDataUrl(file)
    setDraft(current => ({ ...current, [field]: value }))
  }
  return <>
    <PageHead eyebrow="PROFILE" title="个人信息" description="这部分会出现在主页最显眼的位置。" action={<button className="primary-button" onClick={() => onSave(draft)}><Save />保存修改</button>} />
    <section className="admin-panel form-panel">
      <h2>视觉资料</h2>
      <div className="image-fields">
        <ImageField label="头像" value={draft.avatar} round onChange={file => setImage('avatar', file)} onClear={() => setDraft(current => ({ ...current, avatar: '' }))} />
        <ImageField label="主页封面" value={draft.cover} onChange={file => setImage('cover', file)} onClear={() => setDraft(current => ({ ...current, cover: '' }))} />
      </div>
    </section>
    <section className="admin-panel form-panel">
      <h2>基础资料</h2>
      <div className="form-grid">
        <Field label="显示名称" value={draft.name} onChange={name => setDraft({ ...draft, name })} placeholder="你的名字" />
        <Field label="个性账号" value={draft.handle} onChange={handle => setDraft({ ...draft, handle })} placeholder="@yourname" />
        <Field label="所在城市" value={draft.location} onChange={location => setDraft({ ...draft, location })} placeholder="例如：长沙" />
        <Field label="个人标签" value={draft.tags.join('，')} onChange={value => setDraft({ ...draft, tags: splitTags(value) })} placeholder="设计，摄影，开发" wide />
        <label className="wide">个人介绍<textarea value={draft.bio} onChange={e => setDraft({ ...draft, bio: e.target.value })} rows={5} placeholder="简单介绍一下自己，以及正在做的事情…" /></label>
      </div>
    </section>
  </>
}

function MomentsEditor({ moments, onSave }: { moments: Moment[]; onSave: (moments: Moment[], message?: string) => void }) {
  const [content, setContent] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Moment | null>(null)

  const add = () => {
    if (!content.trim()) return
    onSave([{ id: uid(), content: content.trim(), date }, ...moments], '动态已发布')
    setContent('')
  }
  const startEdit = (moment: Moment) => { setEditingId(moment.id); setDraft({ ...moment }) }
  const commitEdit = () => {
    if (!draft || !draft.content.trim()) return
    onSave(moments.map(item => item.id === draft.id ? { ...draft, content: draft.content.trim() } : item), '动态已更新')
    setEditingId(null); setDraft(null)
  }
  const remove = (moment: Moment) => {
    if (!confirm(`确认删除这条动态？\n\n${moment.content.slice(0, 40)}`)) return
    onSave(moments.filter(item => item.id !== moment.id), '动态已删除')
  }

  return <>
    <PageHead eyebrow="MOMENTS" title="说说与时间线" description="记录近况、灵感和生活里的小切片。" />
    <section className="admin-panel composer">
      <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="最近在想什么？" />
      <div><input type="date" value={date} onChange={e => setDate(e.target.value)} /><button className="primary-button" onClick={add}><Plus />发布动态</button></div>
    </section>
    <section className="admin-panel">
      <div className="panel-title"><h2>全部动态</h2><span>{moments.length} 条 · 顺序即前台展示顺序</span></div>
      {moments.length ? <div className="moment-admin-list">{moments.map((m, index) => <article key={m.id}>
        <time>{m.date}</time>
        {editingId === m.id && draft
          ? <div className="moment-edit">
            <textarea rows={3} value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} />
            <div className="moment-edit__row"><input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /><button className="primary-button" onClick={commitEdit}><Check />保存</button><button className="ghost-button" onClick={() => { setEditingId(null); setDraft(null) }}>取消</button></div>
          </div>
          : <p>{m.content}</p>}
        <div className="row-actions">
          <button disabled={index === 0} title="上移" onClick={() => onSave(moveItem(moments, index, -1), '顺序已更新')}><ArrowUp /></button>
          <button disabled={index === moments.length - 1} title="下移" onClick={() => onSave(moveItem(moments, index, 1), '顺序已更新')}><ArrowDown /></button>
          <button title="编辑" onClick={() => startEdit(m)}><Pencil /></button>
          <button className="danger-icon" title="删除" onClick={() => remove(m)}><Trash2 /></button>
        </div>
      </article>)}</div> : <EmptyAdmin text="还没有动态，写下一条近况吧。" />}
    </section>
  </>
}

function ProjectsManager({ projects, onAdd, onEdit, onDelete, onToggle, onMove }: {
  projects: Project[]
  onAdd: () => void
  onEdit: (p: Project) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  onMove: (index: number, offset: number) => void
}) {
  return <>
    <PageHead eyebrow="PROJECTS" title="项目管理" description="管理作品卡片、详细内容与发布状态。" action={<button className="primary-button" onClick={onAdd}><Upload />快捷上传</button>} />
    <section className="admin-panel">
      <div className="panel-title"><h2>全部项目</h2><span>{projects.length} 个 · 顺序即前台展示顺序</span></div>
      {projects.length ? <div className="project-admin-list">{projects.map((p, index) => <article key={p.id}>
        {p.cover ? <img src={p.cover} alt="" /> : <span className="mini-placeholder">{p.title.slice(0, 1)}</span>}
        <div>
          <div className="status-line"><span className={p.published ? 'status published' : 'status'}>{p.published ? '已发布' : '草稿'}</span>{p.tags.slice(0, 2).map(tag => <small key={tag}>#{tag}</small>)}</div>
          <h3>{p.title}</h3><p>{p.summary || '暂无简介'}</p>
        </div>
        <div className="row-actions">
          <button disabled={index === 0} title="上移" onClick={() => onMove(index, -1)}><ArrowUp /></button>
          <button disabled={index === projects.length - 1} title="下移" onClick={() => onMove(index, 1)}><ArrowDown /></button>
          <button onClick={() => onToggle(p.id)} title={p.published ? '取消发布' : '发布'}>{p.published ? <EyeOff /> : <Eye />}</button>
          <button onClick={() => onEdit(p)}>编辑</button>
          <button className="danger-icon" onClick={() => confirm(`确认删除“${p.title}”？删除后无法恢复。`) && onDelete(p.id)}><Trash2 /></button>
        </div>
      </article>)}</div> : <EmptyAdmin text="项目列表还是空的，开始上传吧。" />}
    </section>
  </>
}

function MessagesManager({ messages, onChange }: { messages: SiteState['messages']; onChange: (messages: SiteState['messages']) => void }) {
  const pending = messages.filter(m => m.status === 'pending')
  const published = messages.filter(m => m.status === 'published')
  const setStatus = (id: string, status: 'pending' | 'published') => onChange(messages.map(m => m.id === id ? { ...m, status } : m))
  const remove = (id: string) => { if (confirm('确认删除这条留言？删除后无法恢复。')) onChange(messages.filter(item => item.id !== id)) }
  return <>
    <PageHead eyebrow="GUESTBOOK" title="留言审核" description="留言默认不会公开，由你亲自决定哪些出现在小屋。" />
    <section className="admin-panel">
      <div className="panel-title"><h2>等待审核</h2><span>{pending.length} 条</span></div>
      {pending.length ? <div className="message-list">{pending.map(m => <MessageRow key={m.id} message={m} actions={<><button className="approve" onClick={() => setStatus(m.id, 'published')}><Check />公开</button><button className="danger-icon" onClick={() => remove(m.id)}><Trash2 /></button></>} />)}</div> : <EmptyAdmin text="没有待审留言。" />}
    </section>
    <section className="admin-panel">
      <div className="panel-title"><h2>已经公开</h2><span>{published.length} 条</span></div>
      {published.length ? <div className="message-list">{published.map(m => <MessageRow key={m.id} message={m} actions={<><button onClick={() => setStatus(m.id, 'pending')}><EyeOff />隐藏</button><button className="danger-icon" onClick={() => remove(m.id)}><Trash2 /></button></>} />)}</div> : <EmptyAdmin text="还没有公开留言。" />}
    </section>
  </>
}

function MessageRow({ message, actions }: { message: SiteState['messages'][number]; actions: ReactNode }) {
  return <article className="message-row"><div className="message-avatar">{message.nickname.slice(0, 1)}</div><div><b>{message.nickname}</b><time>{new Date(message.createdAt).toLocaleString('zh-CN')}</time><p>{message.content}</p></div><div className="row-actions">{actions}</div></article>
}

function SettingsPanel({ state, onReplace, onClear, notify }: {
  state: SiteState
  onReplace: (next: SiteState) => Promise<boolean>
  onClear: () => void
  notify: (text: string, error?: boolean) => void
}) {
  const [pending, setPending] = useState<SiteState | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = () => {
    try {
      const filename = exportState(state)
      writeLastBackup()
      notify(`已导出 ${filename}`)
    } catch {
      notify('导出失败，请检查浏览器是否阻止了下载', true)
    }
  }

  const pickFile = async (file?: File) => {
    if (!file) return
    setError('')
    try {
      setPending(await importState(file))
    } catch (e) {
      setPending(null)
      setError(e instanceof Error ? e.message : '备份文件读取失败')
    }
  }

  const confirmImport = async () => {
    if (!pending) return
    const ok = await onReplace(pending)
    if (ok) setPending(null)
  }

  const clearAll = () => {
    if (!confirm('清空后无法恢复。\n建议先导出备份，确认要继续吗？')) return
    if (!confirm('最后确认：真的要清空全部本地内容吗？')) return
    onClear()
  }

  return <>
    <PageHead eyebrow="SETTINGS" title="站点设置" description="管理本地数据、备份与未来迁移准备。" />
    <section className="admin-panel settings-list">
      <div><span className="setting-icon"><Monitor /></span><div><h3>当前存储方式</h3><p>内容与图片保存在此浏览器的 IndexedDB 中，换设备不会同步。</p></div><strong>本地模式</strong></div>
      <div><span className="setting-icon"><Save /></span><div><h3>内容概览</h3><p>{state.projects.length} 个项目（{state.projects.filter(p => p.published).length} 已发布） · {state.moments.length} 条动态 · {state.messages.length} 条留言</p></div></div>
    </section>
    <section className="admin-panel">
      <div className="panel-title"><h2>备份与迁移</h2><span>JSON 文件，可跨浏览器还原</span></div>
      <p className="panel-note">导出会包含个人资料、动态、项目、图片与留言。导入会整体覆盖当前内容，建议先导出一份。</p>
      <div className="backup-actions">
        <button className="primary-button" onClick={doExport}><Download />导出备份</button>
        <button className="ghost-button" onClick={() => fileRef.current?.click()}><Upload />导入备份</button>
        <input ref={fileRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={e => { void pickFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {error && <p className="form-error">{error}</p>}
      {pending && <div className="import-confirm">
        <b>即将用备份覆盖当前内容</b>
        <p>{pending.projects.length} 个项目 · {pending.moments.length} 条动态 · {pending.messages.length} 条留言</p>
        <div className="backup-actions">
          <button className="primary-button" onClick={confirmImport}><Check />确认覆盖</button>
          <button className="ghost-button" onClick={() => setPending(null)}>取消</button>
        </div>
      </div>}
    </section>
    <section className="admin-panel danger-zone">
      <h2>危险操作</h2>
      <p>清空后无法恢复，请务必先导出备份。</p>
      <div className="backup-actions">
        <button className="ghost-button" onClick={doExport}><Download />先导出备份</button>
        <button onClick={clearAll}><Trash2 />清空全部内容</button>
      </div>
    </section>
  </>
}

function ProjectEditor({ project, wasPublished, onCancel, onSave }: {
  project: Project
  wasPublished: boolean
  onCancel: () => void
  onSave: (p: Project) => void
}) {
  const [draft, setDraft] = useState(project)
  const [step, setStep] = useState(1)
  const title = draft.title.trim()
  const linkError = draft.link.trim() && !safeLink(draft.link) ? '链接必须以 http:// 或 https:// 开头' : ''
  const filledBlocks = draft.blocks.filter(isFilledBlock)
  const emptyBlockCount = draft.blocks.length - filledBlocks.length
  const hasDetail = filledBlocks.length > 0

  const patch = (next: Partial<Project>) => setDraft(current => ({ ...current, ...next }))
  const addBlock = (type: DetailBlock['type']) => patch({ blocks: [...draft.blocks, { id: uid(), type, content: '' }] })
  const updateBlock = (id: string, value: Partial<DetailBlock>) => patch({ blocks: draft.blocks.map(block => block.id === id ? { ...block, ...value } as DetailBlock : block) })

  /** 步骤跳转只允许进入已满足前置条件的步骤。 */
  const canEnter = (target: number) => target === 1 || !!title
  const goStep = (target: number) => { if (canEnter(target)) setStep(target) }

  const publish = () => {
    if (!title || linkError) return
    onSave({ ...draft, title, link: safeLink(draft.link), blocks: filledBlocks, published: true })
  }
  const saveDraft = () => {
    if (!title || linkError) return
    onSave({ ...draft, title, link: safeLink(draft.link), blocks: filledBlocks, published: wasPublished })
  }

  return <div className="project-editor">
    <header className="editor-top">
      <button onClick={onCancel} aria-label="关闭编辑器"><X /></button>
      <div><p>快捷上传项目</p><span>填写内容、预览并发布</span></div>
      {wasPublished && <button className="ghost-button" onClick={() => onSave({ ...draft, title: title || draft.title, link: safeLink(draft.link), blocks: filledBlocks, published: false })}><EyeOff />取消发布</button>}
      <button className="ghost-button" disabled={!title || !!linkError} onClick={saveDraft}><Save />{wasPublished ? '保存修改' : '保存草稿'}</button>
    </header>
    <div className="stepper">{['基本信息', '详情内容', '预览发布'].map((label, i) => <button className={step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''} disabled={!canEnter(i + 1)} onClick={() => goStep(i + 1)} key={label}><span>{step > i + 1 ? <Check /> : i + 1}</span>{label}</button>)}</div>
    <main className="editor-body">
      {step === 1 && <section className="editor-section">
        <p className="eyebrow">STEP 01</p><h1>先介绍一下这个项目</h1><p>这些内容会出现在首页的作品卡片上。</p>
        <div className="editor-grid">
          <div>
            <Field label="项目标题 *" value={draft.title} onChange={value => patch({ title: value })} placeholder="给作品起一个好名字" />
            <label>项目简介<textarea rows={5} value={draft.summary} onChange={e => patch({ summary: e.target.value })} placeholder="用两三句话说说它…" /></label>
            <Field label="项目标签" value={draft.tags.join('，')} onChange={value => patch({ tags: splitTags(value) })} placeholder="品牌设计，网页，摄影" />
            <div className="template-options">
              <span>卡片展示方式</span>
              {(['story', 'gallery', 'minimal'] as const).map((item, i) => <button key={item} className={draft.template === item ? 'active' : ''} onClick={() => patch({ template: item })}><i className={`layout-demo demo-${item}`} />{['故事封面', '画廊大图', '极简卡片'][i]}</button>)}
            </div>
          </div>
          <ImageField label="项目封面" value={draft.cover} tall onChange={async file => patch({ cover: await fileToDataUrl(file) })} onClear={() => patch({ cover: '' })} />
        </div>
      </section>}

      {step === 2 && <section className="editor-section">
        <p className="eyebrow">STEP 02</p><h1>编排项目详情</h1><p>按照阅读顺序添加文字和图片，访客会在手机框内滚动查看。</p>
        <div className="block-editor">
          {draft.blocks.map((block, index) => <article key={block.id}>
            <header>
              <span>{String(index + 1).padStart(2, '0')} · {block.type === 'text' ? '文字段落' : '图片'}{!isFilledBlock(block) && ' · 待填写'}</span>
              <div className="block-actions">
                <button disabled={index === 0} title="上移" onClick={() => patch({ blocks: moveItem(draft.blocks, index, -1) })}><ArrowUp /></button>
                <button disabled={index === draft.blocks.length - 1} title="下移" onClick={() => patch({ blocks: moveItem(draft.blocks, index, 1) })}><ArrowDown /></button>
                <button title="删除" onClick={() => patch({ blocks: draft.blocks.filter(item => item.id !== block.id) })}><Trash2 /></button>
              </div>
            </header>
            {block.type === 'text'
              ? <textarea rows={6} value={block.content} onChange={e => updateBlock(block.id, { content: e.target.value })} placeholder="写下项目背景、过程、思考或成果…" />
              : <><ImageField label="详情图片" value={block.content} onChange={async file => updateBlock(block.id, { content: await fileToDataUrl(file) })} onClear={() => updateBlock(block.id, { content: '' })} /><Field label="图片说明" value={block.caption || ''} onChange={caption => updateBlock(block.id, { caption })} placeholder="可不填" /></>}
          </article>)}
          <div className="add-blocks"><button onClick={() => addBlock('text')}><FileText />添加文字</button><button onClick={() => addBlock('image')}><ImagePlus />添加图片</button></div>
        </div>
        <div className="link-fields">
          <h2>外部链接</h2>
          <Field label="按钮文字" value={draft.linkLabel} onChange={value => patch({ linkLabel: value })} placeholder="访问项目" />
          <Field label="链接地址" value={draft.link} onChange={value => patch({ link: value })} placeholder="https://…" />
          {linkError && <p className="form-error">{linkError}</p>}
        </div>
      </section>}

      {step === 3 && <section className="editor-section preview-step">
        <p className="eyebrow">STEP 03</p><h1>最后检查一遍</h1><p>左边是卡片效果，中间是访客打开后看到的手机详情。</p>
        <div className="publish-preview">
          <div className={`project-card template-${draft.template}`}>
            <div className="project-card__image">{draft.cover ? <img src={draft.cover} alt="" /> : <div className="image-placeholder"><span>{title.slice(0, 1) || '作'}</span></div>}</div>
            <div className="project-card__body"><div className="project-card__tags">{draft.tags.map(t => <span key={t}>#{t}</span>)}</div><h3>{title || '未命名项目'}</h3><p>{draft.summary || '这里会显示项目简介。'}</p></div>
          </div>
          <div className="publish-preview__phone">
            <div className="phone-frame">
              <div className="phone-speaker" />
              <div className="phone-content"><ProjectDetail project={{ ...draft, title: title || '未命名项目', blocks: filledBlocks }} preview /></div>
              <div className="phone-home" />
            </div>
          </div>
          <div className="publish-check">
            <h2>准备发布</h2>
            <CheckRow done={!!title} text="项目标题" onClick={() => setStep(1)} />
            <CheckRow done={!!draft.cover} text="项目封面" onClick={() => setStep(1)} />
            <CheckRow done={hasDetail} text="详情内容" onClick={() => setStep(2)} />
            <CheckRow done={!!safeLink(draft.link)} text="外部链接" onClick={() => setStep(2)} optional />
            {linkError && <p className="form-error">{linkError}</p>}
            {emptyBlockCount > 0 && <p className="panel-note">有 {emptyBlockCount} 个空内容块会在保存时自动跳过。</p>}
          </div>
        </div>
      </section>}
    </main>
    <footer className="editor-footer">
      <button className="ghost-button" disabled={step === 1} onClick={() => setStep(step - 1)}><ArrowLeft />上一步</button>
      {step < 3
        ? <button className="primary-button" disabled={!title} onClick={() => setStep(step + 1)}>下一步<ChevronRight /></button>
        : <button className="primary-button" disabled={!title || !!linkError} onClick={publish}><Upload />确认发布</button>}
    </footer>
  </div>
}

function isFilledBlock(block: DetailBlock): boolean {
  return block.type === 'text' ? !!block.content.trim() : !!block.content
}

function newProject(): Project {
  return { id: uid(), title: '', summary: '', cover: '', tags: [], template: 'story', link: '', linkLabel: '访问项目', blocks: [], published: false, createdAt: new Date().toISOString().slice(0, 10) }
}
function splitTags(value: string) { return value.split(/[,，]/).map(item => item.trim()).filter(Boolean) }

function Field({ label, value, onChange, placeholder, wide }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean }) {
  return <label className={wide ? 'wide' : ''}>{label}<input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>
}

function ImageField({ label, value, onChange, onClear, round, tall }: {
  label: string
  value: string
  onChange: (file?: File) => Promise<void>
  onClear?: () => void
  round?: boolean
  tall?: boolean
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pick = async (file?: File) => {
    if (!file) return
    setBusy(true); setError('')
    try {
      await onChange(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : '图片处理失败，请换一张试试')
    } finally {
      setBusy(false)
    }
  }
  return <div className={`image-field ${round ? 'round' : ''} ${tall ? 'tall' : ''}`}>
    <span>{label}</span>
    <div>
      {value ? <img src={value} alt="预览" /> : <><ImagePlus /><b>选择图片</b><small>PNG、JPG 或 WEBP，会自动压缩</small></>}
      {busy && <span className="image-field__busy">正在处理…</span>}
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
    {error && <small className="form-error">{error}</small>}
    {value && onClear && <button type="button" className="image-clear" onClick={onClear}>移除图片</button>}
  </div>
}
