# n8n Version Manager - Production Deployment

Полный стек для запуска n8n Version Manager с PostgreSQL одной командой.

## Что включено

- **PostgreSQL 16** - база данных с автоматической инициализацией схем
- **Web приложение** - Docker образ из GitHub Container Registry
- **Volumes** - персистентное хранилище данных

## Быстрый старт

### 1. Настройка окружения

```bash
# Скопируй .env.example в .env
cp .env.example .env

# Отредактируй .env и заполни обязательные переменные:
nano .env
```

**Обязательные переменные:**

```env
# Смени пароль PostgreSQL
POSTGRES_PASSWORD=твой_надёжный_пароль

# Сгенерируй ключ шифрования (минимум 32 символа)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Настрой интеграцию с n8n
N8N_BASE_URL=https://твой-n8n.example.com
N8N_WEBHOOK_URL=https://твой-n8n.example.com/webhook/версионирование
```

### 2. Аутентификация в GHCR (первый раз)

```bash
# Создай Personal Access Token на GitHub с правами read:packages
# https://github.com/settings/tokens

# Залогинься в GitHub Container Registry
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u altvk88 --password-stdin
```

### 3. Запуск

```bash
# Запусти все сервисы
docker compose up -d

# Проверь статус
docker compose ps

# Посмотри логи
docker compose logs -f web
```

Приложение будет доступно по адресу: http://localhost:3000

### 4. Первый вход

После запуска приложение автоматически создаст дефолтного пользователя при первом посещении страницы `/login`.

## Управление

### Обновление до последней версии

```bash
# Скачай новый образ
docker compose pull web

# Перезапусти сервис
docker compose up -d web
```

### Просмотр логов

```bash
# Все сервисы
docker compose logs -f

# Только web
docker compose logs -f web

# Только postgres
docker compose logs -f postgres
```

### Остановка и запуск

```bash
# Остановить все сервисы
docker compose down

# Остановить с удалением volumes (УДАЛИТ ДАННЫЕ!)
docker compose down -v

# Запустить снова
docker compose up -d
```

### Проверка здоровья

```bash
# API healthcheck
curl http://localhost:3000/api/debug

# PostgreSQL
docker compose exec postgres pg_isready -U app_user
```

### Резервное копирование

```bash
# Создать бэкап базы данных
docker compose exec postgres pg_dumpall -U app_user > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из бэкапа
docker compose exec -T postgres psql -U app_user < backup.sql
```

## Структура данных

PostgreSQL создаёт две базы данных:

1. **app_db** - основная база приложения
   - Пользователи и аутентификация
   - Настройки системы
   - Аудит лог
   - Метаданные версий workflow
   - Группы workflow
   - Instances (мультитенантность)
   - Invite tokens

2. **versions_db** - база данных версий workflow
   - История изменений workflow из n8n

## Переменные окружения

| Переменная | Обязательная | По умолчанию | Описание |
|-----------|--------------|--------------|----------|
| `POSTGRES_USER` | Нет | `app_user` | Пользователь PostgreSQL |
| `POSTGRES_PASSWORD` | **Да** | - | Пароль PostgreSQL |
| `POSTGRES_PORT` | Нет | `5432` | Порт PostgreSQL |
| `ENCRYPTION_KEY` | **Да** | - | Ключ шифрования (мин. 32 символа) |
| `N8N_BASE_URL` | Нет | - | Базовый URL n8n инстанса |
| `N8N_WEBHOOK_URL` | Нет | - | URL webhook для уведомлений |
| `N8N_API_KEY` | Нет | - | API ключ n8n (если нужен) |
| `WEB_PORT` | Нет | `3000` | Порт веб-приложения |

## Настройка базы версий (versions_db)

После первого запуска зайди в **Settings** и настрой подключение к базе versions_db:

- **Host:** `postgres`
- **Port:** `5432`
- **Database:** `versions_db`
- **User:** `versions_user`
- **Password:** `versions_pass`
- **SSL Mode:** `disable`

## Продакшен рекомендации

### 1. Обратный прокси (Nginx)

```nginx
server {
    listen 80;
    server_name versions.yourdomain.com;
    
    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name versions.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Автоматические бэкапы

Добавь в crontab:

```bash
# Ежедневный бэкап в 3:00
0 3 * * * cd /path/to/deploy && docker compose exec postgres pg_dumpall -U app_user | gzip > /backups/n8n-versions_$(date +\%Y\%m\%d).sql.gz
```

### 3. Мониторинг

Используй healthcheck endpoints:
- Web: `http://localhost:3000/api/debug`
- PostgreSQL: встроенный healthcheck в docker-compose

### 4. Логирование

Настрой ротацию логов Docker:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### 5. Безопасность

- Используй сильные пароли для `POSTGRES_PASSWORD`
- Сгенерируй случайный `ENCRYPTION_KEY`
- Не публикуй `.env` файл в git
- Ограничь доступ к портам через firewall
- Используй HTTPS в продакшене

## Troubleshooting

### Проблема: Web не запускается

```bash
# Проверь логи
docker compose logs web

# Проверь подключение к БД
docker compose exec postgres psql -U app_user -d app_db -c "SELECT 1"
```

### Проблема: "permission denied" при создании volumes

```bash
# Убедись что пользователь в группе docker
sudo usermod -aG docker $USER

# Выйди и зайди снова
```

### Проблема: Не удаётся скачать образ

```bash
# Проверь аутентификацию
docker login ghcr.io

# Проверь доступность образа
docker pull ghcr.io/altvk88/n8n-ver-web:latest
```

### Проблема: База данных не инициализируется

```bash
# Удали volume и создай заново
docker compose down -v
docker compose up -d
```

## Дополнительная информация

- Репозиторий: https://github.com/altvk88/n8n-ver
- Docker образ: ghcr.io/altvk88/n8n-ver-web:latest
- CI/CD: GitHub Actions автоматически собирает образ при push в `auto-deploy` ветку
