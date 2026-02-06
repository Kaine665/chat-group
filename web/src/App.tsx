/**
 * App 根组件 — 路由配置
 *
 * 【什么是 React Router？】
 * React 是单页应用（SPA）——整个应用只有一个 HTML 页面。
 * 但用户感知到的是多个"页面"（登录页、聊天页等）。
 * React Router 负责根据 URL 显示不同的组件：
 *   /login  → 显示 LoginPage
 *   /       → 显示 ChatPage（需要登录）
 *
 * 【路由守卫】
 * ProtectedRoute 组件检查用户是否已登录：
 * - 已登录 → 显示子组件
 * - 未登录 → 跳转到 /login
 * - 加载中 → 显示 loading（因为 restoreSession 是异步的）
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!user) {
    // Navigate 组件会自动跳转到指定路径
    // replace 表示替换当前历史记录，而不是新增一条（用户按返回键不会回到这里）
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  // 应用启动时，尝试恢复登录状态
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
