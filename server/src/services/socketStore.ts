/**
 * Socket.io 共享状态 — 让不同模块都能访问 WebSocket
 *
 * 【为什么需要这个模块？】
 * Socket.io 的 io 实例在 app.ts 创建，但 friends.ts 等路由也需要用它
 * （比如接受好友后要通知双方加入新聊天室）。
 * 直接互相 import 会造成循环依赖，所以用这个"中间人"来存储。
 *
 * 【什么是循环依赖？】
 * A import B，B 又 import A → 死循环。
 * 解决方案：把共享的东西放到独立的 C 模块，A 和 B 都 import C。
 */

import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

// 在线用户映射：userId → socketId
// 用于查找用户是否在线、向特定用户发送消息
export const onlineUsers = new Map<string, string>();

/**
 * 初始化 Socket.io 实例（在 app.ts 中调用一次）
 */
export function setIO(instance: SocketIOServer) {
  io = instance;
}

/**
 * 获取 Socket.io 实例（在需要发消息的地方调用）
 */
export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io 还未初始化');
  return io;
}
