# n8n Version Manager - Быстрая установка (Windows)

Write-Host "=== n8n Version Manager - Быстрая установка ===" -ForegroundColor Green
Write-Host ""

# Проверка Docker
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker установлен: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker не установлен" -ForegroundColor Red
    Write-Host "Установи Docker Desktop: https://docs.docker.com/desktop/install/windows-install/"
    exit 1
}

# Проверка Docker Compose
try {
    $composeVersion = docker compose version
    Write-Host "✓ Docker Compose установлен: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose не установлен" -ForegroundColor Red
    exit 1
}

# Проверка .env файла
if (-not (Test-Path .env)) {
    Write-Host "⚠ Файл .env не найден, создаю из примера..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    
    # Генерация случайного ключа шифрования
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    $encryptionKey = [BitConverter]::ToString($bytes).Replace('-', '').ToLower()
    
    # Замена в .env
    (Get-Content .env) -replace 'change_me_to_random_32_chars_minimum_for_encryption_security', $encryptionKey | Set-Content .env
    
    Write-Host "✓ Создан файл .env с сгенерированным ключом шифрования" -ForegroundColor Green
    Write-Host "⚠ ВАЖНО: Отредактируй .env и укажи:" -ForegroundColor Yellow
    Write-Host "  - POSTGRES_PASSWORD (пароль БД)"
    Write-Host "  - N8N_BASE_URL (адрес твоего n8n)"
    Write-Host "  - N8N_WEBHOOK_URL (webhook для уведомлений)"
    Write-Host ""
    Read-Host "Нажми Enter когда отредактируешь .env"
}

Write-Host "✓ Файл .env найден" -ForegroundColor Green

# Проверка аутентификации в GHCR
Write-Host ""
Write-Host "Проверка доступа к GitHub Container Registry..." -ForegroundColor Yellow

$pullResult = docker pull ghcr.io/altvk88/n8n-ver-web:latest 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Требуется аутентификация в GHCR" -ForegroundColor Yellow
    Write-Host "Получи Personal Access Token на: https://github.com/settings/tokens"
    Write-Host "Права: read:packages"
    
    $githubUser = Read-Host "GitHub username"
    $githubToken = Read-Host "GitHub Personal Access Token" -AsSecureString
    $tokenPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($githubToken)
    )
    
    $tokenPlain | docker login ghcr.io -u $githubUser --password-stdin
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Не удалось войти в GHCR" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✓ Доступ к образам подтверждён" -ForegroundColor Green

# Запуск контейнеров
Write-Host ""
Write-Host "Запуск сервисов..." -ForegroundColor Green

docker compose pull
docker compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Сервисы успешно запущены!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Приложение доступно по адресу: http://localhost:3000" -ForegroundColor Green
    Write-Host ""
    Write-Host "Полезные команды:" -ForegroundColor Yellow
    Write-Host "  docker compose logs -f web    # Смотреть логи"
    Write-Host "  docker compose ps             # Статус сервисов"
    Write-Host "  docker compose down           # Остановить"
    Write-Host "  docker compose restart web    # Перезапустить"
    Write-Host ""
    
    # Ждём готовности
    Write-Host "Ожидание готовности сервисов..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Проверка healthcheck
    for ($i = 1; $i -le 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/api/debug" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                Write-Host ""
                Write-Host "✓ Приложение готово к работе!" -ForegroundColor Green
                break
            }
        } catch {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 2
        }
    }
    Write-Host ""
} else {
    Write-Host "❌ Ошибка при запуске сервисов" -ForegroundColor Red
    Write-Host "Проверь логи: docker compose logs"
    exit 1
}
