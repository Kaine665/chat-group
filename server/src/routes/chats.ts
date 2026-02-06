/**
 * 聊天路由 — 聊天列表、历史消息
 *
 * 【聊天和消息的关系】
 * Chat（聊天室）→ 包含多个 ChatMember（成员）→ 包含多条 Message（消息）
 *
 * 私聊在接受好友申请时自动创建，用户不需要手动创建。
 * 这个路由主要用来：
 * 1. 获取"我参与的所有聊天"列表
 * 2. 获取某个聊天的历史消息（支持分页）
 */

import { Router, Request, Response } from 'express';
import prisma from '../services/prisma';
import { auth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/chats — 获取当前用户的聊天列表
 *
 * 返回的每个聊天包含：
 * - 成员信息（对方的用户名、头像）
 * - 最新一条消息（用于在列表页显示预览）
 *
 * 【为什么用 include 和 select？】
 * include 用于加载关联数据（像 SQL 的 JOIN）
 * select 用于指定只返回哪些字段（避免返回 password 等敏感字段）
 */
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const chats = await prisma.chat.findMany({
      where: {
        members: { some: { userId: req.userId } },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, avatar: true, lastSeenAt: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // 只取最新一条消息作为预览
          include: {
            sender: { select: { id: true, username: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' }, // 最近有消息的聊天排前面
    });

    res.json({ chats });
  } catch (err) {
    console.error('获取聊天列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/chats/:id/messages — 获取历史消息（游标分页）
 *
 * 查询参数：
 * - before: 消息 ID，获取这条消息之前的消息（用于"加载更多"）
 * - limit: 每次加载多少条，默认 30
 *
 * 【什么是游标分页？】
 * 传统分页用 page=1&size=20（第几页、每页多少条），但聊天消息不适合：
 * - 如果有人在你翻页时发了新消息，page 对应的数据就会错位
 *
 * 游标分页用"最后一条消息的 ID"作为锚点：
 * - "给我这条消息之前的 30 条" —— 不管有没有新消息，结果都是稳定的
 *
 * 这也是 Discord、Slack 等大厂使用的分页方式。
 */
router.get('/:id/messages', auth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const before = req.query.before as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

    // 先验证当前用户是否是这个聊天的成员
    const member = await prisma.chatMember.findUnique({
      where: { userId_chatId: { userId: req.userId!, chatId: id } },
    });

    if (!member) {
      res.status(403).json({ error: '你不是这个聊天的成员' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { chatId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
    });

    // 返回时反转顺序，让最早的消息在前面（前端按时间顺序显示）
    res.json({ messages: messages.reverse() });
  } catch (err) {
    console.error('获取消息失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
