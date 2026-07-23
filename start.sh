#!/bin/bash
set -e

# CodeXhange — One-command startup
# Usage: bash start.sh
# Installs deps, seeds DB, starts site + bot

echo "===== CodeXhange Setup ====="
echo ""

# 1. Check environment
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Edit .env with your MONGODB_URI, API keys, etc."
    exit 1
  else
    echo "ERROR: No .env file found. Create one with MONGODB_URI and other settings."
    exit 1
  fi
fi

# 2. Install Node dependencies
echo "[1/5] Installing Node dependencies..."
npm install --production 2>/dev/null || npm install

# 3. Install Python dependencies
echo "[2/5] Setting up Python environment..."
if [ ! -d bot/venv ]; then
  python3 -m venv bot/venv
fi
bot/venv/bin/pip install -r bot/requirements.txt -q 2>/dev/null || true

# Install additional deps
bot/venv/bin/pip install colorama fake_useragent cloudscraper playwright-stealth -q 2>/dev/null || true

# Install Playwright browser
echo "[3/5] Installing Playwright browser..."
bot/venv/bin/playwright install chromium 2>/dev/null || true

# 4. Build Next.js
echo "[4/5] Building Next.js app..."
npx next build 2>/dev/null || echo "Build skipped — continuing..."

# 5. Start everything
echo "[5/5] Starting services..."
echo ""

# Start Next.js in background
echo "Starting Next.js on port 3000..."
nohup npx next start --port 3000 > /tmp/codexhange_server.log 2>&1 &
SERVER_PID=$!
echo "  Server PID: $SERVER_PID"

# Wait for server
sleep 5

# Seed brands and categories
echo "Seeding database..."
curl -s -X POST http://127.0.0.1:3000/api/admin/brands/seed --max-time 300 > /dev/null 2>&1 || echo "  Seed skipped (already seeded)"

# Start bot scan in background
echo "Starting bot scanner..."
cd bot
nohup /root/codexhange/bot/venv/bin/python -u scan_all.py > /var/log/codexhange_bot.log 2>&1 &
BOT_PID=$!
echo "  Bot PID: $BOT_PID"
cd ..

echo ""
echo "===== CodeXhange is running ====="
echo "  Site: http://localhost:3000"
echo "  Admin: http://localhost:3000/admin"
echo "  Server log: /tmp/codexhange_server.log"
echo "  Bot log: /var/log/codexhange_bot.log"
echo ""
echo "To stop: kill $SERVER_PID $BOT_PID"
