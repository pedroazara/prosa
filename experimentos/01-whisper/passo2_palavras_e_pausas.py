"""
Passo 2: tempo de cada palavra, velocidade da fala e pausas.

Uso:
    python passo2_palavras_e_pausas.py audios/meu_audio.m4a
    python passo2_palavras_e_pausas.py audios/meu_audio.m4a --pausa-minima 0.5
"""

import argparse

from faster_whisper import WhisperModel

parser = argparse.ArgumentParser(description="Mostra palavras com tempo, palavras/min e pausas.")
parser.add_argument("audio", help="caminho do arquivo de áudio")
parser.add_argument("--modelo", default="small", help="tamanho do modelo (padrão: small)")
parser.add_argument(
    "--pausa-minima",
    type=float,
    default=0.4,
    help="silêncio mínimo, em segundos, para contar como pausa (padrão: 0.4)",
)
args = parser.parse_args()

modelo = WhisperModel(args.modelo, device="cpu", compute_type="int8")

# word_timestamps=True pede o início e o fim de cada palavra.
# O Whisper não foi treinado para isso. Os tempos saem do alinhamento entre
# áudio e texto que o modelo calcula internamente, então são aproximados.
segmentos, info = modelo.transcribe(args.audio, language="pt", word_timestamps=True)

# Junta as palavras de todos os segmentos numa lista só.
palavras = [p for seg in segmentos for p in seg.words]

if not palavras:
    raise SystemExit("Nenhuma palavra reconhecida.")

# 1. Cada palavra com o tempo e a "confiança" do modelo.
#    probability é a probabilidade que o modelo atribuiu aos tokens daquela palavra.
#    Valores baixos costumam indicar trechos onde ele errou ou chutou.
print("PALAVRAS (* = probabilidade abaixo de 0.5)\n")
for p in palavras:
    marca = "*" if p.probability < 0.5 else " "
    print(f"{marca} {p.start:6.2f}s - {p.end:6.2f}s  {p.probability:.2f}  {p.word.strip()}")

# 2. Velocidade: palavras por minuto.
#    O tempo conta do início da primeira palavra ao fim da última, para não
#    incluir silêncio no começo e no fim da gravação.
tempo_de_fala = palavras[-1].end - palavras[0].start
ppm = len(palavras) / (tempo_de_fala / 60)

# 3. Pausas: o intervalo entre o fim de uma palavra e o início da próxima.
pausas = []
for anterior, seguinte in zip(palavras, palavras[1:]):
    intervalo = seguinte.start - anterior.end
    if intervalo >= args.pausa_minima:
        pausas.append((intervalo, anterior, seguinte))

print("\nRESUMO\n")
print(f"Palavras:            {len(palavras)}")
print(f"Tempo de fala:       {tempo_de_fala:.1f} s")
print(f"Palavras por minuto: {ppm:.0f}")
print(f"Pausas (>= {args.pausa_minima} s):   {len(pausas)}")

if pausas:
    media = sum(intervalo for intervalo, _, _ in pausas) / len(pausas)
    print(f"Pausa média:         {media:.2f} s")
    print("\nMAIORES PAUSAS\n")
    for intervalo, anterior, seguinte in sorted(pausas, key=lambda x: x[0], reverse=True)[:5]:
        print(f"{intervalo:5.2f} s  em {anterior.end:6.2f}s:  ...{anterior.word.strip()} | {seguinte.word.strip()}...")
