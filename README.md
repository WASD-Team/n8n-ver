# n8n Version Manager

Монорепозиторий с UI и Docker-настройкой для хранения и восстановления версий
workflow n8n. Включает подготовку PostgreSQL с нужными базами и сидом данных.

## Быстрый старт (сервер)

1) Клонируйте репозиторий:

```
git clone https://github.com/altvk88/n8n-ver.git
cd n8n-ver
```

2) Поднимите PostgreSQL и инициализируйте базы/схемы:

```
docker compose up -d
```

Это создаст:
- `app_db` (пользователи, аудит, метаданные)
- `versions_db` (история версий workflow)

И выполнит сид из `test_version.csv`.

3) Настройте переменные окружения для веб-приложения:

```
cd web
cp .env.example .env.local
```

Заполните `DATABASE_URL` (App DB) и параметры n8n (`N8N_BASE_URL`,
`N8N_WEBHOOK_URL`, опционально `N8N_API_KEY`).

4) Установите зависимости и запустите приложение:

```
npm install
npm run dev
```

Откройте `http://localhost:3000`.

## Настройки БД версий в UI

В разделе **Settings** укажите:
- Host: `localhost`
- Port: `5432`
- Database name: `versions_db`
- User: `versions_user`
- Password: `versions_pass`
- SSL mode: `disable`

## Структура репозитория

- `docker-compose.yml` — PostgreSQL с init-скриптами
- `docker/postgres/init/*` — создание БД/схем/сид данных
- `web/` — Next.js приложение
