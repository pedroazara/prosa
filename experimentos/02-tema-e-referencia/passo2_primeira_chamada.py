"""
Passo 2: primeira conversa com o LLM.

Uso:
    python passo2_primeira_chamada.py
"""

from pydantic import BaseModel

import llm

cliente = llm.criar_cliente()
modelo = llm.modelo()
print(f"Modelo: {modelo}\n")

# 1. Chamada simples: uma lista de mensagens entra, um texto sai.
#    "system" define o comportamento do modelo; "user" é o pedido.
resposta = cliente.chat.completions.create(
    model=modelo,
    messages=[
        {"role": "system", "content": "Responda em português do Brasil, em no máximo duas frases."},
        {"role": "user", "content": "O que é o efeito Hall?"},
    ],
)
print("=== Texto livre ===\n")
print(resposta.choices[0].message.content)

# O fornecedor cobra (ou limita) por tokens: pedaços de palavra.
uso = resposta.usage
print(f"\nTokens: {uso.prompt_tokens} de entrada + {uso.completion_tokens} de saída")


# 2. Saída estruturada: em vez de texto livre, pedimos um JSON num formato fixo.
#    O formato é descrito por uma classe Pydantic. O SDK converte a classe em
#    JSON Schema, o fornecedor obriga o modelo a seguir esse schema, e a resposta
#    já volta convertida num objeto Python.
class Temas(BaseModel):
    temas: list[str]
    dificuldade: str


resposta = cliente.chat.completions.parse(
    model=modelo,
    messages=[
        {"role": "system", "content": "Você sugere temas de estudo, em português do Brasil."},
        {"role": "user", "content": "Sugira 5 temas específicos de Economia."},
    ],
    response_format=Temas,
)
resultado = resposta.choices[0].message.parsed

print("\n=== Saída estruturada ===\n")
print(f"Tipo do resultado: {type(resultado).__name__}")
print(f"Dificuldade: {resultado.dificuldade}")
for tema in resultado.temas:
    print(f"  - {tema}")
