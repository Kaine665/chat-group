/**
 * 用户路由 — 获取/更新个人信息、搜索用户
 *
 * 这些接口都需要先通过 JWT 认证（auth 中间件）。
 * auth 中间件验证 token 后，会把 userId 放到 req.userId 上。
 */

import { Router, Request, Response } from 'express';
import prisma from '../services/prisma';
import { auth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/users/me — 获取当前登录用户的信息
 *
 * 前端拿到 token 后，可以用这个接口获取用户详情。
 * 比如刷新页面后，前端从 localStorage 取出 token，
 * 调这个接口来恢复登录状态。
 */
router.get('/me', auth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        // select 指定只返回这些字段，不会返回 password
        id: true,
        username: true,
        email: true,
        avatar: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/users/search?q=xxx — 搜索用户（用于添加好友）
 *
 * 模糊匹配用户名，返回最多 10 条结果。
 * 不会返回自己（你不需要加自己为好友）。
 *
 * 【什么是模糊匹配？】
 * contains: 'abc' 会匹配所有包含 "abc" 的用户名
 * mode: 'insensitive' 表示不区分大小写
 */
router.get('/search', auth, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;

    if (!query || query.length < 1) {
      res.status(400).json({ error: '搜索关键词不能为空' });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        username: { contains: query, mode: 'insensitive' },
        id: { not: req.userId }, // 排除自己
      },
      select: {
        id: true,
        username: true,
        avatar: true,
      },
      take: 10, // 最多返回 10 条
    });

    res.json({ users });
  } catch (err) {
    console.error('搜索用户失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
