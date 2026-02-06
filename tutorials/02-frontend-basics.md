# ChatGroup 前端教程

## 一、项目结构

```
web/
├── src/
│   ├── main.tsx              # 入口：把 App 渲染到页面
│   ├── App.tsx               # 路由配置 + 登录守卫
│   ├── index.css             # Tailwind CSS 入口
│   ├── lib/
│   │   ├── api.ts            # HTTP API 客户端（axios 封装）
│   │   └── socket.ts         # WebSocket 客户端（Socket.io 封装）
│   ├── stores/
│   │   └── authStore.ts      # 全局状态管理（Zustand）
│   ├── pages/
│   │   ├── LoginPage.tsx     # 登录/注册页面
│   │   └── ChatPage.tsx      # 主页面（聊天列表 + 好友管理）
│   └── components/
│       └── ChatWindow.tsx    # 聊天窗口（消息列表 + 输入框）
├── vite.config.ts            # Vite 配置（代理、Tailwind）
└── package.json
```

---

## 二、核心技术

### 1. React — 用组件拼页面

React 的核心思想：**把 UI 拆成一个个可复用的组件**。

```
App（根组件）
├── LoginPage（登录页）
└── ChatPage（主页面）
    ├── Sidebar（侧边栏）
    │   ├── ChatList（聊天列表）
    │   └── FriendPanel（好友管理）
    └── ChatWindow（聊天窗口）
        ├── MessageList（消息列表）
        └── InputBar（输入框）
```

每个组件管自己的事：ChatWindow 只关心消息的展示和发送，不关心好友系统。

**三个核心 Hook**：

```tsx
// useState — 管理组件内部状态
const [count, setCount] = useState(0);
// count 变化时，React 自动重新渲染组件

// useEffect — 执行副作用（加载数据、监听事件）
useEffect(() => {
  loadMessages();        // 组件挂载时执行
  return () => cleanup(); // 组件卸载时执行（清理）
}, [chatId]);             // chatId 变化时重新执行

// useRef — 存储不触发渲染的值，或获取 DOM 元素
const divRef = useRef<HTMLDivElement>(null);
divRef.current?.scrollIntoView(); // 操作真实 DOM
```

### 2. React Router — 页面路由

单页应用只有一个 HTML，路由让它"假装"有多个页面：

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<ChatPage />} />
  </Routes>
</BrowserRouter>
```

- 用户访问 `/login` → 显示 LoginPage
- 用户访问 `/` → 显示 ChatPage
- 页面切换不刷新浏览器，只是替换组件

**编程式导航**：
```tsx
const navigate = useNavigate();
navigate('/');  // JS 代码跳转到首页
```

### 3. Zustand — 全局状态管理

有些数据多个组件都需要（比如"当前用户"）：

```tsx
// 定义 store
const useAuthStore = create((set) => ({
  user: null,
  login: async (email, password) => {
    const result = await apiLogin(email, password);
    set({ user: result.user }); // 更新状态
  },
}));

// 在任何组件中使用
function Header() {
  const user = useAuthStore((s) => s.user);  // 只订阅 user 字段
  return <span>{user?.username}</span>;
}

function LoginPage() {
  const login = useAuthStore((s) => s.login);
  // 调用 login 后，Header 组件会自动更新
}
```

### 4. Axios — HTTP 请求

```tsx
// 拦截器：自动加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 调用 API
const { data } = await api.post('/auth/login', { email, password });
```

### 5. Socket.io Client — 实时通信

```tsx
import { io } from 'socket.io-client';

const socket = io('/');

// 发送事件
socket.emit('send_message', { chatId: '...', content: '你好' });

// 监听事件
socket.on('new_message', (data) => {
  console.log('收到新消息:', data.message);
});
```

### 6. Tailwind CSS — 用 class 写样式

传统 CSS：写单独的样式文件，通过 className 关联。
Tailwind：直接在 HTML 标签上写样式 class。

```tsx
// 传统方式
<button className="submit-btn">提交</button>
// .submit-btn { padding: 8px 16px; background: blue; color: white; border-radius: 8px; }

