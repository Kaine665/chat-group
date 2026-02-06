/**
 * 认证状态管理 — 用 Zustand 管理全局登录状态
 *
 * 【什么是 Zustand？】
 * 一个极简的 React 状态管理库（名字是德语"状态"的意思）。
 *
 * React 自带的 useState 只能在一个组件内使用。
 * 但"当前用户是谁"这种信息，很多组件都需要——
 * 导航栏要显示用户名，聊天页要知道谁在发消息，好友页要排除自己。
 *
 * Zustand 创建一个全局 store，任何组件都可以读取和修改。
 *
 * 对比其他方案：
 * - Redux：太重了，样板代码多
 * - Context API：性能差，任何状态变化都会重新渲染所有消费者
 * - Zustand：轻量、简单、高性能
 *
 * 【用法】
 * const user = useAuthStore((s) => s.user);  // 在组件中获取用户
 * useAuthStore.getState().login(...)          // 在组件外调用
 */

import { create } from 'zustand';
import { login as apiLogin, register as apiRegister, getMe, type User } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,

  login: async (email, password) => {
    const result = await apiLogin(email, password);
    localStorage.setItem('token', result.token);
    connectSocket(result.token);
    set({ user: result.user, token: result.token });
  },

  register: async (username, email, password) => {
    const result = await apiRegister(username, email, password);
    localStorage.setItem('token', result.token);
    connectSocket(result.token);
    set({ user: result.user, token: result.token });
  },

  logout: () => {
    localStorage.removeItem('token');
    disconnectSocket();
    set({ user: null, token: null });
  },

  /**
   * 恢复登录状态
   * 页面刷新后，token 还在 localStorage 里，
   * 调这个方法用 token 去后端获取用户信息，恢复登录态。
   */
  restoreSession: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const user = await getMe();
      connectSocket(token);
      set({ user, token, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
