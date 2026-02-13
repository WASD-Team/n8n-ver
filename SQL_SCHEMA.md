# SQL Schema для n8n Version Manager

Этот документ содержит все SQL запросы для создания структуры базы данных приложения.

## Содержание

- [1. Создание баз данных и пользователей](#1-создание-баз-данных-и-пользователей)
- [2. Схема app_db (основная БД приложения)](#2-схема-app_db-основная-бд-приложения)
- [3. Схема versions_db (БД версий workflow)](#3-схема-versions_db-бд-версий-workflow)

---

## 1. Создание баз данных и пользователей

Создаем две базы данных: `app_db` для приложения и `versions_db` для хранения версий workflow.

```sql
-- Создание базы данных для версий workflow
CREATE DATABASE versions_db;

-- Создание пользователя для доступа к versions_db
CREATE USER versions_user WITH PASSWORD 'versions_pass';
GRANT ALL PRIVILEGES ON DATABASE versions_db TO versions_user;
```

> **Примечание:** База данных `app_db` создается автоматически при инициализации PostgreSQL через переменную `POSTGRES_DB`.

---

## 2. Схема app_db (основная БД приложения)

База данных `app_db` содержит все таблицы для работы сервиса: пользователи, настройки, аудит, метаданные, инстансы и приглашения.

### 2.1. Таблица пользователей (app_users)

Хранит информацию о пользователях системы с ролями и статусами.

```sql
\connect app_db;

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  password_hash TEXT,
  is_superadmin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Поля:**
- `id` - уникальный идентификатор пользователя (UUID)
- `name` - имя пользователя
- `email` - email (уникальный)
- `role` - роль пользователя (`Admin` или `User`)
- `status` - статус (`Active`, `Pending`, `Disabled`)
- `password_hash` - хеш пароля (bcrypt)
- `is_superadmin` - суперадминистратор (доступ ко всем инстансам)
- `created_at` - дата создания

---

### 2.2. Таблица аудит лога (app_audit_log)

Логирует все действия пользователей в системе.

```sql
CREATE TABLE IF NOT EXISTS app_audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  instance_id TEXT,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_app_audit_log_instance_id 
  ON app_audit_log(instance_id);
```

**Поля:**
- `id` - автоинкрементный идентификатор
- `created_at` - время действия
- `actor_email` - email пользователя, выполнившего действие
- `action` - тип действия (`restore`, `prune`, `create`, `update`, `delete` и т.д.)
- `entity_type` - тип сущности (`version`, `user`, `workflow_group` и т.д.)
- `entity_id` - идентификатор сущности
- `instance_id` - идентификатор инстанса
- `details` - дополнительные данные в формате JSON

---

### 2.3. Таблица метаданных версий (workflow_version_metadata)

Хранит дополнительную информацию о версиях workflow (описание, комментарии, теги).

```sql
CREATE TABLE IF NOT EXISTS workflow_version_metadata (
  version_id INTEGER PRIMARY KEY,
  description TEXT,
  comment TEXT,
  tags JSONB,
  instance_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_version_metadata_instance_id 
  ON workflow_version_metadata(instance_id);
```

**Поля:**
- `version_id` - ID версии из таблицы `workflow_versions` в `versions_db`
- `description` - описание версии
- `comment` - комментарий к версии
- `tags` - теги версии (массив строк в JSON)
- `instance_id` - идентификатор инстанса
- `created_at` / `updated_at` - временные метки

---

### 2.4. Таблицы групп workflow (workflow_groups, workflow_group_members)

Группировка workflow для удобной навигации.

```sql
CREATE TABLE IF NOT EXISTS workflow_groups (
  name TEXT PRIMARY KEY,
  instance_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_group_members (
  workflow_id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL REFERENCES workflow_groups(name) ON DELETE CASCADE,
  instance_id TEXT
);

CREATE INDEX IF NOT EXISTS workflow_group_members_group_name_idx
  ON workflow_group_members (group_name);
```

**workflow_groups:**
- `name` - название группы
- `instance_id` - идентификатор инстанса
- `created_at` - дата создания группы

**workflow_group_members:**
- `workflow_id` - ID workflow из n8n
- `group_name` - название группы (foreign key)
- `instance_id` - идентификатор инстанса

---

### 2.5. Таблица настроек (app_settings)

Хранит настройки подключения к `versions_db` и webhook для каждого инстанса.

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Вставка дефолтных настроек для инстанса по умолчанию
INSERT INTO app_settings (key, value) 
VALUES ('default', '{
  "db": {
    "host": "",
    "port": "5432",
    "database": "",
    "user": "",
    "password": "",
    "sslMode": "disable"
  },
  "webhook": {
    "url": "",
    "method": "POST",
    "contentType": "application/json",
    "template": "{\"workflowId\":\"{w_id}\",\"versionId\":\"{id}\",\"versionUuid\":\"{w_version}\",\"name\":\"{w_name}\",\"updatedAt\":\"{w_updatedAt}\",\"json\":{w_json}}"
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

**Поля:**
- `id` - автоинкрементный идентификатор
- `key` - ключ настроек (обычно `instance_id`)
- `value` - JSON объект с настройками БД и webhook
- `updated_at` / `created_at` - временные метки

**Структура JSON в поле value:**
```json
{
  "db": {
    "host": "postgres",
    "port": "5432",
    "database": "versions_db",
    "user": "versions_user",
    "password": "encrypted_password",
    "sslMode": "disable"
  },
  "webhook": {
    "url": "https://n8n.example.com/webhook/restore",
    "method": "POST",
    "contentType": "application/json",
    "template": "..."
  }
}
```

---

### 2.6. Таблицы мультитенантности (instances, user_instance_memberships)

Поддержка нескольких инстансов n8n в одном интерфейсе.

```sql
-- Таблица инстансов
CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

-- Таблица связей пользователей с инстансами (many-to-many)
CREATE TABLE IF NOT EXISTS user_instance_memberships (
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'User')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_user_instance_memberships_user_id 
  ON user_instance_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_instance_memberships_instance_id 
  ON user_instance_memberships(instance_id);

-- Создание инстанса по умолчанию
INSERT INTO instances (id, name, slug, created_at)
VALUES ('default', 'Default Instance', 'default', NOW())
ON CONFLICT (id) DO NOTHING;
```

**instances:**
- `id` - уникальный идентификатор инстанса
- `name` - название инстанса (например, "Production n8n")
- `slug` - URL-friendly название (например, "production")
- `created_at` - дата создания
- `created_by` - ID пользователя, создавшего инстанс

**user_instance_memberships:**
- `user_id` - ID пользователя
- `instance_id` - ID инстанса
- `role` - роль пользователя в инстансе (`Admin` или `User`)
- `created_at` - дата добавления

---

### 2.7. Таблица токенов приглашений (invite_tokens)

Одноразовые токены для приглашения пользователей по email.

```sql
CREATE TABLE IF NOT EXISTS invite_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invite_tokens_user_id_idx ON invite_tokens (user_id);
CREATE INDEX IF NOT EXISTS invite_tokens_expires_at_idx ON invite_tokens (expires_at);
```

**Поля:**
- `token` - уникальный токен (UUID)
- `user_id` - ID пользователя, которого приглашают
- `user_email` - email пользователя
- `expires_at` - время истечения токена (обычно 7 дней)
- `used_at` - время использования токена (NULL если не использован)
- `created_at` - дата создания токена

---

## 3. Схема versions_db (БД версий workflow)

База данных `versions_db` содержит историю всех версий workflow из n8n.

### 3.1. Таблица версий workflow (workflow_versions)

Главная таблица для хранения версий workflow.

```sql
\connect versions_db;

CREATE TABLE IF NOT EXISTS workflow_versions (
  id INTEGER PRIMARY KEY,
  w_name TEXT NOT NULL,
  w_updatedat TIMESTAMPTZ NOT NULL,
  w_json TEXT NOT NULL,
  w_id TEXT NOT NULL,
  w_version TEXT NOT NULL,
  createdat TIMESTAMPTZ NOT NULL,
  updatedat TIMESTAMPTZ NOT NULL
);
```

**Поля:**
- `id` - уникальный идентификатор версии (автоинкрементный)
- `w_name` - название workflow
- `w_updatedat` - дата последнего обновления workflow в n8n
- `w_json` - полное содержимое workflow в формате JSON (структура n8n)
- `w_id` - ID workflow из n8n
- `w_version` - UUID версии workflow из n8n
- `createdat` - дата создания записи версии
- `updatedat` - дата обновления записи версии

**Пример w_json структуры:**
```json
{
  "id": "workflow_id",
  "name": "My Workflow",
  "nodes": [...],
  "connections": {...},
  "settings": {...},
  "staticData": {...}
}
```

---

## Примеры использования

### Получить все версии workflow

```sql
SELECT 
  wv.id,
  wv.w_name,
  wv.w_id,
  wv.w_updatedat,
  wvm.description,
  wvm.tags
FROM workflow_versions wv
LEFT JOIN workflow_version_metadata wvm ON wv.id = wvm.version_id
WHERE wv.w_id = 'workflow_id'
ORDER BY wv.w_updatedat DESC;
```

### Создать нового пользователя с приглашением

```sql
-- 1. Создать пользователя
INSERT INTO app_users (id, name, email, role, status, created_at)
VALUES ('uuid', 'John Doe', 'john@example.com', 'User', 'Pending', NOW());

-- 2. Добавить в инстанс
INSERT INTO user_instance_memberships (user_id, instance_id, role)
VALUES ('uuid', 'default', 'User');

-- 3. Создать токен приглашения
INSERT INTO invite_tokens (token, user_id, user_email, expires_at, created_at)
VALUES ('invite_token_uuid', 'uuid', 'john@example.com', NOW() + INTERVAL '7 days', NOW());
```

### Записать действие в аудит лог

```sql
INSERT INTO app_audit_log (actor_email, action, entity_type, entity_id, instance_id, details)
VALUES (
  'admin@example.com',
  'restore',
  'version',
  '123',
  'default',
  '{"workflow_id": "workflow_123", "version_uuid": "version_uuid"}'::jsonb
);
```

### Создать группу workflow

```sql
-- 1. Создать группу
INSERT INTO workflow_groups (name, instance_id, created_at)
VALUES ('Production Workflows', 'default', NOW());

-- 2. Добавить workflow в группу
INSERT INTO workflow_group_members (workflow_id, group_name, instance_id)
VALUES ('workflow_id_1', 'Production Workflows', 'default');
```

---

## Миграция данных

При обновлении системы с добавлением мультитенантности используйте эти запросы для миграции:

```sql
-- Убедиться что инстанс по умолчанию существует
INSERT INTO instances (id, name, slug, created_at)
VALUES ('default', 'Default Instance', 'default', NOW())
ON CONFLICT (id) DO NOTHING;

-- Мигрировать настройки
UPDATE app_settings SET key = 'default' WHERE key = 'main';

-- Мигрировать метаданные
UPDATE workflow_version_metadata SET instance_id = 'default' WHERE instance_id IS NULL;

-- Мигрировать аудит лог
UPDATE app_audit_log SET instance_id = 'default' WHERE instance_id IS NULL;

-- Мигрировать группы workflow
UPDATE workflow_groups SET instance_id = 'default' WHERE instance_id IS NULL;
UPDATE workflow_group_members SET instance_id = 'default' WHERE instance_id IS NULL;

-- Сделать первого админа суперадмином
UPDATE app_users SET is_superadmin = TRUE 
WHERE id = (SELECT id FROM app_users WHERE role = 'Admin' ORDER BY created_at ASC LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM app_users WHERE is_superadmin = TRUE);

-- Добавить существующих пользователей в инстанс по умолчанию
INSERT INTO user_instance_memberships (user_id, instance_id, role)
SELECT id, 'default', role FROM app_users
WHERE NOT EXISTS (
  SELECT 1 FROM user_instance_memberships 
  WHERE user_id = app_users.id AND instance_id = 'default'
)
ON CONFLICT DO NOTHING;
```

---

## Очистка данных

### Удалить истёкшие токены приглашений

```sql
DELETE FROM invite_tokens 
WHERE expires_at < NOW() AND used_at IS NULL;
```

### Удалить старые версии workflow (pruning)

```sql
-- Удалить версии старше определённой даты
DELETE FROM workflow_versions 
WHERE w_id = 'workflow_id' 
  AND w_updatedat < '2024-01-01'::timestamptz;

-- Удалить метаданные удалённых версий
DELETE FROM workflow_version_metadata 
WHERE version_id NOT IN (SELECT id FROM workflow_versions);
```

### Очистить старые записи аудит лога

```sql
-- Удалить записи старше 1 года
DELETE FROM app_audit_log 
WHERE created_at < NOW() - INTERVAL '1 year';
```

---

## Дополнительная информация

- Все таблицы используют `TIMESTAMPTZ` для хранения времени с timezone
- Пароли в `app_users` хешируются через bcrypt
- Пароли в `app_settings` шифруются через AES-256-GCM с помощью `ENCRYPTION_KEY`
- Аудит лог использует `BIGSERIAL` для поддержки большого количества записей
- `workflow_versions.w_json` содержит полную структуру workflow для восстановления

---

## См. также

- [README.md](README.md) - Общая документация проекта
- [deploy/README.md](deploy/README.md) - Инструкция по деплою
- [deploy/ARCHITECTURE.md](deploy/ARCHITECTURE.md) - Архитектура системы
