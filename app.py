"""
Entrada do site publicado no Vercel, que procura um `app` do FastAPI num app.py na raiz.

O servidor de verdade é o prototipo/servidor.py; para rodar no PC, use ./treinar.sh.
"""

from prototipo.servidor import app  # noqa: F401
