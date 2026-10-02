"""Funções para buscar artigos na Wikipedia em português."""

import httpx

API = "https://pt.wikipedia.org/w/api.php"

# A Wikimedia pede que todo programa se identifique com um User-Agent.
# Sem ele, as requisições podem ser bloqueadas.
HEADERS = {"User-Agent": "PROSA/0.1 (projeto de estudo; https://github.com/pedroazara/prosa)"}


def buscar(termo: str, limite: int = 5) -> list[str]:
    """Devolve os títulos dos artigos mais relevantes para o termo."""
    resposta = httpx.get(
        API,
        headers=HEADERS,
        params={
            "action": "query",
            "list": "search",
            "srsearch": termo,
            "srlimit": limite,
            "format": "json",
            "formatversion": 2,
        },
    )
    resposta.raise_for_status()
    return [r["title"] for r in resposta.json()["query"]["search"]]


def artigo(titulo: str) -> dict | None:
    """Devolve o título, o texto puro do artigo e se ele é uma página de desambiguação."""
    resposta = httpx.get(
        API,
        headers=HEADERS,
        params={
            "action": "query",
            "titles": titulo,
            "prop": "extracts|pageprops",
            "explaintext": 1,  # texto puro, sem HTML
            "redirects": 1,  # segue redirecionamentos ("Bretton Woods" -> título real)
            "format": "json",
            "formatversion": 2,
        },
    )
    resposta.raise_for_status()
    pagina = resposta.json()["query"]["pages"][0]
    if pagina.get("missing"):
        return None
    return {
        "titulo": pagina["title"],
        "texto": pagina.get("extract", ""),
        # Páginas de desambiguação só listam significados ("Mercúrio pode ser...").
        "desambiguacao": "disambiguation" in pagina.get("pageprops", {}),
    }
