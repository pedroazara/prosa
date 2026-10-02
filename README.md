# PROSA

**Plataforma de Raciocínio, Oratória, Síntese e Argumentação**

PROSA é um treinador de aprendizado e comunicação. O usuário recebe um tema desconhecido, pesquisa sobre ele na internet por poucos minutos e depois o explica em voz alta, sem consultar nada. O sistema dá feedback sobre o que ele entendeu e sobre como comunicou.

> **Status:** Fase 0, testes de risco.
> - Transcrição (Teste 1) e sorteio de tema com referência (Teste 2): funcionando, como scripts em [`experimentos/`](experimentos/).
> - Avaliação da explicação (Teste 3): é o próximo passo.
>
> Ainda não há aplicativo.

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
Tema aleatório e desconhecido
        ↓
Usuário pesquisa na internet        |   Sistema monta, em segredo,
por conta própria (tempo limitado)  |   a referência e a rubrica
        ↓
Fim do tempo: o usuário fecha as fontes
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
Origem dos temas:     mundo (ou: brasil)
Tempo de pesquisa:    05:00
Tempo de explicação:  02:00
Perguntas extras:     3
Modo:                 Learn & Explain
```

### O desafio: os pontos principais

O usuário não precisa explicar tudo. O desafio é falar **os pontos principais do tema, sem entrar em detalhes**, em até 2 minutos.

Isso tem três vantagens:
- treina síntese;
- mantém o usuário no tema;
- torna a avaliação mais confiável, porque há menos afirmações para conferir.

Os detalhes não tiram nem dão pontos. A profundidade é testada depois, nas perguntas de follow-up.

### Referência e rubrica ocultas

A IA **não** gera material de estudo para o usuário: ele aprende com as fontes que encontrar, como faria na vida real. Enquanto ele pesquisa, o sistema monta, só para uso próprio, duas coisas:

- uma **referência** sobre o tema, a partir de um artigo da Wikipedia;
- uma **rubrica** com os **3 a 5 pontos principais** que uma boa explicação deveria conter.

O usuário nunca vê nenhuma das duas. Elas servem só para avaliar a explicação depois.

Antes de montar a rubrica, o LLM confere se o artigo realmente responde à pergunta sorteada. Se não responde, o artigo é descartado ou a pergunta é reescrita.

Cada ponto da rubrica é uma **ideia**, e não uma palavra-chave. Assim a avaliação confere se o usuário ligou as coisas, e não se ele recitou termos. Cada ponto traz o trecho do artigo que o sustenta, e o código confere se esse trecho existe mesmo no artigo:

```json
{
  "pergunta_final": "Como funciona o efeito Hall?",
  "artigo": "Efeito Hall",
  "pontos_principais": [
    {
      "ideia": "O campo magnético desvia as cargas em movimento, que se acumulam num lado do material.",
      "trecho_do_artigo": "...",
      "trecho_verificado": true
    }
  ]
}
```

Como cada pessoa pesquisa em fontes diferentes, a rubrica lista apenas o essencial, aquilo que qualquer boa fonte sobre o tema cobriria. Pontos corretos que estejam fora dela não são penalizados.

O sistema não controla o que o usuário consulta durante a explicação. O PROSA é uma ferramenta de treino e funciona na base da honestidade.

## Princípios de design

Estas decisões existem para enfrentar o maior problema do projeto: **fazer a avaliação ser confiável**.

1. **O que dá para medir em código é medido em código.** Palavras por minuto, pausas e vícios de linguagem são calculados de forma determinística e reproduzível, nunca pelo LLM.
2. **O LLM só entra onde precisa de julgamento.** Ele avalia cobertura de conceitos, erros conceituais, organização da resposta e escreve o feedback.
3. **Toda avaliação cita evidência.** Cada conceito marcado como ✓ ou ✗ aponta o trecho da transcrição que justifica a marcação.
4. **Feedback em vez de notas inventadas.** Usamos checklists e comentários que dizem o que fazer. Não usamos porcentagens como "Clareza 82%", que variam a cada execução e não significam nada.
5. **Conteúdo e comunicação são avaliados separadamente.**
6. **A referência vem de uma fonte.** O LLM monta a referência a partir de um artigo real, e não de memória. Isso importa porque é com base nela que o LLM decide se o usuário errou. Uma referência com alucinação faria o sistema "corrigir" o que estava certo.
7. **Pontos corretos fora da rubrica não são penalizados.** O usuário pesquisa nas próprias fontes e pode trazer aspectos válidos que a rubrica não lista. A análise separa três grupos:
   - conceitos essenciais cobertos;
   - outros pontos corretos;
   - afirmações erradas.
8. **A referência e a rubrica não chegam à interface antes da avaliação.**
9. **Aleatoriedade e verificação ficam no código; julgamento e criatividade, no LLM.**
   - O código sorteia a área e escolhe entre os candidatos, porque LLMs repetem sempre os mesmos temas.
   - O LLM propõe temas e julga se um artigo responde à pergunta.
10. **Não confie, verifique.** Toda citação que o LLM faz, seja do artigo ou da transcrição, é conferida no código. Uma citação que não existe é marcada.
11. **O código não depende de um fornecedor.** Trocar entre Groq, Gemini e um modelo local é só configuração.
12. **Gratuito.** A transcrição roda localmente e o LLM usa um plano grátis. Para rodar o projeto, não é preciso pagar nenhuma API.

## Stack

| Componente | Em uso (grátis) | Alternativas |
|---|---|---|
| Linguagem | Python 3.12+ (testado com o 3.14) | — |
| LLM | [Groq](https://console.groq.com), plano grátis, modelo `openai/gpt-oss-120b` | Gemini (grátis); [Ollama](https://ollama.com) (local); Claude e OpenAI (pagos) |
| Cliente do LLM | Biblioteca `openai` + saída estruturada com Pydantic | — |
| Transcrição | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) local, modelos `small`/`medium` na CPU | Whisper via Groq |
| Fonte da referência | API da Wikipedia em português | — |
| Interface | Streamlit | FastAPI + Next.js (futuro) |
| Armazenamento | Arquivos JSON ou SQLite | PostgreSQL (futuro) |

Ollama, Groq e Gemini oferecem endpoints compatíveis com o formato da OpenAI. Por isso, um único cliente atende os três, e trocar de fornecedor é só mudar a URL e a chave. O Claude usa o SDK da Anthropic, com um adaptador próprio.

## Estrutura do projeto

### Hoje

```
prosa/
  experimentos/
    01-whisper/                 ← Teste 1: transcrição e vícios de linguagem
      GUIA.md                   ← passo a passo para aprender e fazer o teste
      passo1_transcrever.py
      passo2_palavras_e_pausas.py
      passo3_teste_vicios.py
      audios/                   ← gravações (fora do git)
      resultados/               ← resultados dos testes (fora do git)
    02-tema-e-referencia/       ← Teste 2: sorteio de tema, referência e rubrica
      GUIA.md
      llm.py                    ← conexão com o LLM (lê o .env)
      wikipedia.py              ← busca de artigos
      areas.py                  ← áreas do conhecimento para o sorteio
      sorteio.py                ← sorteio de temas (módulo reutilizável)
      referencia.py             ← conferência do artigo + rubrica (módulo reutilizável)
      passo1_wikipedia.py … passo4_referencia.py
      referencias/              ← referências geradas (usadas no Teste 3)
  requirements.txt
  .env.example                  ← modelo de configuração (a chave fica no .env, fora do git)
