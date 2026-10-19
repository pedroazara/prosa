#!/usr/bin/env bash
# Abre o PROSA para treinar, com um comando só (Git Bash, na raiz do projeto):
#     ./treinar.sh
#
# Na primeira vez, cria o ambiente virtual (.venv) e instala as dependências do Python e do site.
# Depois, só reinstala o que mudou e só compila o site quando um arquivo dele mudou.
# Então sobe o servidor e abre o navegador. Ctrl+C para parar.

set -euo pipefail
cd "$(dirname "$0")"
WEB=prototipo/web

if [ ! -f .env ]; then
  echo "Falta o arquivo .env: copie o .env.example para .env e coloque a sua chave do LLM (ver README)."
  exit 1
fi

# Python: o Windows guarda o do ambiente virtual em Scripts/; macOS e Linux, em bin/.
if [ ! -d .venv ]; then
  echo "Criando o ambiente virtual em .venv (só na primeira vez)..."
  if command -v py > /dev/null; then py -m venv .venv; else python3 -m venv .venv; fi
fi
if [ -d .venv/Scripts ]; then PYTHON=.venv/Scripts/python; else PYTHON=.venv/bin/python; fi

# A marca registra quando as dependências foram instaladas: se um dos requirements mudou depois, reinstala.
if [ requirements.txt -nt .venv/.dependencias-instaladas ] || [ requirements-local.txt -nt .venv/.dependencias-instaladas ]; then
  echo "Instalando as dependências do Python..."
  "$PYTHON" -m pip install -q -r requirements-local.txt
  touch .venv/.dependencias-instaladas
fi

# O npm grava node_modules/.package-lock.json a cada instalação: serve de marca do mesmo jeito.
if [ "$WEB/package-lock.json" -nt "$WEB/node_modules/.package-lock.json" ]; then
  echo "Instalando as dependências do site..."
  (cd "$WEB" && npm install)
fi

# Compila o site se ele ainda não existe ou se algum arquivo dele mudou depois da última compilação.
if [ ! -f "$WEB/dist/index.html" ] || [ -n "$(find "$WEB/src" "$WEB/public" "$WEB/index.html" \
    "$WEB/package.json" "$WEB/vite.config.ts" -newer "$WEB/dist/index.html" -print -quit)" ]; then
  echo "Compilando o site..."
  (cd "$WEB" && npm run build)
fi

# -u e UTF-8: as mensagens do servidor aparecem na hora e com acentos certos no Git Bash.
PYTHONUTF8=1 exec "$PYTHON" -u prototipo/servidor.py --treino
