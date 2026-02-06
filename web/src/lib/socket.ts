/**
 * Socket.io 客户端 — 管理 WebSocket 连接
 *
 * 【为什么单独封装？】
 * WebSocket 连接是全局唯一的（不管你在哪个页面，都共用同一条连接）。
 * 封装成模块后，任何组件都可以 import 进去使用。
 *
 * 【连接流程】
 * 1. 用户登录后调用 connectSocket(token)
 * 2. Socket.io 建立 WebSocket 连接到服务器
 * 3. 发送 authenticate 事件（带 JWT token）
 * 4. 服务器验证通过后返回 authenticated 事件
 * 5. 之后就可以收发消息了
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * 建立 WebSocket 连接并认证
 */
export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  // 连接到服务器（Vite 代理会转发到 localhost:3000）
  socket = io('/', {
    autoConnect: false,
  });

  socket.connect();

  // 连接成功后发送认证
  socket.on('connect', () => {
    socket!.emit('authenticate', { token });
  });

  return socket;
}

/**
 * 断开 WebSocket 连接（退出登录时调用）
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * 获取当前 Socket 实例
 */
export function getSocket(): Socket | null {
  return socket;
}
