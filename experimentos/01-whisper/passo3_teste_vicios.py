"""
Passo 3: teste de risco. O Whisper preserva os vícios de linguagem?

O mesmo áudio é transcrito duas vezes:
  A) do jeito padrão;
  B) com um initial_prompt cheio de hesitações, para "ensinar" o estilo ao modelo.
Depois os vícios de cada versão são contados e comparados com a sua contagem manual.

Uso:
    python passo3_teste_vicios.py audios/meu_audio.m4a
    python passo3_teste_vicios.py audios/meu_audio.m4a --modelo large-v3-turbo
"""

import argparse
import json
import re
from pathlib import Path

from faster_whisper import WhisperModel

# Hesitações: sons sem significado. São o que o Whisper costuma apagar.
HESITACOES = {
    "éé / eh": r"\b(?:éé+|eh+)\b",
    "ãã / ahn": r"\b(?:ãã+|ah+n|ahm)\b",
    # Não dá para incluir "um": em português ele também é artigo ("um material").
    "hum / hm": r"\b(?:hu+m+|hm+|umm+)\b",
}

# Palavras-muleta: palavras de verdade usadas como enchimento.
# São ambíguas ("então" pode ser conclusão; "tipo" pode ser substantivo),
# então essa contagem é uma estimativa por cima.
MULETAS = {
    "tipo": r"\btipo\b",
    "né": r"\bné\b",
    "então": r"\bentão\b",
    "assim": r"\bassim\b",
    "aí": r"\baí\b",
    "sabe": r"\bsabe\b",
}

# "é" sozinho é o caso mais ambíguo: é hesitação em "é... o efeito" e verbo em
# "a tensão é proporcional". Contamos à parte, para você julgar lendo o texto.
E_SOZINHO = r"\bé\b"

# O Whisper continua o estilo do texto que vê como "anterior".
# Um prompt com hesitações escritas aumenta a chance de ele transcrevê-las.
PROMPT_COM_HESITACOES = (
    "Então, éé... eu acho que, tipo, né, ãã... o efeito, hum, é assim, sabe? "
    "Aí, éé, ahn... então, hum, tipo assim."
)


def contar(texto: str, padroes: dict[str, str]) -> dict[str, int]:
    texto = texto.lower()
    return {nome: len(re.findall(padrao, texto)) for nome, padrao in padroes.items()}


def transcrever(modelo: WhisperModel, audio: str, prompt: str | None) -> str:
    segmentos, _ = modelo.transcribe(audio, language="pt", initial_prompt=prompt)
    return " ".join(seg.text.strip() for seg in segmentos)


parser = argparse.ArgumentParser(description="Compara a transcrição com e sem prompt de hesitações.")
parser.add_argument("audio", help="caminho do arquivo de áudio")
parser.add_argument("--modelo", default="small", help="tamanho do modelo (padrão: small)")
args = parser.parse_args()

modelo = WhisperModel(args.modelo, device="cpu", compute_type="int8")

versoes = {
    "A (padrão)": transcrever(modelo, args.audio, prompt=None),
    "B (com prompt)": transcrever(modelo, args.audio, prompt=PROMPT_COM_HESITACOES),
}

resultado = {"audio": args.audio, "modelo": args.modelo, "versoes": {}}

for nome, texto in versoes.items():
    hesitacoes = contar(texto, HESITACOES)
    muletas = contar(texto, MULETAS)
    e_sozinho = len(re.findall(E_SOZINHO, texto.lower()))
    resultado["versoes"][nome] = {
        "texto": texto,
        "hesitacoes": hesitacoes,
        "muletas": muletas,
        "e_sozinho": e_sozinho,
    }

    print(f"\n=== {nome} ===\n")
    print(texto)

# Tabela comparativa lado a lado.
nomes = list(versoes)
print(f"\n{'':22}{nomes[0]:>16}{nomes[1]:>18}")
for grupo in ("hesitacoes", "muletas"):
    print(f"\n{grupo.upper()}")
    for item in resultado["versoes"][nomes[0]][grupo]:
        a = resultado["versoes"][nomes[0]][grupo][item]
        b = resultado["versoes"][nomes[1]][grupo][item]
        print(f"  {item:20}{a:>16}{b:>18}")
print(f"\n{'É SOZINHO (ambíguo)':22}"
      f"{resultado['versoes'][nomes[0]]['e_sozinho']:>16}"
      f"{resultado['versoes'][nomes[1]]['e_sozinho']:>18}")

# Salva o resultado para comparar depois (entre modelos, entre gravações).
pasta = Path(__file__).parent / "resultados"
pasta.mkdir(exist_ok=True)
arquivo = pasta / f"{Path(args.audio).stem}_{args.modelo}.json"
arquivo.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\nResultado salvo em {arquivo}")
