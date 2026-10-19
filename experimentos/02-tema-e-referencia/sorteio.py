"""
Sorteio de temas: a versão reutilizável do passo 3, com a opção de origem dos temas.
"""

import difflib
import random
import re
import unicodedata

import httpx
from openai import OpenAI
from pydantic import BaseModel

import wikipedia
from areas import AREAS, SUBAREAS

# Artigos curtos demais não dão uma boa referência para avaliar a explicação.
TAMANHO_MINIMO = 3000  # caracteres

# Para comparar o título do artigo com o tema (ver _mais_amplo e _sobre_o_tema).
PALAVRAS_VAZIAS = {"de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos", "para", "por", "com"}
# Palavras que aparecem em muitos títulos: "Tratado de Tientsin" não é sobre o "Tratado de Nankín".
PALAVRAS_GENERICAS = {
    "efeito", "lei", "teoria", "modelo", "principio", "tratado", "acordo", "reacao", "processo",
    "metodo", "sindrome", "doenca", "experimento", "paradoxo", "problema", "teorema", "historia",
}

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

# Estilo "tema": em vez de uma pergunta específica, um tema para estudar e explicar.
PROMPT_TEMAS = """\
Você escolhe temas para um treino de aprendizado rápido e comunicação.
A pessoa recebe um tema, pesquisa na internet por 5 a 10 minutos e depois
explica em voz alta os pontos principais.

Cada tema deve ser específico, mas não obscuro:
- uma ideia só: um efeito, lei, princípio, paradoxo, experimento, mecanismo, reação ou caso
  que dá para explicar por inteiro em 2 minutos, sem a pessoa ter que escolher um recorte.
  Exemplos do tamanho certo: "Efeito Stroop", "Efeito Kerr", "Interferômetro de Michelson",
  "Curva de esquecimento de Ebbinghaus", "Reação de Maillard", "Lei de Gresham";
- nada amplo demais, como uma área, um conceito básico ou um fenômeno genérico
  ("Psicologia social", "Cor", "Percepção de cor", "Memória", "Efeito estufa");
- nem um assunto com muitas facetas, que pede história, causas, sintomas, objetivos e
  aplicações ao mesmo tempo: uma doença inteira, um tratado, um programa, uma família de técnicas
  ou um monumento ("Hepatite C", "Dengue", "Acordo de Paris", "Programa Artemis",
  "Espectroscopia de absorção", "Fibra óptica", "Catedral de São Basílio").
  Se o assunto que você pensou é assim, desça um nível: um efeito, uma lei, um experimento
  ou um caso famoso dentro dele ("Memória" → "Curva de esquecimento de Ebbinghaus");
- nem um detalhe obscuro, que só especialistas conhecem ("Novarupta", uma erupção específica);
- compreensível no essencial em 5 a 10 minutos de pesquisa;
- coberto por um artigo próprio na Wikipedia em português: um artigo sobre o tema, e não sobre
  um assunto mais amplo que o inclui.

Use o nome de um assunto que já existe, como o título de um artigo. Não junte um tema a um lugar
ou a uma época ("Manguezais da China", "Feudalismo na França") nem escreva "Contribuições de Fulano".
Dê só o nome do tema, sem transformá-lo em pergunta.
Para cada tema, dê o tema e o termo_busca: o título provável do artigo na Wikipedia.
"""

# No estilo tema, pedir variedade de países fazia o LLM amarrar cada tema a um lugar.
ORIGENS_TEMA = {
    "brasil": "Prefira temas ligados ao Brasil: fenômenos, eventos, obras, instituições e pessoas brasileiras.",
    "mundo": "Temas de qualquer lugar do mundo. Não é preciso ligar o tema a um país.",
}

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


class Tema(BaseModel):
    tema: str
    termo_busca: str


class Temas(BaseModel):
    temas: list[Tema]


def sortear_area() -> str:
    return random.choice(AREAS)


def sortear_subarea(area: str) -> str:
    return random.choice(SUBAREAS[area])


def propor_candidatos(
    cliente: OpenAI,
    modelo: str,
    area: str,
    origem: str,
    recentes: list[str],
    quantidade: int = 20,
    subarea: str | None = None,
    estilo: str = "pergunta",
) -> list[Candidato]:
    """Pede ao LLM vários candidatos e devolve a lista já embaralhada.

    estilo: "pergunta" (uma pergunta específica) ou "tema" (um tema de nível médio para estudar).
    """
    tema = estilo == "tema"
    recorte = f"{area}, dentro de {subarea}" if subarea else area
    origens = ORIGENS_TEMA if tema else ORIGENS
    pedido = f"Proponha {quantidade} {'temas' if tema else 'desafios'} da área: {recorte}.\n{origens[origem]}"
    if recentes:
        pedido += "\n\nNão repita estes, que já foram usados:\n" + "\n".join(f"- {p}" for p in recentes)

    resposta = cliente.chat.completions.parse(
        model=modelo,
        messages=[
            {"role": "system", "content": PROMPT_TEMAS if tema else PROMPT_SISTEMA},
            {"role": "user", "content": pedido},
        ],
        response_format=Temas if tema else Candidatos,
        temperature=1.0,
        # Limite de tokens de saída. Modelos que "pensam" gastam parte desse limite
        # raciocinando, antes de escrever o JSON. Se o limite acabar no meio do JSON,
        # o SDK levanta LengthFinishReasonError.
        max_completion_tokens=8000,
    )
    candidatos = resposta.choices[0].message.parsed.temas
    if tema:  # o resto do código usa a "pergunta" do candidato: no estilo tema, ela é o nome do tema
        candidatos = [Candidato(pergunta=t.tema, termo_busca=t.termo_busca) for t in candidatos]
    random.shuffle(candidatos)  # a escolha final é aleatória e feita em código
    return candidatos


