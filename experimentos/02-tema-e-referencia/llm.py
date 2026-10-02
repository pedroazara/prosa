"""
Conexão com o LLM.

Funciona com qualquer fornecedor que tenha API compatível com a da OpenAI
(Groq, Gemini, Ollama...). O fornecedor é escolhido no arquivo .env, na raiz do projeto.

Rodado direto, lista os modelos disponíveis na sua conta:
    python llm.py
"""

import os

from dotenv import load_dotenv
from openai import OpenAI

# Procura o arquivo .env subindo pelas pastas até a raiz do projeto,
# e coloca as variáveis dele no ambiente (os.environ).
load_dotenv()


def _ler(nome: str) -> str:
    valor = os.getenv(nome)
    if not valor or valor.startswith("cole_sua_chave") or valor.startswith("confira_"):
        raise SystemExit(f"Faltou configurar {nome} no arquivo .env (veja o .env.example na raiz do projeto).")
    return valor


def criar_cliente() -> OpenAI:
    return OpenAI(base_url=_ler("LLM_BASE_URL"), api_key=_ler("LLM_API_KEY"))


def modelo() -> str:
    return _ler("LLM_MODEL")


if __name__ == "__main__":
    for m in sorted(criar_cliente().models.list(), key=lambda m: m.id):
        print(m.id)
