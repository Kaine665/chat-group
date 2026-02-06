/**
 * JWT 认证中间件
 *
 * 【什么是中间件？】
 * Express 中间件是一个函数，在请求到达路由处理函数之前执行。
 * 可以用来做：权限检查、日志记录、数据转换等。
 *
 * 【什么是 JWT？】
 * JSON Web Token — 一种无状态的认证方案。
 * 用户登录后，服务器生成一个加密的 token（长字符串）返回给前端。
 * 之后前端每次请求都在 Header 里带上这个 token，服务器验证后就知道"你是谁"。
 *
 * 好处：服务器不需要存储会话状态（对比传统的 session + cookie 方案）。
 * 这对以后做多实例扩展很重要——任何一台服务器都能验证 token，不需要共享 session。
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// 扩展 Express 的 Request 类型，加上 userId 字段
// 这样在路由处理函数里可以通过 req.userId 拿到当前用户 ID
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * 认证中间件：验证请求是否携带了有效的 JWT token
 *
 * 使用方式：router.get('/me', auth, handler)
 * 这样 handler 只有在 token 验证通过后才会执行
 */
export function auth(req: Request, res: Response, next: NextFunction): void {
  // 从请求头获取 token
  // 标准格式是 "Bearer eyJhbGciOiJIUzI1..."
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证 token' });
    return;
  }

  const token = header.split(' ')[1];

  try {
    // jwt.verify() 会检查 token 是否被篡改、是否过期
    // 如果验证通过，返回当初存进去的数据（我们存的是 userId）
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next(); // 验证通过，继续执行下一个处理函数
  } catch {
    res.status(401).json({ error: 'token 无效或已过期' });
  }
}
