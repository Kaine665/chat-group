# ============================================================
# Makefile — 快捷命令
#
# 用法：make <命令>
# 例如：make dev-up    启动开发环境
#       make prod-up   启动生产环境
# ============================================================

# ==================== 开发环境 ====================

dev-up:
	docker compose -f docker-compose.dev.yml --env-file .env.development up -d

dev-up-build:
	docker compose -f docker-compose.dev.yml --env-file .env.development up -d --build

dev-down:
	docker compose -f docker-compose.dev.yml --env-file .env.development down

dev-logs:
	docker compose -f docker-compose.dev.yml --env-file .env.development logs -f

dev-ps:
	docker compose -f docker-compose.dev.yml --env-file .env.development ps

# 重置开发数据库（删除所有数据重新开始）
dev-db-reset:
	docker compose -f docker-compose.dev.yml --env-file .env.development down -v
	docker compose -f docker-compose.dev.yml --env-file .env.development up -d

# ==================== 生产环境 ====================

prod-up:
	docker compose up -d

prod-up-build:
	docker compose up -d --build

prod-down:
	docker compose down

prod-logs:
	docker compose logs -f

prod-ps:
	docker compose ps

# ==================== 通用 ====================

# 同时查看所有环境状态
status:
	@echo "===== 生产环境 ====="
	@docker compose ps 2>/dev/null || echo "(未运行)"
	@echo ""
	@echo "===== 开发环境 ====="
	@docker compose -f docker-compose.dev.yml ps 2>/dev/null || echo "(未运行)"

.PHONY: dev-up dev-up-build dev-down dev-logs dev-ps dev-db-reset \
        prod-up prod-up-build prod-down prod-logs prod-ps status
