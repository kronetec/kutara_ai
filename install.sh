#!/usr/bin/env bash
#
# Kutara AI - One-line Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/kronetec/kutara_ai/main/install.sh | bash
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

KUTARA_DIR="/opt/kutara-ai"
REPO_URL="https://github.com/kronetec/kutara_ai.git"
BRANCH="main"

# Banner
echo ""
echo "  _  __        _    "
echo " | |/ /_ _ _ _| |_  "
echo " | ' <| '_| '_|  _| "
echo " |_|\_|_| |_|  \__| "
echo " Kutara AI Installer"
echo ""

# Root check
if [ "$(id -u)" != "0" ]; then error "Root required. Run: sudo bash install.sh"; exit 1; fi
info "Root OK"

# OS detection
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [ "$ID" != "ubuntu" ] && [ "$ID" != "debian" ]; then
    warn "Only Ubuntu/Debian tested. Continuing anyway..."
  fi
else
  warn "Cannot detect OS. Continuing..."
fi

# Dependencies
info "Checking dependencies..."
for cmd in docker curl git node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    MISSING="$MISSING $cmd"
  fi
done

if [ -n "${MISSING:-}" ]; then
  warn "Installing missing: $MISSING"
  apt update -qq && apt install -y -qq docker.io curl git nodejs npm 2>/dev/null
fi
info "Dependencies OK"

# PostgreSQL check
PG_HBA=$(find /etc/postgresql -name pg_hba.conf 2>/dev/null | head -1)
if [ -z "$PG_HBA" ]; then
  warn "PostgreSQL not found. Installing..."
  apt install -y -qq postgresql postgresql-client 2>/dev/null
  PG_HBA=$(find /etc/postgresql -name pg_hba.conf | head -1)
fi

info "Configuring PostgreSQL..."
cp "$PG_HBA" "${PG_HBA}.bak.$(date +%s)"
cat > "$PG_HBA" << PGHBA
local   all             postgres                                peer
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
host    all             all             0.0.0.0/0               reject
PGHBA
systemctl restart postgresql 2>/dev/null || pg_ctlcluster 14 main restart 2>/dev/null || true

# Create user and database
sudo -u postgres psql << SQL 2>/dev/null || true
CREATE USER kutara WITH PASSWORD 'Kutara2014!';
CREATE DATABASE kutara OWNER kutara;
GRANT ALL ON DATABASE kutara TO kutara;
\c kutara
GRANT ALL ON SCHEMA public TO kutara;
SQL
info "PostgreSQL OK"

# Docker: Ollama
info "Starting Ollama..."
docker kill kutara-ollama 2>/dev/null || true
docker rm kutara-ollama 2>/dev/null || true
docker run -d --name kutara-ollama --restart unless-stopped \
  -p 127.0.0.1:11434:11434 \
  -v kutara-ollama-data:/root/.ollama \
  ollama/ollama 2>/dev/null
info "Ollama started"

# Clone or update repo
if [ -d "$KUTARA_DIR/.git" ]; then
  warn "Existing installation found. Backing up..."
  BACKUP_DIR="/root/kutara-backup-$(date +%s)"
  cp -a "$KUTARA_DIR" "$BACKUP_DIR"
  info "Backup: $BACKUP_DIR"
  cd "$KUTARA_DIR" && git pull origin "$BRANCH" 2>/dev/null || true
else
  rm -rf "$KUTARA_DIR"
  git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$KUTARA_DIR"
fi
info "Code updated"

# .env
if [ ! -f "$KUTARA_DIR/.env" ]; then
  cat > "$KUTARA_DIR/.env" << ENVEOF
PROJECT_NAME=kutara-ai
NODE_ENV=production
MAIN_DOMAIN=kutara.org
APP_DOMAIN=app.kutara.org
API_DOMAIN=api.kutara.org
DATABASE_URL=postgresql://kutara:Kutara2014!@127.0.0.1:5432/kutara
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=kutara-jwt-$(date +%s | sha256sum | head -c 32)
JWT_REFRESH_SECRET=kutara-ref-$(date +%s | sha256sum | head -c 32)
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_FREE_MODEL=llama3.1:8b
OLLAMA_BASIC_MODEL=llama3.1:70b
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
ADMIN_EMAIL=admin@kutara.org
ADMIN_PASSWORD=Kutara2014!
ENVEOF
  info ".env created"
else
  info ".env exists"
fi

# npm install
cd "$KUTARA_DIR/services/api"
npm install --production 2>/dev/null
info "npm dependencies installed"

# Migration
node src/lib/migrate.js 2>/dev/null && info "Database migrated" || warn "Migration failed (may already be migrated)"

# Ollama model
info "Downloading AI model (llama3.1:8b)..."
docker exec kutara-ollama ollama pull llama3.1:8b 2>/dev/null &
info "Model downloading in background (may take a few minutes)"

# Systemd service
cat > /etc/systemd/system/kutara-api.service << SERVICEEOF
[Unit]
Description=Kutara AI API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$KUTARA_DIR/services/api
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable kutara-api 2>/dev/null
systemctl restart kutara-api 2>/dev/null
info "API service started"

# Wait for API
sleep 2
if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
  info "API is running on http://localhost:8080"
else
  warn "Waiting for API..."
  sleep 5
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
    info "API is running"
  else
    error "API failed to start. Check: journalctl -u kutara-api -n 20"
  fi
fi

# Test
echo ""
echo "============================================"
echo "  Kutara AI v2 Installation Complete!"
echo "============================================"
echo ""
echo "  API:      http://localhost:8080"
echo "  Health:   http://localhost:8080/api/health"
echo "  Register: curl -X POST http://localhost:8080/api/auth/register \\"
echo "              -H 'Content-Type: application/json' \\"
echo "              -d '{\"email\":\"user@example.com\",\"password\":\"pass123\"}'"
echo ""
echo "  GitHub:   https://github.com/kronetec/kutara_ai"
echo "  Docs:     https://kutara.org"
echo ""
