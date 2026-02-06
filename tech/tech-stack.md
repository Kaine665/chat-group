# ChatGroup - 技术栈详解

## 一、前端技术栈

### 1. React 18 + TypeScript

**为什么选 React：**
- 组件化开发，聊天界面天然适合拆分成组件（消息气泡、输入框、好友列表等）
- 生态成熟，相关库丰富
- TypeScript 提供类型安全，减少 bug

**核心依赖：**

| 库 | 用途 |
|---|---|
| `react` / `react-dom` | UI 框架 |
| `react-router-dom` | 前端路由（登录页、聊天页、设置页） |
| `zustand` 或 `jotai` | 轻量状态管理（用户状态、消息列表、在线状态） |
| `socket.io-client` | WebSocket 客户端 |
| `axios` | HTTP 请求（登录注册等 REST API） |
| `dayjs` | 时间格式化（消息时间显示） |

### 2. 构建工具：Vite

- 开发时热更新极快
- 基于 ESModule，启动速度远快于 Webpack
- 配置简单，开箱即用

### 3. UI 方案

两种可选路径：

| 方案 | 优点 | 缺点 |
|------|------|------|
| Tailwind CSS | 快速开发，高度自定义 | 类名较长 |
| Shadcn/ui + Tailwind | 提供现成的高质量组件 | 需要一定学习成本 |

**推荐：Tailwind CSS + Shadcn/ui**，可以快速搭建出美观的界面。

---

## 二、后端技术栈

### 1. Node.js + Express

**为什么选 Node.js：**
- 前后端统一语言（TypeScript），降低心智负担
- 天生擅长 I/O 密集型任务（聊天就是 I/O 密集场景）
- npm 生态丰富

**核心依赖：**

| 库 | 用途 |
|---|---|
| `express` | HTTP 框架，提供 REST API |
| `socket.io` | WebSocket 实现，处理实时通信 |
| `jsonwebtoken` | JWT 生成与验证 |
| `bcryptjs` | 密码加密 |
| `prisma` | ORM，操作数据库 |
| `zod` | 请求参数校验 |
| `cors` | 跨域处理 |
| `dotenv` | 环境变量管理 |

### 2. 为什么不选其他框架

| 框架 | 不选的原因 |
|------|-----------|
| NestJS | 对两人项目来说过于重量级，概念多（DI、Module、Guard） |
| Fastify | 可以选，但 Socket.io 集成不如 Express 成熟 |
| Koa | 生态不如 Express 活跃 |

Express 足够简单、灵活，适合这个规模的项目。

---

## 三、数据库

### 1. PostgreSQL

**为什么选 PostgreSQL：**
- 关系型数据库，适合用户、好友关系、消息这类结构化数据
- 支持 JSON 字段（灵活存储消息附加信息）
- 支持全文搜索（后续可做聊天记录搜索）
- 免费开源，性能优秀

### 2. ORM：Prisma

**为什么选 Prisma：**
- Schema 即文档，数据模型一目了然
- 自动生成 TypeScript 类型，与代码无缝集成
- 迁移工具好用（`prisma migrate`）
- 查询 API 直观

```prisma
// 示例：核心数据模型
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String   @unique
  password  String
  avatar    String?
  friends   Friendship[]
  messages  Message[]
  createdAt DateTime @default(now())
}

model Message {
  id        String   @id @default(uuid())
  content   String
  type      MessageType @default(TEXT)
  senderId  String
  sender    User     @relation(fields: [senderId], references: [id])
  chatId    String
  chat      Chat     @relation(fields: [chatId], references: [id])
  createdAt DateTime @default(now())
}

model Chat {
  id        String    @id @default(uuid())
  messages  Message[]
  members   User[]
  createdAt DateTime  @default(now())
}
```

### 3. Redis（可选）

用于：
- 存储用户在线状态（`user:123:online → true`）
- 缓存最近的消息（减少数据库查询）
- 管理 WebSocket 会话映射

