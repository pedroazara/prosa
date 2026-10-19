"""
Manda os temas de prototipo/temas/ para o Supabase, para o site publicado começar com a biblioteca.

Uso (na raiz, com SUPABASE_URL e SUPABASE_SECRET_KEY no .env):
    python prototipo/enviar_temas.py

Pode rodar de novo: um tema que já está lá é substituído, não duplicado.
"""

import sys

import biblioteca
import nuvem

if not nuvem.ATIVO:
    sys.exit("Faltam SUPABASE_URL e SUPABASE_SECRET_KEY no .env.")

arquivos = sorted(biblioteca.PASTA.glob("*.json"))
for arquivo in arquivos:
    desafio = biblioteca._carregar(arquivo)
    biblioteca.salvar(desafio)
    print(f"✓ {desafio['artigo']}")
print(f"{len(arquivos)} temas enviados.")
