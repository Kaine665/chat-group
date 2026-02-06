/**
 * AI 服务 — 在聊天中通过唤醒词调用 AI 助手
 *
 * 【唤醒词机制】
 * 用户在聊天中发 "@ai 你好" 这样的消息，服务器检测到 "@ai" 前缀后：
 * 1. 提取 "@ai" 后面的指令（如 "你好"）
 * 2. 获取最近的聊天上下文（让 AI 了解在聊什么）
 * 3. 读取触发者的 AI 配置（用谁的 Key 就调谁的 API）
 * 4. 调用 AI API，把回复作为一条新消息发到聊天里
 *
 * 【为什么不用 SDK？】
 * 因为 DeepSeek、Kimi、豆包都兼容 OpenAI 格式，
 * 用原生 fetch 直接请求更灵活，不需要额外安装 5 个 SDK。
 * 而且教学目的，能看到实际的 HTTP 请求更容易理解。
 *
 * 【两种 API 格式】
 * - OpenAI 格式：POST /chat/completions （DeepSeek、OpenAI、Kimi、豆包通用）
 * - Anthropic 格式：POST /v1/messages （仅 Claude）
 */

import { getProvider } from './ai-providers';

// 唤醒词 — 用户在消息开头输入这个词就能唤醒 AI
// 不区分大小写，支持 @ai 和 @AI
export const AI_WAKE_WORD = '@ai';

/**
 * 检查消息是否包含唤醒词
 * 返回唤醒词后面的指令部分，如果不是唤醒消息则返回 null
 *
 * 例子：
 * "@ai 帮我总结" → "帮我总结"
 * "@AI what is this?" → "what is this?"
 * "hello @ai" → null（唤醒词必须在开头）
 * "@ai" → ""（只有唤醒词，没有指令）
 */
export function extractAICommand(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.toLowerCase().startsWith(AI_WAKE_WORD)) {
    return trimmed.slice(AI_WAKE_WORD.length).trim();
  }
  return null;
}

// 系统提示词 — 定义 AI 在聊天中的角色和行为
const SYSTEM_PROMPT = `你是 ChatGroup 的 AI 助手，名叫"小助手"。你被嵌入在一个即时通讯软件的聊天中。

你的特点：
- 你可以看到最近的聊天记录作为上下文
- 用户用 @ai 唤醒你，@ai 后面的内容是对你的指令
- 你的回复会作为聊天消息显示给所有聊天成员

你可以做的事情：
- 总结聊天内容（"@ai 总结一下"）
- 翻译（"@ai 翻译成英文：你好"）
- 回答问题（"@ai 什么是量子计算？"）
- 帮忙起草消息（"@ai 帮我写个会议通知"）
- 解释概念（"@ai 解释一下刚才说的那个技术"）
- 或者任何其他文本相关的任务

注意：
- 用中文回答（除非用户明确要求其他语言）
- 保持简洁友好，像一个有用的群助手
- 如果用户只发了 @ai 没有具体指令，友好地问他需要什么帮助
- 回复不要太长，一般控制在 300 字以内`;

interface AICallOptions {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  command: string;          // 用户的指令（@ai 后面的部分）
  chatContext: Array<{      // 最近的聊天记录（提供上下文）
    sender: string;
    content: string;
    time: string;
  }>;
}

/**
 * 调用 AI 处理用户的指令
 */
export async function callAI(options: AICallOptions): Promise<string> {
  const providerConfig = getProvider(options.provider);
  if (!providerConfig) {
    throw new Error(`未知的 AI 提供商: ${options.provider}`);
  }

  // 构建用户消息：聊天上下文 + 用户指令
  let userMessage = '';

  if (options.chatContext.length > 0) {
    const contextText = options.chatContext
      .map((m) => `[${m.time}] ${m.sender}: ${m.content}`)
      .join('\n');
    userMessage += `【最近的聊天记录】\n${contextText}\n\n`;
  }

  if (options.command) {
    userMessage += `【用户指令】${options.command}`;
  } else {
    userMessage += '【用户指令】用户唤醒了你但没有给具体指令，请友好地打个招呼并询问需要什么帮助。';
  }

  const baseUrl = options.baseUrl || providerConfig.baseUrl;

  if (providerConfig.format === 'anthropic') {
    return callAnthropicAPI(baseUrl, options.apiKey, options.model, userMessage);
  } else {
    return callOpenAICompatibleAPI(baseUrl, options.apiKey, options.model, userMessage);
  }
}

/**
 * OpenAI 兼容 API 调用
 *
 * DeepSeek、OpenAI、Kimi、豆包都用这个格式：
 * POST {baseUrl}/chat/completions
 * Body: { model, messages: [{ role, content }] }
 */
async function callOpenAICompatibleAPI(
  baseUrl: string,
  apiKey: string,
  model: string,
  userMessage: string
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API 错误 (${response.status}): ${errorText}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || 'AI 未能生成回复';
}

/**
 * Anthropic Claude API 调用
 *
 * Claude 用自己独特的 Messages API：
 * POST {baseUrl}/v1/messages
 * Headers: x-api-key, anthropic-version
 * Body: { model, system, messages: [{ role, content }], max_tokens }
 */
async function callAnthropicAPI(
  baseUrl: string,
  apiKey: string,
  model: string,
  userMessage: string
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API 错误 (${response.status}): ${errorText}`);
  }

  const data: any = await response.json();
  return data.content?.[0]?.text || 'AI 未能生成回复';
}
