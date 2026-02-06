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
 *
 * 【AI 唤醒词机制】
 * 当用户发送以 @ai 开头的消息时，服务器会：
 * 1. 正常保存并广播这条消息
 * 2. 检测到唤醒词后，异步调用 AI API
 * 3. 把 AI 的回复作为一条新的 AI_SUMMARY 类型消息发到聊天里
 * 这样所有人都能看到 AI 的回复，就像聊天里多了一个 AI 成员。
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../services/prisma';
import { onlineUsers, setIO } from '../services/socketStore';
import { extractAICommand, callAI } from '../services/ai';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function setupSocket(io: SocketIOServer) {
  // 把 io 实例存到共享模块，让其他路由（如 friends.ts）也能使用
  setIO(io);

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

        // 记录在线状态（存到共享的 socketStore，让 friends 路由也能查到）
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
        io.to(`chat:${data.chatId}`).emit('new_message', { message });

        // ========== AI 唤醒词检测 ==========
        // 检查消息是否以 @ai 开头
        const aiCommand = extractAICommand(data.content);
        if (aiCommand !== null) {
          // 异步处理 AI 调用，不阻塞消息发送
          handleAIWakeup(io, userId, data.chatId, aiCommand).catch((err) => {
            console.error('AI 唤醒处理失败:', err);
          });
        }
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

/**
 * 处理 AI 唤醒 — 调用 AI 并把回复发到聊天里
 *
 * 【流程】
 * 1. 先发一条"AI 正在思考..."的提示（让用户知道 AI 在处理中）
 * 2. 读取触发者的 AI 配置
 * 3. 获取最近 30 条聊天记录作为上下文
 * 4. 调用 AI API
 * 5. 把 AI 回复作为 AI_SUMMARY 类型的消息保存并广播
 *
 * 如果触发者没有配置 AI，会提示他去设置。
 */
async function handleAIWakeup(
  io: SocketIOServer,
  triggerUserId: string,
  chatId: string,
  command: string
) {
  // 先通知聊天室"AI 正在思考"
  io.to(`chat:${chatId}`).emit('ai_thinking', { chatId });

  try {
    // 1. 读取触发者的 AI 配置
    const aiConfig = await prisma.userAIConfig.findUnique({
      where: { userId: triggerUserId },
    });

    if (!aiConfig) {
      // 没有配置 AI → 发一条提示消息
      const noConfigMsg = await prisma.message.create({
        data: {
          content: '你还没有配置 AI 服务，请点击页面右上角的「AI 设置」进行配置后再试。',
          type: 'AI_SUMMARY',
          senderId: triggerUserId,  // 用触发者的 ID（因为没有系统用户）
          chatId,
        },
        include: {
          sender: { select: { id: true, username: true, avatar: true } },
        },
      });
      io.to(`chat:${chatId}`).emit('new_message', { message: noConfigMsg });
      return;
    }

    // 2. 获取最近 30 条聊天记录作为上下文
    const recentMessages = await prisma.message.findMany({
      where: { chatId, type: 'TEXT' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        sender: { select: { username: true } },
      },
    });

    recentMessages.reverse();

    // 3. 调用 AI API
    const aiResponse = await callAI({
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      baseUrl: aiConfig.baseUrl || undefined,
      command,
      chatContext: recentMessages.map((m) => ({
        sender: m.sender.username,
        content: m.content,
        time: m.createdAt.toLocaleString('zh-CN'),
      })),
    });

    // 4. 把 AI 回复保存为消息并广播
    const aiMessage = await prisma.message.create({
      data: {
        content: aiResponse,
        type: 'AI_SUMMARY',
        senderId: triggerUserId,
        chatId,
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
    });

    // 更新聊天的 updatedAt
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    io.to(`chat:${chatId}`).emit('new_message', { message: aiMessage });

    // 5. 同时保存到 AISummary 表（用于历史记录）
    await prisma.aISummary.create({
      data: {
        chatId,
        triggeredById: triggerUserId,
        messageCount: recentMessages.length,
        content: { text: aiResponse, command },
      },
    });

    console.log(`AI 回复已发送到聊天 ${chatId}`);
  } catch (err: any) {
    console.error('AI 调用失败:', err);

    // 发送错误提示到聊天
    const errorMsg = await prisma.message.create({
      data: {
        content: `AI 调用失败：${err.message || '未知错误'}。请检查 AI 设置中的 API Key 和模型配置。`,
        type: 'AI_SUMMARY',
        senderId: triggerUserId,
        chatId,
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
    });
    io.to(`chat:${chatId}`).emit('new_message', { message: errorMsg });
  } finally {
    // 通知"AI 思考完毕"
    io.to(`chat:${chatId}`).emit('ai_thinking_done', { chatId });
  }
}
