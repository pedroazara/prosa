"""
Referência oculta: o LLM lê o artigo, confere se ele serve para a pergunta
e monta a rubrica com os pontos principais.
"""

import difflib
import re
import unicodedata
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel

# Só um trecho do artigo vai para o LLM: a introdução mais as seções que mais
# têm a ver com a pergunta (ver preparar_texto). Textos menores gastam menos da
# cota grátis (8 mil tokens por minuto): 12 mil caracteres são uns 4 mil tokens.
LIMITE_ARTIGO = 12000  # caracteres
LIMITE_INTRO = 3000  # a introdução entra sempre, mas cortada neste tamanho

# Seções que só listam coisas e nunca explicam nada.
SECOES_IGNORADAS = {
    "ver tambem", "referencias", "ligacoes externas", "notas", "bibliografia",
    "leitura adicional", "fontes", "links externos", "galeria",
}
PALAVRAS_COMUNS = {
    "como", "porque", "qual", "quais", "foi", "para", "pela", "pelo", "entre",
    "sobre", "essa", "esse", "esta", "este", "seus", "suas", "mais", "quando",
}

PROMPT_SISTEMA = """\
Você prepara a referência de um treino de aprendizado.
A pessoa recebeu uma pergunta, vai pesquisar por conta própria na internet e depois
explicar em voz alta, em até 2 minutos, os pontos principais do tema, sem entrar em detalhes.

Você recebe a pergunta e um artigo da Wikipedia, entre <artigo> e </artigo>.

1. Decida se o artigo serve de referência para a pergunta:
   - "responde": o artigo trata do assunto da pergunta e cobre o que ela pede,
     incluindo os recortes que ela traz (período, lugar, comparação). Se a pergunta
     fala de um período ou de um caso específico e o artigo só trata do tema em
     geral, o veredito é "reescrever";
   - "reescrever": o artigo trata do assunto, mas não cobre o que a pergunta pede.
     Reescreva a pergunta para que ela peça algo que o artigo cobre, mantendo o tema.
     A nova pergunta deve tratar do assunto central do artigo, e não de algo que ele
     só menciona de passagem. Use perguntas do tipo "Como funciona…", "Por que…" ou
     "Qual a importância de…", nunca "Quais são as características de…" nem
     "Como ocorreu…" ou "Qual a história de…", que levam a uma cronologia;
   - "outro_assunto": o artigo é sobre outra coisa, ou só toca de passagem no tema
     da pergunta.
   Em pergunta_final, repita a pergunta original se o veredito for "responde",
   escreva a nova pergunta se for "reescrever" e deixe vazio se for "outro_assunto".

2. Se o veredito não for "outro_assunto", liste de 3 a 5 pontos principais que uma boa
   explicação curta deveria conter:
   - cada ponto é uma ideia completa, numa frase, e não uma palavra-chave.
     Exemplo: "O campo magnético desvia as cargas em movimento, que se acumulam num lado do material."
   - os pontos são a RESPOSTA à pergunta final, e não um resumo do artigo. Um ponto que
     valeria para qualquer pergunta sobre o tema (definição, visão geral) é fraco demais;
     prefira o que só esta pergunta pede: a causa, o porquê, o mecanismo, a consequência;
   - só as ideias essenciais: o que, se a pessoa deixasse de dizer, faria a explicação
     ficar sem sentido. Nada de detalhes de segunda ordem;
   - não monte uma linha do tempo: nenhum ponto pode ser só um evento com data.
     Se uma data ou um nome entrar, é de apoio dentro da ideia, nunca o centro dela;
   - cada ponto explica algo: uma causa, um mecanismo, uma consequência ou uma importância.
     Fatos isolados não são pontos principais: medidas, datas, localização, quem administra,
     listas de componentes. Use um número só se ele for o próprio ponto;
   - para cada ponto, copie do artigo, palavra por palavra, um trecho curto que o sustenta.
   Se o veredito for "outro_assunto", deixe a lista vazia.

3. Use apenas o conteúdo do artigo. Não acrescente informações de memória.

Escreva em português do Brasil.
"""

