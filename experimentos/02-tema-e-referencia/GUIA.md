# Experimento 02: sorteio de tema e referência

Este experimento tem dois objetivos:

1. aprender a chamar um LLM por API, com saída estruturada (JSON);
2. responder à primeira metade do **Teste 2 da Fase 0**: *o sorteio gera temas bons, variados e com um artigo de referência?*

E também à segunda metade, no passo 4: *o LLM monta uma referência e uma rubrica fiéis ao artigo?*

---

## 1. Conceitos (leitura de 10 minutos)

### API

Uma API é um "endereço" que um programa chama para pedir algo a outro programa. A conversa acontece por HTTP, o mesmo protocolo das páginas web, e a resposta costuma vir em JSON.

Neste experimento vocês usam duas:
- a **API da Wikipedia**, que é aberta e não pede chave;
- a **API de um LLM**, que pede uma chave para identificar quem está usando.

### Chamar um LLM

Uma chamada a um LLM recebe uma **lista de mensagens**, e cada mensagem tem um papel:

| Papel | Para quê |
|---|---|
| `system` | Instruções gerais: como o modelo deve se comportar |
| `user` | O pedido |
| `assistant` | Respostas anteriores do modelo, quando há conversa |

O modelo devolve a próxima mensagem do `assistant`.

O custo e os limites de uso são contados em **tokens**, que são pedaços de palavra. Em português, uma palavra dá em média um ou dois tokens.

### Saída estruturada

Texto livre é ótimo para pessoas e péssimo para programas. Para o programa usar a resposta, ela precisa vir num formato fixo.

A saída estruturada resolve isso:
1. você descreve o formato com uma classe **Pydantic**;
2. o SDK converte a classe em **JSON Schema**;
3. o fornecedor **obriga** o modelo a seguir esse schema;
4. a resposta volta como um objeto Python já validado.

```python
class Temas(BaseModel):
    temas: list[str]
```

### Por que o sorteio fica no código

Um LLM escolhe sempre os tokens mais prováveis. Por isso, ao pedir "um tema aleatório", ele tende a cair nos mesmos temas: buracos negros, fotossíntese, Revolução Francesa. Aumentar a **temperatura** dá mais variedade, mas não resolve.

A arquitetura usada aqui divide o trabalho:

```
código sorteia uma área                         ← aleatoriedade: código
  → LLM propõe 20 temas dessa área              ← criatividade: LLM
  → código embaralha e descarta os já usados    ← aleatoriedade e memória: código
  → código confere se existe um bom artigo      ← verificação: código
```

**Regra geral para o projeto inteiro:** o código cuida do que precisa ser exato ou aleatório, e o LLM cuida do que precisa de julgamento ou criatividade.

---

## 2. Configurar o fornecedor do LLM

O código usa a biblioteca `openai`, mas não depende da OpenAI. Groq, Gemini e Ollama aceitam o mesmo formato de API, então trocar de fornecedor é só mudar o `.env`.

