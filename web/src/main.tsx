/**
 * 应用入口文件
 *
 * React 应用从这里开始：
 * 1. 找到 HTML 中 id="root" 的 div
 * 2. 把整个 App 组件渲染进去
 *
 * StrictMode 是 React 的开发辅助工具，会：
 * - 额外执行一次渲染来检测副作用问题
 * - 警告过时的 API 使用
 * - 只在开发模式下生效，不影响生产环境
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