# Estilo "tema" (ver sorteio.py): a pessoa explica um tema de nível médio, e não responde a uma pergunta.
PROMPT_TEMA = """\
Você prepara a referência de um treino de aprendizado.
A pessoa recebeu um tema, vai pesquisar por conta própria na internet e depois
explicar em voz alta, em até 2 minutos, os pontos principais do tema, sem entrar em detalhes.

Você recebe o tema, a área dele e um artigo da Wikipedia, entre <artigo> e </artigo>.

1. Decida se o artigo serve de referência para o tema:
   - "responde": o artigo é especificamente sobre o tema, ainda que com um nome um pouco
     diferente ("Espectroscópio Raman" e "Espectroscopia Raman"; "Polimetilmetacrilato" e "Acrílico");
   - "outro_assunto": o artigo é sobre outra coisa, mesmo que tenha palavras ou lugares em comum
     com o tema (o tema "Falha de Santa Catarina", da Geologia, e um artigo sobre um site de
     reclamações de carro); ou o artigo é sobre um assunto mais amplo, que só trata do tema
     numa parte (o tema "Percepção de cor" e o artigo "Cor"). Na dúvida, "outro_assunto".
   Nunca use "reescrever".
   Em pergunta_final, se o veredito for "responde", escreva o nome do tema como a pessoa vai vê-lo:
   o nome recebido, corrigido só se estiver errado ("Espectroscópio Raman" → "Espectroscopia Raman"),
   sem alargar nem estreitar o tema. Se for "outro_assunto", deixe vazio.

2. Se o veredito for "responde", liste de 3 a 5 pontos principais que uma boa explicação
   curta do tema deveria conter:
   - cada ponto é uma ideia completa, numa frase, e não uma palavra-chave.
     Exemplo: "Gases como o gás carbônico deixam passar a luz do Sol, mas retêm o calor que a Terra emite."
   - juntos, os pontos cobrem o essencial: o que é, como funciona ou por que acontece,
     e por que importa (consequências, usos, impacto). Não precisa haver um ponto de cada;
   - só as ideias essenciais: o que, se a pessoa deixasse de dizer, faria a explicação
     ficar incompleta. Nada de detalhes de segunda ordem;
   - não monte uma linha do tempo: nenhum ponto pode ser só um evento com data.
     Se uma data ou um nome entrar, é de apoio dentro da ideia, nunca o centro dela;
   - fatos isolados não são pontos principais: medidas, datas, localização, listas de
     componentes. Use um número só se ele for o próprio ponto;
   - para cada ponto, copie do artigo, palavra por palavra, um trecho curto que o sustenta.
   Se o veredito for "outro_assunto", deixe a lista vazia.

3. Use apenas o conteúdo do artigo. Não acrescente informações de memória.

Escreva a justificativa e as ideias em português do Brasil, mesmo que o artigo tenha trechos
em outra língua. Só os trechos do artigo são copiados como estão.
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


def _sem_acento(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()


def preparar_texto(texto: str, pergunta: str, limite: int = LIMITE_ARTIGO) -> str:
    """Escolhe o que do artigo vai para o LLM: a introdução e as seções mais ligadas à pergunta.

    Cortar só o começo deixava de fora justamente as seções que explicam causas e
    mecanismos. Aqui as seções são ordenadas por quantas palavras da pergunta elas
    contêm, entram as melhores até o limite e voltam à ordem original do artigo.
    """
    if len(texto) <= limite:
        return texto

    # re.split com grupo de captura devolve [intro, título1, corpo1, título2, corpo2...]
    partes = re.split(r"^=+\s*(.+?)\s*=+\s*$", texto, flags=re.MULTILINE)
    intro = partes[0].strip()[: min(LIMITE_INTRO, limite)]
    secoes = [(partes[i], f"== {partes[i]} ==\n{partes[i + 1].strip()}") for i in range(1, len(partes) - 1, 2)]
    secoes = [(t, c) for t, c in secoes if _sem_acento(t) not in SECOES_IGNORADAS]

    termos = {w for w in re.findall(r"[a-z0-9]{4,}", _sem_acento(pergunta)) if w not in PALAVRAS_COMUNS}

    def nota(secao: tuple[str, str]) -> int:
        palavras = set(re.findall(r"[a-z0-9]{4,}", _sem_acento(secao[1])))
        return len(termos & palavras)

    escolhidas, usado = set(), len(intro)
    for i in sorted(range(len(secoes)), key=lambda i: nota(secoes[i]), reverse=True):
        corpo = secoes[i][1]
        if usado + len(corpo) <= limite:
            escolhidas.add(i)
            usado += len(corpo)
    return "\n\n".join([intro] + [secoes[i][1] for i in sorted(escolhidas)])


def montar(cliente: OpenAI, modelo: str, pergunta: str, artigo: dict, limite: int = LIMITE_ARTIGO,
           estilo: str = "pergunta", area: str | None = None) -> Referencia:
    """estilo: "pergunta" ou "tema" (ver sorteio.py). No estilo tema, a "pergunta" é o nome do tema,
    e a área ajuda a descartar artigos de outro assunto que só têm palavras em comum com ele."""
    texto = preparar_texto(artigo["texto"], pergunta, limite)
    sistema, rotulo = (PROMPT_TEMA, "Tema") if estilo == "tema" else (PROMPT_SISTEMA, "Pergunta")
    if area:
        rotulo = f"Área: {area}\n{rotulo}"
    resposta = cliente.chat.completions.parse(
        model=modelo,
        messages=[
            {"role": "system", "content": sistema},
            {
                "role": "user",
                "content": f"{rotulo}: {pergunta}\n\n<artigo titulo=\"{artigo['titulo']}\">\n{texto}\n</artigo>",
            },
        ],
        response_format=Referencia,
        max_completion_tokens=8000,  # espaço para o raciocínio + o JSON (ver sorteio.py)
    )
    return resposta.choices[0].message.parsed


def _normalizar(texto: str) -> str:
    return " ".join(texto.lower().split())


# Fração mínima de palavras do trecho que precisam bater, na ordem, com algum ponto do artigo.
# Abaixo de 1 para aceitar o que o LLM faz sem querer ao copiar: corrigir um erro de
# digitação do artigo ("dessenvolvimento") ou mudar uma conjugação ("obtiveram" -> "obteve").
SEMELHANCA_MINIMA = 0.9


def _parecido(parte: str, artigo: str) -> bool:
    """Procura no artigo um trecho com quase as mesmas palavras, na mesma ordem."""
    p = re.findall(r"\w+", parte)
    a = re.findall(r"\w+", artigo)
    if not p:
        return False
    # Só testa janelas que começam perto de onde aparece uma das primeiras palavras do trecho.
    inicios = {i for i, w in enumerate(a) if w in p[:3]}
    for i in inicios:
        janela = a[max(0, i - 3) : i + len(p) + 3]
        iguais = sum(b.size for b in difflib.SequenceMatcher(None, p, janela, autojunk=False).get_matching_blocks())
        if iguais / len(p) >= SEMELHANCA_MINIMA:
            return True
    return False


def trecho_existe(trecho: str, texto_enviado: str) -> bool:
    """Confere, no código, se o trecho citado pelo LLM está mesmo no texto que ele recebeu.

    O LLM às vezes encurta citações com "..."; nesse caso, cada parte é conferida.
    Diferenças pequenas (uma palavra a cada dez) são aceitas; ver SEMELHANCA_MINIMA.
    """
    partes = [p.strip(" .,;:\"'“”") for p in re.split(r"\.\.\.|…", trecho)]
    partes = [_normalizar(p) for p in partes if len(p) >= 15]
    artigo = _normalizar(texto_enviado)
    return bool(partes) and all(p in artigo or _parecido(p, artigo) for p in partes)