| | **Groq** (recomendado) | **Gemini** |
|---|---|---|
| Chave | [console.groq.com/keys](https://console.groq.com/keys) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Modelos | Abertos (`openai/gpt-oss-120b`, entre outros) | Gemini Flash |
| Plano grátis | Generoso, sem cartão | Limites menores; o Google pode usar os dados para melhorar os produtos |

**Passo a passo:**

1. Crie a chave no site do fornecedor.
2. Na raiz do projeto, copie o modelo de configuração:

   ```bash
   cp .env.example .env
   ```

3. Abra o `.env` e troque `cole_sua_chave_aqui` pela sua chave.
4. Instale as bibliotecas novas (com o ambiente ativado, na raiz do projeto):

   ```bash
   pip install -r requirements.txt
   ```

5. Teste a conexão listando os modelos da sua conta:

   ```bash
   cd experimentos/02-tema-e-referencia
   python llm.py
   ```

   Se usar o Gemini, escolha um modelo dessa lista e coloque o nome em `LLM_MODEL`.

> **A chave é uma senha.** O `.env` está no `.gitignore` e nunca deve ir para o GitHub. Não colem a chave em conversas nem em código. Se ela vazar, apaguem no site do fornecedor e criem outra.

---

## 3. Passo 1: Wikipedia (sem LLM)

```bash
python passo1_wikipedia.py "Bretton Woods"
```

O script busca o termo, pega o primeiro resultado e mostra o tamanho do artigo e o começo do texto.

O código das chamadas está em `wikipedia.py`. Repare em três coisas:
- o `User-Agent`, que a Wikimedia exige para identificar o programa;
- o `redirects`, que faz "Bretton Woods" levar ao artigo "Acordos de Bretton Woods";
- a detecção de **páginas de desambiguação** ("Mercúrio pode ser: o planeta, o elemento...").

**Exercícios:**
1. Busque "Mercúrio". A busca devolve o planeta ou a página de desambiguação?
2. Busque um termo bem vago, como "energia". O primeiro resultado é o que você esperava?

---

## 4. Passo 2: primeira chamada ao LLM

```bash
python passo2_primeira_chamada.py
```

São duas chamadas:
1. **texto livre**, mostrando quantos tokens a chamada gastou;
2. **saída estruturada**, em que a resposta já chega como objeto Python (`Temas`).

**Exercícios:**
1. Mude a mensagem `system` para "Responda como um pirata" e rode de novo. O que mudou?
2. Rode a chamada estruturada três vezes. Os temas se repetem?
3. Acrescente um campo à classe `Temas`, por exemplo `dificuldade: str`, e veja o modelo preenchê-lo.

---

## 5. Passo 3: o sorteio completo

```bash
python passo3_sorteio.py
python passo3_sorteio.py --area Economia
```

O script mostra cada etapa:
1. a área sorteada;
2. os temas que o LLM propôs;
3. cada candidato testado e o motivo de ter sido descartado;
4. o desafio escolhido.

Os temas escolhidos ficam em `historico_temas.json`, que está fora do git. Nas próximas execuções, eles são evitados de duas formas:
- vão no pedido ao LLM, para ele não propô-los de novo;
- são filtrados no código, comparando o **título do artigo**. Comparar o texto da pergunta não funcionaria, porque o LLM pode escrever o mesmo tema de jeitos diferentes.

**Exercícios:**
1. Rode 5 vezes com `--area Física`. Quantos temas propostos se repetem entre as rodadas?
2. Apague o `historico_temas.json` e repita o exercício 1. A repetição aumenta?
3. Troque `temperature=1.0` por `0` e rode 3 vezes. O que acontece com a variedade?
4. Os temas são mesmo pouco conhecidos? Mude o `PROMPT_SISTEMA` e compare.

### Tabela para preencher

| Rodada | Área | O artigo bate com a pergunta? | O tema é pouco conhecido? | Repetiu tema de outra rodada? |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Para pensar

O `termo_busca` nem sempre leva ao artigo certo. No teste com um LLM falso, a pergunta "O que é Mercúrio?" levou ao artigo do planeta, mesmo estando na área de Economia.

Como o sistema poderia conferir se o artigo encontrado realmente responde à pergunta? Isso pode ser feito pelo código? Ou é trabalho para o LLM?

---

## 6. Passo 4: do sorteio à referência oculta

```bash
python passo4_referencia.py
python passo4_referencia.py --area História --origem brasil
```

O passo 3 mostrou que os filtros do código não bastam. Eles conferem a **forma** (o artigo existe? é grande?), mas não o **significado**: a pergunta sobre a "Casa do Povo" teria caído no artigo do "Parque do Povo" e passado em todos os filtros.

O passo 4 acrescenta duas etapas com LLM e uma verificação em código:

```
código sorteia a área
  → LLM propõe candidatos (brasileiros ou do mundo todo)
  → código: filtros de forma                     (rápidos e grátis)
  → LLM lê o artigo: ele responde à pergunta?   (filtro de significado)
  → LLM monta a rubrica: 3 a 5 pontos principais
  → código confere se as citações existem mesmo no artigo
```

**`--origem`** escolhe de onde vêm os temas:
- `brasil`: majoritariamente brasileiros;
- `mundo`: qualquer país, e é o padrão.

O código foi dividido em módulos reutilizáveis, que depois vão virar o `pipeline/` do projeto:
- **`sorteio.py`:** a lógica do passo 3, mais a opção de origem;
- **`referencia.py`:** o prompt e o formato da rubrica, e a verificação das citações;
- **`passo4_referencia.py`:** só junta as peças e mostra o resultado.

A referência pronta fica salva em `referencias/`. É ela que o Teste 3 (análise da explicação) vai usar.

### Técnicas de LLM que aparecem aqui

- **Três vereditos.** O LLM responde `responde`, `reescrever` ou `outro_assunto`, um tipo `Literal` no Pydantic. Ele não escreve livremente "acho que serve"; escolhe uma opção fixa que o código sabe tratar.
- **Justificativa antes do veredito.** A ordem dos campos importa: o modelo escreve o raciocínio primeiro e decide depois. Na ordem contrária, ele decide primeiro e depois inventa uma justificativa.
- **O artigo entre `<artigo>` e `</artigo>`.** Delimitadores separam claramente os dados das instruções.
- **"Use apenas o conteúdo do artigo."** Isso ancora a rubrica na fonte, em vez de deixar o modelo usar a memória.
- **Não confie, verifique.** O código confere se cada trecho citado existe mesmo no artigo. Uma citação inventada aparece marcada com ⚠.
- **Validar em código o que o schema não garante.** O schema não obriga a ter de 3 a 5 pontos, então o script confere a quantidade e avisa.

### Limites do plano grátis

Só os primeiros 8.000 caracteres do artigo vão para o LLM (`LIMITE_ARTIGO`, em `referencia.py`). O plano grátis limita os tokens por minuto, e a introdução costuma ter o essencial.

Se aparecer uma pausa longa, o fornecedor provavelmente pediu para esperar (erro 429). O script tenta de novo sozinho.

**`LengthFinishReasonError`**: a resposta foi cortada no meio por limite de tokens de saída. O `gpt-oss` é um modelo que raciocina antes de responder, e esse raciocínio gasta o mesmo limite.

Numa das rodadas, o limite padrão era de 3.072 tokens. O modelo gastou 2.474 raciocinando, e os 20 temas em JSON não couberam no que sobrou.

Por isso as chamadas passam `max_completion_tokens=8000`. Outra saída seria pedir menos raciocínio com `reasoning_effort="low"`, mas nem todo modelo aceita esse parâmetro.

### O que observamos no teste

Rodamos com `--area Física` e saiu "Qual é o princípio físico por trás da radiação de Hawking?". As 5 citações foram verificadas, mas o teste ensinou duas coisas:

1. **Citação verificada não garante ideia correta.** O ponto 5 dizia que "a gravidade pode ser tratada de forma quântica". O trecho citado diz outra coisa: longe do buraco negro, a gravidade é fraca o bastante para fazer os cálculos da teoria quântica de campos num espaço-tempo curvo. A citação existia, mas a paráfrase distorceu o sentido. A verificação em código pega citação **inventada**, mas não pega citação **mal interpretada**. Isso só a revisão humana pega.
2. **O LLM voltou aos temas favoritos dele.** Buracos negros não são exatamente "pouco conhecidos". Mesmo com o sorteio no código, o prompt ainda puxa para os temas populares.

### Iteração de prompt: um exemplo real

As três primeiras referências de vocês mostraram dois problemas:
- a rubrica da Bienal virou uma lista de medidas ("25 mil m²");
- a pergunta do Palomar foi reescrita para um assunto que o artigo só cita de passagem.

Ajustamos os prompts e reprocessamos os **mesmos casos**:

| Versão do prompt | Bienal (sustentabilidade) | Palomar (galáxias anãs) |
|---|---|---|
| Original | `reescrever` → rubrica com medidas | `reescrever` → "quasares", um detalhe do artigo |
| + "assunto central" e "sem números" | `reescrever` → ainda com "25 mil m²" | `reescrever` → pergunta melhor, mas pontos com fatos soltos |
| + "cada ponto explica algo" e tipos de pergunta | `outro_assunto` (descartado) | `outro_assunto` (descartado) |

Com a pergunta "Qual a importância do Observatório Palomar para a astronomia?", a versão final dá `responde`, com pontos que explicam algo. O Theatro da Paz continua `responde`.

Três lições:
1. **Uma instrução nem sempre é obedecida na primeira tentativa.** "Sem números" sozinho não bastou. O que funcionou foi dizer **o que** cada ponto deve ser: uma causa, um mecanismo, uma consequência ou uma importância.
2. **Toda mudança tem efeito colateral.** Agora o LLM descarta mais e reescreve menos. Isso é mais seguro, mas gasta mais leituras de artigo, e portanto mais cota.
3. **Testar com 2 ou 3 casos no olho não escala.** O jeito profissional é ter um conjunto fixo de casos e rodá-lo a cada mudança de prompt. É a mesma ideia das evals do Teste 3.

**Exercícios:**
1. Rode 3 vezes com `--origem brasil` e 3 com `--origem mundo`. A diferença aparece?
2. Para cada rubrica, leia o artigo e responda: os pontos são mesmo os principais? Algum é detalhe? Alguma paráfrase distorce a citação?
3. Mude o `LIMITE_ARTIGO` para 3000 e depois para 20000. A rubrica muda? O que acontece com os limites do plano grátis?
4. Force um caso de `outro_assunto`: no `passo4_referencia.py`, troque o artigo por outro qualquer antes de chamar `referencia.montar` e veja se o LLM percebe.

### Tabela para preencher

| Tema | Veredito | Pontos são os principais? | Alguma paráfrase distorce a citação? | Citações ⚠ |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

---

## Conclusões

_Escrevam aqui o que descobriram: os temas variam? Os artigos batem com as perguntas? O que mudariam no prompt?_
