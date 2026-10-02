"""
Passo 4: do sorteio à referência oculta.

    código sorteia a área
      -> LLM propõe candidatos (brasileiros ou do mundo todo)
      -> código embaralha e aplica os filtros de forma (artigo existe? é grande?)
      -> LLM lê o artigo: ele responde à pergunta? (filtro de significado)
      -> LLM monta a rubrica com 3 a 5 pontos principais
      -> código confere se os trechos citados existem mesmo no artigo

Uso:
    python passo4_referencia.py
    python passo4_referencia.py --area História --origem brasil
"""

import argparse
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

import llm
import referencia
import sorteio
from areas import AREAS

PASTA = Path(__file__).parent
HISTORICO = PASTA / "historico_temas.json"
REFERENCIAS = PASTA / "referencias"

# Cada leitura de artigo gasta alguns milhares de tokens da cota grátis.
MAX_LEITURAS = 4


def carregar_historico() -> list[dict]:
    if HISTORICO.exists():
        return json.loads(HISTORICO.read_text(encoding="utf-8"))
    return []


def nome_de_arquivo(titulo: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", titulo).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")


parser = argparse.ArgumentParser(description="Sorteia um tema e monta a referência oculta.")
parser.add_argument("--area", choices=AREAS, help="fixa a área em vez de sortear")
parser.add_argument(
    "--origem",
    choices=sorted(sorteio.ORIGENS),
    default="mundo",
    help="brasil = temas majoritariamente brasileiros; mundo = qualquer país (padrão)",
)
args = parser.parse_args()

# Com a cota grátis, o fornecedor às vezes responde "espere um pouco" (erro 429).
# Mais tentativas automáticas evitam que o script quebre por isso.
cliente = llm.criar_cliente().with_options(max_retries=6)
modelo = llm.modelo()
historico = carregar_historico()

# 1. Área: código.
area = args.area or sorteio.sortear_area()
print(f"Área: {area}   |   Origem: {args.origem}\n")

# 2. Candidatos: LLM. Já voltam embaralhados pelo código.
recentes = [item["pergunta"] for item in historico[-30:]]
candidatos = sorteio.propor_candidatos(cliente, modelo, area, args.origem, recentes)
print(f"O LLM propôs {len(candidatos)} temas. Testando em ordem aleatória:\n")

# 3. Filtros: primeiro os de forma (código, rápidos e grátis),
#    depois o de significado (LLM, mais lento e gasta cota).
artigos_usados = {item["artigo"] for item in historico}
escolha = None
leituras = 0

for c in candidatos:
    art, motivo = sorteio.buscar_artigo(c, artigos_usados)
    if art is None:
        print(f"  x {c.pergunta}\n      forma: {motivo}")
        continue

    if leituras == MAX_LEITURAS:
        print(f"\nLimite de {MAX_LEITURAS} leituras atingido.")
        break
    leituras += 1
    print(f"  ? {c.pergunta}\n      artigo: {art['titulo']}. O LLM está lendo...")
    ref = referencia.montar(cliente, modelo, c.pergunta, art)
    print(f"      veredito: {ref.veredito}. {ref.justificativa}")

    if ref.veredito == "outro_assunto" or not ref.pontos_principais:
        continue

    escolha = (c, art, ref)
    break

if escolha is None:
    raise SystemExit("\nNenhum candidato passou. Rode de novo.")

candidato, art, ref = escolha
link = f"https://pt.wikipedia.org/wiki/{art['titulo'].replace(' ', '_')}"

# 4. Conferência das citações: código. Não confie, verifique.
pontos = []
for p in ref.pontos_principais:
    pontos.append({"ideia": p.ideia, "trecho_do_artigo": p.trecho_do_artigo,
                   "trecho_verificado": referencia.trecho_existe(p.trecho_do_artigo, art["texto"])})

if not 3 <= len(pontos) <= 5:
    print(f"\nAtenção: o LLM devolveu {len(pontos)} pontos, fora da faixa de 3 a 5 pedida.")

# O que o usuário vê.
print(f"\n{'=' * 70}")
print(f"DESAFIO: {ref.pergunta_final}")
print("Pesquise por conta própria e depois explique, em até 2 minutos,")
print("os pontos principais, sem entrar em detalhes.")
print(f"{'=' * 70}")

if ref.veredito == "reescrever":
    print(f"\n(Pergunta original, reescrita pelo LLM: {candidato.pergunta})")

# O que fica oculto (mostrado aqui só porque este é um script de teste).
print(f"\nREFERÊNCIA OCULTA: {link}")
print("RUBRICA OCULTA:")
for i, p in enumerate(pontos, 1):
    marca = "✓" if p["trecho_verificado"] else "⚠ trecho NÃO encontrado no artigo"
    print(f"  {i}. {p['ideia']}")
    print(f"     \"{p['trecho_do_artigo']}\"  [{marca}]")

# Salva a referência, que será usada no Teste 3 (análise da explicação).
registro = {
    "pergunta_original": candidato.pergunta,
    "pergunta_final": ref.pergunta_final,
    "veredito": ref.veredito,
    "justificativa": ref.justificativa,
    "area": area,
    "origem": args.origem,
    "artigo": art["titulo"],
    "link": link,
    "pontos_principais": pontos,
    "modelo": modelo,
    "data": datetime.now().isoformat(timespec="seconds"),
}
REFERENCIAS.mkdir(exist_ok=True)
arquivo = REFERENCIAS / f"{nome_de_arquivo(art['titulo'])}.json"
arquivo.write_text(json.dumps(registro, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\nReferência salva em {arquivo.relative_to(PASTA)}")

historico.append({"pergunta": ref.pergunta_final, "area": area, "artigo": art["titulo"],
                  "data": registro["data"]})
HISTORICO.write_text(json.dumps(historico, ensure_ascii=False, indent=2), encoding="utf-8")
