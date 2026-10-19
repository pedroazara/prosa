"""
Servidor do protótipo: a API que o site em React (pasta web/) usa.

A rubrica fica só aqui no servidor. O navegador recebe apenas a pergunta,
e os pontos esperados só vão para a tela no relatório, depois da gravação.

Uso (na raiz do projeto):
    ./treinar.sh                          ← para treinar: prepara tudo e abre o site
    python prototipo/servidor.py --treino ← o mesmo, se o site já estiver compilado
    python prototipo/servidor.py          ← para desenvolver

Para desenvolver, o servidor reinicia sozinho quando um .py do protótipo ou do experimento 2 muda.
As sessões em andamento ficam na memória, então somem nesse reinício. No modo de treino ele não reinicia.

No site publicado (Vercel, ver app.py na raiz), cada pessoa usa a própria chave da Groq: o navegador
a manda no cabeçalho X-Groq-Key a cada pedido, e ela não é guardada aqui. Sessões e temas vão para
o Supabase (nuvem.py), porque lá o disco é só de leitura e cada pedido pode cair numa máquina diferente.
"""

import json
import re
import shutil
import sys
import tempfile
import threading
import time
import urllib.request
import uuid
import webbrowser
from datetime import datetime
from pathlib import Path

import uvicorn
from fastapi import Depends, FastAPI, Form, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# No Vercel o servidor é importado de fora (app.py, na raiz): os módulos ao lado precisam estar no caminho.
sys.path.insert(0, str(Path(__file__).parent))

import biblioteca  # noqa: E402
import desafio  # noqa: E402
import fala  # noqa: E402
import nuvem  # noqa: E402

# A avaliação pelo LLM vem do experimento 3, que ainda não existe: sem ele, só esse endpoint fica de fora.
sys.path.insert(0, str(desafio.EXPERIMENTO_2.parent / "03-avaliacao"))
try:
    import avaliacao  # noqa: E402
except ImportError:
    avaliacao = None

PASTA = Path(__file__).parent
SITE = PASTA / "web" / "dist"  # gerado por "npm run build"
SESSOES = PASTA / "sessoes"
TEMPO_PESQUISA = 5 * 60  # segundos
TEMPO_EXPLICACAO = 2 * 60

# Sessões em andamento, só na memória: somem quando o servidor reinicia. Na nuvem, ficam no Supabase.
sessoes: dict[str, dict] = {}
TABELA_SESSOES = "prosa_sessoes"

app = FastAPI(title="PROSA")
biblioteca.importar_antigos()


def _chave(x_groq_key: str | None = Header(None)) -> str | None:
    """A chave da Groq que veio do navegador. Sem ela, vale a do .env (no PC); se nem essa existe, pede a chave."""
    chave = (x_groq_key or "").strip() or None
    if chave is None and not desafio.llm.configurado():
        raise HTTPException(401, "Cole a sua chave da Groq para usar o PROSA.", headers={"X-Codigo-Erro": "sem_chave"})
    return chave


def _erro_da_ia(erro: Exception, onde: str) -> HTTPException:
    """O erro precisa chegar à tela, e não só ao terminal."""
    print(f"Falha {onde}: {erro}")
    codigo, mensagem = desafio.llm.explicar_erro(erro)
    return HTTPException(502, mensagem, headers={"X-Codigo-Erro": codigo})


@app.get("/api/config")
def config():
    return {
        "chave_no_servidor": desafio.llm.configurado(),  # sem ela, o site pede a chave da Groq de quem usa
        "areas": desafio.AREAS,
        "origens": desafio.ORIGENS,
        "tempo_pesquisa": TEMPO_PESQUISA,
        "tempo_explicacao": TEMPO_EXPLICACAO,
    }


class PedidoSessao(BaseModel):
    area: str | None = None
    origem: str = "mundo"


class PedidoChave(BaseModel):
    chave: str


@app.post("/api/chave")
def testar_chave(pedido: PedidoChave):
    """Confere se a chave da Groq funciona, antes de o navegador guardá-la."""
    try:
        desafio.llm.criar_cliente(pedido.chave.strip()).models.list()
    except Exception as erro:
        raise _erro_da_ia(erro, "no teste da chave")
    return {"ok": True}