// Tailwind 方式
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg">提交</button>
```

常用 class 速查：
| Class | 效果 |
|-------|------|
| `flex` | 弹性布局 |
| `items-center` | 垂直居中 |
| `justify-between` | 两端对齐 |
| `p-4` / `px-4` / `py-2` | 内边距（全部/水平/垂直） |
| `m-4` / `mt-2` / `mb-4` | 外边距 |
| `text-sm` / `text-lg` | 文字大小 |
| `text-gray-500` | 文字颜色 |
| `bg-blue-600` | 背景色 |
| `rounded-lg` | 圆角 |
| `w-full` / `h-screen` | 宽度/高度 |
| `hover:bg-blue-700` | 鼠标悬停效果 |
| `transition-colors` | 颜色过渡动画 |

### 7. Vite — 开发工具

Vite（法语"快"的意思）是前端构建工具：

- **开发时**：启动极快（毫秒级），修改代码后浏览器自动热更新
- **打包时**：把所有 TS/TSX 编译成浏览器能运行的 JS，压缩优化

**代理配置**（解决跨域）：
```ts
// vite.config.ts
proxy: {
  '/api': 'http://localhost:3000',      // 前端的 /api → 后端 3000
  '/socket.io': {
    target: 'http://localhost:3000',
    ws: true,                            // 代理 WebSocket
  },
}
```
前端跑在 5173 端口，后端跑在 3000 端口。浏览器因为"同源策略"不允许 5173 直接请求 3000。代理让所有请求都走 5173，Vite 在服务端帮你转发到 3000，绕过浏览器限制。

---

## 三、数据流

### 登录流程
```
用户输入邮箱密码 → 点击登录
  ↓
LoginPage 调用 useAuthStore.login()
  ↓
authStore 调用 api.post('/auth/login')
  ↓
Vite 代理转发到后端 → 后端验证 → 返回 { user, token }
  ↓
authStore 把 token 存到 localStorage，user 存到 Zustand
  ↓
connectSocket(token) 建立 WebSocket 连接
  ↓
navigate('/') 跳转到主页
  ↓
ProtectedRoute 检测到 user 存在 → 显示 ChatPage
```

### 发消息流程
```
用户输入文字 → 按发送
  ↓
ChatWindow.handleSend()
  ↓
socket.emit('send_message', { chatId, content })  ← WebSocket 发出
  ↓
后端收到 → 写入数据库 → io.to('chat:xxx').emit('new_message')
  ↓
ChatWindow 的 useEffect 监听到 'new_message'     ← WebSocket 收到
  ↓
setMessages(prev => [...prev, newMessage])  ← 更新 React 状态
  ↓
React 自动重新渲染消息列表
  ↓
scrollToBottom() 滚到最新消息
```

### 页面刷新恢复
```
页面刷新 → main.tsx 重新渲染 App
  ↓
App 的 useEffect 调用 restoreSession()
  ↓
从 localStorage 取出 token → 调用 getMe() API
  ↓
成功 → 恢复用户状态 + 重连 WebSocket
失败 → 清除 token → 跳转登录页
```

---

## 四、如何运行

```bash
# 1. 确保后端已启动（在 server 目录运行 npm run dev）

# 2. 进入前端目录
cd web

# 3. 安装依赖
npm install

# 4. 启动开发服务器
npm run dev

# 5. 打开浏览器访问 http://localhost:5173
```

---

## 五、文件职责速查

| 文件 | 职责 |
|------|------|
| `main.tsx` | 应用入口，渲染根组件 |
| `App.tsx` | 路由 + 登录守卫 |
| `lib/api.ts` | 所有 HTTP API 调用 + 类型定义 |
| `lib/socket.ts` | WebSocket 连接管理 |
| `stores/authStore.ts` | 登录状态（用户信息、token） |
| `pages/LoginPage.tsx` | 登录/注册表单 |
| `pages/ChatPage.tsx` | 主页面骨架 + 侧边栏（聊天列表、好友） |
| `components/ChatWindow.tsx` | 消息展示 + 发送 + 输入状态 |
