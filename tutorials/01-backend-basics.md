# ChatGroup 后端教程

## 你能学到什么

通过这个项目的后端代码，你会理解以下技术是怎么用的、为什么要这么用。

---

## 一、项目结构总览

```
server/
├── prisma/
│   ├── schema.prisma          # 数据库表结构定义
│   └── migrations/            # 数据库迁移记录（自动生成）
├── src/
│   ├── app.ts                 # 入口文件：启动 Express + Socket.io
│   ├── middleware/
│   │   └── auth.ts            # JWT 认证中间件
│   ├── routes/
│   │   ├── auth.ts            # 注册/登录接口
│   │   ├── users.ts           # 用户信息/搜索接口
│   │   ├── friends.ts         # 好友系统接口
│   │   └── chats.ts           # 聊天/消息接口
│   ├── services/
│   │   └── prisma.ts          # 数据库连接（单例）
│   └── socket/
│       └── handler.ts         # WebSocket 实时通信逻辑
├── .env                       # 环境变量（数据库密码等，不提交到 git）
├── package.json               # 依赖和脚本
└── tsconfig.json              # TypeScript 配置
```

**设计理念：分层架构**

```
请求进来
  ↓
中间件层（auth.ts）→ 验证身份，不通过直接返回 401
  ↓
路由层（routes/*.ts）→ 处理业务逻辑
  ↓
数据层（prisma.ts）→ 读写数据库
  ↓
响应出去
```

为什么要分层？因为以后如果要换数据库（比如从 PostgreSQL 换到 MySQL），只需要改数据层；如果要换认证方式（比如从 JWT 换到 Session），只需要改中间件层。**各层互不影响**。

---

## 二、核心技术详解

### 1. Express — HTTP 服务器框架

Express 是 Node.js 最流行的 web 框架。它的核心概念只有三个：

**路由（Route）**：定义"什么 URL 对应什么处理函数"
```typescript
// POST /api/auth/register 这个 URL 被请求时，执行后面的函数
router.post('/register', async (req, res) => {
  // req = 请求对象（包含前端发来的数据）
  // res = 响应对象（用来返回数据给前端）
  res.json({ message: '成功' });
});
```

**中间件（Middleware）**：在请求到达路由之前执行的函数
```typescript
// auth 中间件检查 token，通过了才执行 handler
router.get('/me', auth, handler);
```

**路由挂载**：把路由分模块，然后挂到主应用上
```typescript
app.use('/api/auth', authRoutes);    // authRoutes 里的 /register → /api/auth/register
app.use('/api/friends', friendRoutes); // friendRoutes 里的 / → /api/friends
```

### 2. Prisma — 数据库 ORM

ORM 让你用 TypeScript 代码操作数据库，不用写 SQL。

**定义表结构**（prisma/schema.prisma）：
```prisma
model User {
  id       String @id @default(uuid())  // 主键，自动生成 UUID
  username String @unique               // 唯一，不能重复
  email    String @unique
  password String                       // bcrypt 哈希后的密码
}
```

运行 `npx prisma migrate dev` 后，Prisma 会自动：
1. 生成 SQL 语句（CREATE TABLE...）
2. 在数据库中执行
3. 生成 TypeScript 类型（你写代码时有自动补全）

**增删改查**：
```typescript
// 创建用户（INSERT INTO）
const user = await prisma.user.create({
  data: { username: 'alice', email: 'alice@example.com', password: '...' }
});

// 查找用户（SELECT WHERE）
const user = await prisma.user.findUnique({ where: { email: 'alice@example.com' } });

// 模糊搜索（SELECT WHERE LIKE）
const users = await prisma.user.findMany({
  where: { username: { contains: 'ali', mode: 'insensitive' } }
});

// 更新（UPDATE SET）
await prisma.user.update({ where: { id: '...' }, data: { lastSeenAt: new Date() } });
```

**关联查询**（相当于 SQL 的 JOIN）：
```typescript
// 查消息的同时，把发送者信息也带出来
const messages = await prisma.message.findMany({
  include: {
    sender: { select: { id: true, username: true, avatar: true } }
  }
});
// 结果：[{ content: "你好", sender: { id: "...", username: "alice" } }]
```

**事务**（多个操作要么全成功要么全失败）：
```typescript
await prisma.$transaction(async (tx) => {
  await tx.friendRequest.update(...);  // 操作 1
  await tx.chat.create(...);           // 操作 2
  // 如果操作 2 失败，操作 1 也会回滚
});
```

### 3. JWT — 无状态认证

**传统方式（Session）**：
```
用户登录 → 服务器存一条会话记录 → 返回 session ID 给浏览器（cookie）
之后每次请求 → 浏览器带上 cookie → 服务器查会话记录 → 确认身份
```
问题：服务器要存储所有在线用户的会话，多台服务器还要共享会话。

**JWT 方式**：
```
用户登录 → 服务器生成一个加密的 token（包含 userId）→ 返回给前端
之后每次请求 → 前端在 Header 里带上 token → 服务器验证签名 → 直接从 token 中取出 userId
```
好处：服务器不需要存任何东西。10 台服务器都能验证同一个 token。

