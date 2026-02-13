# 🚀 Быстрый старт

## Вариант 1: Автоматическая установка (рекомендуется)

### Linux/macOS:
```bash
cd deploy
chmod +x setup.sh
./setup.sh
```

### Windows (PowerShell):
```powershell
cd deploy
.\setup.ps1
```

## Вариант 2: Ручная установка

### 1. Создай .env
```bash
cp .env.example .env
nano .env
```

### 2. Настрой переменные
```env
POSTGRES_PASSWORD=твой_надёжный_пароль
ENCRYPTION_KEY=$(openssl rand -hex 32)
N8N_BASE_URL=https://твой-n8n.example.com
N8N_WEBHOOK_URL=https://твой-n8n.example.com/webhook/версионирование
```

### 3. Залогинься в GHCR
```bash
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u altvk88 --password-stdin
```

### 4. Запусти
```bash
docker compose up -d
```

## Вариант 3: С Make
```bash
make setup  # Первый раз
make up     # Запустить
make logs   # Смотреть логи
make help   # Все команды
```

---

### ✅ Готово!
Открой http://localhost:3000

### 📚 Полная документация
См. [README.md](README.md)
