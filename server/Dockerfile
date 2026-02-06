# ============================================================
# 后端 Docker 镜像 — 多阶段构建
#
# 【什么是多阶段构建？】
# 第一阶段（builder）：安装依赖、编译 TypeScript → 生成 JS 文件
# 第二阶段（production）：只复制编译后的 JS + 生产依赖 → 最终镜像更小
#
# 这样最终镜像里不包含 TypeScript、开发工具等，体积可以减少 50%+
# ============================================================

# ---------- 第一阶段：编译 ----------
FROM node:22-alpine AS builder

WORKDIR /app

# 先复制依赖文件（利用 Docker 缓存，依赖没变就不重新装）
COPY package.json package-lock.json ./
RUN npm ci

# 复制源代码并编译
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# 生成 Prisma Client（生成数据库操作的类型安全代码）
RUN npx prisma generate

# 编译 TypeScript → JavaScript
RUN npx tsc

# ---------- 第二阶段：生产镜像 ----------
FROM node:22-alpine

WORKDIR /app

# 只安装生产依赖（不装 TypeScript 等开发工具）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 从 builder 阶段复制编译后的代码
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# 启动脚本：先跑数据库迁移，再启动服务器
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
