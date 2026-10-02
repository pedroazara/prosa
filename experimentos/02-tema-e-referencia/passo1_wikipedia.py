"""
Passo 1: buscar artigos na Wikipedia (sem LLM ainda).

Uso:
    python passo1_wikipedia.py "Bretton Woods"
"""

import argparse

import wikipedia

parser = argparse.ArgumentParser(description="Busca um termo na Wikipedia e mostra o melhor artigo.")
parser.add_argument("termo", help="o que buscar")
args = parser.parse_args()

# 1. Busca: a Wikipedia devolve os títulos mais relevantes para o termo.
titulos = wikipedia.buscar(args.termo)
print(f"Resultados da busca por '{args.termo}':")
for i, titulo in enumerate(titulos, 1):
    print(f"  {i}. {titulo}")

if not titulos:
    raise SystemExit("Nenhum artigo encontrado.")

# 2. Artigo: pega o texto puro do primeiro resultado.
art = wikipedia.artigo(titulos[0])
texto = art["texto"]

print(f"\nArtigo:         {art['titulo']}")
print(f"Desambiguação:  {'sim' if art['desambiguacao'] else 'não'}")
print(f"Tamanho:        {len(texto)} caracteres, {len(texto.split())} palavras")
print(f"Link:           https://pt.wikipedia.org/wiki/{art['titulo'].replace(' ', '_')}")
print(f"\nInício do texto:\n\n{texto[:600]}...")