def _palavras(texto: str) -> set[str]:
    """As palavras que contam num título: sem acento, sem parênteses e sem "de", "da", "do"..."""
    texto = re.sub(r"\(.*?\)", " ", texto)
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return {p for p in re.findall(r"[a-z0-9]+", texto) if len(p) > 1 and p not in PALAVRAS_VAZIAS}


def _tem(palavras: set[str], palavra: str) -> bool:
    """Se a palavra está no conjunto, aceitando variações ("lente" e "lentes", "Westfália" e "Vestfália")."""
    return any(difflib.SequenceMatcher(None, palavra, p).ratio() >= 0.8 for p in palavras)


def _mais_amplo(titulo: str, tema: str) -> bool:
    """Se o artigo é sobre um assunto que contém o tema: "Amnésia" para o tema "Amnésia retrógrada".

    Isso acontece quando o tema não tem artigo próprio e a busca (ou um redirecionamento)
    cai no artigo do assunto maior. Comparar as palavras é de graça e evita gastar uma
    leitura do LLM num artigo que ele recusaria, ou pior, aceitaria.
    """
    do_titulo, do_tema = _palavras(titulo), _palavras(tema)
    return len(do_titulo) < len(do_tema) and all(_tem(do_tema, p) for p in do_titulo)


def _sobre_o_tema(titulo: str, candidato: Candidato) -> bool:
    """Se todas as palavras do título vêm do tema, sem contar "tratado", "efeito", "teoria"...

    A busca só serve para variações de nome ("Lentes de Fresnel" → "Lente de Fresnel");
    sinônimos de verdade chegam pelo redirecionamento do título exato. Uma palavra em comum
    não basta: "Efeito Zeigarnik" e "Bluma Zeigarnik", "Polarização circular" e
    "Polarização eletromagnética" (um artigo mais amplo, como "Cor" para "Percepção de cor").
    """
    do_tema = _palavras(candidato.pergunta) | _palavras(candidato.termo_busca)
    do_titulo = _palavras(titulo) - PALAVRAS_GENERICAS
    return bool(do_titulo) and all(_tem(do_tema, p) for p in do_titulo)


def buscar_artigo(
    candidato: Candidato, artigos_usados: set[str], estilo: str = "pergunta"
) -> tuple[dict | None, str]:
    """Procura o artigo do candidato e aplica os filtros de forma.

    Primeiro tenta o título exato, porque a busca prefere artigos grandes: para "Hepatite A",
    que tem artigo próprio, ela devolvia "Hepatite". Só se o título exato não existir é que
    a busca entra, e o resultado dela tem que ser sobre o tema.

    No estilo "tema", recusa também artigos mais amplos que o tema. No estilo "pergunta" essa
    regra não vale: "Como funciona o efeito Hall?" tem mais palavras que o artigo "Efeito Hall".

    Devolve (artigo, "") se passou, ou (None, motivo) se foi descartado.
    """
    def amplo(titulo: str) -> bool:
        return estilo == "tema" and _mais_amplo(titulo, candidato.pergunta)

    try:
        art = wikipedia.artigo(candidato.termo_busca)  # segue redirecionamentos ("Polimetilmetacrilato" → "Acrílico")
        if art is None or art["desambiguacao"]:
            titulos = [t for t in wikipedia.buscar(candidato.termo_busca, limite=3)
                       if _sobre_o_tema(t, candidato) and not amplo(t)]
            artigos = (wikipedia.artigo(t) for t in titulos)  # um gerador: só baixa até achar um que sirva
            art = next((a for a in artigos if a is not None and not a["desambiguacao"]), None)
    except httpx.HTTPError as erro:  # a Wikipedia às vezes demora: perde-se este candidato, não o sorteio
        return None, f"a Wikipedia não respondeu ({type(erro).__name__})"
    if art is None:
        return None, "nenhum artigo próprio do tema"
    if amplo(art["titulo"]):
        return None, f"artigo mais amplo que o tema ({art['titulo']})"
    if art["titulo"] in artigos_usados:
        return None, f"artigo já usado antes ({art['titulo']})"
    if len(art["texto"]) < TAMANHO_MINIMO:
        return None, f"artigo curto demais ({len(art['texto'])} caracteres)"
    return art, ""
