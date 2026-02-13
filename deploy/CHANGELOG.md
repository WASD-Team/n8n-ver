# Changelog - Deploy Package

## 2026-02-03 - Полный деплой-пакет

### Добавлено

#### Основные файлы
- `docker-compose.yml` - полный стек с PostgreSQL и веб-приложением
- `.env.example` - шаблон конфигурации с переменными окружения
- `.gitignore` - исключение приватных данных

#### Документация
- `README.md` - полное руководство по деплою и эксплуатации
- `QUICKSTART.md` - быстрый старт в 3 варианта
- `ARCHITECTURE.md` - схема архитектуры и потоков данных

#### Скрипты автоматизации
- `setup.sh` - автоматическая установка для Linux/macOS
- `setup.ps1` - автоматическая установка для Windows
- `Makefile` - удобные команды для управления (make up, make logs, и т.д.)

#### База данных
- `init/01-create-databases.sql` - создание БД и пользователей
- `init/02-app-schema.sql` - схема основной БД приложения
- `init/03-versions-schema.sql` - схема БД версий workflow
- `init/04-seed-versions.sql` - начальные данные
- `init/04-settings-schema.sql` - схема настроек
- `init/05-instances-schema.sql` - схема мультитенантности
- `init/06-invite-tokens-schema.sql` - схема инвайт-токенов

### Особенности

#### Docker Compose
- PostgreSQL 16 Alpine с автоматической инициализацией
- Web контейнер с образа из GHCR
- Healthchecks для обоих сервисов
- Зависимости между сервисами (web ждёт готовности postgres)
- Персистентный volume для данных PostgreSQL
- Настраиваемые порты через .env

#### Переменные окружения
- `POSTGRES_USER` - пользователь БД (по умолчанию: app_user)
- `POSTGRES_PASSWORD` - пароль БД (обязательный)
- `POSTGRES_PORT` - порт PostgreSQL (по умолчанию: 5432)
- `ENCRYPTION_KEY` - ключ шифрования (обязательный, мин 32 символа)
- `N8N_BASE_URL` - базовый URL n8n инстанса
- `N8N_WEBHOOK_URL` - URL webhook для уведомлений
- `N8N_API_KEY` - API ключ n8n
- `WEB_PORT` - порт веб-приложения (по умолчанию: 3000)

#### Автоматизация
- Генерация случайного ENCRYPTION_KEY в скриптах
- Проверка установки Docker
- Автоматический логин в GHCR
- Ожидание готовности сервисов
- Проверка healthcheck

#### Управление
- `make help` - список всех команд
- `make up` - запуск
- `make down` - остановка
- `make logs` - просмотр логов
- `make backup` - резервное копирование БД
- `make restore` - восстановление из бэкапа
- `make update` - обновление до последней версии

### Использование

#### Быстрый старт
```bash
cd deploy
./setup.sh  # или setup.ps1 на Windows
```

#### Ручной запуск
```bash
cd deploy
cp .env.example .env
# отредактируй .env
docker compose up -d
```

#### С Make
```bash
cd deploy
make setup
```

### Требования

- Docker 20.10+
- Docker Compose v2
- 512MB RAM минимум
- 1GB свободного места на диске

### Безопасность

- Все пароли в .env (не в git)
- Автоматическая генерация ENCRYPTION_KEY
- Изоляция сети Docker
- Healthchecks для мониторинга
- Read-only mount для SQL скриптов

### Roadmap

- [ ] Добавить Traefik для автоматического HTTPS
- [ ] Prometheus метрики
- [ ] Grafana дашборд
- [ ] Автоматические бэкапы через cron
- [ ] Docker Swarm/Kubernetes манифесты
