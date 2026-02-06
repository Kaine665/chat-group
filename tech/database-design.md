# ChatGroup - 数据库设计

## 一、ER 关系图

```
User ──────┬────── Friendship ──────┬────── User
           │                        │
           │      ChatMember        │
           └──────────┬─────────────┘
                      │
                    Chat
                      │
                   Message
                      │
                  AISummary
```

## 二、完整 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== 用户 ====================

model User {
  id            String         @id @default(uuid())
  username      String         @unique
  email         String         @unique
  password      String         // bcrypt 哈希
  avatar        String?
  lastSeenAt    DateTime?

  // 关系
  sentRequests     FriendRequest[]  @relation("RequestSender")
  receivedRequests FriendRequest[]  @relation("RequestReceiver")
  chatMembers      ChatMember[]
  messages         Message[]
  summaries        AISummary[]

  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

// ==================== 好友 ====================

model FriendRequest {
  id         String              @id @default(uuid())
  senderId   String
  receiverId String
  status     FriendRequestStatus @default(PENDING)

  sender     User @relation("RequestSender", fields: [senderId], references: [id])
  receiver   User @relation("RequestReceiver", fields: [receiverId], references: [id])

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([senderId, receiverId])
}

enum FriendRequestStatus {
  PENDING
  ACCEPTED
  REJECTED
}

// ==================== 聊天 ====================

model Chat {
  id        String       @id @default(uuid())
  name      String?      // 群聊名称，私聊为 null
  type      ChatType     @default(DIRECT)

  members   ChatMember[]
  messages  Message[]
  summaries AISummary[]

  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}

model ChatMember {
  id           String   @id @default(uuid())
  userId       String
  chatId       String
  lastReadAt   DateTime @default(now())  // 用于计算未读消息数

  user         User     @relation(fields: [userId], references: [id])
  chat         Chat     @relation(fields: [chatId], references: [id])

  joinedAt     DateTime @default(now())

  @@unique([userId, chatId])
}

enum ChatType {
  DIRECT  // 私聊（你和朋友）
  GROUP   // 群聊（预留扩展）
}

// ==================== 消息 ====================

model Message {
  id        String      @id @default(uuid())
  content   String
  type      MessageType @default(TEXT)

  senderId  String
  chatId    String

  sender    User        @relation(fields: [senderId], references: [id])
  chat      Chat        @relation(fields: [chatId], references: [id])

  createdAt DateTime    @default(now())

  @@index([chatId, createdAt])  // 按聊天和时间查询的索引
}

enum MessageType {
  TEXT        // 普通文本消息
  SYSTEM      // 系统消息（如 "xxx 加入了聊天"）
  AI_SUMMARY  // AI 总结消息
}

// ==================== AI 总结 ====================

model AISummary {
  id            String   @id @default(uuid())
  chatId        String
  triggeredById String

  // 总结范围
  fromMessageId String?
  toMessageId   String?
  messageCount  Int

  // 总结内容（JSON 格式）
  content       Json
  // content 结构:
  // {
  //   topics: string[],
  //   decisions: string[],
  //   todos: string[],
  //   keyInfo: string[],
  //   raw: string
  // }

  chat          Chat     @relation(fields: [chatId], references: [id])
  triggeredBy   User     @relation(fields: [triggeredById], references: [id])

  createdAt     DateTime @default(now())

  @@index([chatId, createdAt])
}
```

## 三、关键查询场景

### 1. 获取聊天的历史消息（分页）

```typescript
// 游标分页：获取某条消息之前的 20 条
const messages = await prisma.message.findMany({
  where: { chatId },
  orderBy: { createdAt: 'desc' },
  take: 20,
  cursor: beforeMessageId ? { id: beforeMessageId } : undefined,
  skip: beforeMessageId ? 1 : 0,
  include: { sender: { select: { id: true, username: true, avatar: true } } }
});
```

### 2. 获取用户的聊天列表（含最新消息和未读数）

```typescript
const chats = await prisma.chat.findMany({
  where: {
    members: { some: { userId: currentUserId } }
  },
  include: {
    members: { include: { user: { select: { id: true, username: true, avatar: true } } } },
    messages: {
      orderBy: { createdAt: 'desc' },
      take: 1  // 只取最新一条消息作为预览
    }
  }
});
```

### 3. 获取好友列表

```typescript
const friends = await prisma.friendRequest.findMany({
  where: {
    status: 'ACCEPTED',
    OR: [
      { senderId: currentUserId },
      { receiverId: currentUserId }
    ]
  },
  include: {
    sender: { select: { id: true, username: true, avatar: true, lastSeenAt: true } },
    receiver: { select: { id: true, username: true, avatar: true, lastSeenAt: true } }
  }
});
```

## 四、索引策略

| 表 | 索引 | 原因 |
|---|---|---|
| Message | `(chatId, createdAt)` | 按聊天加载历史消息，按时间排序 |
| AISummary | `(chatId, createdAt)` | 查看某个聊天的总结历史 |
| ChatMember | `(userId, chatId)` UNIQUE | 快速查找用户在哪些聊天中 |
| FriendRequest | `(senderId, receiverId)` UNIQUE | 防止重复好友申请 |
