"""
Passo 3: sortear um tema.

    código sorteia uma área
      -> LLM propõe vários temas dessa área
      -> código embaralha e descarta os já usados
      -> código confere se existe um bom artigo na Wikipedia

Uso:
    python passo3_sorteio.py
    python passo3_sorteio.py --area Economia
"""

import argparse
import json
import random
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel

import llm
import wikipedia
from areas import AREAS

HISTORICO = Path(__file__).parent / "historico_temas.json"

# Artigos curtos demais não dão uma boa referência para avaliar a explicação.
TAMANHO_MINIMO = 3000  # caracteres

PROMPT_SISTEMA = """\
Você cria desafios para um treino de aprendizado rápido e comunicação.
A pessoa recebe uma pergunta, pesquisa na internet por 5 a 10 minutos e depois
explica em voz alta os pontos principais.

Cada desafio deve ser:
- específico, não uma área inteira ("Como funciona o efeito Hall?", não "Eletromagnetismo");
- pouco conhecido do público geral: evite os temas mais óbvios e populares da área;
- compreensível no essencial em 5 a 10 minutos de pesquisa;
- coberto por um artigo próprio na Wikipedia em português.

Para cada desafio, dê a pergunta e o termo_busca: o título provável do artigo na Wikipedia.
"""


class Candidato(BaseModel):
    pergunta: str
    termo_busca: str


class Candidatos(BaseModel):
    temas: list[Candidato]


def carregar_historico() -> list[dict]:
    if HISTORICO.exists():
        return json.loads(HISTORICO.read_text(encoding="utf-8"))
    return []


parser = argparse.ArgumentParser(description="Sorteia um tema de estudo.")
parser.add_argument("--area", choices=AREAS, help="fixa a área em vez de sortear")
parser.add_argument("--quantidade", type=int, default=20, help="quantos temas pedir ao LLM (padrão: 20)")
args = parser.parse_args()

historico = carregar_historico()
artigos_usados = {item["artigo"] for item in historico}

# 1. O CÓDIGO sorteia a área. LLMs são ruins em aleatoriedade; o random não.
area = args.area or random.choice(AREAS)
print(f"Área sorteada: {area}\n")

# 2. O LLM propõe candidatos. Mostramos os últimos temas usados para ele evitar.
pedido = f"Proponha {args.quantidade} desafios da área: {area}."
recentes = [item["pergunta"] for item in historico[-30:]]
if recentes:
    pedido += "\n\nNão repita estes, que já foram usados:\n" + "\n".join(f"- {p}" for p in recentes)

cliente = llm.criar_cliente()
resposta = cliente.chat.completions.parse(
    model=llm.modelo(),
    messages=[
        {"role": "system", "content": PROMPT_SISTEMA},
        {"role": "user", "content": pedido},
    ],
    response_format=Candidatos,
    temperature=1.0,  # mais variedade entre uma execução e outra
    # Limite de tokens de saída. Modelos que "pensam" gastam parte desse limite
    # raciocinando, antes de escrever o JSON. Se o limite acabar no meio do JSON,
    # o SDK levanta LengthFinishReasonError.
    max_completion_tokens=8000,
)
candidatos = resposta.choices[0].message.parsed.temas
print(f"O LLM propôs {len(candidatos)} temas:")
for c in candidatos:
    print(f"  - {c.pergunta}  [busca: {c.termo_busca}]")

# 3. O CÓDIGO embaralha e testa um por um até achar um que passe nos filtros.
random.shuffle(candidatos)
print("\nTestando candidatos em ordem aleatória:")

escolhido = None
for c in candidatos:
    titulos = wikipedia.buscar(c.termo_busca, limite=1)
    if not titulos:
        print(f"  x {c.pergunta}  -> nenhum artigo encontrado")
        continue

    art = wikipedia.artigo(titulos[0])
    if art is None or art["desambiguacao"]:
        print(f"  x {c.pergunta}  -> só achou página de desambiguação")
        continue
    # Comparar pelo título do artigo é mais confiável do que comparar o texto
    # da pergunta: o LLM pode escrever o mesmo tema de jeitos diferentes.
    if art["titulo"] in artigos_usados:
        print(f"  x {c.pergunta}  -> artigo já usado antes ({art['titulo']})")
        continue
    if len(art["texto"]) < TAMANHO_MINIMO:
        print(f"  x {c.pergunta}  -> artigo curto demais ({len(art['texto'])} caracteres)")
        continue

    escolhido = c
    print(f"  ✓ {c.pergunta}  -> {art['titulo']} ({len(art['texto'])} caracteres)")
    break

if escolhido is None:
    raise SystemExit("\nNenhum candidato passou nos filtros. Rode de novo.")

link = f"https://pt.wikipedia.org/wiki/{art['titulo'].replace(' ', '_')}"
print(f"\n{'=' * 60}")
print(f"DESAFIO: {escolhido.pergunta}")
print(f"{'=' * 60}")
print(f"Área: {area}")
print(f"Referência (oculta para o usuário): {link}")

historico.append(
    {
        "pergunta": escolhido.pergunta,
        "area": area,
        "artigo": art["titulo"],
        "data": datetime.now().isoformat(timespec="seconds"),
    }
)
HISTORICO.write_text(json.dumps(historico, ensure_ascii=False, indent=2), encoding="utf-8")
