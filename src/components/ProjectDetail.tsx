import { ArrowUpRight, Bookmark } from 'lucide-react'
import { safeLink } from '../data'
import type { Project } from '../types'

interface Props {
  project: Project
  favorite?: boolean
  onFavorite?: () => void
  /** 后台预览时隐藏收藏按钮，只展示访客能看到的内容。 */
  preview?: boolean
}

/** 访客详情与后台预览共用的正文渲染，保证「预览 = 访客所见」。 */
export default function ProjectDetail({ project, favorite = false, onFavorite, preview = false }: Props) {
  const link = safeLink(project.link)
  const blocks = project.blocks.filter(block => block.type === 'text' ? block.content.trim() : block.content)
  return <>
    {project.cover && <img className="detail-cover" src={project.cover} alt={project.title} />}
    <div className="detail-head">
      <div className="project-card__tags">{project.tags.map(item => <span key={item}>#{item}</span>)}</div>
      <h2>{project.title || '未命名项目'}</h2>
      <p>{project.summary || '这里会显示项目简介。'}</p>
    </div>
    <div className="detail-blocks">
      {blocks.length
        ? blocks.map(block => block.type === 'text'
          ? <p key={block.id}>{block.content}</p>
          : <figure key={block.id}><img src={block.content} alt={block.caption || project.title} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>)
        : <p className="detail-blocks__empty">还没有详情内容，可以在「详情内容」步骤里补充。</p>}
    </div>
    {link && <a className="external-link" href={link} target="_blank" rel="noopener noreferrer">{project.linkLabel || '访问项目'}<ArrowUpRight /></a>}
    {!preview && onFavorite && <div className="detail-end">
      <span>THE END</span>
      <button onClick={onFavorite}><Bookmark fill={favorite ? 'currentColor' : 'none'} />{favorite ? '已收藏' : '收藏作品'}</button>
    </div>}
    {preview && <div className="detail-end"><span>THE END</span></div>}
  </>
}
