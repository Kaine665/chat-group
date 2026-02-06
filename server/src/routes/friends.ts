/**
 * 好友路由 — 好友申请、接受/拒绝、好友列表
 *
 * 【好友系统的流程】
 * 1. A 搜索到 B → 发送好友申请（创建一条 PENDING 状态的 FriendRequest）
 * 2. B 看到申请列表 → 选择接受或拒绝（更新状态为 ACCEPTED 或 REJECTED）
 * 3. 接受后，系统自动创建一个 DIRECT 类型的 Chat（私聊），双方成为 ChatMember
 * 4. 之后双方就可以在这个 Chat 里发消息了
 */

import { Router, Request, Response } from 'express';
import prisma from '../services/prisma';
import { auth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/friends — 获取好友列表
 *
 * 查找所有 status=ACCEPTED 的 FriendRequest，
 * 其中 senderId 或 receiverId 是当前用户。
 * 然后提取出"对方"的信息。
 */
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: req.userId },
          { receiverId: req.userId },
        ],
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true, lastSeenAt: true } },
        receiver: { select: { id: true, username: true, avatar: true, lastSeenAt: true } },
      },
    });

    // 从每条好友关系中提取出"对方"的信息
    const friends = requests.map((r) => {
      return r.senderId === req.userId ? r.receiver : r.sender;
    });

    res.json({ friends });
  } catch (err) {
    console.error('获取好友列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/friends/request — 发送好友申请
 *
 * 请求体：{ receiverId: "对方的用户ID" }
 */
router.post('/request', auth, async (req: Request, res: Response) => {
  try {
    const { receiverId } = req.body;

    if (!receiverId) {
      res.status(400).json({ error: '缺少 receiverId' });
      return;
    }

    if (receiverId === req.userId) {
      res.status(400).json({ error: '不能添加自己为好友' });
      return;
    }

    // 检查对方是否存在
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    // 检查是否已经是好友或已有待处理的申请
    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: req.userId, receiverId },
          { senderId: receiverId, receiverId: req.userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        res.status(409).json({ error: '你们已经是好友了' });
        return;
      }
      if (existing.status === 'PENDING') {
        res.status(409).json({ error: '已有待处理的好友申请' });
        return;
      }
    }

    const request = await prisma.friendRequest.create({
      data: {
        senderId: req.userId!,
        receiverId,
      },
    });

    res.status(201).json({ request });
  } catch (err) {
    console.error('发送好友申请失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/friends/requests — 获取收到的待处理好友申请
 */
router.get('/requests', auth, async (req: Request, res: Response) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: {
        receiverId: req.userId,
        status: 'PENDING',
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ requests });
  } catch (err) {
    console.error('获取好友申请失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * PUT /api/friends/request/:id/accept — 接受好友申请
 *
 * 接受后会自动创建一个私聊 Chat，双方都加入为 ChatMember。
 *
 * 【什么是事务 $transaction？】
 * 事务保证多个数据库操作要么全部成功，要么全部回滚。
 * 比如这里：更新申请状态 + 创建聊天 + 添加成员，必须全部成功。
 * 如果创建聊天失败了，申请状态也不应该变成 ACCEPTED。
 */
router.put('/request/:id/accept', auth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const request = await prisma.friendRequest.findUnique({ where: { id } });

    if (!request || request.receiverId !== req.userId) {
      res.status(404).json({ error: '好友申请不存在' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ error: '该申请已被处理' });
      return;
    }

    // 用事务确保原子性
    const result = await prisma.$transaction(async (tx) => {
      // 1. 更新申请状态
      const updated = await tx.friendRequest.update({
        where: { id },
        data: { status: 'ACCEPTED' },
      });

      // 2. 创建私聊
      const chat = await tx.chat.create({
        data: {
          type: 'DIRECT',
          members: {
            create: [
              { userId: request.senderId },
              { userId: request.receiverId },
            ],
          },
        },
      });

      return { request: updated, chat };
    });

    res.json(result);
  } catch (err) {
    console.error('接受好友申请失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * PUT /api/friends/request/:id/reject — 拒绝好友申请
 */
router.put('/request/:id/reject', auth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const request = await prisma.friendRequest.findUnique({ where: { id } });

    if (!request || request.receiverId !== req.userId) {
      res.status(404).json({ error: '好友申请不存在' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ error: '该申请已被处理' });
      return;
    }

    const updated = await prisma.friendRequest.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    res.json({ request: updated });
  } catch (err) {
    console.error('拒绝好友申请失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
