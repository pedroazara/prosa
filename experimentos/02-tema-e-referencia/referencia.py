"""
Referência oculta: o LLM lê o artigo, confere se ele serve para a pergunta
e monta a rubrica com os pontos principais.
"""

import re
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel

# Só o começo do artigo vai para o LLM. A introdução e as primeiras seções
# costumam ter o essencial, e textos menores gastam menos da cota grátis.
LIMITE_ARTIGO = 8000  # caracteres

PROMPT_SISTEMA = """\
Você prepara a referência de um treino de aprendizado.
A pessoa recebeu uma pergunta, vai pesquisar por conta própria na internet e depois
explicar em voz alta, em até 2 minutos, os pontos principais do tema, sem entrar em detalhes.

Você recebe a pergunta e um artigo da Wikipedia, entre <artigo> e </artigo>.

1. Decida se o artigo serve de referência para a pergunta:
   - "responde": o artigo trata do assunto da pergunta e cobre o que ela pede;
   - "reescrever": o artigo trata do assunto, mas não cobre o que a pergunta pede.
     Reescreva a pergunta para que ela peça algo que o artigo cobre, mantendo o tema.
     A nova pergunta deve tratar do assunto central do artigo, e não de algo que ele
     só menciona de passagem. Use perguntas do tipo "Como funciona…", "Por que…" ou
     "Qual a importância de…", nunca "Quais são as características de…";
   - "outro_assunto": o artigo é sobre outra coisa, ou só toca de passagem no tema
     da pergunta.
   Em pergunta_final, repita a pergunta original se o veredito for "responde",
   escreva a nova pergunta se for "reescrever" e deixe vazio se for "outro_assunto".

2. Se o veredito não for "outro_assunto", liste de 3 a 5 pontos principais que uma boa
   explicação curta deveria conter:
   - cada ponto é uma ideia completa, numa frase, e não uma palavra-chave.
     Exemplo: "O campo magnético desvia as cargas em movimento, que se acumulam num lado do material."
   - só o essencial: o que qualquer boa fonte sobre o tema mencionaria;
   - algo que uma pessoa lembraria e diria depois de 5 a 10 minutos de pesquisa;
   - cada ponto explica algo: uma causa, um mecanismo, uma consequência ou uma importância.
     Fatos isolados não são pontos principais: medidas, datas, localização, quem administra,
     listas de componentes. Use um número só se ele for o próprio ponto;
   - para cada ponto, copie do artigo, palavra por palavra, um trecho curto que o sustenta.
   Se o veredito for "outro_assunto", deixe a lista vazia.

3. Use apenas o conteúdo do artigo. Não acrescente informações de memória.

Escreva em português do Brasil.
"""


class Ponto(BaseModel):
    ideia: str
    trecho_do_artigo: str


class Referencia(BaseModel):
    # A justificativa vem ANTES do veredito: o modelo escreve o raciocínio
    # primeiro e decide depois, em vez de decidir e inventar uma justificativa.
    justificativa: str
    veredito: Literal["responde", "reescrever", "outro_assunto"]
    pergunta_final: str
    pontos_principais: list[Ponto]


def montar(cliente: OpenAI, modelo: str, pergunta: str, artigo: dict) -> Referencia:
    texto = artigo["texto"][:LIMITE_ARTIGO]
    resposta = cliente.chat.completions.parse(
        model=modelo,
        messages=[
            {"role": "system", "content": PROMPT_SISTEMA},
            {
                "role": "user",
                "content": f"Pergunta: {pergunta}\n\n<artigo titulo=\"{artigo['titulo']}\">\n{texto}\n</artigo>",
            },
        ],
        response_format=Referencia,
        max_completion_tokens=8000,  # espaço para o raciocínio + o JSON (ver sorteio.py)
    )
    return resposta.choices[0].message.parsed


def _normalizar(texto: str) -> str:
    return " ".join(texto.lower().split())


def trecho_existe(trecho: str, texto_artigo: str) -> bool:
    """Confere, no código, se o trecho citado pelo LLM está mesmo no artigo.

    O LLM às vezes encurta citações com "..."; nesse caso, cada parte é conferida.
    """
    partes = [p.strip(" .,;:\"'“”") for p in re.split(r"\.\.\.|…", trecho)]
    partes = [p for p in partes if len(p) >= 15]
    artigo = _normalizar(texto_artigo[:LIMITE_ARTIGO])
    return bool(partes) and all(_normalizar(p) in artigo for p in partes)
