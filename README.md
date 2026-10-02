# PROSA

**Plataforma de Raciocínio, Oratória, Síntese e Argumentação**

PROSA é um treinador de aprendizado e comunicação. O usuário estuda um tema desconhecido por poucos minutos e depois o explica em voz alta, sem consultar o material. O sistema dá feedback sobre o que ele entendeu e sobre como comunicou.

> **Status:** fase inicial, nos testes de risco (Fase 0). Ainda não há código executável.

---

## Sobre o projeto

Em entrevistas, apresentações, reuniões e defesas de projeto, saber o assunto não basta. Também é preciso:

- entender rápido;
- identificar o que é essencial;
- organizar o raciocínio;
- explicar com clareza;
- responder perguntas inesperadas.

O PROSA cria um ambiente para treinar esse ciclo completo:

```
Aprender → Compreender → Organizar → Explicar → Responder → Argumentar
```

**Este é um projeto de estudo.** O objetivo principal é aprender engenharia de aplicações com LLMs na prática:

- geração estruturada;
- LLM como avaliador;
- construção de *evals*;
- redução de alucinação;
- conversas com várias rodadas;
- integração com reconhecimento de fala.

Viabilidade comercial não é um objetivo.

## Como funciona

```
Tema desconhecido
        ↓
Material de estudo (baseado em artigo da Wikipedia) + rubrica oculta
        ↓
Tempo limitado de estudo
        ↓
Material é ocultado
        ↓
Gravação da explicação em voz alta
        ↓
Transcrição (Whisper)
        ↓
Métricas de fala (código)  +  Análise de conteúdo (LLM)
        ↓
Perguntas de follow-up
        ↓
Relatório com feedback
```

Exemplo de sessão:

```
Tema:                 Como funcionam os relógios atômicos?
Tempo de estudo:      05:00
Tempo de explicação:  03:00
Perguntas extras:     3
Modo:                 Learn & Explain
```

Ao gerar o material, o sistema também cria uma **rubrica oculta**: a lista de conceitos essenciais que uma boa explicação deveria conter. O usuário nunca vê essa rubrica. Ela serve para avaliar a explicação depois.

```json
{
  "tema": "Efeito Hall",
  "conceitos_essenciais": [
    "força de Lorentz",
    "movimento de portadores de carga",
    "separação de cargas",
    "tensão Hall",
    "campo magnético",
    "aplicações em sensores"
  ]
}
```

## Princípios de design

Estas decisões existem para enfrentar o maior problema do projeto: **fazer a avaliação ser confiável**.

1. **O que dá para medir em código é medido em código.** Palavras por minuto, pausas e vícios de linguagem são calculados de forma determinística e reproduzível, nunca pelo LLM.
2. **O LLM só entra onde precisa de julgamento.** Ele avalia cobertura de conceitos, erros conceituais, organização da resposta e escreve o feedback.
3. **Toda avaliação cita evidência.** Cada conceito marcado como ✓ ou ✗ aponta o trecho da transcrição que justifica a marcação.
4. **Feedback em vez de notas inventadas.** Usamos checklists e comentários que dizem o que fazer. Não usamos porcentagens como "Clareza 82%", que variam a cada execução e não significam nada.
5. **Conteúdo e comunicação são avaliados separadamente.**
6. **O material vem de uma fonte.** O LLM resume um artigo real em vez de escrever de memória, o que reduz alucinação.
7. **A rubrica não chega à interface antes da avaliação.**
8. **O código não depende de um fornecedor.** Trocar entre um modelo local e uma API é só configuração.
9. **Local e gratuito por padrão.** Para rodar o projeto, não é preciso pagar nenhuma API.

## Stack

