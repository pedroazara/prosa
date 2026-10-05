"""
Servidor do protótipo: a API que o site em React (pasta web/) usa.

A rubrica fica só aqui no servidor. O navegador recebe apenas a pergunta,
e os pontos esperados só vão para a tela no relatório, depois da gravação.

Uso (na raiz do projeto):
    python prototipo/servidor.py

O servidor reinicia sozinho quando um .py do protótipo ou do experimento 2 muda.
As sessões em andamento ficam na memória, então somem nesse reinício.
"""

import json
import re
import shutil
import sys
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import biblioteca
import desafio
import fala

sys.path.insert(0, str(desafio.EXPERIMENTO_2.parent / "03-avaliacao"))
import avaliacao  # noqa: E402

PASTA = Path(__file__).parent
SITE = PASTA / "web" / "dist"  # gerado por "npm run build"
SESSOES = PASTA / "sessoes"
TEMPO_PESQUISA = 5 * 60  # segundos
TEMPO_EXPLICACAO = 2 * 60

# Sessões em andamento, só na memória: somem quando o servidor reinicia.
sessoes: dict[str, dict] = {}

app = FastAPI(title="PROSA")
biblioteca.importar_antigos()


@app.get("/api/config")
def config():
    return {
        "areas": desafio.AREAS,
        "origens": desafio.ORIGENS,
        "tempo_pesquisa": TEMPO_PESQUISA,
        "tempo_explicacao": TEMPO_EXPLICACAO,
    }


class PedidoSessao(BaseModel):
    area: str | None = None
    origem: str = "mundo"


@app.post("/api/sessoes")
def criar_sessao(pedido: PedidoSessao):
    """Sorteia o tema. A resposta chega aos poucos: uma linha JSON por mensagem de andamento."""
    if pedido.area and pedido.area not in desafio.AREAS:
        raise HTTPException(400, "Área desconhecida.")
    if pedido.origem not in desafio.ORIGENS:
        raise HTTPException(400, "Origem desconhecida.")

    def eventos():
        try:
            for tipo, conteudo in desafio.gerar(pedido.area, pedido.origem):
                if tipo == "pronto":
                    biblioteca.salvar(conteudo)
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
    return {"id": id_sessao, "pergunta": desafio_pronto["pergunta_final"],
            "area": desafio_pronto["area"], "origem": desafio_pronto["origem"],
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
        raise HTTPException(404, "Tema salvo não encontrado.")
    return _nova_sessao(desafio_salvo)


def _sessao(id_sessao: str) -> dict:
    if id_sessao not in sessoes:
        # O servidor reinicia sozinho quando o código muda; se a sessão já foi gravada, ela está no disco.
        arquivos = list(SESSOES.glob(f"*_{id_sessao}.json")) if re.fullmatch(r"[0-9a-f]{12}", id_sessao) else []
        if not arquivos:
            raise HTTPException(404, "Sessão não encontrada. O servidor pode ter reiniciado.")
        sessoes[id_sessao] = json.loads(arquivos[0].read_text(encoding="utf-8")) | {"arquivo": arquivos[0].name}
    return sessoes[id_sessao]


def _gravar(sessao: dict) -> None:
    """Salva a sessão inteira em sessoes/: é o dado do Teste 3 (humano × IA)."""
    SESSOES.mkdir(exist_ok=True)
    conteudo = {k: v for k, v in sessao.items() if k != "arquivo"}
    (SESSOES / sessao["arquivo"]).write_text(json.dumps(conteudo, ensure_ascii=False, indent=2), encoding="utf-8")


@app.post("/api/sessoes/{id_sessao}/analise")
def analisar(id_sessao: str, audio: UploadFile, modo: str | None = Form(None)):
    sessao = _sessao(id_sessao)
    sessao["modo"] = modo  # o modo de treino (clássico, relâmpago…), para comparar depois
    sufixo = Path(audio.filename or "").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=sufixo) as arquivo:
        shutil.copyfileobj(audio.file, arquivo)
        arquivo.flush()
        resultado = fala.analisar(arquivo.name)

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
def avaliar(id_sessao: str, pedido: PedidoAvaliacao):
    """Avalia o conteúdo da fala com o LLM. Guarda junto as marcações manuais, para comparar."""
    sessao = _sessao(id_sessao)
    if "fala" not in sessao:
        raise HTTPException(400, "A sessão ainda não tem gravação.")
    if "avaliacao" not in sessao:  # uma avaliação por sessão: pedir de novo não gasta outra chamada
        try:
            sessao["avaliacao"] = avaliacao.avaliar(desafio.cliente, desafio.modelo, sessao["desafio"],
                                                    sessao["fala"]["texto"])
        except Exception as erro:  # o erro precisa chegar à tela, e não só ao terminal
            print(f"Falha na avaliação: {erro}")
            codigo, mensagem = desafio.llm.explicar_erro(erro)
            raise HTTPException(502, mensagem, headers={"X-Codigo-Erro": codigo})
        sessao["marcacoes_humanas"] = pedido.marcacoes
        _gravar(sessao)
    return sessao["avaliacao"]


@app.get("/api/sessoes/{id_sessao}/dev")
def painel_dev(id_sessao: str):
    """Tudo o que foi gerado, inclusive a rubrica oculta. Só para o painel do desenvolvedor."""
    return _sessao(id_sessao)


# O site já compilado. Em desenvolvimento, o Vite serve o site e repassa /api para cá.
if SITE.exists():
    app.mount("/assets", StaticFiles(directory=SITE / "assets"), name="assets")

    @app.get("/{caminho:path}")
    def site(caminho: str):
        arquivo = (SITE / caminho).resolve()
        if caminho and arquivo.is_file() and arquivo.is_relative_to(SITE.resolve()):
            return FileResponse(arquivo)
        return FileResponse(SITE / "index.html")


if __name__ == "__main__":
    print("PROSA rodando em http://127.0.0.1:8000")
    uvicorn.run(
        "servidor:app",  # pelo nome, e não pelo objeto: é o que permite recarregar
        host="127.0.0.1",
        port=8000,
        reload=True,
        app_dir=str(PASTA),
        reload_dirs=[str(PASTA), str(desafio.EXPERIMENTO_2)],
        reload_excludes=["web/*", "temas/*", "sessoes/*"],
    )
