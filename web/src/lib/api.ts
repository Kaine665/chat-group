/**
 * API 客户端 — 封装所有与后端的 HTTP 通信
 *
 * 【为什么要封装？】
 * 1. 统一添加 token 到请求头（不用每次手动加）
 * 2. 统一处理错误（token 过期自动跳登录页）
 * 3. 所有 API 调用集中管理，方便查找和修改
 *
 * 【什么是 axios？】
 * 一个 HTTP 请求库，比浏览器原生的 fetch 更好用：
 * - 自动转 JSON
 * - 支持拦截器（请求/响应的钩子）
 * - 更好的错误处理
 */

import axios from 'axios';

// 创建一个 axios 实例，配置基础 URL
// 因为 Vite 配置了代理，/api 开头的请求会自动转发到后端
const api = axios.create({
  baseURL: '/api',
});

// 请求拦截器：每次发请求前，自动把 token 加到 Header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：如果返回 401（token 无效），自动清除 token 并跳转登录页
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ========== 认证 API ==========

export async function register(username: string, email: string, password: string) {
  const { data } = await api.post('/auth/register', { username, email, password });
  return data as { user: User; token: string };
}

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  return data as { user: User; token: string };
}

export async function getMe() {
  const { data } = await api.get('/users/me');
  return data.user as User;
}

// ========== 用户 API ==========

export async function searchUsers(query: string) {
  const { data } = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
  return data.users as User[];
}

// ========== 好友 API ==========

export async function getFriends() {
  const { data } = await api.get('/friends');
  return data.friends as User[];
}

export async function getFriendRequests() {
  const { data } = await api.get('/friends/requests');
  return data.requests as FriendRequest[];
}

export async function sendFriendRequest(receiverId: string) {
  const { data } = await api.post('/friends/request', { receiverId });
  return data;
}

export async function acceptFriendRequest(requestId: string) {
  const { data } = await api.put(`/friends/request/${requestId}/accept`);
  return data;
}

export async function rejectFriendRequest(requestId: string) {
  const { data } = await api.put(`/friends/request/${requestId}/reject`);
  return data;
}

// ========== 聊天 API ==========

export async function getChats() {
  const { data } = await api.get('/chats');
  return data.chats as Chat[];
}

export async function getMessages(chatId: string, before?: string) {
  const params = before ? `?before=${before}` : '';
  const { data } = await api.get(`/chats/${chatId}/messages${params}`);
  return data.messages as Message[];
}

// ========== AI API ==========

export async function getAIProviders() {
  const { data } = await api.get('/ai/providers');
  return data.providers as AIProvider[];
}

export async function getAIConfig() {
  const { data } = await api.get('/ai/config');
  return data.config as AIConfig | null;
}

export async function saveAIConfig(config: { provider: string; model: string; apiKey: string; baseUrl?: string }) {
  const { data } = await api.put('/ai/config', config);
  return data.config as AIConfig;
}

// ========== 类型定义 ==========

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar: string | null;
  lastSeenAt?: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  sender: User;
  status: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  name: string | null;
  type: 'DIRECT' | 'GROUP';
  members: ChatMember[];
  messages: Message[]; // 最新一条消息（预览）
  updatedAt: string;
}

export interface ChatMember {
  id: string;
  userId: string;
  chatId: string;
  user: User;
  lastReadAt: string;
}

export interface Message {
  id: string;
  content: string;
  type: 'TEXT' | 'SYSTEM' | 'AI_SUMMARY';
  senderId: string;
  chatId: string;
  sender: { id: string; username: string; avatar: string | null };
  createdAt: string;
}

export interface AIModel {
  id: string;
  name: string;
}

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: AIModel[];
  format: 'openai' | 'anthropic';
  note?: string;
}

export interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;  // 脱敏后的
  baseUrl: string | null;
}

