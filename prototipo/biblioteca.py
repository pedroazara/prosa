"""
Biblioteca de temas: cada desafio gerado (pergunta + referência + rubrica) fica salvo em temas/,
um JSON por artigo. Assim dá para treinar de novo com um tema já pronto, sem gastar chamadas ao LLM.

A lista que vai para o navegador não tem a rubrica: ela continua oculta até o relatório.
Ela só traz os temas do estilo em uso (desafio.ESTILO): com o estilo "tema", as perguntas
específicas geradas antes ficam guardadas, mas fora da lista.

No site publicado, os temas ficam na tabela prosa_temas do Supabase (ver nuvem.py), e não em arquivos.
"""

import json
import random
import re
import unicodedata
from pathlib import Path

import nuvem
from desafio import ESTILO, EXPERIMENTO_2

PASTA = Path(__file__).parent / "temas"
SESSOES = Path(__file__).parent / "sessoes"
REFERENCIAS = EXPERIMENTO_2 / "referencias"  # as geradas pelo passo4_referencia.py
HISTORICO = EXPERIMENTO_2 / "historico_temas.json"  # o mesmo do passo 4, para não repetir temas
TABELA = "prosa_temas"


def id_do_tema(titulo: str) -> str:
    """O mesmo nome de arquivo do passo4_referencia.py: "Ácido sulfúrico" → "acido-sulfurico"."""
    sem_acento = unicodedata.normalize("NFKD", titulo).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")


def salvar(desafio: dict) -> None:
    if nuvem.ATIVO:
        nuvem.gravar(TABELA, {"id": id_do_tema(desafio["artigo"]), "estilo": desafio.get("estilo", "pergunta"),
                              "area": desafio["area"], "subarea": desafio.get("subarea"),
                              "origem": desafio["origem"], "pergunta": desafio["pergunta_final"],
                              "artigo": desafio["artigo"], "data": desafio["data"], "desafio": desafio})
        return
    PASTA.mkdir(exist_ok=True)
    arquivo = PASTA / f"{id_do_tema(desafio['artigo'])}.json"
    arquivo.write_text(json.dumps(desafio, ensure_ascii=False, indent=2), encoding="utf-8")


def historico() -> list[dict]:
    """Os temas já sorteados, do mais antigo para o mais novo, para o sorteio não repetir."""
    if nuvem.ATIVO:  # na nuvem, a própria biblioteca faz o papel do histórico
        return nuvem.buscar(TABELA, select="pergunta,artigo,area,subarea,data", order="data.asc")
    if HISTORICO.exists():
        return json.loads(HISTORICO.read_text(encoding="utf-8"))
    return []


def registrar(desafio: dict) -> None:
    """Guarda um tema recém-gerado: na biblioteca e no histórico do sorteio."""
    salvar(desafio)
    if nuvem.ATIVO:
        return
    itens = historico()
    itens.append({"pergunta": desafio["pergunta_final"], "area": desafio["area"], "subarea": desafio["subarea"],
                  "artigo": desafio["artigo"], "data": desafio["data"]})
    HISTORICO.write_text(json.dumps(itens, ensure_ascii=False, indent=2), encoding="utf-8")


def importar_antigos() -> None:
    """Traz para a biblioteca os temas gerados antes dela existir (referências do passo 4 e sessões gravadas)."""
    if nuvem.ATIVO or PASTA.exists():
        return
    antigos = [json.loads(f.read_text(encoding="utf-8")) for f in sorted(REFERENCIAS.glob("*.json"))]
    antigos += [json.loads(f.read_text(encoding="utf-8"))["desafio"] for f in sorted(SESSOES.glob("*.json"))]
    for desafio in antigos:
        salvar(desafio)


def _carregar(arquivo: Path) -> dict:
    desafio = json.loads(arquivo.read_text(encoding="utf-8"))
    desafio.setdefault("subarea", None)  # as referências do passo 4 não têm subárea nem log
    desafio.setdefault("log", [])
    desafio.setdefault("estilo", "pergunta")  # os gerados antes do estilo "tema"
    return desafio


def listar() -> list[dict]:
    """Os temas salvos no estilo em uso, do mais novo para o mais antigo, sem a rubrica."""
    if nuvem.ATIVO:
        return nuvem.buscar(TABELA, select="id,pergunta,area,subarea,origem,artigo,data",
                            estilo=f"eq.{ESTILO}", order="data.desc")
    temas = []
    for arquivo in PASTA.glob("*.json"):
        d = _carregar(arquivo)
        if d["estilo"] != ESTILO:
            continue
        temas.append({"id": arquivo.stem, "pergunta": d["pergunta_final"], "area": d["area"],
                      "subarea": d["subarea"], "origem": d["origem"], "artigo": d["artigo"], "data": d["data"]})
    return sorted(temas, key=lambda t: t["data"], reverse=True)


def pegar(id_tema: str | None, area: str | None = None, excluir: list[str] | None = None) -> dict | None:
    """O tema com esse id; sem id, um ao acaso (da área pedida, se houver algum dela).

    "excluir" são temas que já saíram (numa maratona, por exemplo). Se todos da área já saíram,
    repete: é melhor repetir um tema do que sair da área escolhida.
    """
    ids = {t["id"]: t for t in listar()}  # o id só vale se estiver na lista: nada de caminhos inventados
    if id_tema is None:
        base = [i for i, t in ids.items() if t["area"] == area] or list(ids)
        candidatos = [i for i in base if i not in (excluir or [])] or base
        if not candidatos:
            return None
        id_tema = random.choice(candidatos)
    if id_tema not in ids:
        return None
    if nuvem.ATIVO:
        return nuvem.buscar(TABELA, select="desafio", id=f"eq.{id_tema}")[0]["desafio"]
    return _carregar(PASTA / f"{id_tema}.json")
