#!/bin/sh
# 后端容器启动脚本
#
# 每次启动时自动执行数据库迁移（prisma migrate deploy）
# 这样部署新版本时，数据库结构会自动更新，不需要手动操作

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
node dist/app.js
