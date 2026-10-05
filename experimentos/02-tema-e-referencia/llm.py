"""
Conexão com o LLM.

Funciona com qualquer fornecedor que tenha API compatível com a da OpenAI
(Groq, Gemini, Ollama...). O fornecedor é escolhido no arquivo .env, na raiz do projeto.

Rodado direto, lista os modelos disponíveis na sua conta:
    python llm.py
"""

import os
import re

import httpx
import openai
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


def _nao_repetir_cota_diaria(resposta: httpx.Response) -> None:
    """O SDK repete sozinho as chamadas recusadas por limite (429), o que ajuda no limite por minuto.
    Quando a cota do DIA acabou, repetir só faz a pessoa esperar à toa; este cabeçalho manda o SDK desistir."""
    if resposta.status_code == 429:
        resposta.read()
        if "per day" in resposta.text:
            resposta.headers["x-should-retry"] = "false"


def criar_cliente() -> OpenAI:
    return OpenAI(
        base_url=_ler("LLM_BASE_URL"),
        api_key=_ler("LLM_API_KEY"),
        http_client=httpx.Client(event_hooks={"response": [_nao_repetir_cota_diaria]}, timeout=120),
    )


def modelo() -> str:
    return _ler("LLM_MODEL")


def _espera(texto: str) -> str | None:
    """'Please try again in 30m23.472s' -> 'uns 31 min'."""
    m = re.search(r"try again in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?", texto)
    if not m or not any(m.groups()):
        return None
    segundos = int(m[1] or 0) * 3600 + int(m[2] or 0) * 60 + float(m[3] or 0)
    if segundos < 60:
        return f"uns {max(1, round(segundos))} segundos"
    if segundos < 3600:
        return f"uns {round(segundos / 60)} min"
    return f"umas {segundos / 3600:.1f} h".replace(".", ",")


def explicar_erro(erro: Exception) -> tuple[str, str]:
    """Traduz um erro do LLM para (codigo, mensagem para a tela).

    Os códigos que a interface entende: cota_diaria, cota_minuto, grande_demais, chave, modelo,
    conexao, resposta_invalida, fornecedor e desconhecido.
    """
    texto = str(erro)
    nome = os.getenv("LLM_MODEL", "o modelo")
    if isinstance(erro, openai.RateLimitError):
        quando = _espera(texto)
        if "per day" in texto:
            return "cota_diaria", (
                f"A cota diária grátis do {nome} acabou. Ela volta aos poucos"
                f"{f': tente de novo em {quando}' if quando else ''}. Enquanto isso, use um tema salvo "
                "ou troque o LLM_MODEL no .env (cada modelo tem a sua cota)."
            )
        return "cota_minuto", (
            f"Muitas chamadas à IA em pouco tempo. Espere {quando or 'um minuto'} e tente de novo."
        )
    if isinstance(erro, openai.APIStatusError) and erro.status_code == 413:
        return "grande_demais", "O texto mandado à IA passou do limite do plano grátis. Tente sortear de novo."
    if isinstance(erro, openai.AuthenticationError | openai.PermissionDeniedError):
        return "chave", "A chave da IA (LLM_API_KEY no .env) foi recusada. Confira se ela está certa e ativa."
    if isinstance(erro, openai.NotFoundError):
        return "modelo", f"O modelo {nome} não está disponível nessa conta. Confira o LLM_MODEL no .env."
    if isinstance(erro, openai.APIConnectionError):  # inclui o tempo esgotado
        return "conexao", "Não consegui falar com o serviço da IA. Confira a internet e tente de novo."
    if isinstance(erro, openai.LengthFinishReasonError) or "json_validate_failed" in texto:
        return "resposta_invalida", "A IA devolveu uma resposta incompleta. Tente de novo."
    if isinstance(erro, openai.InternalServerError):
        return "fornecedor", "O serviço da IA está instável agora. Tente de novo em alguns minutos."
    return "desconhecido", f"Erro inesperado: {texto}"


if __name__ == "__main__":
    for m in sorted(criar_cliente().models.list(), key=lambda m: m.id):
        print(m.id)
