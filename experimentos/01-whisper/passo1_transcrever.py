"""
Passo 1: primeira transcrição.

Uso:
    python passo1_transcrever.py audios/meu_audio.m4a
    python passo1_transcrever.py audios/meu_audio.m4a --modelo medium
"""

import argparse
import time

from faster_whisper import WhisperModel

parser = argparse.ArgumentParser(description="Transcreve um arquivo de áudio com o Whisper.")
parser.add_argument("audio", help="caminho do arquivo (.m4a, .mp3, .wav...)")
parser.add_argument(
    "--modelo",
    default="small",
    help="tiny, base, small, medium, large-v3 ou large-v3-turbo (padrão: small)",
)
args = parser.parse_args()

# 1. Carregar o modelo.
#    Na primeira execução, o modelo é baixado do Hugging Face e fica em cache.
#    device="cpu" faz o modelo rodar no processador.
#    compute_type="int8" usa pesos quantizados em 8 bits: mais rápido e mais
#    leve, com uma perda pequena de qualidade.
inicio = time.perf_counter()
modelo = WhisperModel(args.modelo, device="cpu", compute_type="int8")
print(f"Modelo '{args.modelo}' carregado em {time.perf_counter() - inicio:.1f} s")

# 2. Transcrever.
#    language="pt" pula a detecção automática de idioma, que às vezes erra.
#    transcribe() é preguiçoso: devolve um gerador, e o trabalho pesado só
#    acontece quando os segmentos são percorridos no for abaixo.
inicio = time.perf_counter()
segmentos, info = modelo.transcribe(args.audio, language="pt")

print(f"Duração do áudio: {info.duration:.1f} s\n")
for seg in segmentos:
    print(f"[{seg.start:6.1f}s -> {seg.end:6.1f}s] {seg.text.strip()}")

print(f"\nTranscrição levou {time.perf_counter() - inicio:.1f} s")
