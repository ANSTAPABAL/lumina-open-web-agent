#!/bin/bash

# Ensure script halts on any errors
set -e

echo "🚀 Building and starting Lumina Chat in Docker..."

# Check if docker command is available
if ! command -v docker &> /dev/null; then
    echo "❌ Ошибка: Docker не установлен на вашем компьютере. Пожалуйста, установите Docker и попробуйте снова."
    exit 1
fi

# Run docker compose in detached mode
docker compose up -d --build

echo "✅ Lumina Chat успешно запущен в контейнере!"
echo "👉 Откройте интерфейс в браузере: http://localhost:8000"
