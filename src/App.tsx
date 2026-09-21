import { useCallback, useEffect, useRef, useState } from 'react'
import { emptyState, loadState, saveState } from './data'
import type { SiteState, StateChangeHandler } from './types'
import Admin from './components/Admin'
import Portfolio from './components/Portfolio'

/** 只把 /studio 与 /studio/… 视为后台，避免 /studio-public 之类路径被误判。 */
function isStudioPath(pathname: string): boolean {
  return pathname === '/studio' || pathname.startsWith('/studio/')
}

export default function App() {
  const [state, setState] = useState<SiteState | null>(null)
  const [saveError, setSaveError] = useState('')
  const latest = useRef<SiteState>(emptyState)
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    void loadState().then(loaded => {
      latest.current = loaded
      setState(loaded)
    })
  }, [])

  /**
   * 先更新界面，再把写入串行排队：连续操作不会再出现后写的旧数据覆盖新数据。
   * 写入失败会把错误抛给调用方，同时保留顶部横幅提醒内容尚未落盘。
   */
  const updateState = useCallback<StateChangeHandler>(async next => {
    const resolved = typeof next === 'function' ? next(latest.current) : next
    latest.current = resolved
    setState(resolved)
    const write = queue.current.then(() => saveState(resolved))
    queue.current = write.catch(() => undefined)
    try {
      await write
      setSaveError('')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存到本地数据库失败')
      throw error
    }
  }, [])

  if (!state) return <div className="loading">正在推开小屋的窗…</div>
  return <>
    {saveError && <div className="storage-banner" role="alert">
      <span>内容没能保存到本地：{saveError}。建议先去「站点设置」导出备份。</span>
      <button onClick={() => setSaveError('')} aria-label="关闭提示">×</button>
    </div>}
    {isStudioPath(window.location.pathname)
      ? <Admin state={state} onChange={updateState} />
      : <Portfolio state={state} onChange={updateState} />}
  </>
}
