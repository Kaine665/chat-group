/**
 * 认证路由 — 处理用户注册和登录
 *
 * 【认证流程】
 * 1. 注册：用户提交 username + email + password
 *    → 密码用 bcrypt 加密后存入数据库（永远不存明文密码）
 *    → 返回 JWT token
 *
 * 2. 登录：用户提交 email + password
 *    → 从数据库找到用户，用 bcrypt 对比密码
 *    → 对比成功则生成 JWT token 返回
 *
 * 【什么是 bcrypt？】
 * 一种密码哈希算法，单向不可逆。
 * 即使数据库泄露，攻击者也无法还原出原始密码。
 * bcrypt 还自带"加盐"——同样的密码每次哈希结果都不同，防止彩虹表攻击。
 *
 * 【什么是 Zod？】
 * 一个数据校验库。用来检查前端发来的数据是否符合格式要求。
 * 比如：用户名至少 2 个字符、邮箱格式正确、密码至少 6 位。
 * 这样就不用手写一堆 if-else 校验了。
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod/v4';
import prisma from '../services/prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// 用 Zod 定义注册请求的数据格式
const registerSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符').max(20, '用户名最多 20 个字符'),
  email: z.email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位'),
});

// 用 Zod 定义登录请求的数据格式
const loginSchema = z.object({
  email: z.email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
});

/**
 * POST /api/auth/register — 用户注册
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // 第一步：校验请求数据
    const data = registerSchema.parse(req.body);

    // 第二步：检查用户名和邮箱是否已被注册
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username },
          { email: data.email },
        ],
      },
    });

    if (existing) {
      res.status(409).json({
        error: existing.username === data.username ? '用户名已被占用' : '邮箱已被注册',
      });
      return;
    }

    // 第三步：用 bcrypt 加密密码
    // 10 是 salt rounds（加盐轮数），数字越大越安全但越慢，10 是推荐值
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 第四步：写入数据库
    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: hashedPassword,
      },
    });

    // 第五步：生成 JWT token
    // { userId: user.id } 是存入 token 的数据，之后验证 token 时可以取出来
    // expiresIn: '7d' 表示 token 7 天后过期
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // 返回用户信息和 token（注意：永远不返回密码字段）
    res.status(201).json({
      user: { id: user.id, username: user.username, email: user.email },
      token,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      // Zod 校验失败，返回具体的错误信息
      res.status(400).json({ error: err.issues[0].message });
      return;
    }
    console.error('注册失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/auth/login — 用户登录
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    // 根据邮箱查找用户
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      res.status(401).json({ error: '邮箱或密码错误' });
      return;
    }

    // bcrypt.compare() 对比明文密码和数据库里的哈希值
    // 它会自动处理加盐的逻辑，你不需要手动处理
    const passwordMatch = await bcrypt.compare(data.password, user.password);

    if (!passwordMatch) {
      // 注意：错误信息故意写成"邮箱或密码错误"而不是"密码错误"
      // 这是安全最佳实践——不告诉攻击者到底是邮箱不存在还是密码不对
      res.status(401).json({ error: '邮箱或密码错误' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // 更新最后在线时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    res.json({
      user: { id: user.id, username: user.username, email: user.email },
      token,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues[0].message });
      return;
    }
    console.error('登录失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