```

### Planejada (V1)

Os módulos dos experimentos (`llm.py`, `sorteio.py`, `referencia.py`…) vão migrar para o `pipeline/`.

```
prosa/
  pipeline/
    schemas.py        ← formatos de dados (tema, referência, rubrica, transcrição, análise)
    llm.py            ← LLMProvider: Ollama / Gemini / Groq / ...
    generation.py     ← sorteio do tema, referência e rubrica
    followups.py      ← perguntas de follow-up
    transcription.py  ← Whisper
    metrics.py        ← palavras/min, pausas, vícios de linguagem
    analysis.py       ← análise de conteúdo (LLM como avaliador)
  prompts/            ← prompts em arquivos, versionados no git
  evals/              ← transcrições + avaliações feitas à mão
  experimentos/       ← scripts de aprendizado e testes de risco (Fase 0)
  app.py              ← interface (Streamlit)
  .env.example        ← modelo de configuração (sem chaves reais)
```

O `pipeline/` fica separado da interface. Assim, dá para trocar o Streamlit por FastAPI + Next.js no futuro sem reescrever a lógica.

## Roadmap

### Fase 0: testes de risco

Antes de qualquer interface, validar com scripts as partes que podem inviabilizar o projeto.

#### Teste 1: transcrição e vícios de linguagem: 🟢 risco entendido

Detalhes em [experimentos/01-whisper/GUIA.md](experimentos/01-whisper/GUIA.md).

- [x] Transcrever gravações com e sem um `initial_prompt` cheio de hesitações.
- [x] **Decisão:** a transcrição oficial é feita **sem** o prompt. Ele recupera os "éé", mas faz o Whisper pular e distorcer frases inteiras.
- [ ] Gravar no cenário real (pesquisar 5 minutos e explicar) e comparar com a contagem manual de vícios.
- [ ] Definir a métrica de vícios: prompt mais leve, pausas pelo tempo das palavras, ou métrica aproximada.

#### Teste 2: tema e referência: 🟢 funcionando

Detalhes em [experimentos/02-tema-e-referencia/GUIA.md](experimentos/02-tema-e-referencia/GUIA.md).

- [x] Sorteio: o código sorteia a área, o LLM propõe 20 candidatos, e o código embaralha e aplica os filtros de forma.
- [x] Temas brasileiros ou do mundo todo, à escolha do usuário (`--origem`).
- [x] Filtro de significado: o LLM lê o artigo e confere se ele responde à pergunta. Nos testes, 2 de 3 perguntas pediam algo que o artigo não cobria.
- [x] Rubrica com 3 a 5 ideias, cada uma com a citação do artigo conferida no código.
- [x] Primeira iteração de prompt: pontos que explicam algo, em vez de listas de fatos e medidas.
- [ ] Rodar umas 5 vezes com o prompt atual e revisar as rubricas.

#### Teste 3: avaliação: 🔴 próximo passo

O LLM avaliador concorda com a avaliação humana?

- [ ] Escolher 2 referências.
- [ ] Cada integrante pesquisa por 5 minutos e grava uma explicação de 2 minutos.
- [ ] Cada integrante avalia à mão as duas gravações, **antes** de ver a avaliação do LLM.
- [ ] Experimento 03: o LLM recebe transcrição, rubrica e referência e devolve uma avaliação com evidências.
- [ ] Comparar as avaliações: humano × humano e humano × LLM.

### V1: MVP

**Entra:**
- um único modo (Learn & Explain);
- sorteio do tema, com referência e rubrica ocultas;
- timer de pesquisa;
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
| **Geração** | Sorteio do tema, referência e rubrica com base na Wikipedia, follow-ups | _a definir_ |
| **Avaliação** | Transcrição, métricas de fala, análise de conteúdo, evals | _a definir_ |

Cada frente faz a parte da interface que corresponde ao que construiu. Na metade do V1, vale trocar de frente por um tempo, para os dois conhecerem o pipeline inteiro.

### Convenções

- **Formatos primeiro.** Os formatos em `pipeline/schemas.py` são definidos em conjunto, antes do código. Depois disso, cada frente trabalha em paralelo.
- **Prompts são código.** Ficam em `prompts/` e só mudam via pull request revisado pelo outro integrante.
- **Chaves de API só no `.env`.** Nunca no git. O `.env.example` mostra quais variáveis existem.
- **Gravações de áudio ficam fora do git.** Versionamos as transcrições e as avaliações; os áudios são compartilhados por outro meio.

## Configuração do ambiente (Fase 0)

### 1. Python

Use Python 3.12 ou mais novo. O projeto já foi testado com o 3.14.

O ambiente virtual fica em `.venv`, na raiz do projeto. Ela está no `.gitignore`, então não vai para o GitHub.

Windows (Git Bash):

```bash
py -m venv .venv
source .venv/Scripts/activate
```

macOS / Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Bibliotecas

Com o ambiente ativado, na raiz do projeto:

```bash
pip install -r requirements.txt
```

O passo a passo para aprender a usar o Whisper e fazer o Teste 1 está em [experimentos/01-whisper/GUIA.md](experimentos/01-whisper/GUIA.md).

Para rodar na GPU (NVIDIA), o faster-whisper precisa das bibliotecas CUDA (cuBLAS e cuDNN). Se configurar isso der trabalho, comece na CPU com o modelo `small` ou `medium`: para os testes de risco, é suficiente.

### 3. LLM

Por enquanto usamos um LLM na nuvem, pelo plano grátis do [Groq](https://console.groq.com) ou do [Gemini](https://aistudio.google.com):

1. Crie uma chave no site do fornecedor.
2. Copie o `.env.example` para `.env`.
3. Coloque a chave no `.env`.

Cada integrante usa a própria chave: os limites do plano grátis são por conta.

O passo a passo está em [experimentos/02-tema-e-referencia/GUIA.md](experimentos/02-tema-e-referencia/GUIA.md).

**Limites do plano grátis do Groq para o `gpt-oss-120b`:**
- 30 requisições por minuto;
- 1.000 requisições por dia;
- **8.000 tokens por minuto**;
- 200.000 tokens por dia.

Os tokens por minuto são o gargalo. Uma rodada do passo 4 gasta cerca de 10 mil tokens, então a segunda chamada costuma esperar alguns segundos (erro 429), e o script tenta de novo sozinho. Os limites atualizados ficam em [console.groq.com/settings/limits](https://console.groq.com/settings/limits).

### 4. (Opcional) Ollama, para rodar o LLM localmente

Instale pelo site [ollama.com](https://ollama.com) e baixe um modelo de 7 a 9B, por exemplo:

```bash
ollama pull qwen3:8b
```

Um modelo nessa faixa cabe em uma GPU de 8 GB. Modelos maiores rodam dividindo a carga com a RAM, só que mais devagar.

No `.env`, use `LLM_BASE_URL=http://localhost:11434/v1`, qualquer valor em `LLM_API_KEY` e o nome do modelo em `LLM_MODEL`.