@app.post("/api/sessoes")
def criar_sessao(pedido: PedidoSessao, chave: str | None = Depends(_chave)):
    """Sorteia o tema. A resposta chega aos poucos: uma linha JSON por mensagem de andamento."""
    if pedido.area and pedido.area not in desafio.AREAS:
        raise HTTPException(400, "Área desconhecida.")
    if pedido.origem not in desafio.ORIGENS:
        raise HTTPException(400, "Origem desconhecida.")

    def eventos():
        try:
            for tipo, conteudo in desafio.gerar(pedido.area, pedido.origem, chave, biblioteca.historico()):
                if tipo == "pronto":
                    biblioteca.registrar(conteudo)
                    conteudo = _nova_sessao(conteudo)
                yield json.dumps({"tipo": tipo, "conteudo": conteudo}, ensure_ascii=False) + "\n"
        except Exception as erro:  # o erro precisa chegar à tela, e não só ao terminal
            print(f"Falha no sorteio: {erro}")
            codigo, mensagem = desafio.llm.explicar_erro(erro)
            yield json.dumps({"tipo": "erro", "conteudo": mensagem, "codigo": codigo}, ensure_ascii=False) + "\n"

    return StreamingResponse(eventos(), media_type="application/x-ndjson")


def _nova_sessao(desafio_pronto: dict) -> dict:
    """Guarda o desafio (com a rubrica) aqui no servidor e devolve só o que o navegador pode ver."""
    id_sessao = uuid.uuid4().hex[:12]
    sessoes[id_sessao] = {"desafio": desafio_pronto}
    if nuvem.ATIVO:  # o próximo pedido pode cair em outra máquina: a sessão já precisa estar no banco
        nuvem.gravar(TABELA_SESSOES, {"id": id_sessao, "sessao": sessoes.pop(id_sessao)})
    return {"id": id_sessao, "pergunta": desafio_pronto["pergunta_final"],
            "area": desafio_pronto["area"], "subarea": desafio_pronto.get("subarea"),
            "origem": desafio_pronto["origem"],
            "tema": biblioteca.id_do_tema(desafio_pronto["artigo"])}


@app.get("/api/temas")
def temas_salvos():
    """Os temas já gerados, sem a rubrica."""
    return biblioteca.listar()


class PedidoTemaSalvo(BaseModel):
    id: str | None = None  # sem id: sorteia um dos salvos
    area: str | None = None
    excluir: list[str] = []  # temas que já saíram (maratona)


@app.post("/api/sessoes/salvo")
def usar_tema_salvo(pedido: PedidoTemaSalvo):
    """Começa uma sessão com um tema já gerado. Não chama o LLM."""
    desafio_salvo = biblioteca.pegar(pedido.id, pedido.area, pedido.excluir)
    if desafio_salvo is None:
        raise HTTPException(404, "Ainda não há temas salvos. Sorteie um tema novo: cada sorteio fica salvo.")
    return _nova_sessao(desafio_salvo)


def _sessao(id_sessao: str) -> dict:
    if nuvem.ATIVO:  # sempre do banco: uma cópia na memória podia estar velha
        valido = re.fullmatch(r"[0-9a-f]{12}", id_sessao)
        linhas = nuvem.buscar(TABELA_SESSOES, select="sessao", id=f"eq.{id_sessao}") if valido else []
        if not linhas:
            raise HTTPException(404, "Sessão não encontrada.")
        return linhas[0]["sessao"] | {"id": id_sessao}
    if id_sessao not in sessoes:
        # O servidor reinicia sozinho quando o código muda; se a sessão já foi gravada, ela está no disco.
        arquivos = list(SESSOES.glob(f"*_{id_sessao}.json")) if re.fullmatch(r"[0-9a-f]{12}", id_sessao) else []
        if not arquivos:
            raise HTTPException(404, "Sessão não encontrada. O servidor pode ter reiniciado.")
        sessoes[id_sessao] = json.loads(arquivos[0].read_text(encoding="utf-8")) | {"arquivo": arquivos[0].name}
    return sessoes[id_sessao]


def _gravar(sessao: dict) -> None:
    """Salva a sessão inteira em sessoes/ (ou no banco): é o dado do Teste 3 (humano × IA)."""
    conteudo = {k: v for k, v in sessao.items() if k not in ("arquivo", "id")}
    if nuvem.ATIVO:
        nuvem.gravar(TABELA_SESSOES, {"id": sessao["id"], "sessao": conteudo})
        return
    SESSOES.mkdir(exist_ok=True)
    (SESSOES / sessao["arquivo"]).write_text(json.dumps(conteudo, ensure_ascii=False, indent=2), encoding="utf-8")


