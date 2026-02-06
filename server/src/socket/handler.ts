/**
 * Socket.io 事件处理 — 实时通信的核心
 *
 * 【WebSocket vs HTTP】
 * HTTP 是"一问一答"：客户端发请求 → 服务器返回响应 → 连接断开
 * WebSocket 是"持续连接"：连接一旦建立，双方可以随时互发消息
 *
 * 聊天应用需要 WebSocket 是因为：
 * - 对方发消息时，你需要实时收到，不能靠"每隔几秒刷新一次"
 * - 输入状态（"对方正在输入..."）需要实时推送
 * - 在线/离线状态需要实时更新
 *
 * 【Socket.io 是什么？】
 * 它是 WebSocket 的增强版封装，提供了：
 * - 自动重连（断网后自动恢复）
 * - 房间（Room）机制 — 向特定聊天室的所有成员广播消息
 * - 事件机制 — 用事件名（如 'send_message'）代替裸数据
 * - 自动降级 — 如果浏览器不支持 WebSocket，自动降级到 HTTP 轮询
 *
 * 【Room 机制】
 * 每个 Chat 对应一个 Room。用户加入 Room 后，
 * 向 Room 广播的消息会发给 Room 内所有人。
 * 比如 Chat ID 是 "abc"，那 Room 名就是 "chat:abc"。
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../services/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// 在线用户映射：userId → socketId
// 用于：查某个用户是否在线、向特定用户发消息
const onlineUsers = new Map<string, string>();

export function setupSocket(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`新连接: ${socket.id}`);

    let userId: string | null = null;

    // ========== 认证 ==========
    // 客户端连接后必须先发 authenticate 事件，带上 JWT token
    // 认证通过后才能使用其他功能

    socket.on('authenticate', async (data: { token: string }) => {
      try {
        const payload = jwt.verify(data.token, JWT_SECRET) as { userId: string };
        userId = payload.userId;

        // 记录在线状态
        onlineUsers.set(userId, socket.id);

        // 加入用户自己的所有聊天 Room
        // 这样当别人在这些聊天里发消息时，消息会推送给这个用户
        const memberships = await prisma.chatMember.findMany({
          where: { userId },
          select: { chatId: true },
        });

        for (const m of memberships) {
          socket.join(`chat:${m.chatId}`);
        }

        // 通知客户端认证成功
        socket.emit('authenticated', { userId });

        // 通知所有好友"我上线了"
        socket.broadcast.emit('user_online', { userId });

        console.log(`用户认证成功: ${userId}`);
      } catch {
        socket.emit('error', { message: '认证失败' });
      }
    });

    // ========== 发送消息 ==========

    socket.on('send_message', async (data: { chatId: string; content: string; type?: string }) => {
      if (!userId) {
        socket.emit('error', { message: '请先认证' });
        return;
      }

      try {
        // 验证用户是否是聊天成员
        const member = await prisma.chatMember.findUnique({
          where: { userId_chatId: { userId, chatId: data.chatId } },
        });

        if (!member) {
          socket.emit('error', { message: '你不是这个聊天的成员' });
          return;
        }

        // 写入数据库
        const message = await prisma.message.create({
          data: {
            content: data.content,
            type: (data.type as any) || 'TEXT',
            senderId: userId,
            chatId: data.chatId,
          },
          include: {
            sender: { select: { id: true, username: true, avatar: true } },
          },
        });

        // 更新聊天的 updatedAt（用于聊天列表排序）
        await prisma.chat.update({
          where: { id: data.chatId },
          data: { updatedAt: new Date() },
        });

        // 向聊天室所有成员广播新消息（包括发送者自己）
        // io.to() 向房间里所有人发送，包括自己
        io.to(`chat:${data.chatId}`).emit('new_message', { message });
      } catch (err) {
        console.error('发送消息失败:', err);
        socket.emit('error', { message: '发送消息失败' });
      }
    });

    // ========== 输入状态 ==========

    socket.on('typing_start', (data: { chatId: string }) => {
      if (!userId) return;
      // socket.to() 向房间里除了自己以外的人发送
      socket.to(`chat:${data.chatId}`).emit('typing', { chatId: data.chatId, userId });
    });

    socket.on('typing_stop', (data: { chatId: string }) => {
      if (!userId) return;
      socket.to(`chat:${data.chatId}`).emit('typing_stop', { chatId: data.chatId, userId });
    });

    // ========== 已读标记 ==========

    socket.on('mark_read', async (data: { chatId: string }) => {
      if (!userId) return;

      try {
        await prisma.chatMember.update({
          where: { userId_chatId: { userId, chatId: data.chatId } },
          data: { lastReadAt: new Date() },
        });

        socket.to(`chat:${data.chatId}`).emit('message_read', {
          chatId: data.chatId,
          userId,
        });
      } catch (err) {
        console.error('标记已读失败:', err);
      }
    });

    // ========== 断开连接 ==========

    socket.on('disconnect', async () => {
      if (userId) {
        onlineUsers.delete(userId);

        // 更新最后在线时间
        await prisma.user.update({
          where: { id: userId },
          data: { lastSeenAt: new Date() },
        }).catch(() => {}); // 静默处理错误，断连时不需要抛异常

        // 通知其他人"我下线了"
        socket.broadcast.emit('user_offline', { userId });

        console.log(`用户断开连接: ${userId}`);
      }
    });
  });
}