对于两人使用的小项目，**Redis 是可选的**。初期可以用内存 Map 替代，后续需要扩展时再引入。

---

## 四、实时通信：WebSocket

### 为什么不用 HTTP 轮询

| 方案 | 延迟 | 资源消耗 | 适合场景 |
|------|------|---------|---------|
| HTTP 短轮询 | 高（取决于轮询间隔） | 高（大量无用请求） | 不适合聊天 |
| HTTP 长轮询 | 中 | 中 | 勉强可用 |
| **WebSocket** | **低（毫秒级）** | **低（持久连接）** | **聊天最佳选择** |
| SSE | 低 | 低 | 单向推送，不适合双向聊天 |

### Socket.io

选择 Socket.io 而非原生 WebSocket 的原因：
- 自动降级（WebSocket 不可用时降级为轮询）
- 内置心跳检测和断线重连
- 支持房间（Room）概念，天然适合群聊场景
- 支持命名空间（Namespace），可以隔离不同功能的通信

```typescript
// 服务端示例
io.on('connection', (socket) => {
  socket.on('send_message', (data) => {
    // 存入数据库
    // 广播给聊天室内其他人
    socket.to(data.chatId).emit('new_message', savedMessage);
  });
});
```

---

## 五、AI 集成

### 1. 唤醒词机制

当用户消息匹配预设的唤醒词时触发 AI 功能：

```typescript
const WAKE_WORDS = ['@ai', '/ai', '@总结', '/总结'];

function detectWakeWord(message: string): { triggered: boolean; command: string } {
  for (const word of WAKE_WORDS) {
    if (message.startsWith(word)) {
      return { triggered: true, command: message.slice(word.length).trim() };
    }
  }
  return { triggered: false, command: '' };
}
```

### 2. AI 服务选择

| 服务 | 优点 | 缺点 |
|------|------|------|
| OpenAI API (GPT-4o) | 能力最强，总结质量高 | 需要付费，需翻墙 |
| Claude API | 长文本处理优秀 | 需要付费 |
| DeepSeek API | 便宜，中文能力好 | 能力相对弱一些 |
| 本地模型 (Ollama) | 免费，隐私性好 | 需要 GPU，速度慢 |

**推荐：DeepSeek API 或 OpenAI API**，按实际需求选择。

### 3. 总结功能设计

```
用户发送: "@ai 总结一下今天的聊天"
     ↓
服务端提取最近的聊天记录（默认最近 50 条，或按时间范围）
     ↓
构造 Prompt：
  "以下是两位用户的聊天记录，请提取其中的关键信息并生成结构化总结：
   - 讨论的主题
   - 达成的共识或决定
   - 待办事项
   - 重要的时间/地点/数字信息"
     ↓
调用 LLM API → 获取总结
     ↓
将总结作为系统消息发送到聊天中
```

---

## 六、认证与安全

### JWT 认证流程

```
1. 用户登录 → 服务端验证密码 → 签发 JWT（access token + refresh token）
2. 客户端将 JWT 存入 localStorage 或 httpOnly cookie
3. 后续请求在 Header 中携带 JWT：Authorization: Bearer <token>
4. WebSocket 连接时也携带 JWT 进行身份验证
5. Token 过期后使用 refresh token 刷新
```

### 密码安全

- 使用 `bcryptjs` 对密码进行哈希加密，永远不存储明文密码
- 盐值轮数建议 10-12

---

## 七、部署方案（后续）

对于两人使用的项目，部署可以很简单：

| 组件 | 方案 |
|------|------|
| 前端 | Vercel / Netlify（免费） |
| 后端 | 一台云服务器（轻量应用服务器即可） |
| 数据库 | 同一台服务器上的 PostgreSQL |
| 域名 | 可选，也可以直接用 IP |

或者使用 Docker Compose 一键部署所有服务。
