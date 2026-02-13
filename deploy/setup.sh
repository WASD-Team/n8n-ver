#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== n8n Version Manager - Быстрая установка ===${NC}\n"

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker не установлен${NC}"
    echo "Установи Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose не установлен${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker установлен${NC}"

# Проверка .env файла
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ Файл .env не найден, создаю из примера...${NC}"
    cp .env.example .env
    
    # Генерация случайного ключа шифрования
    ENCRYPTION_KEY=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    
    # Замена в .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/change_me_to_random_32_chars_minimum_for_encryption_security/$ENCRYPTION_KEY/" .env
    else
        # Linux
        sed -i "s/change_me_to_random_32_chars_minimum_for_encryption_security/$ENCRYPTION_KEY/" .env
    fi
    
    echo -e "${GREEN}✓ Создан файл .env с сгенерированным ключом шифрования${NC}"
    echo -e "${YELLOW}⚠ ВАЖНО: Отредактируй .env и укажи:${NC}"
    echo "  - POSTGRES_PASSWORD (пароль БД)"
    echo "  - N8N_BASE_URL (адрес твоего n8n)"
    echo "  - N8N_WEBHOOK_URL (webhook для уведомлений)"
    echo ""
    read -p "Нажми Enter когда отредактируешь .env..."
fi

echo -e "${GREEN}✓ Файл .env найден${NC}"

# Проверка аутентификации в GHCR
echo -e "\n${YELLOW}Проверка доступа к GitHub Container Registry...${NC}"
if ! docker pull ghcr.io/altvk88/n8n-ver-web:latest &>/dev/null; then
    echo -e "${YELLOW}⚠ Требуется аутентификация в GHCR${NC}"
    echo "Получи Personal Access Token на: https://github.com/settings/tokens"
    echo "Права: read:packages"
    read -p "GitHub username: " GITHUB_USER
    read -sp "GitHub Personal Access Token: " GITHUB_TOKEN
    echo ""
    
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Не удалось войти в GHCR${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Доступ к образам подтверждён${NC}"

# Запуск контейнеров
echo -e "\n${GREEN}Запуск сервисов...${NC}"
docker compose pull
docker compose up -d

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Сервисы успешно запущены!${NC}"
    echo -e "\n${GREEN}Приложение доступно по адресу: http://localhost:3000${NC}"
    echo -e "\n${YELLOW}Полезные команды:${NC}"
    echo "  docker compose logs -f web    # Смотреть логи"
    echo "  docker compose ps             # Статус сервисов"
    echo "  docker compose down           # Остановить"
    echo "  docker compose restart web    # Перезапустить"
    echo ""
    
    # Ждём готовности
    echo -e "${YELLOW}Ожидание готовности сервисов...${NC}"
    sleep 5
    
    # Проверка healthcheck
    for i in {1..30}; do
        if curl -s http://localhost:3000/api/debug > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Приложение готово к работе!${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""
else
    echo -e "${RED}❌ Ошибка при запуске сервисов${NC}"
    echo "Проверь логи: docker compose logs"
    exit 1
fi
