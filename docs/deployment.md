# ChatGroup 部署指南

## 一、架构概览

ChatGroup 使用 Docker Compose 编排 4 个服务：

```
┌─────────────────────────────────────────────┐
│                  服务器                       │
│                                             │
│  ┌────────┐    ┌────────┐                   │
│  │ web    │◄──►│ server │                   │
│  │ Nginx  │    │ Node.js│                   │
│  │ :80    │    │ :3000  │                   │
│  └────────┘    └───┬────┘                   │
│                    │                        │
│         ┌──────────┼──────────┐             │
│         ▼                     ▼             │
│  ┌────────────┐     ┌──────────┐            │
│  │ db         │     │ redis    │            │
│  │ PostgreSQL │     │ Redis    │            │
│  │ :5432      │     │ :6379    │            │
│  └────────────┘     └──────────┘            │
│                                             │
│  数据卷:                                     │
│  - postgres_data (数据库持久化)               │
│  - redis_data (Redis 持久化)                 │
└─────────────────────────────────────────────┘
```

- **web**：Nginx 容器，托管前端静态文件，反向代理 `/api/` 和 `/socket.io/` 到后端
- **server**：Node.js 容器，提供 REST API 和 WebSocket 服务
- **db**：PostgreSQL 16 数据库
- **redis**：Redis 7 缓存

## 二、首次部署

### 2.1 服务器要求

- Linux 服务器（推荐 Ubuntu 22.04 / CentOS 8+）
- 最低配置：1 核 1G 内存（两人使用足够）
- 已安装 Docker 和 docker-compose
- 开放相应端口（默认 80）

> **提示**：如果使用 1Panel 管理面板，Docker 已经内置，可以直接在「容器 → Compose」中导入 `docker-compose.yml`。

### 2.2 部署步骤

```bash
# 1. 克隆代码
git clone https://github.com/Kaine665/chat-group.git
cd chat-group

# 2. 创建环境变量文件
cp .env.example .env

# 3. 修改环境变量（重要！）
vi .env
```

`.env` 文件内容：

```bash
# 数据库密码 — 必须修改
DB_PASSWORD=你的强密码

# JWT 密钥 — 必须修改，用于用户 token 加密
# 生成方法：openssl rand -base64 32
JWT_SECRET=一个随机的长字符串

# 前端暴露端口
PORT=9090
```

```bash
# 4. 启动所有服务
docker compose up -d --build

# 5. 查看启动日志
docker compose logs -f
```

首次启动时，`docker-entrypoint.sh` 会自动执行 `prisma migrate deploy`，创建所有数据库表。

### 2.3 验证部署

```bash
# 查看容器状态
docker compose ps

# 应该看到 4 个容器都是 running/healthy 状态
```

访问 `http://你的服务器IP:端口` 即可看到登录页面。

## 三、更新代码

当代码有更新时，按以下步骤在服务器上更新：

### 方法一：本地构建（推荐）

```bash
cd /你的项目目录/chat-group

# 1. 拉取最新代码
git fetch origin main
git checkout -f origin/main -- .

# 2. 重新构建并启动（数据库数据不会丢失）
docker compose up -d --build
```

> **关键点**：`docker compose up -d --build` 只会重建应用容器（server、web），数据库和 Redis 的数据存储在 Docker Volume 中，不会受影响。

### 方法二：使用 GitHub Container Registry 镜像

如果配置了 GitHub Actions CI/CD，镜像会自动推送到 ghcr.io：

```bash
# 1. 拉取最新镜像
docker compose pull

# 2. 重启服务
docker compose up -d
```

需要在 `docker-compose.yml` 中将 `build` 替换为 `image`：

```yaml
server:
  image: ghcr.io/kaine665/chat-group-server:latest
  # build: ./server  # 注释掉

web:
  image: ghcr.io/kaine665/chat-group-web:latest
  # build: ./web  # 注释掉
```

### 更新注意事项

- **数据库迁移自动执行**：后端容器每次启动时，`docker-entrypoint.sh` 会自动运行 `prisma migrate deploy`，新增的表和字段会自动创建
- **数据不会丢失**：PostgreSQL 数据存在 `postgres_data` Docker Volume 中，容器重建不影响数据
- **如果 git pull 报冲突**：使用 `git checkout -f origin/main -- .` 强制覆盖本地文件

## 四、常用运维命令

```bash
# 查看所有容器状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 只看后端日志
docker compose logs -f server

# 重启单个服务
docker compose restart server

# 停止所有服务（数据保留）
docker compose down

# 停止并删除所有数据（慎用！）
docker compose down -v

# 进入数据库终端
docker compose exec db psql -U chatgroup -d chatgroup

# 查看数据库表
docker compose exec db psql -U chatgroup -d chatgroup -c '\dt'
```

## 五、端口说明

| 服务 | 容器内端口 | 对外端口 | 说明 |
|------|-----------|---------|------|
| web (Nginx) | 80 | `${PORT}` (默认 80) | 唯一对外暴露的端口 |
| server (Node.js) | 3000 | 不暴露 | 只通过 Nginx 反向代理访问 |
| db (PostgreSQL) | 5432 | 不暴露 | 只在内部网络可访问 |
| redis | 6379 | 不暴露 | 只在内部网络可访问 |

> **安全性**：只有 Nginx 的端口对外暴露。数据库、Redis、后端都在 Docker 内部网络中，外部无法直接访问。

## 六、使用 1Panel 部署

如果你的服务器安装了 1Panel 管理面板：

1. 登录 1Panel → 容器 → Compose
2. 点击「创建 Compose」
3. 上传 `docker-compose.yml` 文件
4. 在环境变量中填写 `DB_PASSWORD`、`JWT_SECRET`、`PORT`
5. 点击部署

1Panel 会自动管理容器的启停和日志查看。

## 七、HTTPS 配置（可选）

生产环境建议启用 HTTPS。两种方式：

### 方式一：通过 1Panel / 宝塔面板

面板通常提供免费 SSL 证书申请和自动续期，在面板中配置反向代理到 ChatGroup 的端口即可。

### 方式二：手动 Nginx + Let's Encrypt

在服务器上安装 Nginx（容器外），配置反向代理到 ChatGroup 端口：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:9090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 八、故障排查

### 容器启动失败

```bash
# 查看日志定位问题
docker compose logs server
docker compose logs db
```

### 数据库连接失败

确认 db 容器健康：

```bash
docker compose exec db pg_isready -U chatgroup
```

### 前端页面不更新

Docker 有构建缓存，确保使用 `--build` 参数：

```bash
# 如果仍然不更新，清除缓存重建
docker compose build --no-cache
docker compose up -d
```

### WebSocket 连接失败

检查 Nginx 是否正确代理了 `/socket.io/`。如果用了外部反向代理（如 1Panel），需要额外配置 WebSocket 支持：

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:你的端口;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```
