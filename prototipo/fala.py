"""
Transcrição e métricas de fala, a partir do que foi testado em experimentos/01-whisper.

Dois jeitos de transcrever, com o mesmo resultado:
- no PC, o faster-whisper local (modelo medium), se estiver instalado (requirements-local.txt);
- no site publicado, o Whisper da Groq, com a chave de quem está usando. O faster-whisper não cabe no Vercel.
WHISPER=groq no .env força a Groq também no PC.
"""

import os
import re
from functools import cache
from importlib.util import find_spec

import llm  # o de experimentos/02-tema-e-referencia (desafio.py põe a pasta no caminho)

MODELO_WHISPER = "medium"
MODELO_GROQ = "whisper-large-v3-turbo"
LOCAL = os.getenv("WHISPER", "local" if find_spec("faster_whisper") else "groq") == "local"
PAUSA_MINIMA = 0.4  # segundos de silêncio para contar como pausa

HESITACOES = {
    "éé / eh": r"\b(?:éé+|eh+)\b",
    "ãã / ahn": r"\b(?:ãã+|ah+n|ahm)\b",
    "hum / hm": r"\b(?:hu+m+|hm+|umm+)\b",
}

# Palavras-muleta são ambíguas ("então" pode ser conclusão), então a contagem
# é uma estimativa por cima.
MULETAS = {
    "tipo": r"\btipo\b",
    "né": r"\bné\b",
    "então": r"\bentão\b",
    "assim": r"\bassim\b",
    "aí": r"\baí\b",
    "sabe": r"\bsabe\b",
}


@cache
def _modelo():
    from faster_whisper import WhisperModel

    # Carregado só na primeira transcrição: leva alguns segundos.
    return WhisperModel(MODELO_WHISPER, device="cpu", compute_type="int8")


def _transcrever(audio: str, chave: str | None) -> tuple[list[tuple[str, float, float]], float]:
    """(palavras, duração do áudio). Cada palavra é (texto com o espaço antes, início, fim), como no faster-whisper."""
    if LOCAL:
        # Sem initial_prompt: no Teste 1, o prompt de hesitações fez o Whisper perder conteúdo.
        segmentos, info = _modelo().transcribe(audio, language="pt", word_timestamps=True)
        return [(p.word, p.start, p.end) for seg in segmentos for p in seg.words], info.duration
    with open(audio, "rb") as arquivo:
        resposta = llm.criar_cliente(chave).audio.transcriptions.create(
            file=arquivo, model=MODELO_GROQ, language="pt", response_format="verbose_json",
            timestamp_granularities=["word"],
        )
    # As palavras da Groq vêm sem o espaço antes (e com a pontuação grudada): o espaço é posto aqui.
    palavras = [(" " + p.word.strip(), p.start, p.end) for p in resposta.words or [] if p.word.strip()]
    return palavras, resposta.duration


def _contar(texto: str, padroes: dict[str, str]) -> dict[str, int]:
    texto = texto.lower()
    return {nome: len(re.findall(padrao, texto)) for nome, padrao in padroes.items()}


def analisar(audio: str, chave: str | None = None) -> dict:
    palavras, duracao = _transcrever(audio, chave)
    if not palavras:
        return {"texto": "", "marcacoes": [], "duracao": duracao, "palavras": 0,
                "palavras_por_minuto": 0, "pausas": 0, "maior_pausa": 0,
                "hesitacoes": _contar("", HESITACOES), "muletas": _contar("", MULETAS)}

    bruto = "".join(p for p, _, _ in palavras)
    texto = bruto.strip()
    # Onde cada palavra está no texto e em que momento do áudio ela é dita, para a tela animar a palavra tocando.
    folga = len(bruto) - len(bruto.lstrip())
    tokens, pos = [], 0
    for p, t0, t1 in palavras:
        inicio = pos + len(p) - len(p.lstrip()) - folga
        fim = pos + len(p.rstrip()) - folga
        if fim > inicio:
            tokens.append({"inicio": max(inicio, 0), "fim": fim, "t0": t0, "t1": t1})
        pos += len(p)
    tempo_de_fala = palavras[-1][2] - palavras[0][1]
    pausas = [
        seguinte[1] - anterior[2]
        for anterior, seguinte in zip(palavras, palavras[1:])
        if seguinte[1] - anterior[2] >= PAUSA_MINIMA
    ]
    # Posição de cada vício no texto, para a tela destacá-los na transcrição.
    marcacoes = sorted(
        (
            {"inicio": m.start(), "fim": m.end(), "tipo": tipo}
            for tipo, padroes in (("hesitacao", HESITACOES), ("muleta", MULETAS))
            for padrao in padroes.values()
            for m in re.finditer(padrao, texto.lower())
        ),
        key=lambda m: m["inicio"],
    )
    return {
        "texto": texto,
        "marcacoes": marcacoes,
        "tokens": tokens,
        "duracao": duracao,
        "palavras": len(palavras),
        "palavras_por_minuto": len(palavras) / (tempo_de_fala / 60) if tempo_de_fala else 0,
        "pausas": len(pausas),
        "maior_pausa": max(pausas, default=0),
        "hesitacoes": _contar(texto, HESITACOES),
        "muletas": _contar(texto, MULETAS),
    }