| Componente | Padrão (grátis, local) | Alternativas |
|---|---|---|
| Linguagem | Python 3.12+ | — |
| LLM | [Ollama](https://ollama.com) + modelo aberto de 7–9B | Gemini e Groq (planos grátis); Claude e OpenAI (pagos) |
| Transcrição | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (local) | Whisper via Groq |
| Fonte de conteúdo | API da Wikipedia em português | — |
| Interface | Streamlit | FastAPI + Next.js (futuro) |
| Armazenamento | Arquivos JSON ou SQLite | PostgreSQL (futuro) |

Ollama, Groq e Gemini oferecem endpoints compatíveis com o formato da OpenAI. Por isso, um único cliente atende os três, e trocar de fornecedor é só mudar a URL e a chave. O Claude usa o SDK da Anthropic, com um adaptador próprio.

## Estrutura do projeto (planejada)

```
prosa/
  pipeline/
    schemas.py        ← formatos de dados (material, rubrica, transcrição, análise)
    llm.py            ← LLMProvider: Ollama / Gemini / Groq / ...
    generation.py     ← tema, material e rubrica
    followups.py      ← perguntas de follow-up
    transcription.py  ← Whisper
    metrics.py        ← palavras/min, pausas, vícios de linguagem
    analysis.py       ← análise de conteúdo (LLM como avaliador)
  prompts/            ← prompts em arquivos, versionados no git
  evals/              ← transcrições + avaliações feitas à mão
  app.py              ← interface (Streamlit)
  .env.example        ← modelo de configuração (sem chaves reais)
```

O `pipeline/` fica separado da interface. Assim, dá para trocar o Streamlit por FastAPI + Next.js no futuro sem reescrever a lógica.

## Roadmap

### Fase 0: testes de risco

Antes de qualquer interface, validar com scripts as partes que podem inviabilizar o projeto.

- [ ] **Teste 1: vícios de linguagem.** O Whisper preserva "é...", "tipo", "né"?
  - Transcrever gravações com e sem um `initial_prompt` cheio de hesitações.
  - Comparar com a contagem feita à mão.
- [ ] **Teste 2: geração.** O modelo local cria material e rubrica que prestam?
  - O JSON vem válido?
  - O material é fiel ao artigo da Wikipedia?
  - A rubrica faz sentido?
- [ ] **Teste 3: avaliação.** O LLM avaliador concorda com a avaliação humana?
  - Cada integrante avalia à mão a mesma explicação.
  - Comparar as avaliações humanas com a do LLM.

### V1: MVP

**Entra:**
- um único modo (Learn & Explain);
- tema, material e rubrica;
- timer de estudo e ocultação do material;
- gravação, transcrição e métricas de fala;
- análise de conteúdo com evidências;
- relatório da sessão;
- alternativa de digitar a resposta em vez de gravar.

**Fica de fora:** login, follow-ups, outros modos, gráficos de evolução e vídeo.

### Evals: antes de qualquer feature nova

- [ ] Juntar cerca de 20 gravações, cada uma avaliada à mão pelos dois integrantes.
- [ ] Medir a concordância humano × humano. Essa é a meta que o avaliador automático precisa atingir.
- [ ] Medir a concordância humano × LLM.
- [ ] Rodar o conjunto de avaliação a cada mudança de prompt.

### V2: follow-ups

Perguntas de aprofundamento geradas a partir da resposta:

```
Resposta → Análise → Pergunta → Resposta → Nova pergunta
```

### V3: histórico

- Sessões anteriores.
- Evolução das métricas ao longo do tempo.

### V4: outros modos

- **Feynman:** explicar em linguagem simples.
- **Entrevista:** perguntas cada vez mais difíceis.
- **Debate:** defender uma posição sorteada e responder a objeções.
- **Públicos diferentes:** explicar o mesmo tema para uma criança, um estudante e um especialista.

### Fora do escopo por enquanto

- Visão computacional (contato visual, postura, gestos, expressões faciais).
- Dificuldade adaptativa por área. Ela só faz sentido depois de dezenas de sessões por área.
- Autenticação e múltiplos usuários.

## Organização da dupla

O trabalho é dividido por etapa do pipeline, e não em frontend e backend, para que os dois trabalhem com LLM.

| Frente | Responsabilidades | Responsável |
|---|---|---|
| **Geração** | Tema, material com base na Wikipedia, rubrica, follow-ups | _a definir_ |
| **Avaliação** | Transcrição, métricas de fala, análise de conteúdo, evals | _a definir_ |

Cada frente faz a parte da interface que corresponde ao que construiu. Na metade do V1, vale trocar de frente por um tempo, para os dois conhecerem o pipeline inteiro.

### Convenções

- **Formatos primeiro.** Os formatos em `pipeline/schemas.py` são definidos em conjunto, antes do código. Depois disso, cada frente trabalha em paralelo.
- **Prompts são código.** Ficam em `prompts/` e só mudam via pull request revisado pelo outro integrante.
- **Chaves de API só no `.env`.** Nunca no git. O `.env.example` mostra quais variáveis existem.
- **Gravações de áudio ficam fora do git.** Versionamos as transcrições e as avaliações; os áudios são compartilhados por outro meio.

## Configuração do ambiente (Fase 0)

### 1. Python

Use Python 3.12 ou mais novo. Se a instalação de alguma biblioteca falhar numa versão muito recente, use o 3.12.

Windows (PowerShell):

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
```

macOS / Linux:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

### 2. Whisper

```bash
pip install faster-whisper requests
```

Para rodar na GPU (NVIDIA), o faster-whisper precisa das bibliotecas CUDA (cuBLAS e cuDNN). Se configurar isso der trabalho, comece na CPU com o modelo `small` ou `medium`: para os testes de risco, é suficiente.

### 3. Ollama

Instale pelo site [ollama.com](https://ollama.com) e baixe um modelo de 7 a 9B, por exemplo:

```bash
ollama pull qwen3:8b
```

Um modelo nessa faixa cabe em uma GPU de 8 GB. Modelos maiores rodam dividindo a carga com a RAM, só que mais devagar.

### 4. (Opcional) APIs na nuvem

Se o computador não rodar modelos locais, use o plano grátis do [Gemini](https://aistudio.google.com) ou do [Groq](https://console.groq.com). As chaves vão no arquivo `.env`.

## Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Sistemas de transcrição apagam hesitações ("é...", "hum") | `initial_prompt` com hesitações; detectar pausas pelo áudio; validar no Teste 1 |
| "é", "então", "tipo", "aí" também são palavras normais | Desambiguar pelo contexto; tratar a métrica de vícios como aproximada |
| Modelos locais pequenos avaliam de forma menos consistente | Rubrica com evidência; evals; comparar com um modelo maior |
| Material com erro em tema desconhecido para o usuário | Basear o material em um artigo real e mostrar a fonte |
| Notas do LLM variam entre execuções | Checklists com evidência em vez de porcentagens |
| Espera de 5 a 15 s por rodada de follow-up | Aceitável no V2; streaming para melhorar a percepção |

## Equipe

- _a definir_
- _a definir_

## Licença

A definir.
