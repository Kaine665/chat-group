/**
 * AI 路由 — AI 配置管理
 *
 * 【功能】
 * 1. GET  /api/ai/providers — 获取所有支持的 AI 提供商和模型列表
 * 2. GET  /api/ai/config    — 获取当前用户的 AI 配置
 * 3. PUT  /api/ai/config    — 保存/更新用户的 AI 配置
 *
 * 【AI 触发方式】
 * AI 不是通过 API 调用的，而是通过聊天中的唤醒词（@ai）触发。
 * 具体逻辑在 socket/handler.ts 里。
 * 这个路由主要负责配置管理（选择提供商、模型、填 API Key）。
 *
 * 【安全说明】
 * API Key 存在数据库里。生产环境应该加密存储，
 * 这里为了教学简单直接存明文。返回给前端时会做脱敏处理（只显示前几位）。
 */

import { Router, Request, Response } from 'express';
import prisma from '../services/prisma';
import { auth } from '../middleware/auth';
import { AI_PROVIDERS } from '../services/ai-providers';
import { AI_WAKE_WORD } from '../services/ai';

const router = Router();

/**
 * GET /api/ai/providers — 获取所有支持的 AI 提供商和唤醒词
 *
 * 前端用这个来渲染"选择提供商"下拉框和"选择模型"列表。
 */
router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    providers: AI_PROVIDERS,
    wakeWord: AI_WAKE_WORD,
  });
});

/**
 * GET /api/ai/config — 获取当前用户的 AI 配置
 *
 * 返回用户保存的提供商、模型、API Key（脱敏）、自定义 URL。
 * 如果用户没有配置过，返回 null。
 */
router.get('/config', auth, async (req: Request, res: Response) => {
  try {
    const config = await prisma.userAIConfig.findUnique({
      where: { userId: req.userId },
    });

    if (!config) {
      res.json({ config: null });
      return;
    }

    // 脱敏 API Key：只显示前 8 位 + 星号
    const maskedKey = config.apiKey.length > 8
      ? config.apiKey.slice(0, 8) + '********'
      : '********';

    res.json({
      config: {
        provider: config.provider,
        model: config.model,
        apiKey: maskedKey,
        baseUrl: config.baseUrl,
      },
    });
  } catch (err) {
    console.error('获取 AI 配置失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * PUT /api/ai/config — 保存用户的 AI 配置
 *
 * 用 upsert（update + insert 的合体）：
 * - 用户已有配置 → 更新
 * - 用户没有配置 → 创建
 */
router.put('/config', auth, async (req: Request, res: Response) => {
  try {
    const { provider, model, apiKey, baseUrl } = req.body;

    if (!provider || !model || !apiKey) {
      res.status(400).json({ error: '请填写提供商、模型和 API Key' });
      return;
    }

    // 验证 provider 是否有效
    const validProvider = AI_PROVIDERS.find((p) => p.id === provider);
    if (!validProvider) {
      res.status(400).json({ error: '无效的 AI 提供商' });
      return;
    }

    const config = await prisma.userAIConfig.upsert({
      where: { userId: req.userId! },
      update: { provider, model, apiKey, baseUrl: baseUrl || null },
      create: {
        userId: req.userId!,
        provider,
        model,
        apiKey,
        baseUrl: baseUrl || null,
      },
    });

    res.json({
      config: {
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey.slice(0, 8) + '********',
        baseUrl: config.baseUrl,
      },
    });
  } catch (err) {
    console.error('保存 AI 配置失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