## Riscos conhecidos

| Risco | Mitigação | Situação |
|---|---|---|
| O Whisper apaga hesitações ("é...", "hum") | `initial_prompt` com hesitações | **Testado:** recupera os "éé", mas faz perder e distorcer conteúdo. Descartado como transcrição oficial; a métrica de vícios segue em aberto |
| "é", "um", "então", "tipo" também são palavras normais | Desambiguar pelo contexto; métrica aproximada | "hum" transcrito como "um" fica igual ao artigo; a contagem não inclui "um" |
| A pergunta do LLM tem premissa inventada ou pede algo que o artigo não cobre | O LLM lê o artigo e descarta ou reescreve a pergunta antes da rubrica | **Testado:** aconteceu em 2 de 3 casos, e o filtro pegou |
| A busca leva a um artigo de outro assunto ("Casa do Povo" → "Parque do Povo") | O mesmo filtro de significado | **Testado:** os filtros de forma não pegam; o de significado pega |
| A rubrica lista detalhes (medidas, datas) em vez de ideias | Prompt: cada ponto explica uma causa, um mecanismo, uma consequência ou uma importância | **Melhorou** após iteração de prompt |
| A paráfrase da rubrica distorce a citação (citação certa, ideia errada) | Revisão humana das rubricas; evals | **Em aberto:** a verificação em código só pega citação inventada |
| Referência com erro faz o avaliador "corrigir" o que o usuário disse certo | Referência a partir de um artigo real; mostrar a fonte de cada correção | |
| O usuário pesquisa em fontes diferentes da referência | Rubrica só com o essencial; pontos corretos fora dela não são penalizados | |
| LLMs repetem os mesmos temas quando se pede algo "aleatório" | Sorteio no código; LLM só propõe e filtra | Ainda puxa para temas populares (ex.: buracos negros) |
| Modelos que raciocinam esgotam o limite de saída antes de terminar o JSON | `max_completion_tokens=8000` | **Corrigido** |
| Limites do plano grátis (8 mil tokens/minuto) | Repetições automáticas no erro 429; artigo limitado a 8.000 caracteres; uma chave por pessoa | Causa pausas, não falhas |
| Notas do LLM variam entre execuções | Checklists com evidência em vez de porcentagens | A medir no Teste 3 |
| Espera de 5 a 15 s por rodada de follow-up | Aceitável no V2; streaming para melhorar a percepção | |