@app.post("/api/sessoes/{id_sessao}/analise")
def analisar(id_sessao: str, audio: UploadFile, modo: str | None = Form(None),
             chave: str | None = Depends(_chave)):
    sessao = _sessao(id_sessao)
    sessao["modo"] = modo  # o modo de treino (clássico, relâmpago…), para comparar depois
    sufixo = Path(audio.filename or "").suffix or ".webm"
    # No Windows um arquivo temporário aberto não pode ser reaberto por outro leitor: fecha antes de analisar.
    with tempfile.NamedTemporaryFile(suffix=sufixo, delete=False) as arquivo:
        shutil.copyfileobj(audio.file, arquivo)
    try:
        resultado = fala.analisar(arquivo.name, chave)
    except Exception as erro:
        raise _erro_da_ia(erro, "na transcrição")
    finally:
        Path(arquivo.name).unlink(missing_ok=True)

    sessao["fala"] = resultado
    d = sessao["desafio"]

    sessao["arquivo"] = f"{datetime.now():%Y-%m-%d_%H-%M-%S}_{id_sessao}.json"
    _gravar(sessao)

    return {
        "fala": resultado,
        "pontos": [p["ideia"] for p in d["pontos_principais"]],
        "artigo": d["artigo"],
        "link": d["link"],
    }


class PedidoAvaliacao(BaseModel):
    marcacoes: list[bool]  # o que a pessoa marcou à mão, ANTES de ver a avaliação da IA


@app.post("/api/sessoes/{id_sessao}/avaliacao")
def avaliar(id_sessao: str, pedido: PedidoAvaliacao, chave: str | None = Depends(_chave)):
    """Avalia o conteúdo da fala com o LLM. Guarda junto as marcações manuais, para comparar."""
    if avaliacao is None:
        raise HTTPException(501, "A avaliação pela IA ainda não foi desenvolvida (experimento 3).")
    sessao = _sessao(id_sessao)
    if "fala" not in sessao:
        raise HTTPException(400, "A sessão ainda não tem gravação.")
    if "avaliacao" not in sessao:  # uma avaliação por sessão: pedir de novo não gasta outra chamada
        try:
            cliente = desafio.llm.criar_cliente(chave).with_options(max_retries=6)
            sessao["avaliacao"] = avaliacao.avaliar(cliente, desafio.llm.modelo(chave), sessao["desafio"],
                                                    sessao["fala"]["texto"])
        except Exception as erro:
            raise _erro_da_ia(erro, "na avaliação")
        sessao["marcacoes_humanas"] = pedido.marcacoes
        _gravar(sessao)
    return sessao["avaliacao"]


@app.get("/api/sessoes/{id_sessao}/dev")
def painel_dev(id_sessao: str):
    """Tudo o que foi gerado, inclusive a rubrica oculta. Só para o painel do desenvolvedor."""
    return _sessao(id_sessao)


# O site já compilado. Em desenvolvimento, o Vite serve o site e repassa /api para cá.
# No Vercel, esses arquivos saem direto da CDN, sem passar pelo Python.
if SITE.exists():
    app.frontend("/", directory=SITE)


ENDERECO = "http://127.0.0.1:8000"


def _respondendo() -> bool:
    """O PROSA já responde no endereço? (o servidor acabou de subir, ou o comando rodou duas vezes)"""
    try:
        with urllib.request.urlopen(f"{ENDERECO}/api/config", timeout=1):
            return True
    except OSError:
        return False


def _abrir_quando_pronto() -> None:
    for _ in range(60):  # até 30 s
        if _respondendo():
            webbrowser.open(ENDERECO)
            return
        time.sleep(0.5)


if __name__ == "__main__":
    # Modo de treino: abre o navegador e não reinicia sozinho, porque uma mudança no código
    # no meio do treino apagaria a sessão em andamento.
    if "--treino" in sys.argv:
        if _respondendo():
            print(f"O PROSA já está rodando. Abrindo {ENDERECO}")
            webbrowser.open(ENDERECO)
            sys.exit()
        if not SITE.exists():
            sys.exit("O site ainda não foi compilado. Use ./treinar.sh, que compila e abre tudo.")
        print(f"PROSA rodando em {ENDERECO}. O navegador vai abrir sozinho; Ctrl+C para parar.")
        threading.Thread(target=_abrir_quando_pronto, daemon=True).start()
        uvicorn.run(app, host="127.0.0.1", port=8000)
        sys.exit()

    print(f"PROSA rodando em {ENDERECO}")
    uvicorn.run(
        "servidor:app",  # pelo nome, e não pelo objeto: é o que permite recarregar
        host="127.0.0.1",
        port=8000,
        reload=True,
        app_dir=str(PASTA),
        reload_dirs=[str(PASTA), str(desafio.EXPERIMENTO_2)],
        reload_excludes=["web/*", "temas/*", "sessoes/*"],
    )
