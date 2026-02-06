/**
 * AI 提供商配置 — 定义所有支持的 AI 服务商
 *
 * 【为什么要支持多个提供商？】
 * 不同用户可能有不同的 API Key。有人有 OpenAI，有人用 DeepSeek。
 * 而且不同场景适合不同模型（快速总结用便宜的，复杂分析用贵的）。
 *
 * 【API 兼容性】
 * 好消息：DeepSeek、Kimi、豆包都兼容 OpenAI 的 API 格式！
 * 这意味着用同一套代码就能调用这些服务，只需要换 baseUrl 和 apiKey。
 * 只有 Claude 用的是自己独特的 Messages API 格式。
 *
 * 【模型命名规律】
 * - OpenAI: gpt-4.1, gpt-4.1-mini（数字越大越新，mini 是轻量版）
 * - DeepSeek: deepseek-chat（通用）, deepseek-reasoner（推理）
 * - Kimi: moonshot-v1-8k/32k/128k（数字是上下文窗口大小）
 * - 豆包: doubao-pro-32k（专业版）, doubao-lite-32k（轻量版）
 * - Claude: claude-opus-4-6（最强）, claude-sonnet-4-5（平衡）, claude-haiku-4-5（最快）
 */

export interface AIModel {
  id: string;       // API 调用时用的模型 ID
  name: string;     // 显示给用户看的名字
}

export interface AIProvider {
  id: string;       // 内部标识
  name: string;     // 显示名
  baseUrl: string;  // API 地址
  models: AIModel[];
  format: 'openai' | 'anthropic';  // API 格式
  note?: string;    // 额外说明
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    format: 'openai',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    format: 'openai',
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'o3-mini', name: 'o3-mini (推理模型)' },
    ],
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.ai/v1',
    format: 'openai',
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K' },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K' },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K' },
    ],
  },
  {
    id: 'doubao',
    name: '豆包 (Doubao)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    format: 'openai',
    note: '也可在"自定义模型ID"中填入火山引擎的 Endpoint ID（如 ep-2024xxxx）',
    models: [
      { id: 'doubao-pro-32k', name: '豆包 Pro 32K' },
      { id: 'doubao-lite-32k', name: '豆包 Lite 32K' },
    ],
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com',
    format: 'anthropic',
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (最强)' },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (平衡)' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (最快)' },
    ],
  },
];

/**
 * 根据 provider ID 查找提供商配置
 */
export function getProvider(providerId: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === providerId);
}