## Decisões tomadas

| Data | Decisão | Por quê |
|---|---|---|
| 01/10/2026 | Nome: PROSA | Plataforma de Raciocínio, Oratória, Síntese e Argumentação |
| 01/10/2026 | Projeto de estudo, sem objetivo comercial | O foco é aprender engenharia de LLM |
| 01/10/2026 | Python + Streamlit no V1, com o `pipeline/` separado da interface | Uma linguagem só; foco nas partes de LLM |
| 01/10/2026 | Começar pelos testes de risco, sem interface | Descobrir cedo o que pode inviabilizar o projeto |
| 01/10/2026 | Ambiente virtual em `.venv` e comandos em Git Bash | Preferência da equipe |
| 02/10/2026 | Transcrição oficial sem `initial_prompt` | Teste 1: o prompt faz o Whisper perder conteúdo |
| 02/10/2026 | O usuário pesquisa por conta própria; a IA só gera referência e rubrica ocultas | Mais realista, e o usuário não aprende com texto alucinado |
| 02/10/2026 | O desafio pede os pontos principais em até 2 minutos; rubrica com 3 a 5 ideias | Treina síntese e torna a avaliação mais confiável |
| 02/10/2026 | Sorteio: o código sorteia, o LLM propõe, o código filtra a forma, o LLM confere o significado | LLMs são ruins em aleatoriedade; filtros de forma não bastam |
| 02/10/2026 | Origem dos temas à escolha do usuário (`brasil` ou `mundo`) | O prompt em português puxava tudo para temas brasileiros |
| 02/10/2026 | LLM pelo plano grátis do Groq (`gpt-oss-120b`), sem instalar Ollama | Começar sem baixar 5 GB; o código continua independente de fornecedor |

## Equipe

- _a definir_
- _a definir_

## Licença

A definir.
