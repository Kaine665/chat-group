# ============================================================
# 前端 Docker 镜像 — 编译 + Nginx 静态托管
#
# 【思路】
# React 应用打包后就是一堆静态文件（HTML/CSS/JS）。
# 用 Nginx 来托管这些文件，同时反向代理 /api 和 /socket.io 到后端。
#
# 【什么是 Nginx？】
# 一个高性能的 Web 服务器。在这里它做两件事：
# 1. 托管前端静态文件（HTML/CSS/JS）
# 2. 反向代理：把 /api 请求转发到后端容器
# ============================================================

# ---------- 第一阶段：编译前端 ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- 第二阶段：Nginx 托管 ----------
FROM nginx:alpine

# 复制编译后的静态文件到 Nginx 默认目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
