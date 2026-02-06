# ChatGroup - API 设计

## 一、REST API

### 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/refresh` | 刷新 token |
| POST | `/api/auth/logout` | 退出登录 |

### 用户相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users/me` | 获取当前用户信息 |
| PUT | `/api/users/me` | 更新个人信息 |
| GET | `/api/users/search?q=xxx` | 搜索用户（用于添加好友） |

### 好友相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/friends` | 获取好友列表 |
| POST | `/api/friends/request` | 发送好友申请 |
| PUT | `/api/friends/request/:id/accept` | 接受好友申请 |
| PUT | `/api/friends/request/:id/reject` | 拒绝好友申请 |
| GET | `/api/friends/requests` | 获取待处理的好友申请 |
| DELETE | `/api/friends/:id` | 删除好友 |

### 聊天相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/chats` | 获取聊天列表 |
| POST | `/api/chats` | 创建聊天 |
| GET | `/api/chats/:id/messages` | 获取历史消息（分页） |
| GET | `/api/chats/:id/messages?before=xxx&limit=20` | 加载更多历史消息 |

### AI 相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai/summaries/:chatId` | 获取某个聊天的所有总结记录 |
| GET | `/api/ai/summaries/:id` | 获取单条总结详情 |

---

## 二、WebSocket 事件

### 客户端 → 服务端

| 事件名 | 数据 | 说明 |
|--------|------|------|
| `authenticate` | `{ token: string }` | 连接后进行身份认证 |
| `send_message` | `{ chatId, content, type }` | 发送消息 |
| `typing_start` | `{ chatId }` | 开始打字 |
| `typing_stop` | `{ chatId }` | 停止打字 |
| `mark_read` | `{ chatId, messageId }` | 标记消息已读 |

### 服务端 → 客户端

| 事件名 | 数据 | 说明 |
|--------|------|------|
| `authenticated` | `{ userId }` | 认证成功 |
| `new_message` | `{ message }` | 收到新消息 |
| `user_online` | `{ userId }` | 好友上线 |
| `user_offline` | `{ userId }` | 好友下线 |
| `typing` | `{ chatId, userId }` | 对方正在打字 |
| `message_read` | `{ chatId, messageId, userId }` | 消息被对方已读 |
| `ai_summary` | `{ chatId, summary }` | AI 总结结果 |
| `ai_thinking` | `{ chatId }` | AI 正在生成总结（loading 状态） |

---

## 三、数据结构示例

### 消息体

```typescript
interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: 'text' | 'system' | 'ai_summary';
  createdAt: string;       // ISO 8601
  readBy: string[];        // 已读用户 ID 列表
}
```

### 用户

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeenAt?: string;
}
```

### AI 总结

```typescript
interface AISummary {
  id: string;
  chatId: string;
  triggeredBy: string;      // 触发总结的用户 ID
  messageRange: {
    from: string;           // 起始消息 ID
    to: string;             // 结束消息 ID
    count: number;          // 涉及的消息数量
  };
  summary: {
    topics: string[];       // 讨论的主题
    decisions: string[];    // 达成的决定
    todos: string[];        // 待办事项
    keyInfo: string[];      // 关键信息
    raw: string;            // 完整的总结文本
  };
  createdAt: string;
}
```
