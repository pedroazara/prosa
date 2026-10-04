"""
Transcrição e métricas de fala, a partir do que foi testado em experimentos/01-whisper.
"""

import re
from functools import cache

from faster_whisper import WhisperModel

MODELO_WHISPER = "small"
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
def _modelo() -> WhisperModel:
    # Carregado só na primeira transcrição: leva alguns segundos.
    return WhisperModel(MODELO_WHISPER, device="cpu", compute_type="int8")


def _contar(texto: str, padroes: dict[str, str]) -> dict[str, int]:
    texto = texto.lower()
    return {nome: len(re.findall(padrao, texto)) for nome, padrao in padroes.items()}


def analisar(audio: str) -> dict:
    # Sem initial_prompt: no Teste 1, o prompt de hesitações fez o Whisper perder conteúdo.
    segmentos, info = _modelo().transcribe(audio, language="pt", word_timestamps=True)
    palavras = [p for seg in segmentos for p in seg.words]
    if not palavras:
        return {"texto": "", "marcacoes": [], "duracao": info.duration, "palavras": 0,
                "palavras_por_minuto": 0, "pausas": 0, "maior_pausa": 0,
                "hesitacoes": _contar("", HESITACOES), "muletas": _contar("", MULETAS)}

    texto = "".join(p.word for p in palavras).strip()
    tempo_de_fala = palavras[-1].end - palavras[0].start
    pausas = [
        seguinte.start - anterior.end
        for anterior, seguinte in zip(palavras, palavras[1:])
        if seguinte.start - anterior.end >= PAUSA_MINIMA
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
        "duracao": info.duration,
        "palavras": len(palavras),
        "palavras_por_minuto": len(palavras) / (tempo_de_fala / 60) if tempo_de_fala else 0,
        "pausas": len(pausas),
        "maior_pausa": max(pausas, default=0),
        "hesitacoes": _contar(texto, HESITACOES),
        "muletas": _contar(texto, MULETAS),
    }
