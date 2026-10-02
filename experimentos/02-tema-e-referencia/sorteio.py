"""
Sorteio de temas: a versão reutilizável do passo 3, com a opção de origem dos temas.
"""

import random

from openai import OpenAI
from pydantic import BaseModel

import wikipedia
from areas import AREAS

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

Prefira perguntas do tipo "Como funciona…", "Por que…" e "Qual a importância de…".
Evite "Quais são as características de…", que pedem listas de fatos em vez de ideias.

Para cada desafio, dê a pergunta e o termo_busca: o título provável do artigo na Wikipedia.
"""

# Instrução extra conforme a preferência do usuário.
ORIGENS = {
    "brasil": "Prefira temas ligados ao Brasil: obras, instituições, eventos, pessoas e descobertas brasileiras.",
    "mundo": "Varie países, regiões e épocas. Temas brasileiros podem aparecer, mas não devem ser a maioria.",
}


class Candidato(BaseModel):
    pergunta: str
    termo_busca: str


class Candidatos(BaseModel):
    temas: list[Candidato]


def sortear_area() -> str:
    return random.choice(AREAS)


def propor_candidatos(
    cliente: OpenAI, modelo: str, area: str, origem: str, recentes: list[str], quantidade: int = 20
) -> list[Candidato]:
    """Pede ao LLM vários candidatos e devolve a lista já embaralhada."""
    pedido = f"Proponha {quantidade} desafios da área: {area}.\n{ORIGENS[origem]}"
    if recentes:
        pedido += "\n\nNão repita estes, que já foram usados:\n" + "\n".join(f"- {p}" for p in recentes)

    resposta = cliente.chat.completions.parse(
        model=modelo,
        messages=[
            {"role": "system", "content": PROMPT_SISTEMA},
            {"role": "user", "content": pedido},
        ],
        response_format=Candidatos,
        temperature=1.0,
        # Limite de tokens de saída. Modelos que "pensam" gastam parte desse limite
        # raciocinando, antes de escrever o JSON. Se o limite acabar no meio do JSON,
        # o SDK levanta LengthFinishReasonError.
        max_completion_tokens=8000,
    )
    candidatos = resposta.choices[0].message.parsed.temas
    random.shuffle(candidatos)  # a escolha final é aleatória e feita em código
    return candidatos


def buscar_artigo(candidato: Candidato, artigos_usados: set[str]) -> tuple[dict | None, str]:
    """Procura o artigo do candidato e aplica os filtros de forma.

    Devolve (artigo, "") se passou, ou (None, motivo) se foi descartado.
    """
    titulos = wikipedia.buscar(candidato.termo_busca, limite=1)
    if not titulos:
        return None, "nenhum artigo encontrado"
    art = wikipedia.artigo(titulos[0])
    if art is None or art["desambiguacao"]:
        return None, "só achou página de desambiguação"
    if art["titulo"] in artigos_usados:
        return None, f"artigo já usado antes ({art['titulo']})"
    if len(art["texto"]) < TAMANHO_MINIMO:
        return None, f"artigo curto demais ({len(art['texto'])} caracteres)"
    return art, ""
