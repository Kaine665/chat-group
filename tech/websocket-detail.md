# ChatGroup - WebSocket 实时通信详解

## 一、为什么聊天必须用 WebSocket

HTTP 是「请求-响应」模型：客户端问，服务端答。聊天需要的是「服务端主动推送」——朋友发了消息，服务端需要立刻通知你，而不是等你来问。

WebSocket 建立后是一条持久的双向通道，双方都可以随时发数据。

```
HTTP:     客户端 ──请求──► 服务端 ──响应──► 客户端（完毕，连接关闭）

WebSocket: 客户端 ◄──────────────────────► 服务端（持久连接，双方随时通信）
```

## 二、连接生命周期

```
1. [建立连接] 客户端发起 WebSocket 握手
2. [认证]     客户端发送 JWT token 进行身份验证
3. [加入房间] 服务端将用户加入其所有聊天的房间
4. [通信]     双方正常收发消息
5. [心跳]     定期 ping/pong 检测连接存活
6. [断线重连] 连接断开后自动重试
7. [关闭]     用户退出或长时间无活动
```

## 三、Socket.io 的关键概念

### 房间 (Room)

每个聊天对话是一个房间。用户上线后加入自己所有聊天的房间：

```typescript
// 用户上线后加入所有聊天房间
socket.on('authenticate', async (token) => {
  const user = verifyToken(token);
  const chats = await getUserChats(user.id);

  for (const chat of chats) {
    socket.join(`chat:${chat.id}`);
  }
});

// 发消息时只广播给房间内的人
socket.on('send_message', async (data) => {
  const message = await saveMessage(data);
  socket.to(`chat:${data.chatId}`).emit('new_message', message);
});
```

### 心跳检测

Socket.io 内置心跳机制，默认配置：
- `pingInterval`: 25000ms（每 25 秒发一次 ping）
- `pingTimeout`: 20000ms（20 秒内没收到 pong 则认为断开）

### 断线重连

Socket.io 客户端自动处理断线重连：

```typescript
const socket = io('http://localhost:3000', {
  auth: { token: getToken() },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,       // 首次重试延迟 1s
  reconnectionDelayMax: 30000,   // 最大重试延迟 30s
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`重连成功，第 ${attemptNumber} 次尝试`);
  // 重连后需要重新拉取断线期间的消息
});
```

## 四、消息可靠性

### 问题：消息可能丢失

- 发送方断网：消息没有到达服务端
- 接收方断网：服务端推送时对方不在线

### 解决方案

1. **发送确认 (ACK)**

```typescript
// 客户端发消息并等待确认
socket.emit('send_message', data, (ack) => {
  if (ack.success) {
    // 消息发送成功，更新 UI 状态
    markMessageSent(data.localId);
  } else {
    // 发送失败，标记为发送失败，允许重试
    markMessageFailed(data.localId);
  }
});
```

2. **离线消息**

用户上线后，查询自己最后一条已读消息之后的所有新消息：

```typescript
socket.on('authenticate', async (token) => {
  const user = verifyToken(token);
  const unreadMessages = await getUnreadMessages(user.id);
  socket.emit('sync_messages', unreadMessages);
});
```

## 五、消息顺序

消息使用服务端时间戳排序。客户端生成一个临时 ID (`localId`) 用于本地渲染，服务端确认后替换为正式 ID。

```typescript
// 客户端发送
const localMessage = {
  localId: crypto.randomUUID(),
  content: '你好',
  chatId: 'chat-123',
  status: 'sending'  // sending → sent → delivered → read
};
```
