import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import friendRoutes from './routes/friends';
import chatRoutes from './routes/chats';
import aiRoutes from './routes/ai';
import { setupSocket } from './socket/handler';

// 加载 .env 配置文件
dotenv.config();

// ========== 创建服务器 ==========

// 1. 创建 Express 应用（处理 HTTP 请求）
const app = express();

// 2. 用 Express 创建一个原生 HTTP 服务器
//    为什么不直接用 app.listen()？因为 Socket.io 需要挂载到原生 HTTP 服务器上
const server = http.createServer(app);

// 3. 创建 Socket.io 实例，挂载到同一个 HTTP 服务器
//    这样 REST API 和 WebSocket 共用同一个端口
const io = new SocketIOServer(server, {
  cors: {
    origin: '*', // 开发阶段允许所有来源，上线后要改成前端域名
  },
});

// ========== 中间件 ==========

// cors() — 允许跨域请求（前端和后端不在同一个域名/端口时需要）
app.use(cors());

// express.json() — 自动解析请求体中的 JSON 数据
// 没有这行的话，req.body 就是 undefined
app.use(express.json());

// ========== 路由挂载 ==========

// 把各模块的路由挂到对应的路径上
// 比如 authRoutes 里定义了 POST /register，挂载后完整路径就是 POST /api/auth/register
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/ai', aiRoutes);  // AI 总结 + 配置

// 健康检查接口 — 用来测试服务器是否正常运行
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== WebSocket ==========

setupSocket(io);

// ========== 启动 ==========

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket ready on ws://localhost:${PORT}`);
});

export { app, server, io };
