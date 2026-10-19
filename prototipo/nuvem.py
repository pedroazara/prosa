"""
Banco no Supabase, para o site publicado (no Vercel o disco é só de leitura).

Só entra em uso quando SUPABASE_URL e SUPABASE_SECRET_KEY estão no ambiente; sem eles, o protótipo
grava em arquivos, como sempre. As tabelas estão em supabase.sql. A chave secreta fica só no servidor:
as tabelas têm RLS ligado e nenhuma política, então nada é acessível pelo navegador.

Usa a API REST do Supabase direto pelo httpx, sem a biblioteca deles.
"""

import os

import httpx
from dotenv import load_dotenv

load_dotenv()

URL = os.getenv("SUPABASE_URL", "").rstrip("/")
CHAVE = os.getenv("SUPABASE_SECRET_KEY", "")
ATIVO = bool(URL and CHAVE)


def _cabecalhos() -> dict[str, str]:
    cabecalhos = {"apikey": CHAVE}
    if CHAVE.startswith("eyJ"):  # a chave antiga (service_role) é um JWT e vai também no Authorization
        cabecalhos["Authorization"] = f"Bearer {CHAVE}"
    return cabecalhos


def buscar(tabela: str, **filtros: str) -> list[dict]:
    """GET na tabela. Os filtros seguem o PostgREST: select="id,area", id="eq.abc", order="data.desc"."""
    resposta = httpx.get(f"{URL}/rest/v1/{tabela}", params=filtros, headers=_cabecalhos(), timeout=20)
    resposta.raise_for_status()
    return resposta.json()


def gravar(tabela: str, linha: dict) -> None:
    """Insere a linha ou, se a chave primária já existe, substitui."""
    resposta = httpx.post(
        f"{URL}/rest/v1/{tabela}",
        json=linha,
        headers=_cabecalhos() | {"Prefer": "resolution=merge-duplicates,return=minimal"},
        timeout=20,
    )
    resposta.raise_for_status()
