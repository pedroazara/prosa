"""
Sorteio do tema e montagem da referência oculta (o mesmo fluxo do passo4_referencia.py).

É um gerador: vai devolvendo mensagens de andamento para a tela, e no fim o desafio.
"""

import sys

import openai
from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

EXPERIMENTO_2 = Path(__file__).parent.parent / "experimentos" / "02-tema-e-referencia"
sys.path.insert(0, str(EXPERIMENTO_2))

import llm  # noqa: E402
import referencia  # noqa: E402
import sorteio  # noqa: E402
from areas import AREAS, SUBAREAS  # noqa: E402

ORIGENS = sorted(sorteio.ORIGENS)
MAX_LEITURAS = 4  # cada leitura de artigo gasta alguns milhares de tokens
LIMITE_REDUZIDO = 7000  # caracteres; se o artigo inteiro estourar o limite por chamada (erro 413)
# Enquanto não há a avaliação do conteúdo, o sorteio dá um tema específico para estudar
# ("Efeito Stroop"), e não uma pergunta específica e difícil. Para voltar às perguntas: "pergunta".
ESTILO = "tema"


def gerar(area: str | None, origem: str, chave: str | None, historico: list[dict]) -> Iterator[tuple[str, str | dict]]:
    """Devolve ("status", mensagem) durante o processo e, no fim, ("pronto", desafio) ou ("erro", mensagem).

    Logo no começo devolve também ("sorteio", {...}), com as opções, para a tela fazer a roleta.
    "chave" é a chave da Groq de quem está no site (None: a do .env); "historico", os temas já sorteados.
    Guardar o tema pronto fica com quem chamou (biblioteca.registrar).
    """
    cliente = llm.criar_cliente(chave).with_options(max_retries=6)
    modelo = llm.modelo(chave)
    area_sorteada = area is None
    area = area or sorteio.sortear_area()
    subarea = sorteio.sortear_subarea(area)
    yield "sorteio", {"area": area, "subarea": subarea, "areas": AREAS if area_sorteada else [],
                      "subareas": SUBAREAS[area]}
    yield "status", "Pedindo candidatos ao LLM…"

    recentes = [item["pergunta"] for item in historico[-30:]]
    candidatos = sorteio.propor_candidatos(cliente, modelo, area, origem, recentes, subarea=subarea,
                                            estilo=ESTILO)
    yield "status", f"{len(candidatos)} temas propostos. Procurando um com bom artigo…"

    artigos_usados = {item["artigo"] for item in historico}
    log = []
    escolha = None
    leituras = 0
    for c in candidatos:
        art, motivo = sorteio.buscar_artigo(c, artigos_usados, estilo=ESTILO)
        if art is None:
            log.append(f"✗ {c.pergunta} — {motivo}")
            continue
        if leituras == MAX_LEITURAS:
            break
        leituras += 1
        yield "status", f"Lendo o artigo “{art['titulo']}”…"
        try:
            ref = referencia.montar(cliente, modelo, c.pergunta, art, estilo=ESTILO, area=area)
        except openai.APIStatusError as erro:
            if erro.status_code != 413:
                raise
            yield "status", "Artigo grande demais para o plano grátis. Lendo um trecho menor…"
            ref = referencia.montar(cliente, modelo, c.pergunta, art, limite=LIMITE_REDUZIDO,
                                       estilo=ESTILO, area=area)
            texto_limite = LIMITE_REDUZIDO
        else:
            texto_limite = referencia.LIMITE_ARTIGO
        log.append(f"→ {art['titulo']}: {ref.veredito}. {ref.justificativa}")
        if ref.veredito != "outro_assunto" and ref.pontos_principais:
            escolha = (c, art, ref)
            break
        yield "status", "O artigo não serviu. Tentando outro…"

    if escolha is None:
        yield "erro", "Nenhum candidato passou nos filtros. Tente sortear de novo."
        return

    c, art, ref = escolha
    texto_enviado = referencia.preparar_texto(art["texto"], c.pergunta, texto_limite)
    desafio = {
        "pergunta_original": c.pergunta,
        "pergunta_final": ref.pergunta_final or c.pergunta,
        "veredito": ref.veredito,
        "justificativa": ref.justificativa,
        "area": area,
        "subarea": subarea,
        "origem": origem,
        "estilo": ESTILO,
        "artigo": art["titulo"],
        "link": f"https://pt.wikipedia.org/wiki/{art['titulo'].replace(' ', '_')}",
        "pontos_principais": [
            {"ideia": p.ideia, "trecho_do_artigo": p.trecho_do_artigo,
             "trecho_verificado": referencia.trecho_existe(p.trecho_do_artigo, texto_enviado)}
            for p in ref.pontos_principais
        ],
        # O texto que o LLM leu: a avaliação confere as correções contra ele (ver avaliacao.py).
        "texto_referencia": texto_enviado,
        "modelo": modelo,
        "data": datetime.now().isoformat(timespec="seconds"),
        "log": log,
    }
    yield "pronto", desafio
