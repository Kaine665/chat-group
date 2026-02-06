# ChatGroup — AI 驱动的即时通讯应用

一款内置 AI 助手的实时聊天应用。支持好友系统、实时消息、输入状态提示，以及通过 `@ai` 唤醒词在聊天中直接调用 AI 助手。

## 功能特性

- **实时聊天** — 基于 WebSocket 的毫秒级即时通信
- **好友系统** — 搜索用户、发送/接受好友申请、在线状态
- **AI 助手** — 在聊天中输入 `@ai` + 指令，即可唤醒 AI（支持 5 家提供商）
- **输入状态** — "对方正在输入..." 实时提示
- **已读回执** — 消息已读状态追踪
- **Docker 一键部署** — `docker compose up -d` 即可启动所有服务

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| **后端** | Node.js + Express 5 + TypeScript + Socket.io |
| **数据库** | PostgreSQL 16 + Prisma 6 ORM |
| **部署** | Docker + docker-compose + Nginx 反向代理 |
| **CI/CD** | GitHub Actions → GitHub Container Registry |

## 项目结构

```
chat-group/
├── server/                    # 后端服务
│   ├── src/
│   │   ├── app.ts             # Express 入口，挂载路由和中间件
│   │   ├── routes/            # REST API 路由
│   │   │   ├── auth.ts        # 注册、登录
│   │   │   ├── friends.ts     # 好友系统（申请、列表、搜索）
│   │   │   ├── chats.ts       # 聊天列表和历史消息
│   │   │   └── ai.ts          # AI 配置管理
│   │   ├── socket/
│   │   │   └── handler.ts     # WebSocket 事件处理（消息、输入状态、AI 唤醒）
│   │   ├── services/
│   │   │   ├── ai.ts          # AI 调用逻辑（OpenAI/Anthropic 格式）
│   │   │   ├── ai-providers.ts # AI 提供商和模型定义
│   │   │   ├── prisma.ts      # Prisma 客户端实例
│   │   │   └── socketStore.ts # Socket.io 共享状态
│   │   └── middleware/
│   │       └── auth.ts        # JWT 认证中间件
│   ├── prisma/
│   │   └── schema.prisma      # 数据库模型定义
│   ├── Dockerfile             # 多阶段构建
│   └── docker-entrypoint.sh   # 启动脚本（迁移 + 启动）
├── web/                       # 前端应用
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── ChatPage.tsx   # 主聊天页面
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx  # 消息列表 + 输入框
│   │   │   ├── ChatList.tsx    # 聊天列表
│   │   │   ├── FriendList.tsx  # 好友列表
│   │   │   └── AISettings.tsx  # AI 配置面板
│   │   └── lib/
│   │       ├── api.ts          # HTTP API 封装
│   │       └── socket.ts       # WebSocket 客户端
│   ├── Dockerfile             # 多阶段构建 → Nginx
│   └── nginx.conf             # Nginx 反向代理配置
├── docker-compose.yml         # 一键启动 4 个服务
├── .env.example               # 环境变量模板
├── docs/                      # 项目文档
│   ├── deployment.md          # 部署指南
│   ├── ai-guide.md            # AI 功能使用指南
│   └── security.md            # 敏感配置管理方案
└── tech/                      # 技术设计文档
    ├── architecture.md
    ├── tech-stack.md
    ├── api-design.md
    └── database-design.md
```

## 快速开始

### 前置要求

- Docker 和 docker-compose
- Git

### 1. 克隆项目

```bash
git clone https://github.com/Kaine665/chat-group.git
cd chat-group
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，修改以下值：

```bash
DB_PASSWORD=你的数据库密码
JWT_SECRET=你的JWT密钥    # 用 openssl rand -base64 32 生成
PORT=80                   # 对外暴露的端口
```

### 3. 启动服务

```bash
docker compose up -d --build
```

首次启动会自动：
- 拉取 PostgreSQL 和 Redis 镜像
- 编译前后端代码
- 执行数据库迁移
- 启动所有服务

### 4. 访问应用

打开浏览器访问 `http://你的服务器IP:端口`

## 文档目录

| 文档 | 说明 |
|------|------|
| [部署指南](docs/deployment.md) | 完整的服务器部署和更新流程 |
| [AI 功能指南](docs/ai-guide.md) | AI 助手的配置和使用方法 |
| [敏感配置方案](docs/security.md) | API Key 等敏感信息的安全管理 |
| [系统架构](tech/architecture.md) | 整体架构设计 |
| [技术栈](tech/tech-stack.md) | 技术选型详解 |
| [API 设计](tech/api-design.md) | REST API 和 WebSocket 事件 |
| [数据库设计](tech/database-design.md) | 数据模型和表结构 |

## 数据库模型

```
User ──┬── FriendRequest（好友申请）
       ├── ChatMember ── Chat（聊天）
       ├── Message（消息：TEXT / SYSTEM / AI_SUMMARY）
       ├── UserAIConfig（AI 配置：提供商、模型、API Key）
       └── AISummary（AI 总结记录）
```

## AI 助手

在任意聊天中输入 `@ai` + 你的指令即可唤醒 AI：

```
@ai 总结一下最近的聊天
@ai 翻译成英文：你好世界
@ai 什么是量子计算？
@ai 帮我写个会议通知
```

支持的 AI 提供商：

| 提供商 | 模型 | API 格式 |
|--------|------|----------|
| DeepSeek | deepseek-chat, deepseek-reasoner | OpenAI 兼容 |
| OpenAI | GPT-4.1, GPT-4o, o3-mini 等 | OpenAI |
| Kimi | moonshot-v1-8k/32k/128k | OpenAI 兼容 |
| 豆包 | doubao-pro-32k, doubao-lite-32k | OpenAI 兼容 |
| Claude | Opus 4.6, Sonnet 4.5, Haiku 4.5 | Anthropic Messages |

每个用户使用自己的 API Key，在页面右上角的"AI 设置"中配置。

详细使用说明见 [AI 功能指南](docs/ai-guide.md)。
