# 悠哉的小屋

一个使用 React、TypeScript 与 Vite 制作的本地优先个人作品集。

## 启动

```powershell
npm install
npm run dev
```

- 游客页面：<http://127.0.0.1:5173/>

管理入口地址与口令属于私有运维信息，保存在本地的 `README-admin.md` 中，该文件已加入 `.gitignore`，不随仓库发布。

## 数据说明

个人资料、动态、项目、图片和留言保存在当前浏览器的 IndexedDB 中；收藏、主题、上次导出时间和后台会话保存在浏览器本地。清理浏览器站点数据会同时清除这些内容。

读取和写入都会经过 `src/data.ts` 的 `normalizeState`：缺失字段补默认值，非法条目直接丢弃。因此旧版本数据、手工改过的数据或损坏的本地记录都不会让页面崩溃。

## 备份与迁移

管理后台「站点设置」提供：

- **导出备份**：下载 `youzai-backup-YYYY-MM-DD.json`，包含个人资料、动态、项目、图片与留言。
- **导入备份**：选择备份文件后会先显示条目数量，确认后才覆盖当前内容。

导出文件带 `format: "youzai-portfolio"` 与 `version` 字段，便于以后做数据迁移。导入失败（文件不是 JSON、不是小屋数据等）会给出中文提示，不会改动现有内容。

## 图片上传

后台选择图片时会自动校验：只接受 PNG、JPG、WEBP，原文件不超过 8 MB，最长边超过 2000px 会自动等比缩小，非 PNG 会转成压缩后的 WEBP。校验失败会在上传框下方提示，并保留原有图片。每个图片字段都可以单独「移除图片」。

## 构建

```powershell
npm run build
npm run preview
```

## 目录

```text
src
├─ App.tsx                    加载数据、串行保存、按路径分发游客端或后台
├─ data.ts                    IndexedDB 仓库、数据校验、图片处理、导入导出
├─ storage.ts                 localStorage / sessionStorage 安全读写
├─ types.ts                   全部核心数据类型
├─ styles.css                 游客端、后台、响应式和动画样式
└─ components
   ├─ Portfolio.tsx           游客端页面与交互
   ├─ Admin.tsx               登录、后台管理与项目上传向导
   └─ ProjectDetail.tsx       访客详情与后台预览共用的正文渲染
```
