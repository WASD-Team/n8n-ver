.PHONY: help setup up down restart logs status clean backup pull update

help: ## Показать эту справку
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup: ## Быстрая установка с автоматической настройкой
	@./setup.sh

up: ## Запустить все сервисы
	docker compose up -d

down: ## Остановить все сервисы
	docker compose down

restart: ## Перезапустить все сервисы
	docker compose restart

restart-web: ## Перезапустить только web
	docker compose restart web

logs: ## Показать логи всех сервисов
	docker compose logs -f

logs-web: ## Показать логи web
	docker compose logs -f web

logs-db: ## Показать логи PostgreSQL
	docker compose logs -f postgres

status: ## Показать статус сервисов
	docker compose ps

health: ## Проверить healthcheck
	@curl -s http://localhost:3000/api/debug | jq . || echo "Сервис недоступен"

pull: ## Скачать последние образы
	docker compose pull

update: pull ## Обновить до последней версии
	docker compose up -d web
	@echo "Ожидание готовности..."
	@sleep 5
	@docker compose logs --tail=50 web

clean: ## Остановить и удалить все данные (ОПАСНО!)
	@echo "ВНИМАНИЕ: Это удалит все данные из базы!"
	@read -p "Продолжить? (yes/no): " confirm && [ "$$confirm" = "yes" ] || exit 1
	docker compose down -v

backup: ## Создать резервную копию базы данных
	@mkdir -p backups
	docker compose exec postgres pg_dumpall -U app_user | gzip > backups/backup_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Backup создан: backups/backup_$$(date +%Y%m%d_%H%M%S).sql.gz"

restore: ## Восстановить из последней резервной копии
	@LATEST=$$(ls -t backups/*.sql.gz | head -1); \
	echo "Восстановление из $$LATEST..."; \
	gunzip -c $$LATEST | docker compose exec -T postgres psql -U app_user

shell-db: ## Подключиться к PostgreSQL
	docker compose exec postgres psql -U app_user -d app_db

shell-web: ## Подключиться к контейнеру web
	docker compose exec web sh

build: ## Собрать образ локально (для разработки)
	docker build -t ghcr.io/altvk88/n8n-ver-web:latest -f ../Dockerfile ..

dev-local: ## Запустить с локальным образом
	IMAGE_TAG=latest docker compose up -d
