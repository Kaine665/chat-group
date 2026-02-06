/**
 * 聊天窗口组件 — 消息列表 + 输入框
 *
 * 这是最复杂的组件，涉及：
 * 1. 初始加载历史消息（HTTP API）
 * 2. 实时接收新消息（WebSocket）
 * 3. 发送消息（WebSocket）
 * 4. 自动滚动到最新消息
 * 5. 输入状态提示（"对方正在输入..."）
 *
 * 【useEffect 依赖数组】
 * useEffect(() => { ... }, [chatId])
 *                           ^^^^^^^^ 依赖数组
 * - [] 空数组：只在组件挂载时执行一次
 * - [chatId]：chatId 变化时重新执行
 * - 不写：每次渲染都执行（几乎不用）
 *
 * 【useRef 的用途】
 * - messagesEndRef：指向消息列表底部的空 div，调用 scrollIntoView() 自动滚到底
 * - 和 useState 的区别：ref 变化不会触发重新渲染
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
  const [typing, setTyping] = useState(false); // 对方是否正在输入
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ========== 加载历史消息（切换聊天时触发）==========
  useEffect(() => {
    setMessages([]); // 先清空
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

        // 标记已读
        socket.emit('mark_read', { chatId: chat.id });
      }
    };

    // 对方正在输入
    const handleTyping = (data: { chatId: string; userId: string }) => {
      if (data.chatId === chat.id && data.userId !== currentUserId) {
        setTyping(true);
        // 3 秒后自动取消"正在输入"
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

    socket.on('new_message', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('typing_stop', handleTypingStop);

    // 进入聊天时标记已读
    socket.emit('mark_read', { chatId: chat.id });

    // 组件卸载时取消监听（防止内存泄漏）
    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing', handleTyping);
      socket.off('typing_stop', handleTypingStop);
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

    // 停止输入状态
    socket.emit('typing_stop', { chatId: chat.id });
    setInput('');
  }

  // 输入时发送"正在输入"事件
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

  // 格式化时间：只显示时分
  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* 聊天标题栏 */}
      <div className="h-14 border-b border-gray-200 flex items-center px-4 bg-white shrink-0">
        <h2 className="font-medium text-gray-800">{chatDisplayName}</h2>
        {typing && (
          <span className="ml-3 text-xs text-gray-400">正在输入...</span>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUserId;
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] ${isMine ? 'order-2' : ''}`}>
                {/* 发送者名字（只显示对方的） */}
                {!isMine && (
                  <div className="text-xs text-gray-400 mb-1 ml-1">
                    {msg.sender.username}
                  </div>
                )}
                {/* 消息气泡 */}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMine
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
                {/* 时间 */}
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
        })}
        {/* 这个空 div 用于自动滚动到底部 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200 shrink-0">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="输入消息..."
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
