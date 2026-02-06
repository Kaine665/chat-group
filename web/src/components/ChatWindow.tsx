/**
 * 聊天窗口组件 — 消息列表 + 输入框
 *
 * 这是最复杂的组件，涉及：
 * 1. 初始加载历史消息（HTTP API）
 * 2. 实时接收新消息（WebSocket）
 * 3. 发送消息（WebSocket）
 * 4. 自动滚动到最新消息
 * 5. 输入状态提示（"对方正在输入..."）
 * 6. AI 消息的特殊显示样式
 * 7. AI 正在思考的加载状态
 *
 * 【AI 唤醒词】
 * 在输入框输入 "@ai 你的问题" 然后发送，
 * 服务器会检测到 @ai 前缀，调用 AI 处理，
 * AI 的回复会作为一条特殊样式的消息出现在聊天里。
 */

import { useState, useEffect, useRef } from 'react';
import { getMessages, type Chat, type Message } from '../lib/api';
import { getSocket } from '../lib/socket';

interface Props {
  chat: Chat;
  currentUserId: string;
  chatDisplayName: string;
}

export default function ChatWindow({ chat, currentUserId, chatDisplayName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [aiThinking, setAiThinking] = useState(false); // AI 是否正在思考
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ========== 加载历史消息（切换聊天时触发）==========
  useEffect(() => {
    setMessages([]);
    setAiThinking(false);
    loadMessages();
  }, [chat.id]);

  async function loadMessages() {
    try {
      const data = await getMessages(chat.id);
      setMessages(data);
      scrollToBottom();
    } catch (err) {
      console.error('加载消息失败', err);
    }
  }

  // ========== WebSocket 事件监听 ==========
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // 收到新消息
    const handleNewMessage = (data: { message: Message }) => {
      if (data.message.chatId === chat.id) {
        setMessages((prev) => [...prev, data.message]);
        scrollToBottom();
        socket.emit('mark_read', { chatId: chat.id });
      }
    };

    // 对方正在输入
    const handleTyping = (data: { chatId: string; userId: string }) => {
      if (data.chatId === chat.id && data.userId !== currentUserId) {
        setTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTyping(false), 3000);
      }
    };

    // 对方停止输入
    const handleTypingStop = (data: { chatId: string }) => {
      if (data.chatId === chat.id) {
        setTyping(false);
      }
    };

    // AI 正在思考
    const handleAIThinking = (data: { chatId: string }) => {
      if (data.chatId === chat.id) {
        setAiThinking(true);
      }
    };

    // AI 思考完毕
    const handleAIThinkingDone = (data: { chatId: string }) => {
      if (data.chatId === chat.id) {
        setAiThinking(false);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('typing_stop', handleTypingStop);
    socket.on('ai_thinking', handleAIThinking);
    socket.on('ai_thinking_done', handleAIThinkingDone);

    socket.emit('mark_read', { chatId: chat.id });

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing', handleTyping);
      socket.off('typing_stop', handleTypingStop);
      socket.off('ai_thinking', handleAIThinking);
      socket.off('ai_thinking_done', handleAIThinkingDone);
    };
  }, [chat.id, currentUserId]);

  // ========== 发送消息 ==========
  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit('send_message', {
      chatId: chat.id,
      content: input.trim(),
    });

    socket.emit('typing_stop', { chatId: chat.id });
    setInput('');
  }

  function handleInputChange(value: string) {
    setInput(value);
    const socket = getSocket();
    if (!socket) return;

    if (value.trim()) {
      socket.emit('typing_start', { chatId: chat.id });
    } else {
      socket.emit('typing_stop', { chatId: chat.id });
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ========== 渲染消息 ==========
  function renderMessage(msg: Message) {
    const isMine = msg.senderId === currentUserId;
    const isAI = msg.type === 'AI_SUMMARY';

    // AI 消息 — 特殊样式，居中显示，紫色主题
    if (isAI) {
      return (
        <div key={msg.id} className="flex justify-center my-2">
          <div className="max-w-[85%] w-full">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl px-4 py-3">
              {/* AI 标识 */}
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  AI 助手
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
              {/* AI 回复内容 — 保留换行 */}
              <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 普通消息
    return (
      <div
        key={msg.id}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`max-w-[70%] ${isMine ? 'order-2' : ''}`}>
          {!isMine && (
            <div className="text-xs text-gray-400 mb-1 ml-1">
              {msg.sender.username}
            </div>
          )}
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              isMine
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
            }`}
          >
            {msg.content}
          </div>
          <div
            className={`text-xs text-gray-400 mt-1 ${
              isMine ? 'text-right mr-1' : 'ml-1'
            }`}
          >
            {formatTime(msg.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* 聊天标题栏 */}
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-medium text-gray-800">{chatDisplayName}</h2>
          {typing && (
            <span className="text-xs text-gray-400">正在输入...</span>
          )}
          {aiThinking && (
            <span className="text-xs text-purple-500 animate-pulse">AI 正在思考...</span>
          )}
        </div>
        {/* @ai 使用提示 */}
        <span className="text-xs text-gray-400">
          输入 @ai + 指令唤醒 AI
        </span>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map(renderMessage)}

        {/* AI 思考中的加载动画 */}
        {aiThinking && (
          <div className="flex justify-center my-2">
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-purple-600">AI 正在思考...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200 shrink-0">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="输入消息...（输入 @ai 唤醒 AI 助手）"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}
