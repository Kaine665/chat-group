/**
 * AI 设置弹窗组件 — 配置 AI 服务商和模型
 *
 * 【Modal 模式窗口】
 * 这是一个覆盖在页面上方的弹窗。
 * 点击背景或关闭按钮可以关闭。
 *
 * 【数据流】
 * 1. 组件挂载时，并行请求提供商列表和用户当前配置
 * 2. 用户选择提供商 → 自动更新模型列表
 * 3. 用户填写 API Key → 点击保存
 * 4. 保存成功后关闭弹窗
 */

import { useState, useEffect } from 'react';
import {
  getAIProviders,
  getAIConfig,
  saveAIConfig,
  type AIProvider,
  type AIConfig,
} from '../lib/api';

interface Props {
  onClose: () => void;
}

export default function AISettings({ onClose }: Props) {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [existingConfig, setExistingConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 表单状态
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');

  // 当前选中的提供商对象
  const currentProvider = providers.find((p) => p.id === selectedProvider);

  // ========== 加载数据 ==========
  useEffect(() => {
    async function load() {
      try {
        const [providerList, config] = await Promise.all([
          getAIProviders(),
          getAIConfig(),
        ]);

        setProviders(providerList);
        setExistingConfig(config);

        // 如果用户有已保存的配置，回填表单
        if (config) {
          setSelectedProvider(config.provider);
          setSelectedModel(config.model);
          setCustomBaseUrl(config.baseUrl || '');
          // API Key 不回填（脱敏的没用）
        }
      } catch (err) {
        console.error('加载 AI 配置失败:', err);
        setError('加载配置失败');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 切换提供商时，自动选中第一个模型
  function handleProviderChange(providerId: string) {
    setSelectedProvider(providerId);
    const provider = providers.find((p) => p.id === providerId);
    if (provider && provider.models.length > 0) {
      setSelectedModel(provider.models[0].id);
    } else {
      setSelectedModel('');
    }
    setCustomBaseUrl('');
    setError('');
  }

  // ========== 保存配置 ==========
  async function handleSave() {
    if (!selectedProvider || !selectedModel || !apiKey) {
      setError('请填写所有必填项');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await saveAIConfig({
        provider: selectedProvider,
        model: selectedModel,
        apiKey,
        baseUrl: customBaseUrl || undefined,
      });

      setSuccess('配置保存成功！');
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    // Modal 背景遮罩
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      {/* 弹窗内容（阻止点击事件冒泡到背景） */}
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">AI 设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* 使用说明 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
              <p className="font-medium text-gray-700 mb-1">使用方法</p>
              <p>在聊天中输入 <code className="bg-gray-200 px-1.5 py-0.5 rounded text-purple-600 font-mono">@ai</code> + 你的指令，即可唤醒 AI 助手。</p>
              <p className="mt-1 text-xs text-gray-500">例如：@ai 帮我总结一下 / @ai 翻译成英文 / @ai 什么是量子计算</p>
            </div>

            {/* 已有配置提示 */}
            {existingConfig && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                当前配置：{providers.find(p => p.id === existingConfig.provider)?.name || existingConfig.provider} / {existingConfig.model}
                <br />
                API Key：{existingConfig.apiKey}
              </div>
            )}

            {/* 选择提供商 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI 服务商
              </label>
              <div className="grid grid-cols-2 gap-2">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      selectedProvider === p.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 选择模型 */}
            {currentProvider && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  模型
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {currentProvider.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>

                {/* 提供商备注 */}
                {currentProvider.note && (
                  <p className="mt-1 text-xs text-gray-500">{currentProvider.note}</p>
                )}
              </div>
            )}

            {/* API Key */}
            {selectedProvider && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={existingConfig ? '输入新 Key 覆盖原有配置...' : '输入你的 API Key...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  API Key 保存在服务器数据库中，仅你自己可用
                </p>
              </div>
            )}

            {/* 自定义 Base URL（高级选项） */}
            {selectedProvider && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  自定义 API 地址（可选）
                </label>
                <input
                  type="text"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder={currentProvider?.baseUrl || '默认地址'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  留空则使用默认地址：{currentProvider?.baseUrl}
                </p>
              </div>
            )}

            {/* 错误/成功提示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-600">
                {success}
              </div>
            )}

            {/* 保存按钮 */}
            <button
              onClick={handleSave}
              disabled={saving || !selectedProvider || !selectedModel || !apiKey}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