**代码中的流程**：
```
注册/登录 → jwt.sign({ userId }, secret, { expiresIn: '7d' }) → 返回 token
                                                                    ↓
请求 API → Header: "Bearer eyJhbG..." → jwt.verify(token, secret) → 拿到 userId
```

### 4. bcrypt — 密码加密

**为什么不能明文存密码？**
如果数据库泄露，所有用户密码暴露。bcrypt 是单向哈希——加密后无法还原。

```typescript
// 注册时：明文 → 哈希
const hashed = await bcrypt.hash('123456', 10);
// 结果类似："$2a$10$N9qo8uLOickgx2ZMRZoMy..." （每次结果不同！）

// 登录时：对比明文和哈希
const match = await bcrypt.compare('123456', hashed); // true
const match = await bcrypt.compare('wrong', hashed);  // false
```

### 5. Socket.io — 实时通信

**和 HTTP 的区别**：
- HTTP：你问一句，我答一句，然后挂电话
- WebSocket：打通电话后一直不挂，随时可以说话

**核心概念**：

```
事件（Event）：用名字标识的消息
  socket.emit('send_message', { content: '你好' })  // 发送
  socket.on('new_message', (data) => { ... })        // 接收

房间（Room）：消息分组
  socket.join('chat:abc')           // 加入房间
  io.to('chat:abc').emit(...)       // 向房间所有人广播
  socket.to('chat:abc').emit(...)   // 向房间里除自己外的人广播
```

**本项目的 WebSocket 流程**：
```
1. 前端连接 WebSocket
2. 发送 authenticate 事件（带 JWT token）
3. 服务器验证 token，把用户加入所有聊天 Room
4. 之后用户发消息 → 服务器写入数据库 → 广播给 Room 里所有人
5. 断开连接 → 通知其他人"我下线了"
```

### 6. Zod — 请求数据校验

前端发来的数据不可信（可能被篡改）。Zod 帮你声明式地校验：

```typescript
const schema = z.object({
  username: z.string().min(2).max(20),
  email: z.email(),
  password: z.string().min(6),
});

schema.parse(req.body); // 通过 → 返回校验后的数据
                        // 不通过 → 抛出 ZodError，包含具体哪个字段不对
```

---

## 三、数据流完整示例

### 用户注册

```
前端：POST /api/auth/register { username, email, password }
  ↓
Express 收到请求
  ↓
Zod 校验：用户名 2-20 字符？邮箱格式对？密码 ≥6 位？
  ↓ 通过
Prisma 查数据库：用户名/邮箱是否已存在？
  ↓ 不存在
bcrypt 加密密码
  ↓
Prisma 写入数据库
  ↓
jwt.sign() 生成 token
  ↓
返回 { user, token }
```

### 发送消息（实时）

```
前端：socket.emit('send_message', { chatId, content })
  ↓
Socket.io 收到事件
  ↓
检查 userId（是否已认证？）
  ↓
Prisma 验证：用户是否是 chatId 的成员？
  ↓ 是
Prisma 写入 Message 表
  ↓
io.to('chat:xxx').emit('new_message', { message })
  ↓
聊天室内所有在线成员实时收到消息
```

### 好友系统

```
Alice 搜索 "bob" → GET /api/users/search?q=bob
  ↓
Alice 发送好友申请 → POST /api/friends/request { receiverId: bob.id }
  ↓ 创建 FriendRequest（PENDING）
Bob 查看申请列表 → GET /api/friends/requests
  ↓
Bob 接受申请 → PUT /api/friends/request/:id/accept
  ↓ 事务内：更新状态为 ACCEPTED + 自动创建私聊 Chat + 双方加入 ChatMember
Alice 和 Bob 可以开始聊天了
```

---

## 四、如何运行

```bash
# 1. 确保 PostgreSQL 正在运行

# 2. 进入 server 目录
cd server

# 3. 安装依赖
npm install

# 4. 配置 .env 文件（参考 .env 格式）
# DATABASE_URL="postgresql://用户名:密码@localhost:5432/chatgroup"
# JWT_SECRET="你的密钥"
# PORT=3000

# 5. 创建数据库表
npx prisma migrate dev

# 6. 启动开发服务器
npm run dev
```

---

## 五、接口速查表

| 方法 | 路径 | 需要登录 | 说明 |
|------|------|---------|------|
| POST | /api/auth/register | 否 | 注册 |
| POST | /api/auth/login | 否 | 登录 |
| GET | /api/users/me | 是 | 获取个人信息 |
| GET | /api/users/search?q=xxx | 是 | 搜索用户 |
| GET | /api/friends | 是 | 好友列表 |
| POST | /api/friends/request | 是 | 发送好友申请 |
| GET | /api/friends/requests | 是 | 待处理的申请 |
| PUT | /api/friends/request/:id/accept | 是 | 接受申请 |
| PUT | /api/friends/request/:id/reject | 是 | 拒绝申请 |
| GET | /api/chats | 是 | 聊天列表 |
| GET | /api/chats/:id/messages | 是 | 历史消息（游标分页） |

WebSocket 事件见 `src/socket/handler.ts` 文件顶部注释。
