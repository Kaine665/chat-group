# ChatGroup 部署教程

## 部署架构

```
用户浏览器
    ↓ 访问 http://你的IP:80
┌───────────────────────────────┐
│         Nginx（前端容器）       │ ← 托管 HTML/CSS/JS
│   / → 静态文件                 │
│   /api → 反向代理到后端         │
│   /socket.io → WebSocket 代理  │
└───────────┬───────────────────┘
            ↓
┌───────────────────────────────┐
│       Node.js（后端容器）       │ ← Express + Socket.io
└──────┬──────────────┬─────────┘
       ↓              ↓
┌────────────┐  ┌──────────┐
│ PostgreSQL │  │  Redis   │
│  （数据库） │  │ （缓存）  │
└────────────┘  └──────────┘
```

所有服务都跑在 Docker 容器里，互相通信，对外只暴露 80 端口。

---

## 方式一：1Panel 部署（最简单）

### 前提
- 服务器已安装 1Panel（自带 Docker）

### 步骤

1. **登录 1Panel 面板**

2. **创建 Compose 项目**
   - 容器 → Compose → 创建
   - 名称填 `chatgroup`
   - 把项目根目录的 `docker-compose.yml` 内容粘贴进去
   - 但需要把 `build: ./server` 和 `build: ./web` 改成镜像地址（见下方）

3. **修改 docker-compose.yml 用镜像模式**

   ```yaml
   server:
     image: ghcr.io/kaine665/chat-group-server:latest
     # 删掉 build: ./server

   web:
     image: ghcr.io/kaine665/chat-group-web:latest
     # 删掉 build: ./web
   ```

4. **配置环境变量**
   ```
   DB_PASSWORD=你的数据库密码
   JWT_SECRET=你的JWT密钥
   PORT=80
   ```

5. **点击部署** → 等待拉取镜像并启动

6. **访问** `http://你的服务器IP`

### 更新版本
推送代码到 main → GitHub Actions 自动构建新镜像 → 1Panel 里点"重建"即可。

---

## 方式二：SSH 手动部署

### 前提
- 服务器有 Docker 和 Docker Compose

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/Kaine665/chat-group.git
cd chat-group

# 2. 创建环境变量文件
cp .env.example .env
nano .env   # 修改密码和密钥！

# 3. 一键启动所有服务
docker compose up -d

# 4. 查看运行状态
docker compose ps

# 5. 查看日志
docker compose logs -f
```

### 常用命令

```bash
# 停止所有服务
docker compose down

# 更新到最新代码
git pull
docker compose up -d --build

# 只看后端日志
docker compose logs -f server

# 进入数据库命令行
docker compose exec db psql -U chatgroup

# 重置数据库（⚠️ 删除所有数据）
docker compose down -v
docker compose up -d
```

---

## 方式三：用 GitHub Actions 构建的镜像

如果不想在服务器上编译（服务器配置低），可以用 GitHub Actions 预构建的镜像。

### 设置

1. **在 GitHub 仓库启用 Actions**
   - 仓库 Settings → Actions → General → 允许 all actions

2. **推送到 main 分支**
   - Actions 自动构建并推送镜像到 `ghcr.io`

3. **在服务器上拉取镜像**

   创建 `docker-compose.yml`（用镜像模式）：

   ```yaml
   services:
     db:
       image: postgres:16-alpine
       restart: unless-stopped
       environment:
         POSTGRES_USER: chatgroup
         POSTGRES_PASSWORD: ${DB_PASSWORD:-chatgroup123}
         POSTGRES_DB: chatgroup
       volumes:
         - postgres_data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U chatgroup"]
         interval: 5s
         timeout: 5s
         retries: 5

     redis:
       image: redis:7-alpine
       restart: unless-stopped

     server:
       image: ghcr.io/kaine665/chat-group-server:latest
       restart: unless-stopped
       environment:
         DATABASE_URL: postgresql://chatgroup:${DB_PASSWORD:-chatgroup123}@db:5432/chatgroup
         JWT_SECRET: ${JWT_SECRET:-change-me}
         PORT: "3000"
       depends_on:
         db:
           condition: service_healthy

     web:
       image: ghcr.io/kaine665/chat-group-web:latest
       restart: unless-stopped
       ports:
         - "${PORT:-80}:80"
       depends_on:
         - server

   volumes:
     postgres_data:
   ```

4. **启动**
   ```bash
   docker compose up -d
   ```

### 自动更新脚本

你可以在服务器上创建一个更新脚本：

```bash
#!/bin/bash
# update.sh — 拉取最新镜像并重启
docker compose pull
docker compose up -d
echo "Updated at $(date)"
```

---

## GitHub Actions 工作流说明

```
你推送代码到 main 分支
    ↓
GitHub Actions 自动触发
    ↓
┌──────────────────────┐  ┌──────────────────────┐
│  构建后端镜像          │  │  构建前端镜像          │  ← 两个并行执行
│  server/Dockerfile   │  │  web/Dockerfile      │
│  → 编译 TypeScript   │  │  → Vite 打包         │
│  → 生成 Prisma Client │  │  → Nginx 配置        │
└──────────┬───────────┘  └──────────┬───────────┘
           ↓                         ↓
  推送到 ghcr.io                推送到 ghcr.io
  kaine665/chat-group-server   kaine665/chat-group-web
    ↓
你的服务器: docker compose pull && docker compose up -d
    ↓
  更新完成！
```

镜像存在 GitHub 免费的 Container Registry，不需要额外付费。

---

## 配置域名 + HTTPS（可选）

如果你有域名，在 1Panel 中：

1. 网站 → 创建网站 → 反向代理
2. 域名填你的域名
3. 代理地址填 `http://127.0.0.1:80`（或者改 docker-compose 端口）
4. 申请 SSL 证书 → 开启 HTTPS

或者直接修改 docker-compose 中 web 的端口映射为 `443:80`，然后在 nginx.conf 中配置 SSL。
