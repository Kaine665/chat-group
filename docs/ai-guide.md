# AI 功能指南

## 一、功能概述

ChatGroup 内置了 AI 助手功能。在任意聊天中输入 `@ai` + 你的指令，AI 会根据最近的聊天上下文来回复。

AI 的回复以紫色主题的特殊样式显示在聊天中，所有聊天成员都能看到。

## 二、配置 AI

### 2.1 打开设置

点击页面右上角的 **「AI 设置」** 按钮，打开 AI 配置面板。

### 2.2 选择提供商

目前支持 5 家 AI 提供商：

| 提供商 | 获取 API Key | 特点 |
|--------|-------------|------|
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) | 价格便宜，中文能力强 |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | 综合能力最强 |
| **Kimi (Moonshot)** | [platform.moonshot.ai](https://platform.moonshot.ai) | 长文本处理出色 |
| **豆包 (Doubao)** | [console.volcengine.com](https://console.volcengine.com) | 字节跳动旗下，国内访问快 |
| **Claude (Anthropic)** | [console.anthropic.com](https://console.anthropic.com) | 安全性好，长文本理解强 |

### 2.3 选择模型

每个提供商有多个模型可选：

**DeepSeek**
- `deepseek-chat` — 通用对话模型（推荐，性价比最高）
- `deepseek-reasoner` — 推理增强模型

**OpenAI**
- `gpt-4.1` — 最新旗舰
- `gpt-4.1-mini` — 轻量版（性价比高）
- `gpt-4.1-nano` — 超轻量版（最便宜）
- `gpt-4o` / `gpt-4o-mini` — 上一代
- `o3-mini` — 推理模型

**Kimi**
- `moonshot-v1-8k` — 8K 上下文
- `moonshot-v1-32k` — 32K 上下文
- `moonshot-v1-128k` — 128K 上下文（适合很长的聊天记录）

**豆包**
- `doubao-pro-32k` — 专业版
- `doubao-lite-32k` — 轻量版

**Claude**
- `claude-opus-4-6` — 最强（最贵）
- `claude-sonnet-4-5` — 性能与价格平衡
- `claude-haiku-4-5` — 最快最便宜

### 2.4 填写 API Key

在 AI 配置面板中填入你从提供商平台获取的 API Key，点击保存。

> **安全提示**：API Key 存储在服务器数据库中。在前端显示时会做脱敏处理（只显示前 8 位）。关于更安全的存储方案，请参阅 [敏感配置方案](security.md)。

### 2.5 自定义 API 地址（可选）

如果你使用代理服务或私有部署的模型，可以填写自定义的 Base URL 来覆盖默认地址。

## 三、使用 AI

### 3.1 基本用法

在聊天输入框中输入 `@ai` + 你的指令：

```
@ai 总结一下最近的聊天
@ai 翻译成英文：你好世界
@ai 什么是量子计算？
@ai 帮我写个会议通知
@ai 解释一下刚才说的那个技术
```

### 3.2 工作流程

1. 你发送 `@ai 你的指令`
2. 消息正常发送到聊天中
3. 服务器检测到 `@ai` 唤醒词
4. 聊天中显示 "AI 正在思考..."（紫色弹跳动画）
5. 服务器读取最近 30 条聊天记录作为上下文
6. 使用**你的** AI 配置调用 AI API
7. AI 回复以紫色主题消息显示在聊天中

### 3.3 注意事项

- **唤醒词必须在消息开头**：`@ai 你好` 会触发，`你好 @ai` 不会
- **不区分大小写**：`@ai`、`@AI`、`@Ai` 都可以
- **谁触发用谁的 Key**：每次 `@ai` 调用使用触发者自己的 API Key 和额度
- **没有配置会提示**：如果你还没配置 AI，触发后会收到提示去配置
- **上下文自动携带**：AI 能看到最近 30 条聊天记录，所以可以直接问"刚才说的那个..."

### 3.4 AI 回复样式

AI 的回复以特殊样式显示：
- 居中显示，宽度占 85%
- 紫色渐变背景
- 带有「AI 助手」标签
- 保留换行格式

### 3.5 费用说明

- 每个用户使用自己的 API Key
- 每次 `@ai` 触发都会消耗触发者的 API 额度
- 不同提供商和模型价格不同
- 推荐初期使用 DeepSeek（最便宜）或 GPT-4.1-nano（OpenAI 中最便宜）

## 四、技术实现

### 4.1 架构

```
用户发送 "@ai 你好"
       │
       ▼
  socket handler
  (send_message)
       │
       ├── 1. 保存消息到数据库
       ├── 2. 广播消息给聊天成员
       └── 3. 检测唤醒词 → extractAICommand()
              │
              ▼
        handleAIWakeup()
              │
              ├── 读取用户 AI 配置 (UserAIConfig)
              ├── 获取最近 30 条聊天记录
              ├── 构建 prompt（系统提示 + 上下文 + 指令）
              ├── 调用 AI API (callAI())
              │     ├── OpenAI 兼容格式 (DeepSeek/OpenAI/Kimi/豆包)
              │     └── Anthropic 格式 (Claude)
              └── 保存 AI 回复并广播
```

### 4.2 API 格式

项目支持两种 API 格式：

**OpenAI 兼容格式**（DeepSeek、OpenAI、Kimi、豆包）：
```
POST {baseUrl}/chat/completions
Authorization: Bearer {apiKey}
Body: { model, messages: [{ role, content }] }
```

**Anthropic 格式**（Claude）：
```
POST {baseUrl}/v1/messages
x-api-key: {apiKey}
anthropic-version: 2023-06-01
Body: { model, system, messages: [{ role, content }], max_tokens }
```

### 4.3 不用 SDK 的原因

项目使用原生 `fetch` 直接调用 API，没有引入任何 AI SDK：
- 4 家提供商（DeepSeek、OpenAI、Kimi、豆包）都兼容 OpenAI 格式，用同一套代码
- 只有 Claude 需要单独实现，代码量也不大
- 避免安装 5 个 SDK 增加项目体积
- 更容易理解实际的 HTTP 请求过程
