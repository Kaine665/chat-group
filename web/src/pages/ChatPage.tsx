/**
 * 主聊天页面 — 左侧聊天列表 + 右侧聊天窗口
 *
 * 【布局结构】
 * ┌─────────────────────────────────────────────┐
 * │  Header（用户名 + 退出按钮）                  │
 * ├──────────────┬──────────────────────────────┤
 * │              │                              │
 * │  侧边栏       │      聊天窗口                │
 * │  - 聊天列表   │      - 消息列表              │
 * │  - 好友管理   │      - 输入框                │
 * │              │                              │
 * └──────────────┴──────────────────────────────┘
 *
 * 【React 概念】
 * - useEffect：组件挂载时执行副作用（加载数据、监听事件）
 * - useRef：获取 DOM 元素的引用（用于滚动到底部）
 * - 条件渲染：selectedChat 有值时显示聊天，否则显示空状态
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getChats, getFriends, getFriendRequests, searchUsers, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, type Chat, type User, type FriendRequest } from '../lib/api';
import { getSocket } from '../lib/socket';
import ChatWindow from '../components/ChatWindow';

export default function ChatPage() {
  const { user, logout } = useAuthStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // 侧边栏 tab：聊天列表 / 好友管理
  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>('chats');
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const selectedChat = chats.find((c) => c.id === selectedChatId);

  // ========== 加载数据 ==========

  useEffect(() => {
    loadChats();
    loadFriends();
    loadFriendRequests();
  }, []);

  // 监听 WebSocket 的 new_message 事件，更新聊天列表
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = () => {
      loadChats(); // 收到新消息时刷新列表
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, []);

  async function loadChats() {
    try {
      const data = await getChats();
      setChats(data);
    } catch (err) {
      console.error('加载聊天列表失败', err);
    }
  }

  async function loadFriends() {
    try {
      setFriends(await getFriends());
    } catch (err) {
      console.error('加载好友列表失败', err);
    }
  }

  async function loadFriendRequests() {
    try {
      setFriendRequests(await getFriendRequests());
    } catch (err) {
      console.error('加载好友申请失败', err);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    try {
      setSearchResults(await searchUsers(searchQuery));
    } catch (err) {
      console.error('搜索失败', err);
    }
  }

  async function handleAddFriend(receiverId: string) {
    try {
      await sendFriendRequest(receiverId);
      setSearchResults((prev) => prev.filter((u) => u.id !== receiverId));
      alert('好友申请已发送');
    } catch (err: any) {
      alert(err.response?.data?.error || '发送失败');
    }
  }

  async function handleAcceptRequest(requestId: string) {
    try {
      await acceptFriendRequest(requestId);
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
      loadFriends();
      loadChats();
    } catch (err) {
      console.error('接受失败', err);
    }
  }

  async function handleRejectRequest(requestId: string) {
    try {
      await rejectFriendRequest(requestId);
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error('拒绝失败', err);
    }
  }

  /**
   * 获取私聊中对方的用户名（用于显示聊天标题）
   * 因为私聊的 chat.name 是 null，需要从 members 中找出"不是自己"的那个人
   */
  function getChatDisplayName(chat: Chat): string {
    if (chat.name) return chat.name;
    const other = chat.members.find((m) => m.userId !== user?.id);
    return other?.user.username || '未知';
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ========== Header ========== */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <h1 className="text-lg font-bold text-gray-800">ChatGroup</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user?.username}</span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            退出
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ========== 侧边栏 ========== */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
          {/* Tab 切换 */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'chats'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              聊天
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'friends'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              好友
              {friendRequests.length > 0 && (
                <span className="absolute top-2 right-6 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {friendRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab 内容 */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'chats' ? (
              /* ===== 聊天列表 ===== */
              chats.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  还没有聊天，去好友页添加好友吧
                </div>
              ) : (
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selectedChatId === chat.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* 头像占位 */}
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium shrink-0">
                        {getChatDisplayName(chat)[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 text-sm">
                          {getChatDisplayName(chat)}
                        </div>
                        {chat.messages[0] && (
                          <div className="text-xs text-gray-400 truncate mt-0.5">
                            {chat.messages[0].sender.username}: {chat.messages[0].content}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              /* ===== 好友管理 ===== */
              <div className="p-4 space-y-4">
                {/* 搜索用户 */}
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="搜索用户名..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleSearch}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      搜索
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg divide-y">
                      {searchResults.map((u) => (
                        <div key={u.id} className="p-3 flex items-center justify-between">
                          <span className="text-sm text-gray-700">{u.username}</span>
                          <button
                            onClick={() => handleAddFriend(u.id)}
                            className="text-xs px-3 py-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                          >
                            添加
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 好友申请 */}
                {friendRequests.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">待处理的好友申请</h3>
                    <div className="border border-gray-200 rounded-lg divide-y">
                      {friendRequests.map((req) => (
                        <div key={req.id} className="p-3 flex items-center justify-between">
                          <span className="text-sm text-gray-700">{req.sender.username}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptRequest(req.id)}
                              className="text-xs px-3 py-1 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                            >
                              接受
                            </button>
                            <button
                              onClick={() => handleRejectRequest(req.id)}
                              className="text-xs px-3 py-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                            >
                              拒绝
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 好友列表 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    我的好友 ({friends.length})
                  </h3>
                  {friends.length === 0 ? (
                    <p className="text-sm text-gray-400">还没有好友，搜索并添加吧</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg divide-y">
                      {friends.map((f) => (
                        <div key={f.id} className="p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-sm font-medium">
                            {f.username[0]}
                          </div>
                          <span className="text-sm text-gray-700">{f.username}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ========== 聊天窗口 ========== */}
        <main className="flex-1 flex flex-col">
          {selectedChat ? (
            <ChatWindow
              chat={selectedChat}
              currentUserId={user!.id}
              chatDisplayName={getChatDisplayName(selectedChat)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              选择一个聊天开始对话
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
