#!/bin/bash

# Ensure script halts on any errors
set -e

echo "🛑 Останавливаем Lumina Chat..."

if ! command -v docker &> /dev/null; then
    echo "❌ Ошибка: Docker не установлен."
    exit 1
fi

docker compose down

echo "✅ Lumina Chat успешно остановлен."
