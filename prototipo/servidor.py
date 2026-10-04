"""
Servidor do protótipo: a API que o site em React (pasta web/) usa.

A rubrica fica só aqui no servidor. O navegador recebe apenas a pergunta,
e os pontos esperados só vão para a tela no relatório, depois da gravação.

Uso (na raiz do projeto):
    python prototipo/servidor.py
"""

import json
import shutil
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import desafio
import fala

PASTA = Path(__file__).parent
SITE = PASTA / "web" / "dist"  # gerado por "npm run build"
SESSOES = PASTA / "sessoes"
TEMPO_PESQUISA = 5 * 60  # segundos
TEMPO_EXPLICACAO = 2 * 60

# Sessões em andamento, só na memória: somem quando o servidor reinicia.
sessoes: dict[str, dict] = {}

app = FastAPI(title="PROSA")


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
                    id_sessao = uuid.uuid4().hex[:12]
                    sessoes[id_sessao] = {"desafio": conteudo}
                    conteudo = {"id": id_sessao, "pergunta": conteudo["pergunta_final"],
                                "area": conteudo["area"], "origem": conteudo["origem"]}
                yield json.dumps({"tipo": tipo, "conteudo": conteudo}, ensure_ascii=False) + "\n"
        except Exception as erro:  # o erro precisa chegar à tela, e não só ao terminal
            yield json.dumps({"tipo": "erro", "conteudo": f"Falha no sorteio: {erro}"}, ensure_ascii=False) + "\n"

    return StreamingResponse(eventos(), media_type="application/x-ndjson")


def _sessao(id_sessao: str) -> dict:
    if id_sessao not in sessoes:
        raise HTTPException(404, "Sessão não encontrada. O servidor pode ter reiniciado.")
    return sessoes[id_sessao]


@app.post("/api/sessoes/{id_sessao}/analise")
def analisar(id_sessao: str, audio: UploadFile):
    sessao = _sessao(id_sessao)
    sufixo = Path(audio.filename or "").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=sufixo) as arquivo:
        shutil.copyfileobj(audio.file, arquivo)
        arquivo.flush()
        resultado = fala.analisar(arquivo.name)

    sessao["fala"] = resultado
    d = sessao["desafio"]

    # Guarda a sessão inteira: vai servir de dado para o Teste 3.
    SESSOES.mkdir(exist_ok=True)
    nome = f"{datetime.now():%Y-%m-%d_%H-%M-%S}_{id_sessao}.json"
    (SESSOES / nome).write_text(json.dumps(sessao, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "fala": resultado,
        "pontos": [p["ideia"] for p in d["pontos_principais"]],
        "artigo": d["artigo"],
        "link": d["link"],
    }


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
    uvicorn.run(app, host="127.0.0.1", port=8000)
